import 'server-only';

import { query, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

async function requireGlobalPortalAdmin(tx: TxQuery, userId: string) {
  const rows = await tx<{ id: string }>(
    `SELECT id FROM role_grants WHERE user_id = $1 AND role = 'portal_admin'
     AND org_id IS NULL AND revoked_at IS NULL
     AND (expires_at IS NULL OR expires_at > now()) LIMIT 1 FOR SHARE`,
    [userId],
  );
  if (!rows[0]) throw new Error('Active global portal administrator grant required');
}

export async function listEligiblePortalAdmins() {
  return query<{ id: string; display_name: string; email: string }>(
    `SELECT DISTINCT u.id, u.display_name, u.email
     FROM role_grants g JOIN users u ON u.id = g.user_id
     WHERE g.role = 'portal_admin' AND g.org_id IS NULL AND g.revoked_at IS NULL
       AND (g.expires_at IS NULL OR g.expires_at > now()) AND u.disabled_at IS NULL
     ORDER BY u.display_name, u.id LIMIT 200`,
  );
}

export async function listSupportAccessGrants() {
  return query<{
    id: string; org_id: string; org_name: string; portal_admin_id: string;
    portal_admin_name: string; portal_admin_email: string; reason: string;
    granted_at: Date; expires_at: Date; revoked_at: Date | null; is_active: boolean;
  }>(
    `SELECT sa.id, sa.org_id, o.name AS org_name, sa.portal_admin_id,
            u.display_name AS portal_admin_name, u.email AS portal_admin_email,
            sa.reason, sa.granted_at, sa.expires_at, sa.revoked_at,
            (sa.revoked_at IS NULL AND sa.expires_at > now()) AS is_active
     FROM support_access sa JOIN organizations o ON o.id = sa.org_id
     JOIN users u ON u.id = sa.portal_admin_id
     WHERE sa.contribution_id IS NULL
     ORDER BY sa.granted_at DESC, sa.id DESC LIMIT 500`,
  );
}

export async function listActiveClientOrganizations() {
  return query<{ id: string; name: string }>(
    `SELECT id, name FROM organizations
     WHERE type = 'client' AND status = 'active'
     ORDER BY name, id LIMIT 500`,
  );
}

export async function grantOrganizationSupportAccess(input: {
  actorId: string; portalAdminId: string; orgId: string; reason: string; durationHours: number; requestId: string;
}) {
  return transaction(async (tx) => {
    await requireGlobalPortalAdmin(tx, input.actorId);
    const organizations = await tx<{ id: string }>(
      `SELECT id FROM organizations WHERE id = $1 AND type = 'client' AND status = 'active' FOR SHARE`,
      [input.orgId],
    );
    if (!organizations[0]) throw new Error('Active client organisation not found');
    const recipientGrant = await tx<{ id: string }>(
      `SELECT id FROM role_grants WHERE user_id = $1 AND role = 'portal_admin'
       AND org_id IS NULL AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now()) LIMIT 1 FOR SHARE`,
      [input.portalAdminId],
    );
    if (!recipientGrant[0]) throw new Error('Recipient must have an active global portal administrator grant');
    const existing = await tx<{ id: string }>(
      `SELECT id FROM support_access WHERE portal_admin_id = $1 AND org_id = $2
       AND contribution_id IS NULL AND revoked_at IS NULL AND expires_at > now()
       LIMIT 1 FOR UPDATE`,
      [input.portalAdminId, input.orgId],
    );
    if (existing[0]) throw new Error('Active support access already exists');
    const inserted = await tx<{ id: string; expires_at: Date; granted_at: Date }>(
      `INSERT INTO support_access (portal_admin_id, org_id, contribution_id, reason, expires_at)
       VALUES ($1, $2, NULL, $3, now() + ($4::int * interval '1 hour'))
       RETURNING id, expires_at, granted_at`,
      [input.portalAdminId, input.orgId, input.reason, input.durationHours],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'support_access.grant', 'support_access', $2, $3, $4, 'allowed', $5::jsonb)`,
      [input.actorId, inserted[0].id, input.orgId, input.requestId, JSON.stringify({ recipient_portal_admin_id: input.portalAdminId, reason: input.reason, expires_at: inserted[0].expires_at, duration_hours: input.durationHours })],
    );
    return { id: inserted[0].id, org_id: input.orgId, portal_admin_id: input.portalAdminId, granted_at: inserted[0].granted_at, expires_at: inserted[0].expires_at, is_active: true };
  });
}

export async function revokeOrganizationSupportAccess(input: {
  actorId: string; accessId: string; requestId: string;
}) {
  return transaction(async (tx) => {
    await requireGlobalPortalAdmin(tx, input.actorId);
    const rows = await tx<{ id: string; org_id: string; portal_admin_id: string }>(
      `UPDATE support_access SET revoked_at = now()
       WHERE id = $1 AND contribution_id IS NULL
         AND revoked_at IS NULL AND expires_at > now()
       RETURNING id, org_id, portal_admin_id`,
      [input.accessId],
    );
    const access = rows[0];
    if (!access) throw new Error('Active support access not found');
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision)
       VALUES ($1, 'support_access.revoke', 'support_access', $2, $3, $4, 'allowed', $5::jsonb)`,
      [input.actorId, access.id, access.org_id, input.requestId, JSON.stringify({ recipient_portal_admin_id: access.portal_admin_id })],
    );
    return { id: access.id, org_id: access.org_id, portal_admin_id: access.portal_admin_id, revoked: true };
  });
}
