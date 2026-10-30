import 'server-only';

import type { IdeaCreateInput, IdeaStatusUpdateInput } from '@/app/(common-lib)/types/schemas';
import { query, queryOne, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

export const INVALID_IDEA_EVIDENCE_ERROR = 'Every evidence reference must be an active approved shared contribution';

export class InvalidIdeaEvidenceError extends Error {
  constructor() {
    super(INVALID_IDEA_EVIDENCE_ERROR);
  }
}

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
  i.client_update, i.owner_team, i.priority, i.status, i.audience, i.created_at, i.updated_at`;
const CLIENT_IDEA_COLUMNS = `i.id, i.title, i.offering, i.client_update, i.owner_team,
  i.status, i.audience, i.created_at, i.updated_at`;

export async function listIdeas(audience: 'client' | 'internal', offerings: string[] = [], orgId?: string) {
  if (audience === 'internal' && offerings.length === 0) return [];
  if (!orgId) return [];
  const workspaceScope = `((EXISTS (SELECT 1 FROM organizations ws WHERE ws.id = $2 AND ws.is_sandbox = true) AND i.org_id = $2)
    OR (EXISTS (SELECT 1 FROM organizations ws WHERE ws.id = $2 AND ws.is_sandbox = false) AND i.org_id IS NULL))`;
  const audienceClause = audience === 'client'
    ? `i.audience = 'public' OR (i.audience = 'clients' AND EXISTS (
         SELECT 1 FROM entitlements e WHERE e.org_id = $2 AND e.offering_id = i.offering
           AND e.status = 'active' AND e.valid_from <= now() AND (e.valid_to IS NULL OR e.valid_to > now())
       ))`
    : `i.audience IN ('internal', 'clients', 'public')`;
  return query(
    `SELECT ${audience === 'client' ? CLIENT_IDEA_COLUMNS : IDEA_COLUMNS}, count(DISTINCT CASE WHEN co.id IS NOT NULL THEN s.id END)::int AS evidence_count
     FROM improvement_ideas i
     LEFT JOIN idea_evidence ie ON ie.idea_id = i.id
     LEFT JOIN shared_copies s ON s.id = ie.shared_copy_id AND s.status = 'active'
     LEFT JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND EXISTS (SELECT 1 FROM organizations evidence_org WHERE evidence_org.id = c.org_id
         AND ((i.org_id IS NULL AND evidence_org.is_sandbox = false) OR (i.org_id = c.org_id AND evidence_org.is_sandbox = true)))
     LEFT JOIN contribution_versions v ON v.id = s.source_version_id
     LEFT JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE (${audienceClause}) AND ${workspaceScope}
       AND ($1::text[] IS NULL OR i.offering = ANY($1::text[]))
     GROUP BY i.id
     ORDER BY i.updated_at DESC, i.id DESC
     LIMIT 100`,
    audience === 'internal' ? [offerings, orgId] : [null, orgId],
  );
}

export async function getIdea(ideaId: string, audience: 'client' | 'internal', offerings: string[] = [], orgId?: string) {
  if (audience === 'internal' && offerings.length === 0) return null;
  if (!orgId) return null;
  const workspaceScope = `((EXISTS (SELECT 1 FROM organizations ws WHERE ws.id = $3 AND ws.is_sandbox = true) AND i.org_id = $3)
    OR (EXISTS (SELECT 1 FROM organizations ws WHERE ws.id = $3 AND ws.is_sandbox = false) AND i.org_id IS NULL))`;
  const audienceClause = audience === 'client'
    ? `i.audience = 'public' OR (i.audience = 'clients' AND EXISTS (
         SELECT 1 FROM entitlements e WHERE e.org_id = $3 AND e.offering_id = i.offering
           AND e.status = 'active' AND e.valid_from <= now() AND (e.valid_to IS NULL OR e.valid_to > now())
       ))`
    : `i.audience IN ('internal', 'clients', 'public')`;
  return queryOne(
    `SELECT ${audience === 'client' ? CLIENT_IDEA_COLUMNS : IDEA_COLUMNS}, count(DISTINCT CASE WHEN co.id IS NOT NULL THEN s.id END)::int AS evidence_count
     FROM improvement_ideas i
     LEFT JOIN idea_evidence ie ON ie.idea_id = i.id
     LEFT JOIN shared_copies s ON s.id = ie.shared_copy_id AND s.status = 'active'
     LEFT JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND EXISTS (SELECT 1 FROM organizations evidence_org WHERE evidence_org.id = c.org_id
         AND ((i.org_id IS NULL AND evidence_org.is_sandbox = false) OR (i.org_id = c.org_id AND evidence_org.is_sandbox = true)))
     LEFT JOIN contribution_versions v ON v.id = s.source_version_id
     LEFT JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE i.id = $1 AND (${audienceClause}) AND ${workspaceScope}
       AND ($2::text[] IS NULL OR i.offering = ANY($2::text[]))
     GROUP BY i.id`,
    audience === 'internal' ? [ideaId, offerings, orgId] : [ideaId, null, orgId],
  );
}

export async function getIdeaHistory(ideaId: string) {
  return query<{ action: string; actor: string; at: Date }>(
    `SELECT h.to_status AS action, COALESCE(u.display_name, 'System') AS actor, h.created_at AS at
     FROM idea_status_history h
     LEFT JOIN users u ON u.id = h.changed_by
     WHERE h.idea_id = $1
     ORDER BY h.created_at, h.id`,
    [ideaId],
  );
}

export async function getIdeaEvidence(ideaId: string, orgId: string) {
  return query<{ id: string; title: string; observation_type: string; published_at: Date }>(
    `SELECT DISTINCT s.id,
            s.reviewed_payload->>'title' AS title,
            s.reviewed_payload->>'observation_type' AS observation_type,
            s.published_at
     FROM idea_evidence ie
     JOIN shared_copies s ON s.id = ie.shared_copy_id AND s.status = 'active' AND s.deidentified = true
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND c.visibility = 'community_proposed'
     JOIN organizations source_org ON source_org.id = c.org_id
     JOIN organizations workspace ON workspace.id = $2
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE ie.idea_id = $1
       AND ((workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $2)
         OR (workspace.is_sandbox = false AND source_org.is_sandbox = false))
     ORDER BY s.published_at DESC, s.id
     LIMIT 50`,
    [ideaId, orgId],
  );
}

export async function createIdea(input: IdeaCreateInput, actorId: string, orgId: string, requestId: string) {
  return transaction(async (tx) => {
    const membership = await tx<{ id: string; is_sandbox: boolean }>(
      `SELECT m.id, o.is_sandbox FROM memberships m JOIN organizations o ON o.id = m.org_id
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
       JOIN organizations evidence_org ON evidence_org.id = c.org_id
       JOIN contribution_versions v ON v.id = s.source_version_id
       JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
         AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
       WHERE c.id = ANY($1::uuid[]) AND c.state = 'published' AND c.withdrawn_at IS NULL
         AND c.visibility = 'community_proposed'
         AND ${membership[0].is_sandbox ? 'evidence_org.is_sandbox = true AND c.org_id = $2' : 'evidence_org.is_sandbox = false'}
       ORDER BY c.id, s.published_at DESC`,
      [input.supporting_contribution_ids, orgId],
    );
    if (evidence.length !== input.supporting_contribution_ids.length) {
      throw new InvalidIdeaEvidenceError();
    }

    const inserted = await tx<{ id: string }>(
      `INSERT INTO improvement_ideas
         (org_id, title, problem_statement, offering, proposed_outcome, client_update, owner_team, priority, status, audience)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'Proposed', $9)
       RETURNING id`,
      [membership[0].is_sandbox ? orgId : null, input.title.trim(), input.problem_statement.trim(), input.offering, input.proposed_outcome.trim(), input.client_update?.trim() ?? '', input.owner_team?.trim() ?? '', input.priority, input.audience],
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

export async function getIdeaScope(ideaId: string, orgId: string) {
  return queryOne<{ id: string; offering: string | null; audience: string; title: string }>(
    `SELECT i.id, i.offering, i.audience, i.title FROM improvement_ideas i
     WHERE i.id = $1 AND ((EXISTS (SELECT 1 FROM organizations ws WHERE ws.id = $2 AND ws.is_sandbox = true) AND i.org_id = $2)
       OR (EXISTS (SELECT 1 FROM organizations ws WHERE ws.id = $2 AND ws.is_sandbox = false) AND i.org_id IS NULL))`,
    [ideaId, orgId],
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
    const membership = await tx<{ id: string; is_sandbox: boolean }>(
      `SELECT m.id, o.is_sandbox FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active' AND o.status = 'active'
       FOR SHARE OF m`,
      [actorId, orgId],
    );
    if (!membership[0]) throw new Error('Workspace membership is no longer active');
    await requireProductOwner(tx, actorId, orgId, offering);
    const found = await tx<{ status: string; audience: string; title: string; client_update: string }>(
      `SELECT status, audience, title, client_update FROM improvement_ideas WHERE id = $1 AND offering = $2
         AND org_id IS NOT DISTINCT FROM CASE WHEN $4::boolean THEN $3::uuid ELSE NULL END FOR UPDATE`,
      [ideaId, offering, orgId, membership[0].is_sandbox],
    );
    const idea = found[0];
    if (!idea) throw new Error('Idea not found');
    const transitions: Record<string, string[]> = {
      Proposed: ['Under review', 'Not proceeding'],
      'Under review': ['Planned', 'In progress', 'Not proceeding'],
      Planned: ['In progress', 'Not proceeding'],
      'In progress': ['Released', 'Not proceeding'],
      Released: [],
      'Not proceeding': [],
    };
    const statusChanged = idea.status !== input.status;
    const clientUpdateChanged = idea.audience === 'clients'
      && input.client_update !== undefined
      && input.client_update.trim() !== idea.client_update;
    if (!transitions[idea.status]?.includes(input.status) && !(!statusChanged && clientUpdateChanged)) {
      throw new Error('This idea status transition is not allowed');
    }
    const updated = await tx<{ status: string }>(
      `UPDATE improvement_ideas SET status = $1,
         client_update = CASE WHEN audience = 'clients' AND $2::text IS NOT NULL THEN $2 ELSE client_update END,
         updated_at = now()
       WHERE id = $3 RETURNING status`,
      [input.status, input.client_update === undefined ? null : input.client_update.trim(), ideaId],
    );
    if (statusChanged) {
      await tx(
        `INSERT INTO idea_status_history (idea_id, from_status, to_status, changed_by, note)
         VALUES ($1, $2, $3, $4, $5)`,
        [ideaId, idea.status, input.status, actorId, input.status_note ?? null],
      );
    }
    if (idea.audience === 'clients' || idea.audience === 'public') {
      await tx(
        `INSERT INTO notifications (recipient_user_id, event, safe_payload)
         SELECT DISTINCT c.author_user_id, 'idea.status_updated', $2::jsonb
         FROM idea_evidence ie
         JOIN shared_copies s ON s.id = ie.shared_copy_id AND s.status = 'active'
         JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published'
         WHERE ie.idea_id = $1 AND c.withdrawn_at IS NULL`,
        [ideaId, JSON.stringify({ idea_id: ideaId, title: idea.title, status: input.status, client_update: input.client_update?.trim() || null })],
      );
    }
    await recordAudit(tx, actorId, 'idea.status_update', ideaId, orgId, requestId, {
      from_status: idea.status,
      to_status: input.status,
      client_update_changed: clientUpdateChanged,
      audience: idea.audience,
    });
    return updated[0];
  });
}
