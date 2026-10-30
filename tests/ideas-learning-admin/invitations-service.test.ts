import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { inviteCreateSchema } from '@/app/(common-lib)/types/schemas';
import { enqueueEmail } from '@/app/api/(services)/email/outbox';
import { renderInvitationEmail } from '@/app/api/(services)/email/renderer';
import {
  acceptInvitation, createInvitation, getInvitation, hashInvitationToken, listPendingInvitations,
  listWorkspaceMembers, revokeInvitation, revokeWorkspaceMember,
} from '@/app/api/(services)/invitations/service';
import { mockDb } from '@/tests/support/db';
import { UUID_A, UUID_B, callsMatching, metadataOf, respondTo, sha256, sqlCalls } from './helpers';

jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));
jest.mock('@/app/api/(services)/email/outbox', () => ({ enqueueEmail: jest.fn(), deliverEmailOutboxItem: jest.fn() }));
jest.mock('@/app/api/(services)/email/renderer', () => ({ renderInvitationEmail: jest.fn() }));

const RAW_TOKEN = 'raw-invite-token-0123456789abcdefghijklmnopq';
const WRITE_SQL = /^(INSERT|UPDATE|DELETE)\b/;

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  query.mockResolvedValue([]);
  queryOne.mockResolvedValue(null);
  mockDb({ query, queryOne, transaction });
  jest.mocked(enqueueEmail).mockReset().mockResolvedValue('outbox-7');
  jest.mocked(renderInvitationEmail).mockReset().mockReturnValue({ subject: 'Invite', text: 'text', html: '<p>html</p>' });
});

function writesIn(mock: jest.Mock) {
  return sqlCalls(mock).filter((call) => WRITE_SQL.test(call.sql));
}

describe('invitation tokens', () => {
  it('stores only a SHA-256 hash of the invitation token', () => {
    expect(hashInvitationToken(RAW_TOKEN)).toBe(sha256(RAW_TOKEN));
    expect(hashInvitationToken(RAW_TOKEN)).not.toContain(RAW_TOKEN);
  });
});

describe('createInvitation', () => {
  const args = {
    id: UUID_A, token: RAW_TOKEN, email: 'New.Person@Acme.test', role: 'client_member' as const,
    orgId: 'org-1', inviterId: 'user-admin', requestId: 'req-1', origin: 'https://portal.test',
  };

  function respondCreate(overrides: Array<[string, unknown]> = []) {
    respondTo(query, [
      ...overrides,
      ["m.role = 'client_admin' AND o.type = 'client' AND o.status = 'active'", [{ id: 'm-admin' }]],
      ['JOIN users u ON u.id = m.user_id', []],
      ['SELECT id FROM invitations WHERE org_id = $1', []],
      ['INSERT INTO invitations (id, org_id', [{ id: UUID_A, expires_at: new Date('2026-11-07T00:00:00Z') }]],
    ]);
  }

  it('refuses to invite unless the inviter is an active client administrator', async () => {
    respondCreate([["m.role = 'client_admin' AND o.type = 'client' AND o.status = 'active'", []]]);
    await expect(createInvitation(args)).rejects.toThrow('Client workspace membership is no longer active');
    expect(writesIn(query)).toHaveLength(0);
  });

  it('refuses to invite someone who is already an active member, matched case-insensitively', async () => {
    respondCreate([['JOIN users u ON u.id = m.user_id', [{ id: 'm-existing' }]]]);
    await expect(createInvitation(args)).rejects.toThrow('This person is already a member');
    expect(writesIn(query)).toHaveLength(0);
  });

  it('refuses a second live invitation for the same email in the same workspace', async () => {
    respondCreate([['SELECT id FROM invitations WHERE org_id = $1', [{ id: 'inv-old' }]]]);
    await expect(createInvitation(args)).rejects.toThrow('An active invitation already exists for this email');
    expect(writesIn(query)).toHaveLength(0);
  });

  it('stores the hashed token with a seven-day expiry and never the raw token', async () => {
    respondCreate();
    await createInvitation(args);
    const [insert] = callsMatching(query, 'INSERT INTO invitations (id, org_id');
    expect(insert.sql).toContain("now() + ($6::text || ' days')::interval");
    expect(insert.sql).toContain('lower($3)');
    expect(insert.params).toEqual([UUID_A, 'org-1', 'New.Person@Acme.test', 'client_member', sha256(RAW_TOKEN), 7, 'user-admin']);
    expect(insert.params).not.toContain(RAW_TOKEN);
  });

  it('sends the invitation link built from the token and queues the email idempotently', async () => {
    respondCreate();
    await expect(createInvitation(args)).resolves.toMatchObject({ id: UUID_A, email_outbox_id: 'outbox-7' });
    expect(renderInvitationEmail).toHaveBeenCalledWith(expect.objectContaining({
      role: 'client_member', inviteUrl: `https://portal.test/invite/${RAW_TOKEN}`, expiresInDays: 7,
    }));
    expect(enqueueEmail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: `invitation:${UUID_A}:created`, recipient: 'New.Person@Acme.test',
    }));
  });

  it('audits the invitation with role, email domain and expiry but not the full address', async () => {
    respondCreate();
    await createInvitation(args);
    const audit = callsMatching(query, 'INSERT INTO audit_log')[0];
    expect(audit.params).toContain('invitation.create');
    const metadata = metadataOf(audit.params);
    expect(metadata).toMatchObject({ role: 'client_member', email_domain: 'Acme.test', email_outbox_id: 'outbox-7' });
    expect(JSON.stringify(metadata)).not.toContain('New.Person');
  });

  it('issues a client administrator invitation only when that role is requested', async () => {
    respondCreate();
    await createInvitation({ ...args, role: 'client_admin' });
    expect(callsMatching(query, 'INSERT INTO invitations (id, org_id')[0].params[3]).toBe('client_admin');
  });
});

describe('invitation escalation rule', () => {
  it.each(['client_member', 'client_admin'])('accepts %s as an invitable role', (role) => {
    expect(inviteCreateSchema.safeParse({ email: 'a@acme.test', role }).success).toBe(true);
  });

  it.each(['employee', 'learning_moderator', 'content_publisher', 'product_owner', 'portal_admin'])(
    'refuses to invite someone as %s',
    (role) => {
      expect(inviteCreateSchema.safeParse({ email: 'a@acme.test', role }).success).toBe(false);
    },
  );
});

describe('getInvitation', () => {
  it('looks the invitation up by token hash and derives its status from the record', async () => {
    await getInvitation(RAW_TOKEN);
    const [{ sql, params }] = sqlCalls(queryOne);
    expect(sql).toContain('WHERE i.token_hash = $1 AND o.type = \'client\'');
    expect(sql).toContain("WHEN i.accepted_at IS NOT NULL THEN 'accepted'");
    expect(sql).toContain("WHEN i.revoked_at IS NOT NULL THEN 'revoked'");
    expect(sql).toContain("WHEN i.expires_at <= now() THEN 'expired'");
    expect(params).toEqual([sha256(RAW_TOKEN)]);
  });
});

describe('acceptInvitation', () => {
  const invitation = (overrides: Record<string, unknown> = {}) => ({
    id: UUID_A, org_id: 'org-1', email: 'new.person@acme.test', proposed_role: 'client_member', status: 'pending', ...overrides,
  });
  const args = { token: RAW_TOKEN, verifiedEmail: 'new.person@acme.test', displayName: 'New Person', requestId: 'req-2' };

  function respondAccept(row: Record<string, unknown> | null, existing: unknown[] = []) {
    respondTo(query, [
      ['FOR UPDATE OF i', row ? [row] : []],
      ['SELECT id, disabled_at FROM users WHERE lower(email)', existing],
      ['INSERT INTO users (email, display_name, verified_at)', [{ id: 'user-new' }]],
    ]);
  }

  it.each([
    ['accepted', 'already used'],
    ['revoked', 'withdrawn'],
    ['expired', 'past its expiry'],
  ])('refuses an invitation that is %s, so it is single use and time-limited', async (status) => {
    respondAccept(invitation({ status }));
    await expect(acceptInvitation(args)).rejects.toThrow('Invitation is no longer valid');
    expect(writesIn(query)).toHaveLength(0);
  });

  it('refuses a token that matches no client invitation', async () => {
    respondAccept(null);
    await expect(acceptInvitation(args)).rejects.toThrow('Invitation is no longer valid');
  });

  it('locks the invitation row while it is being accepted', async () => {
    respondAccept(invitation());
    await acceptInvitation(args);
    expect(callsMatching(query, 'FOR UPDATE OF i')[0].params).toEqual([sha256(RAW_TOKEN)]);
  });

  it('refuses when the signed-in email is not the invited address (any letter case is accepted)', async () => {
    respondAccept(invitation());
    await expect(acceptInvitation({ ...args, verifiedEmail: 'someone.else@acme.test' })).rejects.toThrow(
      'Signed-in email does not match this invitation',
    );
    respondAccept(invitation());
    await expect(acceptInvitation({ ...args, verifiedEmail: 'NEW.PERSON@ACME.TEST' })).resolves.toMatchObject({ org_id: 'org-1' });
  });

  it('refuses a disabled account', async () => {
    respondAccept(invitation(), [{ id: 'user-old', disabled_at: new Date('2026-01-01') }]);
    await expect(acceptInvitation(args)).rejects.toThrow('This account is disabled');
    expect(callsMatching(query, 'INSERT INTO memberships')).toHaveLength(0);
  });

  it('creates a verified user, joins them with the invited role and marks the invitation accepted', async () => {
    respondAccept(invitation({ proposed_role: 'client_admin' }));
    await expect(acceptInvitation(args)).resolves.toEqual({ org_id: 'org-1', role: 'client_admin' });
    expect(callsMatching(query, 'INSERT INTO users (email, display_name, verified_at)')[0].params).toEqual(['new.person@acme.test', 'New Person']);
    const [membership] = callsMatching(query, 'INSERT INTO memberships');
    expect(membership.sql).toContain('ON CONFLICT (org_id, user_id) DO UPDATE');
    expect(membership.params).toEqual(['org-1', 'user-new', 'client_admin']);
    const [accepted] = callsMatching(query, 'UPDATE invitations SET accepted_by');
    expect(accepted.params).toEqual(['user-new', UUID_A]);
    expect(callsMatching(query, 'INSERT INTO workspace_acceptances')).toHaveLength(1);
  });

  it('falls back to the verified email as the display name when none is given', async () => {
    respondAccept(invitation());
    await acceptInvitation({ ...args, displayName: '   ' });
    expect(callsMatching(query, 'INSERT INTO users (email, display_name, verified_at)')[0].params[1]).toBe('new.person@acme.test');
  });

  it('reuses an existing account without creating a second user', async () => {
    respondAccept(invitation(), [{ id: 'user-existing', disabled_at: null }]);
    await acceptInvitation(args);
    expect(callsMatching(query, 'INSERT INTO users (email')).toHaveLength(0);
    expect(callsMatching(query, 'UPDATE users SET verified_at')[0].params).toEqual(['user-existing']);
    expect(callsMatching(query, 'INSERT INTO memberships')[0].params[1]).toBe('user-existing');
  });

  it('notifies the new member and audits the acceptance with the terms version', async () => {
    respondAccept(invitation());
    await acceptInvitation(args);
    expect(callsMatching(query, 'INSERT INTO notifications')[0].params[1]).toBe(JSON.stringify({ org_id: 'org-1', role: 'client_member' }));
    const audit = callsMatching(query, 'INSERT INTO audit_log')[0];
    expect(audit.params).toContain('invitation.accept');
    expect(metadataOf(audit.params)).toEqual({ role: 'client_member', terms_version: 'workspace-terms-v1' });
  });
});

describe('revokeInvitation', () => {
  it('refuses unless the actor is an active client administrator of that workspace', async () => {
    respondTo(query, [["m.role = 'client_admin' AND m.status = 'active' AND o.type = 'client'", []]]);
    await expect(revokeInvitation(UUID_A, 'user-admin', 'org-1', 'req-3')).rejects.toThrow('Client administrator membership is no longer active');
  });

  it('only revokes a pending invitation in the same workspace', async () => {
    respondTo(query, [
      ["m.role = 'client_admin' AND m.status = 'active' AND o.type = 'client'", [{ id: 'm-admin' }]],
      ['UPDATE invitations SET revoked_at = now()', []],
    ]);
    await expect(revokeInvitation(UUID_A, 'user-admin', 'org-1', 'req-3')).rejects.toThrow('Invitation not found or already resolved');
    const [update] = callsMatching(query, 'UPDATE invitations SET revoked_at');
    expect(update.sql).toContain('accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()');
    expect(update.params).toEqual([UUID_A, 'org-1']);
  });

  it('revokes a pending invitation and audits it', async () => {
    respondTo(query, [
      ["m.role = 'client_admin' AND m.status = 'active' AND o.type = 'client'", [{ id: 'm-admin' }]],
      ['UPDATE invitations SET revoked_at = now()', [{ id: UUID_A, email: 'new.person@acme.test' }]],
    ]);
    await expect(revokeInvitation(UUID_A, 'user-admin', 'org-1', 'req-3')).resolves.toEqual({ id: UUID_A, revoked: true });
    const audit = callsMatching(query, 'INSERT INTO audit_log')[0];
    expect(audit.params).toContain('invitation.revoke');
    expect(metadataOf(audit.params)).toEqual({ email: 'new.person@acme.test' });
  });
});

describe('workspace listings', () => {
  it('lists only pending invitations: not accepted, not revoked and not expired', async () => {
    await listPendingInvitations('org-1');
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain('accepted_at IS NULL AND revoked_at IS NULL AND expires_at > now()');
    expect(params).toEqual(['org-1']);
  });

  it('lists active members before inactive ones', async () => {
    await listWorkspaceMembers('org-1');
    expect(sqlCalls(query)[0].sql).toContain("ORDER BY CASE WHEN m.status = 'active' THEN 0 ELSE 1 END");
  });
});

describe('revokeWorkspaceMember', () => {
  const ORG_SQL = "SELECT id FROM organizations WHERE id = $1 AND type = 'client' AND status = 'active' FOR UPDATE";
  const ADMIN_SQL = "AND m.role = 'client_admin' AND m.status = 'active' FOR SHARE OF m";
  const TARGET_SQL = 'SELECT m.id, m.user_id, m.role FROM memberships m';

  it('refuses when the client organisation is not active', async () => {
    respondTo(query, [[ORG_SQL, []]]);
    await expect(revokeWorkspaceMember(UUID_A, 'user-admin', 'org-1', 'req')).rejects.toThrow('Client organization is no longer active');
  });

  it('refuses unless the actor is an active client administrator', async () => {
    respondTo(query, [[ORG_SQL, [{ id: 'org-1' }]], [ADMIN_SQL, []]]);
    await expect(revokeWorkspaceMember(UUID_A, 'user-admin', 'org-1', 'req')).rejects.toThrow('Client administrator membership is no longer active');
  });

  it('reports a membership that is missing or not in this workspace as not found', async () => {
    respondTo(query, [[ORG_SQL, [{ id: 'org-1' }]], [ADMIN_SQL, [{ id: 'm-admin' }]], [TARGET_SQL, []]]);
    await expect(revokeWorkspaceMember(UUID_A, 'user-admin', 'org-1', 'req')).rejects.toThrow('Member not found');
  });

  it('prevents an administrator from revoking their own active workspace', async () => {
    respondTo(query, [
      [ORG_SQL, [{ id: 'org-1' }]], [ADMIN_SQL, [{ id: 'm-admin' }]],
      [TARGET_SQL, [{ id: UUID_A, user_id: 'user-admin', role: 'client_admin' }]],
    ]);
    await expect(revokeWorkspaceMember(UUID_A, 'user-admin', 'org-1', 'req')).rejects.toThrow('You cannot revoke your own active workspace');
    expect(writesIn(query)).toHaveLength(0);
  });

  it('keeps at least one active client administrator in the workspace', async () => {
    respondTo(query, [
      [ORG_SQL, [{ id: 'org-1' }]], [ADMIN_SQL, [{ id: 'm-admin' }]],
      [TARGET_SQL, [{ id: UUID_A, user_id: UUID_B, role: 'client_admin' }]],
      ['SELECT count(*)::text AS count FROM memberships', [{ count: '1' }]],
    ]);
    await expect(revokeWorkspaceMember(UUID_A, 'user-admin', 'org-1', 'req')).rejects.toThrow('The last client administrator cannot be revoked');
    expect(writesIn(query)).toHaveLength(0);
  });

  it('revokes the membership, the member\'s workspace grants and notifies them, then audits the change', async () => {
    respondTo(query, [
      [ORG_SQL, [{ id: 'org-1' }]], [ADMIN_SQL, [{ id: 'm-admin' }]],
      [TARGET_SQL, [{ id: UUID_A, user_id: UUID_B, role: 'client_member' }]],
    ]);
    await expect(revokeWorkspaceMember(UUID_A, 'user-admin', 'org-1', 'req-4')).resolves.toEqual({ membership_id: UUID_A, status: 'revoked' });
    expect(callsMatching(query, "UPDATE memberships SET status = 'revoked'")[0].params).toEqual([UUID_A]);
    expect(callsMatching(query, 'UPDATE role_grants SET revoked_at = now()')[0].params).toEqual([UUID_B, 'org-1']);
    expect(callsMatching(query, 'INSERT INTO notifications')[0].params[0]).toBe(UUID_B);
    const audit = callsMatching(query, 'INSERT INTO audit_log')[0];
    expect(audit.params).toContain('member.revoke');
    expect(metadataOf(audit.params)).toEqual({ role: 'client_member' });
  });
});
