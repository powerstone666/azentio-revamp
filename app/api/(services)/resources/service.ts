import 'server-only';

import { query, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

async function requirePlatformAdmin(tx: TxQuery, userId: string) {
  const rows = await tx<{ id: string }>(
    `SELECT id FROM role_grants WHERE user_id = $1 AND role = 'portal_admin'
       AND org_id IS NULL AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
     LIMIT 1 FOR SHARE`, [userId],
  );
  if (!rows[0]) throw new Error('Active platform administrator grant required');
}

export async function listClientResources(orgId: string) {
  return query(
    `SELECT r.id, r.title, r.description, r.category, r.resource_url, r.offering_id, r.created_at
     FROM client_resources r
     JOIN organizations o ON o.id = r.org_id AND o.type = 'client' AND o.status = 'active'
     WHERE r.org_id = $1 AND r.status = 'active'
       AND (r.offering_id IS NULL OR EXISTS (
         SELECT 1 FROM entitlements e WHERE e.org_id = r.org_id AND e.offering_id = r.offering_id
           AND e.status = 'active' AND e.valid_from <= now() AND (e.valid_to IS NULL OR e.valid_to > now())
       ))
     ORDER BY r.category, r.created_at DESC, r.id DESC LIMIT 100`, [orgId],
  );
}

export async function listAdminClientResources(orgId: string) {
  return query(
    `SELECT id, title, description, category, resource_url, offering_id, status, created_at
     FROM client_resources WHERE org_id = $1 ORDER BY created_at DESC, id DESC LIMIT 200`, [orgId],
  );
}

export async function createClientResource(input: {
  actorId: string; orgId: string; title: string; description: string; category: string;
  resourceUrl: string; offeringId: string | null; requestId: string;
}) {
  let resourceUrl: URL;
  try {
    resourceUrl = new URL(input.resourceUrl);
  } catch {
    throw new Error('Resource link must be a valid HTTPS URL');
  }
  if (resourceUrl.protocol !== 'https:' || resourceUrl.username || resourceUrl.password) {
    throw new Error('Resource link must use HTTPS and cannot contain URL credentials');
  }
  return transaction(async (tx) => {
    await requirePlatformAdmin(tx, input.actorId);
    const org = await tx<{ id: string }>(
      `SELECT id FROM organizations WHERE id = $1 AND type = 'client' AND status = 'active' FOR SHARE`, [input.orgId],
    );
    if (!org[0]) throw new Error('Active client organization not found');
    if (input.offeringId) {
      const entitlement = await tx<{ id: string }>(
        `SELECT id FROM entitlements WHERE org_id = $1 AND offering_id = $2 AND status = 'active'
           AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now()) LIMIT 1 FOR SHARE`,
        [input.orgId, input.offeringId],
      );
      if (!entitlement[0]) throw new Error('An active offering entitlement is required');
    }
    const rows = await tx<{ id: string }>(
      `INSERT INTO client_resources (org_id, title, description, category, resource_url, offering_id, created_by)
       VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING id`,
      [input.orgId, input.title, input.description, input.category, input.resourceUrl, input.offeringId, input.actorId],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'client_resource.create', 'client_resource', $2, $3, $4, 'allowed', $5::jsonb)`,
      [input.actorId, rows[0].id, input.orgId, input.requestId, JSON.stringify({ offering_id: input.offeringId })],
    );
    return rows[0];
  });
}

export async function archiveClientResource(input: { actorId: string; orgId: string; resourceId: string; requestId: string }) {
  return transaction(async (tx) => {
    await requirePlatformAdmin(tx, input.actorId);
    const rows = await tx<{ id: string }>(
      `UPDATE client_resources SET status = 'archived', updated_at = now()
       WHERE id = $1 AND org_id = $2 AND status = 'active' RETURNING id`,
      [input.resourceId, input.orgId],
    );
    if (!rows[0]) throw new Error('Active client resource not found');
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision)
       VALUES ($1, 'client_resource.archive', 'client_resource', $2, $3, $4, 'allowed')`,
      [input.actorId, rows[0].id, input.orgId, input.requestId],
    );
    return rows[0];
  });
}
