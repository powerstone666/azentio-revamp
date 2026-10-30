import 'server-only';

import type { IdeaCreateInput, IdeaStatusUpdateInput } from '@/app/(common-lib)/types/schemas';
import { query, queryOne, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

async function requireProductOwner(tx: TxQuery, userId: string, orgId: string, offering: string) {
  const rows = await tx<{ allowed: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM role_grants
       WHERE user_id = $1 AND role = 'product_owner'
         AND (org_id = $2 OR org_id IS NULL)
         AND offering_id::text = $3
         AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
     ) AS allowed`,
    [userId, orgId, offering],
  );
  if (!rows[0]?.allowed) throw new Error('Product owner assignment is no longer active for this offering');
}

async function recordAudit(tx: TxQuery, actorId: string, action: string, ideaId: string, orgId: string, requestId: string, metadata: Record<string, unknown>) {
  await tx(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
     VALUES ($1, $2, 'improvement_idea', $3, $4, $5, 'allowed', $6::jsonb)`,
    [actorId, action, ideaId, orgId, requestId, JSON.stringify(metadata)],
  );
}

const IDEA_COLUMNS = `i.id, i.title, i.problem_statement, i.offering, i.proposed_outcome,
  i.owner_team, i.priority, i.status, i.audience, i.created_at, i.updated_at`;

export async function listIdeas(audience: 'client' | 'internal') {
  const audienceClause = audience === 'client'
    ? `i.audience IN ('clients', 'public')`
    : `i.audience IN ('internal', 'clients', 'public')`;
  return query(
    `SELECT ${IDEA_COLUMNS}, count(DISTINCT ie.shared_copy_id)::int AS evidence_count
     FROM improvement_ideas i
     LEFT JOIN idea_evidence ie ON ie.idea_id = i.id
     LEFT JOIN shared_copies s ON s.id = ie.shared_copy_id AND s.status = 'active'
     LEFT JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     WHERE ${audienceClause}
     GROUP BY i.id
     ORDER BY i.updated_at DESC, i.id DESC
     LIMIT 100`,
  );
}

export async function getIdea(ideaId: string, audience: 'client' | 'internal') {
  const audienceClause = audience === 'client'
    ? `i.audience IN ('clients', 'public')`
    : `i.audience IN ('internal', 'clients', 'public')`;
  return queryOne(
    `SELECT ${IDEA_COLUMNS}, count(DISTINCT ie.shared_copy_id)::int AS evidence_count
     FROM improvement_ideas i
     LEFT JOIN idea_evidence ie ON ie.idea_id = i.id
     LEFT JOIN shared_copies s ON s.id = ie.shared_copy_id AND s.status = 'active'
     LEFT JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     WHERE i.id = $1 AND ${audienceClause}
     GROUP BY i.id`,
    [ideaId],
  );
}

export async function createIdea(input: IdeaCreateInput, actorId: string, orgId: string, requestId: string) {
  return transaction(async (tx) => {
    const membership = await tx<{ id: string }>(
      `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active' AND o.status = 'active'
       FOR SHARE OF m`,
      [actorId, orgId],
    );
    if (!membership[0]) throw new Error('Workspace membership is no longer active');
    await requireProductOwner(tx, actorId, orgId, input.offering);

    const evidence = input.supporting_contribution_ids.length === 0 ? [] : await tx<{ shared_copy_id: string; contribution_id: string }>(
      `SELECT DISTINCT ON (c.id) s.id AS shared_copy_id, c.id AS contribution_id
       FROM contributions c
       JOIN shared_copies s ON s.contribution_id = c.id AND s.status = 'active'
       JOIN contribution_versions v ON v.id = s.source_version_id
       JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
         AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
       WHERE c.id = ANY($1::uuid[]) AND c.state = 'published' AND c.withdrawn_at IS NULL
         AND c.visibility = 'community_proposed'
       ORDER BY c.id, s.published_at DESC`,
      [input.supporting_contribution_ids],
    );
    if (evidence.length !== input.supporting_contribution_ids.length) {
      throw new Error('Every evidence reference must be an active approved shared contribution');
    }

    const inserted = await tx<{ id: string }>(
      `INSERT INTO improvement_ideas
         (title, problem_statement, offering, proposed_outcome, owner_team, priority, status, audience)
       VALUES ($1, $2, $3, $4, $5, $6, 'Proposed', $7)
       RETURNING id`,
      [input.title.trim(), input.problem_statement.trim(), input.offering, input.proposed_outcome.trim(), input.owner_team?.trim() ?? '', input.priority, input.audience],
    );
    const ideaId = inserted[0].id;
    for (const item of evidence) {
      await tx('INSERT INTO idea_evidence (idea_id, shared_copy_id) VALUES ($1, $2)', [ideaId, item.shared_copy_id]);
    }
    await tx(
      `INSERT INTO idea_status_history (idea_id, from_status, to_status, changed_by, note)
       VALUES ($1, NULL, 'Proposed', $2, NULL)`,
      [ideaId, actorId],
    );
    await recordAudit(tx, actorId, 'idea.create', ideaId, orgId, requestId, {
      offering: input.offering,
      audience: input.audience,
      evidence_count: evidence.length,
    });
    return { id: ideaId, status: 'Proposed' };
  });
}

export async function getIdeaScope(ideaId: string) {
  return queryOne<{ id: string; offering: string | null; audience: string; title: string }>(
    'SELECT id, offering, audience, title FROM improvement_ideas WHERE id = $1',
    [ideaId],
  );
}

export async function updateIdeaStatus(
  ideaId: string,
  actorId: string,
  orgId: string,
  offering: string,
  input: IdeaStatusUpdateInput,
  requestId: string,
) {
  return transaction(async (tx) => {
    await requireProductOwner(tx, actorId, orgId, offering);
    const found = await tx<{ status: string; audience: string; title: string }>(
      `SELECT status, audience, title FROM improvement_ideas WHERE id = $1 AND offering = $2 FOR UPDATE`,
      [ideaId, offering],
    );
    const idea = found[0];
    if (!idea) throw new Error('Idea not found');
    const updated = await tx<{ status: string }>(
      `UPDATE improvement_ideas SET status = $1, updated_at = now()
       WHERE id = $2 RETURNING status`,
      [input.status, ideaId],
    );
    await tx(
      `INSERT INTO idea_status_history (idea_id, from_status, to_status, changed_by, note)
       VALUES ($1, $2, $3, $4, $5)`,
      [ideaId, idea.status, input.status, actorId, input.status_note ?? null],
    );
    if (idea.audience === 'clients' || idea.audience === 'public') {
      await tx(
        `INSERT INTO notifications (recipient_user_id, event, safe_payload)
         SELECT DISTINCT c.author_user_id, 'idea.status_updated', $2::jsonb
         FROM idea_evidence ie
         JOIN shared_copies s ON s.id = ie.shared_copy_id AND s.status = 'active'
         JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published'
         WHERE ie.idea_id = $1 AND c.withdrawn_at IS NULL`,
        [ideaId, JSON.stringify({ idea_id: ideaId, title: idea.title, status: input.status })],
      );
    }
    await recordAudit(tx, actorId, 'idea.status_update', ideaId, orgId, requestId, {
      from_status: idea.status,
      to_status: input.status,
      audience: idea.audience,
    });
    return updated[0];
  });
}
