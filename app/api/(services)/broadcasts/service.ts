import 'server-only';

import { query, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

function assertSecureBroadcastUrl(value: string | null) {
  if (!value) return;
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    throw new Error('Broadcast links must be valid HTTPS URLs');
  }
  if (url.protocol !== 'https:' || url.username || url.password) {
    throw new Error('Broadcast links must use HTTPS and cannot contain URL credentials');
  }
}
type BroadcastStatus = 'scheduled' | 'live' | 'recorded' | 'cancelled';

async function requirePublisher(tx: TxQuery, userId: string, orgId: string) {
  const membership = await tx<{ id: string }>(
    `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2
       AND m.status = 'active' AND o.status = 'active'
       AND ((m.role = 'employee' AND o.type = 'azentio') OR o.is_sandbox = true)
     FOR SHARE OF m`, [userId, orgId],
  );
  if (!membership[0]) throw new Error('Active employee membership required');
  const grant = await tx<{ id: string }>(
    `SELECT id FROM role_grants WHERE user_id = $1 AND role = 'content_publisher'
       AND (org_id = $2 OR org_id IS NULL) AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY (org_id IS NULL), id LIMIT 1 FOR SHARE`,
    [userId, orgId],
  );
  if (!grant[0]) throw new Error('Active content publisher grant required');
}

export async function listEmployeeBroadcasts(orgId: string) {
  return query(
    `SELECT b.id, b.title, b.description, b.starts_at, b.ends_at, b.status,
            u.display_name AS host
     FROM broadcast_sessions b
     JOIN users u ON u.id = b.host_user_id
     WHERE b.org_id = $1 AND b.audience = 'employees' AND b.status <> 'cancelled'
     ORDER BY b.starts_at DESC, b.id
     LIMIT 100`,
    [orgId],
  );
}

export async function listClientBroadcasts(orgId: string) {
  return query(
    `SELECT b.id, b.title, b.description, b.starts_at, b.ends_at, b.status,
            u.display_name AS host, b.org_id AS publisher_org_id
     FROM broadcast_sessions b
     JOIN users u ON u.id = b.host_user_id
     JOIN organizations o ON o.id = $1 AND o.type = 'client' AND o.status = 'active'
     LEFT JOIN broadcast_session_invited_orgs i ON i.broadcast_id = b.id AND i.org_id = $1 AND i.revoked_at IS NULL
     WHERE o.type = 'client' AND o.status = 'active'
       AND b.audience = 'clients' AND b.status IN ('scheduled', 'live', 'recorded')
       AND (i.org_id = $1 OR (o.is_sandbox = true AND b.org_id = $1))
       AND b.starts_at BETWEEN now() - interval '180 days' AND now() + interval '180 days'
     ORDER BY b.starts_at DESC, b.id
     LIMIT 100`, [orgId],
  );
}

export async function getClientBroadcastTarget(orgId: string, id: string, kind: 'join' | 'recording') {
  const rows = await query<{ join_url: string | null; recording_url: string | null; status: BroadcastStatus }>(
    `SELECT b.join_url, b.recording_url, b.status FROM broadcast_sessions b
     JOIN organizations o ON o.id = $2 AND o.type = 'client' AND o.status = 'active'
     LEFT JOIN broadcast_session_invited_orgs i ON i.broadcast_id = b.id AND i.org_id = $2 AND i.revoked_at IS NULL
     WHERE b.id = $1 AND o.type = 'client' AND o.status = 'active'
       AND (i.org_id = $2 OR (o.is_sandbox = true AND b.org_id = $2))
       AND b.audience = 'clients' AND b.status <> 'cancelled'`, [id, orgId],
  );
  const session = rows[0];
  if (kind === 'join' && session?.status === 'live') return session.join_url;
  if (kind === 'recording' && session?.status === 'recorded') return session.recording_url;
  return null;
}

export async function getEmployeeBroadcastTarget(orgId: string, id: string, kind: 'join' | 'recording') {
  const rows = await query<{ join_url: string | null; recording_url: string | null; status: BroadcastStatus }>(
    `SELECT join_url, recording_url, status FROM broadcast_sessions
     WHERE id = $1 AND org_id = $2 AND audience = 'employees' AND status <> 'cancelled'`,
    [id, orgId],
  );
  const session = rows[0];
  if (!session) return null;
  if (kind === 'join' && session.status === 'live') return session.join_url;
  if (kind === 'recording' && session.status === 'recorded') return session.recording_url;
  return null;
}

export async function listClientOrganizationsForPublisher(userId: string, publisherOrgId: string) {
  await transaction(async (tx) => requirePublisher(tx, userId, publisherOrgId));
  return query<{ id: string; name: string }>(
    `SELECT id, name FROM organizations WHERE type = 'client' AND status = 'active'
     ORDER BY name, id LIMIT 500`,
  );
}

export async function listManagedBroadcasts(orgId: string) {
  return query<{ id: string; title: string; status: BroadcastStatus; audience: 'employees' | 'clients'; invited_org_ids: string[] }>(
    `SELECT b.id, b.title, b.status, b.audience,
            COALESCE(array_agg(i.org_id) FILTER (WHERE i.revoked_at IS NULL), ARRAY[]::uuid[]) AS invited_org_ids
     FROM broadcast_sessions b
     LEFT JOIN broadcast_session_invited_orgs i ON i.broadcast_id = b.id
     WHERE b.org_id = $1
     GROUP BY b.id
     ORDER BY b.starts_at DESC, b.id DESC
     LIMIT 100`, [orgId],
  );
}

export async function createBroadcast(input: {
  userId: string; orgId: string; requestId: string; title: string; description: string;
  startsAt: string; endsAt: string | null; joinUrl: string | null; recordingUrl: string | null;
  audience?: 'employees' | 'clients'; invitedOrgIds?: string[];
}) {
  assertSecureBroadcastUrl(input.joinUrl);
  assertSecureBroadcastUrl(input.recordingUrl);
  return transaction(async (tx) => {
    await requirePublisher(tx, input.userId, input.orgId);
    const workspace = await tx<{ is_sandbox: boolean }>('SELECT is_sandbox FROM organizations WHERE id = $1 AND status = \'active\'', [input.orgId]);
    const isSandbox = workspace[0]?.is_sandbox === true;
    const audience = input.audience ?? 'employees';
    const invitedOrgIds = [...new Set(input.invitedOrgIds ?? [])];
    if (isSandbox && invitedOrgIds.length > 0) throw new Error('Demo sessions cannot invite external workspaces');
    if (audience === 'employees' && invitedOrgIds.length > 0) throw new Error('Employee sessions cannot have client workspace invitations');
    if (audience === 'clients' && invitedOrgIds.length === 0 && !isSandbox) throw new Error('Invite at least one client workspace');
    if (invitedOrgIds.length > 0) {
      const targets = await tx<{ id: string }>(
        `SELECT id FROM organizations WHERE id = ANY($1::uuid[]) AND type = 'client' AND status = 'active' FOR SHARE`,
        [invitedOrgIds],
      );
      if (targets.length !== invitedOrgIds.length) throw new Error('One or more invited client workspaces are unavailable');
    }
    const rows = await tx<{ id: string }>(
      `INSERT INTO broadcast_sessions
         (org_id, title, description, host_user_id, starts_at, ends_at, audience, status, join_url, recording_url, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7, 'scheduled', $8, $9, $4)
       RETURNING id`,
      [input.orgId, input.title, input.description, input.userId, input.startsAt, input.endsAt, audience, input.joinUrl, input.recordingUrl],
    );
    for (const invitedOrgId of invitedOrgIds) {
      await tx(
        `INSERT INTO broadcast_session_invited_orgs (broadcast_id, org_id, invited_by)
         VALUES ($1, $2, $3)`, [rows[0].id, invitedOrgId, input.userId],
      );
      await notifyClientWorkspace(tx, invitedOrgId, rows[0].id, input.title);
    }
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision)
       VALUES ($1, 'broadcast.create', 'broadcast_session', $2, $3, $4, 'allowed')`,
      [input.userId, rows[0].id, input.orgId, input.requestId],
    );
    if (audience === 'clients') await auditInvitations(tx, input.userId, input.orgId, rows[0].id, input.requestId, invitedOrgIds);
    return rows[0];
  });
}

async function auditInvitations(tx: TxQuery, userId: string, orgId: string, broadcastId: string, requestId: string, invitedOrgIds: string[]) {
  await tx(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
     VALUES ($1, 'broadcast.invitations_update', 'broadcast_session', $2, $3, $4, 'allowed', $5::jsonb)`,
    [userId, broadcastId, orgId, requestId, JSON.stringify({ invited_org_count: invitedOrgIds.length })],
  );
}

async function notifyClientWorkspace(tx: TxQuery, orgId: string, broadcastId: string, title: string) {
  await tx(
    `INSERT INTO notifications (recipient_user_id, event, safe_payload)
     SELECT m.user_id, 'broadcast.invited', $2::jsonb
     FROM memberships m
     JOIN organizations o ON o.id = m.org_id AND o.type = 'client' AND o.status = 'active'
     WHERE m.org_id = $1 AND m.status = 'active' AND m.role IN ('client_member', 'client_admin')`,
    [orgId, JSON.stringify({ broadcast_session_id: broadcastId, title })],
  );
}

export async function updateBroadcastInvitations(input: {
  userId: string; publisherOrgId: string; broadcastId: string; invitedOrgIds: string[]; requestId: string;
}) {
  return transaction(async (tx) => {
    await requirePublisher(tx, input.userId, input.publisherOrgId);
    const workspace = await tx<{ is_sandbox: boolean }>('SELECT is_sandbox FROM organizations WHERE id = $1', [input.publisherOrgId]);
    if (workspace[0]?.is_sandbox) throw new Error('Demo sessions cannot invite external workspaces');
    const session = await tx<{ id: string; audience: string; status: BroadcastStatus }>(
      `SELECT id, audience, status FROM broadcast_sessions WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [input.broadcastId, input.publisherOrgId],
    );
    if (!session[0] || session[0].audience !== 'clients' || ['recorded', 'cancelled'].includes(session[0].status)) {
      throw new Error('Active client webinar not found');
    }
    const invitedOrgIds = [...new Set(input.invitedOrgIds)];
    if (invitedOrgIds.length === 0) throw new Error('Invite at least one client workspace');
    const targets = await tx<{ id: string }>(
      `SELECT id FROM organizations WHERE id = ANY($1::uuid[]) AND type = 'client' AND status = 'active' FOR SHARE`,
      [invitedOrgIds],
    );
    if (targets.length !== invitedOrgIds.length) throw new Error('One or more invited client workspaces are unavailable');
    const currentInvites = await tx<{ org_id: string }>(
      'SELECT org_id FROM broadcast_session_invited_orgs WHERE broadcast_id = $1 AND revoked_at IS NULL FOR UPDATE',
      [input.broadcastId],
    );
    const currentIds = new Set(currentInvites.map((row) => row.org_id));
    const titleRows = await tx<{ title: string }>('SELECT title FROM broadcast_sessions WHERE id = $1', [input.broadcastId]);
    await tx(
      `UPDATE broadcast_session_invited_orgs SET revoked_at = now()
       WHERE broadcast_id = $1 AND revoked_at IS NULL AND NOT (org_id = ANY($2::uuid[]))`,
      [input.broadcastId, invitedOrgIds],
    );
    for (const orgId of invitedOrgIds) {
      await tx(
        `INSERT INTO broadcast_session_invited_orgs (broadcast_id, org_id, invited_by, invited_at, revoked_at)
         VALUES ($1, $2, $3, now(), NULL)
         ON CONFLICT (broadcast_id, org_id) DO UPDATE SET invited_by = EXCLUDED.invited_by,
           invited_at = EXCLUDED.invited_at, revoked_at = NULL`,
        [input.broadcastId, orgId, input.userId],
      );
      if (!currentIds.has(orgId) && titleRows[0]) await notifyClientWorkspace(tx, orgId, input.broadcastId, titleRows[0].title);
    }
    await auditInvitations(tx, input.userId, input.publisherOrgId, input.broadcastId, input.requestId, invitedOrgIds);
    return { broadcast_id: input.broadcastId, invited_org_ids: invitedOrgIds };
  });
}

export async function updateBroadcast(input: {
  userId: string; orgId: string; requestId: string; id: string; status: BroadcastStatus;
  joinUrl: string | null; recordingUrl: string | null;
}) {
  assertSecureBroadcastUrl(input.joinUrl);
  assertSecureBroadcastUrl(input.recordingUrl);
  return transaction(async (tx) => {
    await requirePublisher(tx, input.userId, input.orgId);
    const existing = await tx<{ id: string; status: BroadcastStatus; join_url: string | null; recording_url: string | null; audience: string }>(
      `SELECT id, status, join_url, recording_url, audience FROM broadcast_sessions WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [input.id, input.orgId],
    );
    if (!existing[0]) throw new Error('Broadcast session not found');
    if (existing[0].audience === 'clients') {
      const invited = await tx<{ total: number }>(
        'SELECT count(*)::int AS total FROM broadcast_session_invited_orgs WHERE broadcast_id = $1 AND revoked_at IS NULL', [input.id],
      );
      const sandbox = await tx<{ is_sandbox: boolean }>('SELECT is_sandbox FROM organizations WHERE id = $1', [input.orgId]);
      if (!invited[0]?.total && !sandbox[0]?.is_sandbox) throw new Error('Invite at least one client workspace before opening this webinar');
    }
    const allowed: Record<BroadcastStatus, BroadcastStatus[]> = {
      scheduled: ['live', 'cancelled'], live: ['recorded', 'cancelled'], recorded: [], cancelled: [],
    };
    if (existing[0].status !== input.status && !allowed[existing[0].status].includes(input.status)) {
      throw new Error('Broadcast status transition is not allowed');
    }
    const joinUrl = input.joinUrl ?? existing[0].join_url;
    const recordingUrl = input.recordingUrl ?? existing[0].recording_url;
    if (input.status === 'live' && !joinUrl) throw new Error('A join link is required before starting a session');
    if (input.status === 'recorded' && !recordingUrl) throw new Error('A recording link is required before publishing a recording');
    const updated = await tx<{ id: string; status: BroadcastStatus }>(
      `UPDATE broadcast_sessions SET status = $1, join_url = $2, recording_url = $3, updated_at = now()
       WHERE id = $4 AND org_id = $5 RETURNING id, status`,
      [input.status, joinUrl, recordingUrl, input.id, input.orgId],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'broadcast.status_update', 'broadcast_session', $2, $3, $4, 'allowed', $5::jsonb)`,
      [input.userId, input.id, input.orgId, input.requestId, JSON.stringify({ from: existing[0].status, to: input.status })],
    );
    return updated[0];
  });
}
