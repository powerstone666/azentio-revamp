jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import {
  grantOrganizationSupportAccess,
  listActiveClientOrganizations,
  listEligiblePortalAdmins,
  listSupportAccessGrants,
  revokeOrganizationSupportAccess,
} from '@/app/api/(services)/support/access';

const ACTOR = 'actor-1';
const ADMIN = 'admin-2';
const ORG = 'org-1';

type SqlCall = [string, unknown[]?];
const sqlCalls = () => query.mock.calls as SqlCall[];

const grantInput = {
  actorId: ACTOR, portalAdminId: ADMIN, orgId: ORG, reason: 'Migration support', durationHours: 24, requestId: 'req-1',
};

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

describe('listing helpers', () => {
  it('lists only eligible portal admins: active global grants on enabled users', async () => {
    query.mockResolvedValueOnce([]);
    await listEligiblePortalAdmins();
    const [sql] = sqlCalls()[0];
    expect(sql).toMatch(/g\.role = 'portal_admin' AND g\.org_id IS NULL AND g\.revoked_at IS NULL/);
    expect(sql).toMatch(/g\.expires_at IS NULL OR g\.expires_at > now\(\)/);
    expect(sql).toMatch(/u\.disabled_at IS NULL/);
  });

  it('lists support access grants without contribution-scoped grants', async () => {
    query.mockResolvedValueOnce([]);
    await listSupportAccessGrants();
    expect(sqlCalls()[0][0]).toMatch(/WHERE sa\.contribution_id IS NULL/);
  });

  it('lists only active client organisations', async () => {
    query.mockResolvedValueOnce([]);
    await listActiveClientOrganizations();
    expect(sqlCalls()[0][0]).toMatch(/WHERE type = 'client' AND status = 'active'/);
  });
});

describe('grantOrganizationSupportAccess', () => {
  it('refuses when the actor is not an active global portal administrator', async () => {
    query.mockResolvedValueOnce([]);
    await expect(grantOrganizationSupportAccess(grantInput)).rejects.toThrow(
      'Active global portal administrator grant required',
    );
    expect(sqlCalls()).toHaveLength(1);
    expect(sqlCalls()[0][1]).toEqual([ACTOR]);
  });

  it('refuses when the target organisation is not an active client workspace', async () => {
    query.mockResolvedValueOnce([{ id: 'g1' }]).mockResolvedValueOnce([]);
    await expect(grantOrganizationSupportAccess(grantInput)).rejects.toThrow('Active client organisation not found');
    expect(sqlCalls()).toHaveLength(2);
  });

  it('refuses when the recipient does not hold an active global portal administrator grant', async () => {
    query
      .mockResolvedValueOnce([{ id: 'g1' }])
      .mockResolvedValueOnce([{ id: ORG }])
      .mockResolvedValueOnce([]);
    await expect(grantOrganizationSupportAccess(grantInput)).rejects.toThrow(
      'Recipient must have an active global portal administrator grant',
    );
    expect(sqlCalls()[2][1]).toEqual([ADMIN]);
  });

  it('refuses a duplicate when the recipient already has active organisation-wide access', async () => {
    query
      .mockResolvedValueOnce([{ id: 'g1' }])
      .mockResolvedValueOnce([{ id: ORG }])
      .mockResolvedValueOnce([{ id: 'g2' }])
      .mockResolvedValueOnce([{ id: 'sa-existing' }]);
    await expect(grantOrganizationSupportAccess(grantInput)).rejects.toThrow('Active support access already exists');
    expect(sqlCalls().some(([sql]) => sql.includes('INSERT INTO support_access'))).toBe(false);
  });

  it('inserts organisation-wide access (no contribution) with the requested duration and audits the grant', async () => {
    const expiresAt = new Date('2026-11-01T00:00:00Z');
    const grantedAt = new Date('2026-10-31T00:00:00Z');
    query
      .mockResolvedValueOnce([{ id: 'g1' }])
      .mockResolvedValueOnce([{ id: ORG }])
      .mockResolvedValueOnce([{ id: 'g2' }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ id: 'sa-new', expires_at: expiresAt, granted_at: grantedAt }])
      .mockResolvedValueOnce([]);

    const result = await grantOrganizationSupportAccess(grantInput);

    expect(transaction).toHaveBeenCalledTimes(1);
    const insert = sqlCalls()[4];
    expect(insert[0]).toMatch(/VALUES \(\$1, \$2, NULL, \$3, now\(\) \+ \(\$4::int \* interval '1 hour'\)\)/);
    expect(insert[1]).toEqual([ADMIN, ORG, 'Migration support', 24]);

    const audit = sqlCalls()[5];
    expect(audit[0]).toMatch(/'support_access\.grant'/);
    expect(audit[0]).toMatch(/'allowed'/);
    expect(audit[1]?.[0]).toBe(ACTOR);
    expect(audit[1]?.[1]).toBe('sa-new');
    expect(audit[1]?.[2]).toBe(ORG);
    expect(JSON.parse(audit[1]?.[4] as string)).toMatchObject({
      recipient_portal_admin_id: ADMIN, reason: 'Migration support', duration_hours: 24,
    });
    expect(result).toEqual({ id: 'sa-new', org_id: ORG, portal_admin_id: ADMIN, granted_at: grantedAt, expires_at: expiresAt, is_active: true });
  });
});

describe('revokeOrganizationSupportAccess', () => {
  it('refuses when the actor is not an active global portal administrator', async () => {
    query.mockResolvedValueOnce([]);
    await expect(revokeOrganizationSupportAccess({ actorId: ACTOR, accessId: 'sa-1', requestId: 'r' })).rejects.toThrow(
      'Active global portal administrator grant required',
    );
    expect(sqlCalls()).toHaveLength(1);
  });

  it('only revokes access that is still active and organisation-wide', async () => {
    query.mockResolvedValueOnce([{ id: 'g1' }]).mockResolvedValueOnce([]);
    await expect(revokeOrganizationSupportAccess({ actorId: ACTOR, accessId: 'sa-1', requestId: 'r' })).rejects.toThrow(
      'Active support access not found',
    );
    const update = sqlCalls()[1];
    expect(update[0]).toMatch(/UPDATE support_access SET revoked_at = now\(\)/);
    expect(update[0]).toMatch(/contribution_id IS NULL/);
    expect(update[0]).toMatch(/revoked_at IS NULL AND expires_at > now\(\)/);
    expect(update[1]).toEqual(['sa-1']);
  });

  it('revokes the access, audits the revocation and returns the revoked record', async () => {
    query
      .mockResolvedValueOnce([{ id: 'g1' }])
      .mockResolvedValueOnce([{ id: 'sa-1', org_id: ORG, portal_admin_id: ADMIN }])
      .mockResolvedValueOnce([]);

    await expect(revokeOrganizationSupportAccess({ actorId: ACTOR, accessId: 'sa-1', requestId: 'req-7' })).resolves.toEqual({
      id: 'sa-1', org_id: ORG, portal_admin_id: ADMIN, revoked: true,
    });
    const audit = sqlCalls()[2];
    expect(audit[0]).toMatch(/'support_access\.revoke'/);
    expect(audit[1]).toEqual([ACTOR, 'sa-1', ORG, 'req-7', JSON.stringify({ recipient_portal_admin_id: ADMIN })]);
  });
});
