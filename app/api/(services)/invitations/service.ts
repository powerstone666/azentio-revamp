import 'server-only';

import { createHash } from 'node:crypto';
import type { PortalRole } from '@/app/(common-lib)/types';
import type { InviteCreateInput } from '@/app/(common-lib)/types/schemas';
import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { enqueueEmail } from '@/app/api/(services)/email/outbox';
import { renderInvitationEmail } from '@/app/api/(services)/email/renderer';

const INVITATION_TTL_DAYS = 7;
const WORKSPACE_POLICY_VERSION = 'workspace-terms-v1';
type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

export function hashInvitationToken(token: string) {
  return createHash('sha256').update(token).digest('hex');
}

async function audit(tx: TxQuery, actorId: string, action: string, targetId: string, orgId: string, requestId: string, metadata: Record<string, unknown>) {
  await tx(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
     VALUES ($1, $2, 'invitation', $3, $4, $5, 'allowed', $6::jsonb)`,
    [actorId, action, targetId, orgId, requestId, JSON.stringify(metadata)],
  );
}

export async function createInvitation(
  args: { id: string; token: string; email: string; role: InviteCreateInput['role']; orgId: string; inviterId: string; requestId: string; origin: string },
) {
  return transaction(async (tx) => {
    const admin = await tx<{ id: string }>(
      `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active' AND m.role = 'client_admin'
         AND o.type = 'client' AND o.status = 'active'
       FOR SHARE OF m`,
      [args.inviterId, args.orgId],
    );
    if (!admin[0]) throw new Error('Client workspace membership is no longer active');

    const existingMember = await tx<{ id: string }>(
      `SELECT m.id FROM memberships m JOIN users u ON u.id = m.user_id
       WHERE m.org_id = $1 AND lower(u.email) = lower($2) AND m.status = 'active'`,
      [args.orgId, args.email],
    );
    if (existingMember[0]) throw new Error('This person is already a member');

    const pending = await tx<{ id: string }>(
      `SELECT id FROM invitations WHERE org_id = $1 AND lower(email) = lower($2)
       AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
       LIMIT 1`,
      [args.orgId, args.email],
    );
    if (pending[0]) throw new Error('An active invitation already exists for this email');

    const inserted = await tx<{ id: string; expires_at: Date }>(
      `INSERT INTO invitations (id, org_id, email, proposed_role, token_hash, expires_at, inviter)
       VALUES ($1, $2, lower($3), $4, $5, now() + ($6::text || ' days')::interval, $7)
       RETURNING id, expires_at`,
      [args.id, args.orgId, args.email, args.role, hashInvitationToken(args.token), INVITATION_TTL_DAYS, args.inviterId],
    );

    const url = new URL(`/invite/${encodeURIComponent(args.token)}`, args.origin).toString();
    const rendered = renderInvitationEmail({
      role: args.role,
      inviteUrl: url,
      expiresInDays: INVITATION_TTL_DAYS,
      origin: args.origin,
    });
    const outboxId = await enqueueEmail(tx, {
      idempotencyKey: `invitation:${args.id}:created`,
      recipient: args.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    await audit(tx, args.inviterId, 'invitation.create', inserted[0].id, args.orgId, args.requestId, {
      role: args.role,
      email_domain: args.email.split('@')[1] ?? '',
      expires_at: inserted[0].expires_at,
      email_outbox_id: outboxId,
    });
    return { ...inserted[0], email_outbox_id: outboxId };
  });
}

export async function getInvitation(token: string) {
  return queryOne<{
    id: string;
    email: string;
    proposed_role: PortalRole;
    org_id: string;
    org_name: string;
    status: string;
    expires_at: Date;
  }>(
    `SELECT i.id, i.email, i.proposed_role, i.org_id, o.name AS org_name,
            i.expires_at,
            CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted'
                 WHEN i.revoked_at IS NOT NULL THEN 'revoked'
                 WHEN i.expires_at <= now() THEN 'expired'
                 ELSE 'pending' END AS status
     FROM invitations i JOIN organizations o ON o.id = i.org_id
     WHERE i.token_hash = $1 AND o.type = 'client'`,
    [hashInvitationToken(token)],
  );
}

export async function acceptInvitation(
  args: { token: string; verifiedEmail: string; displayName: string; requestId: string },
) {
  return transaction(async (tx) => {
    const rows = await tx<{
      id: string;
      org_id: string;
      email: string;
      proposed_role: 'client_member' | 'client_admin';
      status: string;
    }>(
      `SELECT i.id, i.org_id, i.email, i.proposed_role,
              CASE WHEN i.accepted_at IS NOT NULL THEN 'accepted'
                   WHEN i.revoked_at IS NOT NULL THEN 'revoked'
                   WHEN i.expires_at <= now() THEN 'expired'
                   ELSE 'pending' END AS status
       FROM invitations i JOIN organizations o ON o.id = i.org_id
       WHERE i.token_hash = $1 AND o.type = 'client' AND o.status = 'active'
       FOR UPDATE OF i`,
      [hashInvitationToken(args.token)],
    );
    const invitation = rows[0];
    if (!invitation || invitation.status !== 'pending') throw new Error('Invitation is no longer valid');
    if (invitation.email.toLowerCase() !== args.verifiedEmail.toLowerCase()) throw new Error('Signed-in email does not match this invitation');

    const existing = await tx<{ id: string; disabled_at: Date | null }>(
      'SELECT id, disabled_at FROM users WHERE lower(email) = lower($1) FOR UPDATE',
      [args.verifiedEmail],
    );
    if (existing[0]?.disabled_at) throw new Error('This account is disabled');
    let userId = existing[0]?.id;
    if (!userId) {
      const created = await tx<{ id: string }>(
        `INSERT INTO users (email, display_name, verified_at)
         VALUES (lower($1), $2, now()) RETURNING id`,
        [args.verifiedEmail, args.displayName.trim() || args.verifiedEmail],
      );
      userId = created[0].id;
    } else {
      await tx(
        `UPDATE users SET verified_at = COALESCE(verified_at, now()) WHERE id = $1`,
        [userId],
      );
    }

    await tx(
      `INSERT INTO memberships (org_id, user_id, role, status, joined_at)
       VALUES ($1, $2, $3, 'active', now())
       ON CONFLICT (org_id, user_id) DO UPDATE SET
         role = EXCLUDED.role, status = 'active', joined_at = now()`,
      [invitation.org_id, userId, invitation.proposed_role],
    );
    await tx(
      `INSERT INTO workspace_acceptances (user_id, org_id, policy_version)
       VALUES ($1, $2, $3)
       ON CONFLICT (user_id, org_id, policy_version) DO NOTHING`,
      [userId, invitation.org_id, WORKSPACE_POLICY_VERSION],
    );
    await tx(
      `UPDATE invitations SET accepted_by = $1, accepted_at = now() WHERE id = $2`,
      [userId, invitation.id],
    );
    await tx(
      `INSERT INTO notifications (recipient_user_id, event, safe_payload)
       VALUES ($1, 'workspace.joined', $2::jsonb)`,
      [userId, JSON.stringify({ org_id: invitation.org_id, role: invitation.proposed_role })],
    );
    await audit(tx, userId, 'invitation.accept', invitation.id, invitation.org_id, args.requestId, {
      role: invitation.proposed_role,
      terms_version: WORKSPACE_POLICY_VERSION,
    });
    return { org_id: invitation.org_id, role: invitation.proposed_role };
  });
}

export async function revokeInvitation(
  invitationId: string,
  actorId: string,
  orgId: string,
  requestId: string,
) {
  return transaction(async (tx) => {
    const admin = await tx<{ id: string }>(
      `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1 AND m.org_id = $2 AND m.role = 'client_admin'
         AND m.status = 'active' AND o.type = 'client' AND o.status = 'active'
       FOR SHARE OF m`,
      [actorId, orgId],
    );
    if (!admin[0]) throw new Error('Client administrator membership is no longer active');
    const rows = await tx<{ id: string; email: string }>(
      `UPDATE invitations
       SET revoked_at = now()
       WHERE id = $1 AND org_id = $2 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
       RETURNING id, email`,
      [invitationId, orgId],
    );
    if (!rows[0]) throw new Error('Invitation not found or already resolved');
    await audit(tx, actorId, 'invitation.revoke', invitationId, orgId, requestId, {
      email: rows[0].email,
    });
    return { id: rows[0].id, revoked: true };
  });
}

export async function listPendingInvitations(orgId: string) {
  return query<{
    id: string;
    email: string;
    proposed_role: PortalRole;
    expires_at: Date;
    created_at: Date;
  }>(
    `SELECT id, email, proposed_role, expires_at, created_at
     FROM invitations
     WHERE org_id = $1 AND accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()
     ORDER BY created_at DESC`,
    [orgId],
  );
}

export async function listWorkspaceMembers(orgId: string) {
  return query<{ membership_id: string; user_id: string; display_name: string; email: string; role: string; status: string; joined_at: Date }>(
    `SELECT m.id AS membership_id, m.user_id, u.display_name, u.email, m.role, m.status, m.joined_at
     FROM memberships m JOIN users u ON u.id = m.user_id
     WHERE m.org_id = $1
     ORDER BY CASE WHEN m.status = 'active' THEN 0 ELSE 1 END, u.display_name, m.id`,
    [orgId],
  );
}

export async function revokeWorkspaceMember(membershipId: string, actorId: string, orgId: string, requestId: string) {
  return transaction(async (tx) => {
    const organization = await tx<{ id: string }>(
      `SELECT id FROM organizations WHERE id = $1 AND type = 'client' AND status = 'active' FOR UPDATE`,
      [orgId],
    );
    if (!organization[0]) throw new Error('Client organization is no longer active');
    const admin = await tx<{ id: string }>(
      `SELECT m.id FROM memberships m WHERE m.user_id = $1 AND m.org_id = $2
       AND m.role = 'client_admin' AND m.status = 'active' FOR SHARE OF m`,
      [actorId, orgId],
    );
    if (!admin[0]) throw new Error('Client administrator membership is no longer active');
    const rows = await tx<{ id: string; user_id: string; role: string }>(
      `SELECT m.id, m.user_id, m.role
       FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.id = $1 AND m.org_id = $2 AND m.status = 'active' AND o.type = 'client'
       FOR UPDATE OF m`,
      [membershipId, orgId],
    );
    const membership = rows[0];
    if (!membership) throw new Error('Member not found');
    if (membership.user_id === actorId) throw new Error('You cannot revoke your own active workspace');
    if (membership.role === 'client_admin') {
      const activeAdmins = await tx<{ count: string }>(
        `SELECT count(*)::text AS count FROM memberships
         WHERE org_id = $1 AND role = 'client_admin' AND status = 'active'`,
        [orgId],
      );
      if (Number(activeAdmins[0]?.count ?? '0') <= 1) throw new Error('The last client administrator cannot be revoked');
    }
    await tx("UPDATE memberships SET status = 'revoked' WHERE id = $1", [membershipId]);
    await tx(
      `UPDATE role_grants SET revoked_at = now()
       WHERE user_id = $1 AND org_id = $2 AND revoked_at IS NULL`,
      [membership.user_id, orgId],
    );
    await tx(
      `INSERT INTO notifications (recipient_user_id, event, safe_payload)
       VALUES ($1, 'workspace.access_revoked', $2::jsonb)`,
      [membership.user_id, JSON.stringify({ org_id: orgId, status: 'revoked' })],
    );
    await audit(tx, actorId, 'member.revoke', membershipId, orgId, requestId, { role: membership.role });
    return { membership_id: membershipId, status: 'revoked' as const };
  });
}
