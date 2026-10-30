import 'server-only';

import { createHash } from 'node:crypto';
import { enqueueEmail } from '@/app/api/(services)/email/outbox';
import { renderInvitationEmail } from '@/app/api/(services)/email/renderer';
import { query, queryOne, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];
type AdminRole = 'learning_moderator' | 'content_publisher' | 'product_owner' | 'portal_admin';

async function requirePlatformAdmin(tx: TxQuery, userId: string) {
  const rows = await tx<{ id: string }>(
    `SELECT id FROM role_grants
     WHERE user_id = $1 AND role = 'portal_admin' AND org_id IS NULL
       AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
     ORDER BY id LIMIT 1 FOR SHARE`,
    [userId],
  );
  if (!rows[0]) throw new Error('Active platform administrator grant required');
}

async function audit(tx: TxQuery, actorId: string, action: string, targetType: string, targetId: string, orgId: string | null, requestId: string, metadata: Record<string, unknown> = {}) {
  await tx(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, 'allowed', $7::jsonb)`,
    [actorId, action, targetType, targetId, orgId, requestId, JSON.stringify(metadata)],
  );
}

export async function getAdminOverview() {
  return queryOne<{ organizations: number; users: number; grants: number; pending_invitations: number }>(
    `SELECT (SELECT count(*)::int FROM organizations WHERE NOT is_sandbox) AS organizations,
            (SELECT count(*)::int FROM users WHERE disabled_at IS NULL AND verified_at IS NOT NULL) AS users,
            (SELECT count(*)::int FROM role_grants WHERE revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())) AS grants,
            (SELECT count(*)::int FROM invitations WHERE accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()) AS pending_invitations`,
  );
}

export async function listAdminOrganizations() {
  return query(
    `SELECT o.id, o.name, o.type, o.status, o.created_at,
            (SELECT count(*)::int FROM memberships m WHERE m.org_id = o.id AND m.status = 'active') AS active_members,
            COALESCE((SELECT json_agg(json_build_object('id', e.id, 'offering_id', e.offering_id,
               'feature', e.feature, 'valid_from', e.valid_from, 'valid_to', e.valid_to)
               ORDER BY e.offering_id, e.feature)
              FROM entitlements e WHERE e.org_id = o.id AND e.status = 'active'
                AND e.valid_from <= now() AND (e.valid_to IS NULL OR e.valid_to > now())), '[]'::json) AS entitlements
     FROM organizations o
     WHERE NOT o.is_sandbox
     ORDER BY CASE WHEN o.type = 'azentio' THEN 0 ELSE 1 END, o.name, o.id`,
  );
}

export async function listAdminRoleGrants() {
  return query(
    `SELECT g.id, g.org_id, o.name AS org_name, g.user_id, u.display_name, u.email,
            g.role, g.offering_id, g.expires_at, g.revoked_at, g.granted_by,
            grantor.display_name AS granted_by_name,
            CASE WHEN g.revoked_at IS NOT NULL THEN 'revoked'
                 WHEN g.expires_at IS NOT NULL AND g.expires_at <= now() THEN 'expired'
                 ELSE 'active' END AS status
     FROM role_grants g
     JOIN users u ON u.id = g.user_id
     JOIN users grantor ON grantor.id = g.granted_by
     LEFT JOIN organizations o ON o.id = g.org_id
     WHERE o.id IS NULL OR NOT o.is_sandbox
     ORDER BY CASE WHEN g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now()) THEN 0 ELSE 1 END,
              g.role, u.display_name, g.id
     LIMIT 500`,
  );
}

export async function listAdminEligibleEmployees() {
  return query(
    `SELECT DISTINCT u.id, u.display_name, u.email, o.id AS org_id, o.name AS org_name
     FROM users u
     JOIN memberships m ON m.user_id = u.id AND m.role = 'employee' AND m.status = 'active'
     JOIN organizations o ON o.id = m.org_id AND o.type = 'azentio' AND o.status = 'active' AND NOT o.is_sandbox
     WHERE u.disabled_at IS NULL AND u.verified_at IS NOT NULL
     ORDER BY u.display_name, u.email, o.name
     LIMIT 500`,
  );
}

export async function createAdminOrganization(input: {
  actorId: string; requestId: string; name: string; type: 'azentio' | 'client'; initialAdminEmail?: string;
  invitationId?: string; invitationToken?: string; origin: string;
}) {
  return transaction(async (tx) => {
    await requirePlatformAdmin(tx, input.actorId);
    const inserted = await tx<{ id: string; name: string; type: string; status: string }>(
      `INSERT INTO organizations (name, type, status) VALUES ($1, $2, 'active') RETURNING id, name, type, status`,
      [input.name.trim(), input.type],
    );
    const org = inserted[0];
    await audit(tx, input.actorId, 'organization.create', 'organization', org.id, org.id, input.requestId, { type: org.type });

    let emailOutboxId: string | null = null;
    if (input.type === 'client' && input.initialAdminEmail && input.invitationId && input.invitationToken) {
      const tokenHash = createHash('sha256').update(input.invitationToken).digest('hex');
      const invitation = await tx<{ id: string; expires_at: Date }>(
        `INSERT INTO invitations (id, org_id, email, proposed_role, token_hash, expires_at, inviter)
         VALUES ($1, $2, lower($3), 'client_admin', $4, now() + interval '7 days', $5)
         RETURNING id, expires_at`,
        [input.invitationId, org.id, input.initialAdminEmail, tokenHash, input.actorId],
      );
      const inviteUrl = new URL(`/invite/${encodeURIComponent(input.invitationToken)}`, input.origin).toString();
      const rendered = renderInvitationEmail({
        role: 'client_admin',
        orgName: org.name,
        inviteUrl,
        expiresInDays: 7,
        origin: input.origin,
      });
      emailOutboxId = await enqueueEmail(tx, {
        idempotencyKey: `invitation:${invitation[0].id}:created`,
        recipient: input.initialAdminEmail,
        subject: rendered.subject,
        text: rendered.text,
        html: rendered.html,
      });
      await audit(tx, input.actorId, 'invitation.create', 'invitation', invitation[0].id, org.id, input.requestId, {
        role: 'client_admin', email_domain: input.initialAdminEmail.split('@')[1] ?? '',
        expires_at: invitation[0].expires_at, email_outbox_id: emailOutboxId,
      });
    }
    return { ...org, email_outbox_id: emailOutboxId };
  });
}

export async function updateAdminOrganization(input: { actorId: string; requestId: string; orgId: string; status: 'active' | 'suspended' | 'disabled' }) {
  return transaction(async (tx) => {
    await requirePlatformAdmin(tx, input.actorId);
    const rows = await tx<{ id: string; type: string; status: string }>(
      `SELECT id, type, status FROM organizations WHERE id = $1 FOR UPDATE`, [input.orgId],
    );
    const organization = rows[0];
    if (!organization || organization.type !== 'client') throw new Error('Client organization not found');
    const updated = await tx<{ id: string; status: string }>(
      `UPDATE organizations SET status = $1 WHERE id = $2 RETURNING id, status`,
      [input.status, input.orgId],
    );
    if (organization.status !== input.status) {
      await audit(tx, input.actorId, 'organization.status_update', 'organization', input.orgId, input.orgId, input.requestId, { from: organization.status, to: input.status });
    }
    return updated[0];
  });
}

export async function createAdminEntitlement(input: { actorId: string; requestId: string; orgId: string; offeringId: string; feature: string | null }) {
  return transaction(async (tx) => {
    await requirePlatformAdmin(tx, input.actorId);
    const org = await tx<{ id: string }>(`SELECT id FROM organizations WHERE id = $1 AND type = 'client' AND status = 'active' FOR SHARE`, [input.orgId]);
    if (!org[0]) throw new Error('Active client organization not found');
    await tx('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [`entitlement:${input.orgId}:${input.offeringId}:${input.feature ?? ''}`]);
    const duplicate = await tx<{ id: string }>(
      `SELECT id FROM entitlements WHERE org_id = $1 AND offering_id = $2
       AND feature IS NOT DISTINCT FROM $3 AND status = 'active'
       AND (valid_to IS NULL OR valid_to > now()) LIMIT 1 FOR SHARE`,
      [input.orgId, input.offeringId, input.feature],
    );
    if (duplicate[0]) throw new Error('An active entitlement already exists');
    const rows = await tx<{ id: string }>(
      `INSERT INTO entitlements (org_id, offering_id, feature, status, granted_by)
       VALUES ($1, $2, $3, 'active', $4) RETURNING id`,
      [input.orgId, input.offeringId, input.feature, input.actorId],
    );
    await audit(tx, input.actorId, 'entitlement.create', 'entitlement', rows[0].id, input.orgId, input.requestId, { offering_id: input.offeringId, feature: input.feature });
    return rows[0];
  });
}

export async function revokeAdminEntitlement(input: { actorId: string; requestId: string; entitlementId: string }) {
  return transaction(async (tx) => {
    await requirePlatformAdmin(tx, input.actorId);
    const rows = await tx<{ id: string; org_id: string; offering_id: string; feature: string | null }>(
      `UPDATE entitlements SET status = 'revoked' WHERE id = $1 AND status = 'active'
       RETURNING id, org_id, offering_id, feature`, [input.entitlementId],
    );
    const entitlement = rows[0];
    if (!entitlement) throw new Error('Active entitlement not found');
    await audit(tx, input.actorId, 'entitlement.revoke', 'entitlement', entitlement.id, entitlement.org_id, input.requestId, { offering_id: entitlement.offering_id, feature: entitlement.feature });
    return { id: entitlement.id, status: 'revoked' as const };
  });
}

export async function createAdminRoleGrant(input: {
  actorId: string; requestId: string; userId: string; orgId: string | null; role: AdminRole;
  offeringId: string | null; expiresAt: string | null;
}) {
  return transaction(async (tx) => {
    await requirePlatformAdmin(tx, input.actorId);
    if (input.userId === input.actorId) throw new Error('You cannot grant a role to yourself');
    if (input.role === 'portal_admin' && input.orgId !== null) throw new Error('Portal administrator grants must be platform-wide');
    if (input.role === 'product_owner' && !input.offeringId) throw new Error('Product owner grants require an offering');
    if (input.role !== 'product_owner' && input.offeringId) throw new Error('Only product owner grants can be offering-scoped');
    if (input.expiresAt && Date.parse(input.expiresAt) <= Date.now()) throw new Error('Grant expiry must be in the future');

    const target = await tx<{ id: string }>(
      `SELECT u.id FROM users u
       WHERE u.id = $1 AND u.disabled_at IS NULL AND u.verified_at IS NOT NULL
         AND EXISTS (
           SELECT 1 FROM memberships m JOIN organizations o ON o.id = m.org_id
           WHERE m.user_id = u.id AND m.role = 'employee' AND m.status = 'active'
             AND o.type = 'azentio' AND o.status = 'active'
             AND ($2::uuid IS NULL OR m.org_id = $2)
         )
       FOR SHARE OF u`,
      [input.userId, input.orgId],
    );
    if (!target[0]) throw new Error('Target must be a verified active employee');
    if (input.orgId) {
      const org = await tx<{ id: string }>(`SELECT id FROM organizations WHERE id = $1 AND type = 'azentio' AND status = 'active' FOR SHARE`, [input.orgId]);
      if (!org[0]) throw new Error('Scoped grants can only target an active Azentio organization');
    }

    const lockKey = `${input.userId}:${input.orgId ?? 'platform'}:${input.role}:${input.offeringId ?? ''}`;
    await tx('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', [lockKey]);
    const duplicate = await tx<{ id: string }>(
      `SELECT id FROM role_grants WHERE user_id = $1 AND org_id IS NOT DISTINCT FROM $2::uuid
       AND role = $3 AND offering_id IS NOT DISTINCT FROM $4 AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now()) LIMIT 1`,
      [input.userId, input.orgId, input.role, input.offeringId],
    );
    if (duplicate[0]) throw new Error('An active grant already exists');
    const rows = await tx<{ id: string }>(
      `INSERT INTO role_grants (org_id, user_id, role, offering_id, granted_by, expires_at)
       VALUES ($1, $2, $3, $4, $5, $6) RETURNING id`,
      [input.orgId, input.userId, input.role, input.offeringId, input.actorId, input.expiresAt],
    );
    await audit(tx, input.actorId, 'role_grant.create', 'role_grant', rows[0].id, input.orgId, input.requestId, { role: input.role, offering_id: input.offeringId });
    return rows[0];
  });
}

export async function revokeAdminRoleGrant(input: { actorId: string; requestId: string; grantId: string }) {
  return transaction(async (tx) => {
    await requirePlatformAdmin(tx, input.actorId);
    await tx('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['platform-admin-grant-lock']);
    const rows = await tx<{ id: string; user_id: string; org_id: string | null; role: string; offering_id: string | null }>(
      `SELECT id, user_id, org_id, role, offering_id FROM role_grants
       WHERE id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now()) FOR UPDATE`,
      [input.grantId],
    );
    const grant = rows[0];
    if (!grant) throw new Error('Active role grant not found');
    if (grant.role === 'portal_admin' && grant.org_id === null) {
      const active = await tx<{ count: number }>(
        `SELECT count(*)::int AS count FROM role_grants
         WHERE role = 'portal_admin' AND org_id IS NULL AND revoked_at IS NULL
           AND (expires_at IS NULL OR expires_at > now())`,
      );
      if (Number(active[0]?.count ?? 0) <= 1) throw new Error('The last platform administrator grant cannot be revoked');
    }
    await tx(`UPDATE role_grants SET revoked_at = now() WHERE id = $1`, [grant.id]);
    await audit(tx, input.actorId, 'role_grant.revoke', 'role_grant', grant.id, grant.org_id, input.requestId, { role: grant.role, offering_id: grant.offering_id });
    return { id: grant.id, revoked: true as const };
  });
}
