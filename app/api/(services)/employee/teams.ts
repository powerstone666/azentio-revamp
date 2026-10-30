import 'server-only';

import type { HackathonTeamCreateInput, HackathonTeamPostInput } from '@/app/(common-lib)/types/schemas';
import { query, queryOne, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

async function requireEmployee(tx: TxQuery, userId: string, orgId: string) {
  const rows = await tx<{ id: string }>(
    `SELECT m.id FROM memberships m
     JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active' AND o.status = 'active'
       AND ((m.role = 'employee' AND o.type = 'azentio') OR (o.is_sandbox = true AND EXISTS (
         SELECT 1 FROM role_grants g WHERE g.user_id = $1 AND g.org_id = $2 AND g.role IN ('employee', 'content_publisher')
           AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())
       )))
     FOR SHARE OF m`,
    [userId, orgId],
  );
  if (!rows[0]) throw new Error('Active employee membership required');
}

export async function listHackathonTeams(userId: string, orgId: string) {
  const employee = await queryOne<{ id: string }>(
    `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active' AND o.status = 'active'
       AND ((m.role = 'employee' AND o.type = 'azentio') OR (o.is_sandbox = true AND EXISTS (
         SELECT 1 FROM role_grants g WHERE g.user_id = $1 AND g.org_id = $2 AND g.role IN ('employee', 'content_publisher')
           AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())
       )))`,
    [userId, orgId],
  );
  if (!employee) throw new Error('Active employee membership required');
  return query<{
    id: string; name: string; description: string; status: string;
    created_at: Date; creator: string; member_count: number; is_member: boolean; my_role: string | null;
  }>(
    `SELECT t.id, t.name, t.description, t.status, t.created_at,
            u.display_name AS creator, count(tm.user_id)::int AS member_count,
            bool_or(tm.user_id = $1) AS is_member,
            max(tm.role) FILTER (WHERE tm.user_id = $1) AS my_role
     FROM employee_hackathon_teams t
     JOIN users u ON u.id = t.created_by
     JOIN organizations workspace ON workspace.id = $2 AND workspace.status = 'active'
     LEFT JOIN employee_hackathon_team_members tm ON tm.team_id = t.id
     WHERE t.org_id = $2 OR (t.org_id IS NULL AND workspace.is_sandbox = false)
     GROUP BY t.id, u.display_name
     HAVING t.status = 'open' OR bool_or(tm.user_id = $1)
     ORDER BY (t.status = 'open') DESC, t.updated_at DESC, t.id DESC LIMIT 100`,
    [userId, orgId],
  );
}

export async function createHackathonTeam(
  userId: string, orgId: string, input: HackathonTeamCreateInput, requestId: string,
) {
  return transaction(async (tx) => {
    await requireEmployee(tx, userId, orgId);
    const rows = await tx<{ id: string }>(
      `INSERT INTO employee_hackathon_teams (org_id, name, description, created_by)
       VALUES (CASE WHEN (SELECT is_sandbox FROM organizations WHERE id = $1) THEN $1 ELSE NULL END, $2, $3, $4) RETURNING id`,
      [orgId, input.name, input.description, userId],
    );
    const teamId = rows[0].id;
    await tx(
      `INSERT INTO employee_hackathon_team_members (team_id, user_id, role)
       VALUES ($1, $2, 'lead')`,
      [teamId, userId],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision)
       VALUES ($1, 'employee.hackathon_team.create', 'employee_hackathon_team', $2, $3, $4, 'allowed')`,
      [userId, teamId, orgId, requestId],
    );
    return { id: teamId, name: input.name, description: input.description, status: 'open', member_count: 1, is_member: true, my_role: 'lead' };
  });
}

export async function joinHackathonTeam(teamId: string, userId: string, orgId: string, requestId: string) {
  return transaction(async (tx) => {
    await requireEmployee(tx, userId, orgId);
    const team = await tx<{ id: string }>(
      `SELECT id FROM employee_hackathon_teams WHERE id = $1 AND org_id IS NOT DISTINCT FROM
         CASE WHEN (SELECT is_sandbox FROM organizations WHERE id = $2) THEN $2::uuid ELSE NULL END
         AND status = 'open' FOR UPDATE`,
      [teamId, orgId],
    );
    if (!team[0]) throw new Error('Open team not found');
    const rows = await tx<{ user_id: string }>(
      `INSERT INTO employee_hackathon_team_members (team_id, user_id, role)
       VALUES ($1, $2, 'member') ON CONFLICT (team_id, user_id) DO NOTHING RETURNING user_id`,
      [teamId, userId],
    );
    if (rows[0]) {
      await tx('UPDATE employee_hackathon_teams SET updated_at = now() WHERE id = $1', [teamId]);
      await tx(
        `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision)
         VALUES ($1, 'employee.hackathon_team.join', 'employee_hackathon_team', $2, $3, $4, 'allowed')`,
        [userId, teamId, orgId, requestId],
      );
    }
    return { id: teamId, is_member: true };
  });
}

export async function leaveHackathonTeam(teamId: string, userId: string, orgId: string, requestId: string) {
  return transaction(async (tx) => {
    await requireEmployee(tx, userId, orgId);
    const rows = await tx<{ role: string }>(
      `SELECT tm.role FROM employee_hackathon_team_members tm
       JOIN employee_hackathon_teams t ON t.id = tm.team_id
       WHERE tm.team_id = $1 AND tm.user_id = $2 AND t.org_id IS NOT DISTINCT FROM
         CASE WHEN (SELECT is_sandbox FROM organizations WHERE id = $3) THEN $3::uuid ELSE NULL END FOR UPDATE OF tm, t`,
      [teamId, userId, orgId],
    );
    const membership = rows[0];
    if (!membership) throw new Error('Team membership not found');
    if (membership.role === 'lead') {
      const leads = await tx<{ count: number }>(
        `SELECT count(*)::int AS count FROM employee_hackathon_team_members
         WHERE team_id = $1 AND role = 'lead'`,
        [teamId],
      );
      if ((leads[0]?.count ?? 0) <= 1) {
        const nextLead = await tx<{ user_id: string }>(
          `SELECT user_id FROM employee_hackathon_team_members
           WHERE team_id = $1 AND user_id <> $2 ORDER BY joined_at, user_id LIMIT 1 FOR UPDATE`,
          [teamId, userId],
        );
        if (nextLead[0]) {
          await tx("UPDATE employee_hackathon_team_members SET role = 'lead' WHERE team_id = $1 AND user_id = $2", [teamId, nextLead[0].user_id]);
        } else {
          await tx("UPDATE employee_hackathon_teams SET status = 'closed', updated_at = now() WHERE id = $1", [teamId]);
        }
      }
    }
    await tx('DELETE FROM employee_hackathon_team_members WHERE team_id = $1 AND user_id = $2', [teamId, userId]);
    await tx('UPDATE employee_hackathon_teams SET updated_at = now() WHERE id = $1', [teamId]);
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision)
       VALUES ($1, 'employee.hackathon_team.leave', 'employee_hackathon_team', $2, $3, $4, 'allowed')`,
      [userId, teamId, orgId, requestId],
    );
    return { id: teamId, is_member: false };
  });
}

export async function listHackathonTeamPosts(teamId: string, userId: string, orgId: string) {
  const employee = await queryOne<{ id: string }>(
    `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active' AND o.status = 'active'
       AND ((m.role = 'employee' AND o.type = 'azentio') OR (o.is_sandbox = true AND EXISTS (
         SELECT 1 FROM role_grants g WHERE g.user_id = $1 AND g.org_id = $2 AND g.role IN ('employee', 'content_publisher')
           AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())
       )))`,
    [userId, orgId],
  );
  if (!employee) throw new Error('Active employee membership required');
  const member = await queryOne<{ id: string }>(
    `SELECT tm.team_id AS id FROM employee_hackathon_team_members tm
     JOIN employee_hackathon_teams t ON t.id = tm.team_id
     WHERE tm.team_id = $1 AND tm.user_id = $2 AND t.org_id IS NOT DISTINCT FROM
       CASE WHEN (SELECT is_sandbox FROM organizations WHERE id = $3) THEN $3::uuid ELSE NULL END`,
    [teamId, userId, orgId],
  );
  if (!member) throw new Error('Team membership required');
  return query<{ id: string; body: string; author: string; created_at: Date }>(
    `SELECT p.id, p.body, u.display_name AS author, p.created_at
     FROM employee_hackathon_team_posts p JOIN users u ON u.id = p.author_user_id
     JOIN employee_hackathon_teams t ON t.id = p.team_id
     WHERE p.team_id = $1 AND t.org_id IS NOT DISTINCT FROM
       CASE WHEN (SELECT is_sandbox FROM organizations WHERE id = $2) THEN $2::uuid ELSE NULL END
     ORDER BY p.created_at DESC, p.id DESC LIMIT 100`,
    [teamId, orgId],
  );
}

export async function createHackathonTeamPost(
  teamId: string, userId: string, orgId: string, input: HackathonTeamPostInput, requestId: string,
) {
  return transaction(async (tx) => {
    await requireEmployee(tx, userId, orgId);
    const member = await tx<{ team_id: string }>(
      `SELECT tm.team_id FROM employee_hackathon_team_members tm
       JOIN employee_hackathon_teams t ON t.id = tm.team_id
       WHERE tm.team_id = $1 AND tm.user_id = $2 AND t.org_id IS NOT DISTINCT FROM
         CASE WHEN (SELECT is_sandbox FROM organizations WHERE id = $3) THEN $3::uuid ELSE NULL END FOR SHARE OF tm, t`,
      [teamId, userId, orgId],
    );
    if (!member[0]) throw new Error('Team membership required');
    const rows = await tx<{ id: string; created_at: Date }>(
      `INSERT INTO employee_hackathon_team_posts (team_id, author_user_id, body)
       VALUES ($1, $2, $3) RETURNING id, created_at`,
      [teamId, userId, input.body],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision)
       VALUES ($1, 'employee.hackathon_team.post', 'employee_hackathon_team_post', $2, $3, $4, 'allowed')`,
      [userId, rows[0].id, orgId, requestId],
    );
    return { ...rows[0], body: input.body, author: 'You' };
  });
}
