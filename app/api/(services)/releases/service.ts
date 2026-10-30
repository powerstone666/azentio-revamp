import 'server-only';

import { query, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

export type ReleaseNote = {
  id: string;
  title: string;
  body: string;
  audience: 'employees' | 'clients';
  offering_id: string | null;
  published_at: Date;
};

async function requireAudienceMembership(userId: string, orgId: string, audience: ReleaseNote['audience']) {
  const rows = await query<{ id: string }>(
    `SELECT m.id FROM memberships m
     JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active' AND o.status = 'active'
       AND (($3 = 'employees' AND m.role = 'employee' AND o.type = 'azentio')
         OR ($3 = 'clients' AND m.role IN ('client_member', 'client_admin') AND o.type = 'client'))
     LIMIT 1`,
    [userId, orgId, audience],
  );
  if (!rows[0]) throw new Error('Active audience membership required');
}

export async function listEmployeeReleaseNotes(userId: string, orgId: string) {
  await requireAudienceMembership(userId, orgId, 'employees');
  return query<ReleaseNote>(
    `SELECT id, title, body, audience, offering_id, published_at
     FROM release_notes
     WHERE audience = 'employees' AND status = 'published'
       AND org_id IS NULL
     ORDER BY published_at DESC, id DESC
     LIMIT 100`,
  );
}

export async function listClientReleaseNotes(userId: string, orgId: string) {
  await requireAudienceMembership(userId, orgId, 'clients');
  return query<ReleaseNote>(
    `SELECT r.id, r.title, r.body, r.audience, r.offering_id, r.published_at
     FROM release_notes r
     WHERE r.audience = 'clients' AND r.status = 'published'
       AND (r.org_id IS NULL OR r.org_id = $1)
       AND (r.offering_id IS NULL OR EXISTS (
         SELECT 1 FROM entitlements e
         WHERE e.org_id = $1 AND e.offering_id = r.offering_id
           AND e.status = 'active' AND e.valid_from <= now()
           AND (e.valid_to IS NULL OR e.valid_to > now())
       ))
     ORDER BY r.published_at DESC, r.id DESC
     LIMIT 100`,
    [orgId],
  );
}

export async function listManageableReleaseNotes(userId: string, activeOrgId: string) {
  return query(
    `SELECT r.id, r.title, r.body, r.audience, r.offering_id, r.org_id,
            o.name AS org_name, r.status, r.published_at, r.updated_at
     FROM release_notes r
     LEFT JOIN organizations o ON o.id = r.org_id
     WHERE EXISTS (
       SELECT 1 FROM role_grants g
       WHERE g.user_id = $1 AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())
         AND (g.org_id = $2 OR g.org_id IS NULL)
         AND (
           (g.role = 'content_publisher' AND (g.offering_id IS NULL OR g.offering_id = r.offering_id))
           OR (g.role = 'product_owner' AND r.offering_id IS NOT NULL AND g.offering_id = r.offering_id)
         )
     )
       AND (
         r.org_id IS NULL OR EXISTS (
           SELECT 1 FROM role_grants publisher
           WHERE publisher.user_id = $1 AND publisher.role = 'content_publisher'
             AND publisher.revoked_at IS NULL
             AND (publisher.expires_at IS NULL OR publisher.expires_at > now())
             AND (publisher.org_id = $2 OR publisher.org_id IS NULL)
         )
       )
     ORDER BY CASE r.status WHEN 'draft' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
              r.updated_at DESC, r.id DESC
     LIMIT 200`, [userId, activeOrgId],
  );
}

export type ReleaseNoteScope = {
  id: string;
  audience: 'employees' | 'clients';
  org_id: string | null;
  offering_id: string | null;
  status: 'draft' | 'published' | 'archived';
};

export async function getReleaseNoteScope(id: string) {
  return query<ReleaseNoteScope>(
    `SELECT id, audience, org_id, offering_id, status FROM release_notes WHERE id = $1`,
    [id],
  ).then((rows) => rows[0] ?? null);
}

async function requireReleaseManager(
  tx: TxQuery,
  userId: string,
  activeOrgId: string,
  offeringId: string | null,
  targetOrgId: string | null,
) {
  const workspace = await tx<{ id: string }>(
    `SELECT id FROM organizations WHERE id = $1 AND type = 'azentio' AND status = 'active' FOR SHARE`,
    [activeOrgId],
  );
  if (!workspace[0]) throw new Error('An active Azentio workspace is required to manage release notes');
  const rows = await tx<{ id: string }>(
    `SELECT id FROM role_grants
     WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
       AND (
         (role = 'content_publisher' AND (org_id = $2 OR org_id IS NULL))
         OR (role = 'product_owner' AND $3::text IS NOT NULL AND offering_id = $3
             AND (org_id = $2 OR org_id IS NULL) AND $4::uuid IS NULL)
       )
     ORDER BY (org_id IS NULL), id LIMIT 1 FOR SHARE`,
    [userId, activeOrgId, offeringId, targetOrgId],
  );
  if (!rows[0]) throw new Error('Release-note publishing grant is no longer active');
}

async function validateAudienceTarget(tx: TxQuery, audience: 'employees' | 'clients', orgId: string | null) {
  if (audience === 'employees' && orgId) throw new Error('Employee release notes cannot target a client organization');
  if (audience === 'clients' && orgId) {
    const org = await tx<{ id: string }>(
      `SELECT id FROM organizations WHERE id = $1 AND type = 'client' AND status = 'active' FOR SHARE`,
      [orgId],
    );
    if (!org[0]) throw new Error('Active client organization not found');
  }
}

export async function createReleaseNote(input: {
  actorId: string; activeOrgId: string; requestId: string; title: string; body: string;
  audience: 'employees' | 'clients'; offeringId: string | null; orgId: string | null;
}) {
  return transaction(async (tx) => {
    await requireReleaseManager(tx, input.actorId, input.activeOrgId, input.offeringId, input.orgId);
    await validateAudienceTarget(tx, input.audience, input.orgId);
    const rows = await tx<ReleaseNote>(
      `INSERT INTO release_notes (title, body, audience, offering_id, org_id, status, author_user_id)
       VALUES ($1, $2, $3, $4, $5, 'draft', $6)
       RETURNING id, title, body, audience, offering_id, published_at`,
      [input.title, input.body, input.audience, input.offeringId, input.orgId, input.actorId],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'release_note.create', 'release_note', $2, $3, $4, 'allowed', $5::jsonb)`,
      [input.actorId, rows[0].id, input.activeOrgId, input.requestId, JSON.stringify({ audience: input.audience, offering_id: input.offeringId, org_id: input.orgId })],
    );
    return rows[0];
  });
}

export async function updateReleaseNoteDraft(input: {
  id: string; actorId: string; activeOrgId: string; requestId: string; title: string; body: string;
  offeringId: string | null; orgId?: string | null;
}) {
  return transaction(async (tx) => {
    const targetOrgId = input.orgId ?? null;
    await requireReleaseManager(tx, input.actorId, input.activeOrgId, input.offeringId, targetOrgId);
    const rows = await tx<ReleaseNote>(
      `UPDATE release_notes SET title = $2, body = $3, updated_at = now()
       WHERE id = $1 AND status = 'draft' AND offering_id IS NOT DISTINCT FROM $4
         AND org_id IS NOT DISTINCT FROM $5
       RETURNING id, title, body, audience, offering_id, published_at`,
      [input.id, input.title, input.body, input.offeringId, targetOrgId],
    );
    if (!rows[0]) throw new Error('Draft release note not found or offering scope changed');
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision)
       VALUES ($1, 'release_note.update', 'release_note', $2, $3, $4, 'allowed')`,
      [input.actorId, input.id, input.activeOrgId, input.requestId],
    );
    return rows[0];
  });
}

export async function publishReleaseNote(input: {
  id: string; actorId: string; activeOrgId: string; requestId: string; offeringId: string | null; orgId?: string | null;
}) {
  return transitionReleaseNote(input, 'published', 'release_note.publish');
}

export async function archiveReleaseNote(input: {
  id: string; actorId: string; activeOrgId: string; requestId: string; offeringId: string | null; orgId?: string | null;
}) {
  return transitionReleaseNote(input, 'archived', 'release_note.archive');
}

async function transitionReleaseNote(input: {
  id: string; actorId: string; activeOrgId: string; requestId: string; offeringId: string | null; orgId?: string | null;
}, nextStatus: 'published' | 'archived', action: string) {
  return transaction(async (tx) => {
    const targetOrgId = input.orgId ?? null;
    await requireReleaseManager(tx, input.actorId, input.activeOrgId, input.offeringId, targetOrgId);
    const allowedFrom = nextStatus === 'published' ? ['draft'] : ['draft', 'published'];
    const existing = await tx<{ audience: 'employees' | 'clients'; org_id: string | null }>(
      `SELECT audience, org_id FROM release_notes
       WHERE id = $1 AND offering_id IS NOT DISTINCT FROM $2
         AND org_id IS NOT DISTINCT FROM $4 AND status = ANY($3::text[])
       FOR UPDATE`,
      [input.id, input.offeringId, allowedFrom, targetOrgId],
    );
    const note = existing[0];
    if (!note) throw new Error('Release-note state transition is not allowed');
    if (nextStatus === 'published' && note.audience === 'clients' && note.org_id) {
      const target = await tx<{ id: string }>(
        `SELECT id FROM organizations WHERE id = $1 AND type = 'client' AND status = 'active' FOR SHARE`,
        [note.org_id],
      );
      if (!target[0]) throw new Error('Release-note target organisation is not active');
    }
    const rows = await tx<ReleaseNote>(
      `UPDATE release_notes
       SET status = $2, published_at = CASE WHEN $2 = 'published' THEN now() ELSE published_at END,
           updated_at = now()
       WHERE id = $1 AND offering_id IS NOT DISTINCT FROM $3
         AND org_id IS NOT DISTINCT FROM $5 AND status = ANY($4::text[])
       RETURNING id, title, body, audience, offering_id, published_at`,
      [input.id, nextStatus, input.offeringId, allowedFrom, targetOrgId],
    );
    if (!rows[0]) throw new Error('Release-note state transition is not allowed');
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision)
       VALUES ($1, $2, 'release_note', $3, $4, $5, 'allowed')`,
      [input.actorId, action, input.id, input.activeOrgId, input.requestId],
    );
    return rows[0];
  });
}
