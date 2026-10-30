import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { enqueueEmail } from '@/app/api/(services)/email/outbox';
import { renderInvitationEmail } from '@/app/api/(services)/email/renderer';
import {
  createAdminEntitlement, createAdminOrganization, createAdminRoleGrant, getAdminOverview, listAdminEligibleEmployees,
  listAdminOrganizations, listAdminRoleGrants, revokeAdminEntitlement, revokeAdminRoleGrant, updateAdminOrganization,
} from '@/app/api/(services)/admin/service';
import { mockDb } from '@/tests/support/db';
import { UUID_A, UUID_B, callsMatching, metadataOf, respondTo, sha256, sqlCalls } from './helpers';

jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));
jest.mock('@/app/api/(services)/email/outbox', () => ({ enqueueEmail: jest.fn(), deliverEmailOutboxItem: jest.fn() }));
jest.mock('@/app/api/(services)/email/renderer', () => ({ renderInvitationEmail: jest.fn() }));

const PLATFORM_SQL = "role = 'portal_admin' AND org_id IS NULL";
const WRITE_SQL = /^(INSERT|UPDATE|DELETE)\b/;

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  query.mockResolvedValue([]);
  queryOne.mockResolvedValue(null);
  mockDb({ query, queryOne, transaction });
  jest.mocked(enqueueEmail).mockReset().mockResolvedValue('outbox-1');
  jest.mocked(renderInvitationEmail).mockReset().mockReturnValue({ subject: 'Invite', text: 'text', html: '<p>html</p>' });
});

function writesIn(mock: jest.Mock) {
  return sqlCalls(mock).filter((call) => WRITE_SQL.test(call.sql));
}

describe('platform administrator gate', () => {
  const actions: Record<string, () => Promise<unknown>> = {
    createAdminOrganization: () => createAdminOrganization({ actorId: 'admin-1', requestId: 'r', name: 'Acme', type: 'azentio', origin: 'https://portal.test' }),
    updateAdminOrganization: () => updateAdminOrganization({ actorId: 'admin-1', requestId: 'r', orgId: UUID_A, status: 'suspended' }),
    createAdminEntitlement: () => createAdminEntitlement({ actorId: 'admin-1', requestId: 'r', orgId: UUID_A, offeringId: 'FAI', feature: 'sandbox' }),
    revokeAdminEntitlement: () => revokeAdminEntitlement({ actorId: 'admin-1', requestId: 'r', entitlementId: UUID_A }),
    createAdminRoleGrant: () => createAdminRoleGrant({ actorId: 'admin-1', requestId: 'r', userId: UUID_B, orgId: null, role: 'learning_moderator', offeringId: null, expiresAt: null }),
    revokeAdminRoleGrant: () => revokeAdminRoleGrant({ actorId: 'admin-1', requestId: 'r', grantId: UUID_A }),
  };

  it.each(Object.keys(actions))('%s refuses to run without an active platform administrator grant and writes nothing', async (name) => {
    respondTo(query, [[PLATFORM_SQL, []]]);
    await expect(actions[name]()).rejects.toThrow('Active platform administrator grant required');
    expect(writesIn(query)).toHaveLength(0);
  });
});

describe('admin directories hide sandbox organisations and private client content', () => {
  it.each([
    ['organisations', () => listAdminOrganizations(), 'WHERE NOT o.is_sandbox'],
    ['role grants', () => listAdminRoleGrants(), 'WHERE o.id IS NULL OR NOT o.is_sandbox'],
    ['eligible employees', () => listAdminEligibleEmployees(), 'AND NOT o.is_sandbox'],
  ])('the %s listing excludes sandbox organisations', async (_label, run, fragment) => {
    await run();
    expect(sqlCalls(query)[0].sql).toContain(fragment);
  });

  it('the overview counts exclude sandbox organisations', async () => {
    await getAdminOverview();
    expect(sqlCalls(queryOne)[0].sql).toContain('FROM organizations WHERE NOT is_sandbox');
  });

  it.each([
    ['organisations', () => listAdminOrganizations()],
    ['role grants', () => listAdminRoleGrants()],
    ['eligible employees', () => listAdminEligibleEmployees()],
    ['overview', () => getAdminOverview()],
  ])('the %s directory never reads client contributions or reviewed payloads', async (_label, run) => {
    await run();
    const sql = [...sqlCalls(query), ...sqlCalls(queryOne)].map((call) => call.sql).join(' ');
    for (const forbidden of ['contributions', 'shared_copies', 'reviewed_payload', 'contribution_versions']) {
      expect(sql).not.toContain(forbidden);
    }
  });

  it('lists only active, unexpired entitlements on organisations', async () => {
    await listAdminOrganizations();
    expect(sqlCalls(query)[0].sql).toContain("e.status = 'active'");
    expect(sqlCalls(query)[0].sql).toContain('(e.valid_to IS NULL OR e.valid_to > now())');
  });
});

describe('createAdminOrganization', () => {
  function respondCreate() {
    respondTo(query, [
      [PLATFORM_SQL, [{ id: 'g0' }]],
      ['INSERT INTO organizations', [{ id: 'org-new', name: 'Acme', type: 'client', status: 'active' }]],
      ['INSERT INTO invitations', [{ id: UUID_A, expires_at: new Date('2026-11-07T00:00:00Z') }]],
    ]);
  }

  it('creates an azentio organisation without any invitation or email', async () => {
    respondCreate();
    await expect(createAdminOrganization({ actorId: 'admin-1', requestId: 'r', name: 'Azentio Labs', type: 'azentio', origin: 'https://portal.test' }))
      .resolves.toMatchObject({ id: 'org-new', email_outbox_id: null });
    expect(callsMatching(query, 'INSERT INTO invitations')).toHaveLength(0);
    expect(enqueueEmail).not.toHaveBeenCalled();
  });

  it('creates a client organisation with a hashed, single-use client admin invitation and queues the email', async () => {
    respondCreate();
    const result = await createAdminOrganization({
      actorId: 'admin-1', requestId: 'req-8', name: '  Acme  ', type: 'client',
      initialAdminEmail: 'Admin@Example.com', invitationId: UUID_A, invitationToken: 'raw-token-value',
      origin: 'https://portal.test',
    });
    expect(result).toMatchObject({ id: 'org-new', name: 'Acme', email_outbox_id: 'outbox-1' });

    const [invite] = callsMatching(query, 'INSERT INTO invitations');
    expect(invite.sql).toContain("lower($3)");
    expect(invite.sql).toContain("now() + interval '7 days'");
    expect(invite.params).toEqual([UUID_A, 'org-new', 'Admin@Example.com', sha256('raw-token-value'), 'admin-1']);
    expect(invite.params).not.toContain('raw-token-value');

    expect(renderInvitationEmail).toHaveBeenCalledWith(expect.objectContaining({
      role: 'client_admin', inviteUrl: 'https://portal.test/invite/raw-token-value', expiresInDays: 7,
    }));
    expect(enqueueEmail).toHaveBeenCalledWith(expect.anything(), expect.objectContaining({
      idempotencyKey: `invitation:${UUID_A}:created`, recipient: 'Admin@Example.com',
    }));
  });

  it('audits the invitation without recording the full email address', async () => {
    respondCreate();
    await createAdminOrganization({
      actorId: 'admin-1', requestId: 'req-8', name: 'Acme', type: 'client',
      initialAdminEmail: 'admin@acme.test', invitationId: UUID_A, invitationToken: 'raw-token-value', origin: 'https://portal.test',
    });
    const invitationAudit = callsMatching(query, 'INSERT INTO audit_log').find((call) => call.params.includes('invitation.create'));
    expect(invitationAudit).toBeDefined();
    const metadata = metadataOf(invitationAudit!.params);
    expect(metadata).toMatchObject({ role: 'client_admin', email_domain: 'acme.test', email_outbox_id: 'outbox-1' });
    expect(JSON.stringify(metadata)).not.toContain('admin@acme.test');
  });
});

describe('organisation status and entitlements', () => {
  it('refuses to change status on anything that is not a client organisation', async () => {
    respondTo(query, [[PLATFORM_SQL, [{ id: 'g0' }]], ['SELECT id, type, status FROM organizations', [{ id: UUID_A, type: 'azentio', status: 'active' }]]]);
    await expect(updateAdminOrganization({ actorId: 'admin-1', requestId: 'r', orgId: UUID_A, status: 'suspended' }))
      .rejects.toThrow('Client organization not found');
    expect(writesIn(query)).toHaveLength(0);
  });

  it.each([
    ['active', 'suspended', true],
    ['suspended', 'suspended', false],
  ])('changing status from %s to %s audits: %s', async (from, to, audited) => {
    respondTo(query, [
      [PLATFORM_SQL, [{ id: 'g0' }]],
      ['SELECT id, type, status FROM organizations', [{ id: UUID_A, type: 'client', status: from }]],
      ['UPDATE organizations SET status', [{ id: UUID_A, status: to }]],
    ]);
    await expect(updateAdminOrganization({ actorId: 'admin-1', requestId: 'r', orgId: UUID_A, status: to as 'suspended' }))
      .resolves.toEqual({ id: UUID_A, status: to });
    const audits = callsMatching(query, 'INSERT INTO audit_log');
    expect(audits).toHaveLength(audited ? 1 : 0);
    if (audited) expect(metadataOf(audits[0].params)).toEqual({ from, to });
  });

  it('grants an entitlement only to an active client organisation', async () => {
    respondTo(query, [[PLATFORM_SQL, [{ id: 'g0' }]]]);
    await expect(createAdminEntitlement({ actorId: 'admin-1', requestId: 'r', orgId: UUID_A, offeringId: 'FAI', feature: 'sandbox' }))
      .rejects.toThrow('Active client organization not found');
    expect(writesIn(query)).toHaveLength(0);
  });

  it('refuses a duplicate active entitlement', async () => {
    respondTo(query, [
      [PLATFORM_SQL, [{ id: 'g0' }]],
      ["type = 'client' AND status = 'active' FOR SHARE", [{ id: UUID_A }]],
      ['SELECT id FROM entitlements WHERE org_id = $1', [{ id: 'ent-1' }]],
    ]);
    await expect(createAdminEntitlement({ actorId: 'admin-1', requestId: 'r', orgId: UUID_A, offeringId: 'FAI', feature: 'sandbox' }))
      .rejects.toThrow('An active entitlement already exists');
  });

  it('creates an entitlement and audits it', async () => {
    respondTo(query, [
      [PLATFORM_SQL, [{ id: 'g0' }]],
      ["type = 'client' AND status = 'active' FOR SHARE", [{ id: UUID_A }]],
      ['INSERT INTO entitlements', [{ id: 'ent-2' }]],
    ]);
    await expect(createAdminEntitlement({ actorId: 'admin-1', requestId: 'r', orgId: UUID_A, offeringId: 'FAI', feature: 'sandbox' }))
      .resolves.toEqual({ id: 'ent-2' });
    expect(metadataOf(callsMatching(query, 'INSERT INTO audit_log')[0].params)).toEqual({ offering_id: 'FAI', feature: 'sandbox' });
  });

  it('reports an entitlement that is not active as not found when revoking', async () => {
    respondTo(query, [[PLATFORM_SQL, [{ id: 'g0' }]]]);
    await expect(revokeAdminEntitlement({ actorId: 'admin-1', requestId: 'r', entitlementId: UUID_A })).rejects.toThrow('Active entitlement not found');
  });

  it('revokes an active entitlement and audits the revocation', async () => {
    respondTo(query, [
      [PLATFORM_SQL, [{ id: 'g0' }]],
      ["UPDATE entitlements SET status = 'revoked'", [{ id: UUID_A, org_id: 'org-1', offering_id: 'FAI', feature: 'sandbox' }]],
    ]);
    await expect(revokeAdminEntitlement({ actorId: 'admin-1', requestId: 'r', entitlementId: UUID_A })).resolves.toEqual({ id: UUID_A, status: 'revoked' });
    expect(callsMatching(query, 'INSERT INTO audit_log')[0].params).toContain('entitlement.revoke');
  });
});

describe('createAdminRoleGrant rules', () => {
  const base = { actorId: 'admin-1', requestId: 'r', userId: UUID_B, orgId: null as string | null, role: 'learning_moderator' as const, offeringId: null as string | null, expiresAt: null as string | null };

  it.each([
    ['granting a role to yourself', { userId: 'admin-1' }, 'You cannot grant a role to yourself'],
    ['a portal administrator grant scoped to an organisation', { role: 'portal_admin', orgId: UUID_A }, 'Portal administrator grants must be platform-wide'],
    ['a product owner grant without an offering', { role: 'product_owner', offeringId: null }, 'Product owner grants require an offering'],
    ['a moderator grant scoped to an offering', { role: 'learning_moderator', offeringId: 'FAI' }, 'Only product owner grants can be offering-scoped'],
    ['an expiry that is already in the past', { expiresAt: new Date(Date.now() - 60_000).toISOString() }, 'Grant expiry must be in the future'],
  ])('refuses %s', async (_label, override, message) => {
    respondTo(query, [[PLATFORM_SQL, [{ id: 'g0' }]]]);
    await expect(createAdminRoleGrant({ ...base, ...override } as never)).rejects.toThrow(message);
    expect(writesIn(query)).toHaveLength(0);
  });

  it('only grants to a verified, active Azentio employee', async () => {
    respondTo(query, [[PLATFORM_SQL, [{ id: 'g0' }]], ['FOR SHARE OF u', []]]);
    await expect(createAdminRoleGrant(base)).rejects.toThrow('Target must be a verified active employee');
  });

  it('scopes a grant to an organisation only when that organisation is an active Azentio organisation', async () => {
    respondTo(query, [
      [PLATFORM_SQL, [{ id: 'g0' }]],
      ['FOR SHARE OF u', [{ id: UUID_B }]],
      ["type = 'azentio' AND status = 'active' FOR SHARE", []],
    ]);
    await expect(createAdminRoleGrant({ ...base, orgId: UUID_A, role: 'content_publisher' })).rejects.toThrow(
      'Scoped grants can only target an active Azentio organization',
    );
  });

  it('refuses a duplicate active grant for the same user, scope, role and offering', async () => {
    respondTo(query, [
      [PLATFORM_SQL, [{ id: 'g0' }]],
      ['FOR SHARE OF u', [{ id: UUID_B }]],
      ['SELECT id FROM role_grants WHERE user_id = $1 AND org_id IS NOT DISTINCT FROM', [{ id: 'rg-old' }]],
    ]);
    await expect(createAdminRoleGrant(base)).rejects.toThrow('An active grant already exists');
    expect(writesIn(query)).toHaveLength(0);
  });

  it('creates the grant with the acting administrator as grantor and audits it', async () => {
    respondTo(query, [
      [PLATFORM_SQL, [{ id: 'g0' }]],
      ['FOR SHARE OF u', [{ id: UUID_B }]],
      ['INSERT INTO role_grants', [{ id: 'rg-new' }]],
    ]);
    await expect(createAdminRoleGrant({ ...base, role: 'product_owner', offeringId: 'FAI', expiresAt: '2030-01-01T00:00:00.000Z' }))
      .resolves.toEqual({ id: 'rg-new' });
    const [insert] = callsMatching(query, 'INSERT INTO role_grants');
    expect(insert.params).toEqual([null, UUID_B, 'product_owner', 'FAI', 'admin-1', '2030-01-01T00:00:00.000Z']);
    expect(metadataOf(callsMatching(query, 'INSERT INTO audit_log')[0].params)).toEqual({ role: 'product_owner', offering_id: 'FAI' });
  });
});

describe('revokeAdminRoleGrant', () => {
  function respondRevoke({ count, role = 'portal_admin', orgId = null as string | null }: { count: number; role?: string; orgId?: string | null }) {
    // The count query also contains the platform-admin predicate, so it must be matched first.
    respondTo(query, [
      ['count(*)::int AS count FROM role_grants', [{ count }]],
      ['SELECT id, user_id, org_id, role, offering_id FROM role_grants', [{ id: UUID_A, user_id: UUID_B, org_id: orgId, role, offering_id: null }]],
      [PLATFORM_SQL, [{ id: 'g0' }]],
    ]);
  }

  it('refuses to revoke the last platform administrator grant', async () => {
    respondRevoke({ count: 1 });
    await expect(revokeAdminRoleGrant({ actorId: 'admin-1', requestId: 'r', grantId: UUID_A })).rejects.toThrow(
      'The last platform administrator grant cannot be revoked',
    );
    expect(writesIn(query)).toHaveLength(0);
  });

  it('allows revoking a platform administrator grant while another one remains', async () => {
    respondRevoke({ count: 2 });
    await expect(revokeAdminRoleGrant({ actorId: 'admin-1', requestId: 'r', grantId: UUID_A })).resolves.toEqual({ id: UUID_A, revoked: true });
    expect(callsMatching(query, 'UPDATE role_grants SET revoked_at')).toHaveLength(1);
  });

  it('does not apply the last-administrator guard to other roles', async () => {
    respondRevoke({ count: 0, role: 'learning_moderator', orgId: 'org-1' });
    await expect(revokeAdminRoleGrant({ actorId: 'admin-1', requestId: 'r', grantId: UUID_A })).resolves.toMatchObject({ revoked: true });
    expect(callsMatching(query, 'count(*)::int AS count FROM role_grants')).toHaveLength(0);
  });

  it('reports a grant that is missing or already inactive as not found', async () => {
    respondTo(query, [[PLATFORM_SQL, [{ id: 'g0' }]]]);
    await expect(revokeAdminRoleGrant({ actorId: 'admin-1', requestId: 'r', grantId: UUID_A })).rejects.toThrow('Active role grant not found');
  });
});
