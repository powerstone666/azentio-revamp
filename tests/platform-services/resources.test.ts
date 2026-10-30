jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import {
  archiveClientResource,
  createClientResource,
  listAdminClientResources,
  listClientResources,
} from '@/app/api/(services)/resources/service';

const ORG = 'org-client';
const ACTOR = 'admin-1';

type SqlCall = [string, unknown[]?];
const sqlCalls = () => query.mock.calls as SqlCall[];

const baseCreate = {
  actorId: ACTOR, orgId: ORG, title: 'Onboarding guide', description: 'Start here', category: 'Guides',
  resourceUrl: 'https://docs.example.com/guide', offeringId: null, requestId: 'req-1',
};

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

describe('client resource listing', () => {
  it('lists only active resources of an active client org, gated by entitlement for offering-scoped resources', async () => {
    query.mockResolvedValueOnce([]);
    await listClientResources(ORG);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE r\.org_id = \$1 AND r\.status = 'active'/);
    expect(sql).toMatch(/JOIN organizations o ON o\.id = r\.org_id AND o\.type = 'client' AND o\.status = 'active'/);
    expect(sql).toMatch(/r\.offering_id IS NULL OR EXISTS/);
    expect(sql).toMatch(/e\.org_id = r\.org_id AND e\.offering_id = r\.offering_id/);
    expect(sql).toMatch(/LIMIT 100/);
    expect(params).toEqual([ORG]);
  });

  it('lists every resource for the admin view, scoped to the org only', async () => {
    query.mockResolvedValueOnce([]);
    await listAdminClientResources(ORG);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/FROM client_resources WHERE org_id = \$1/);
    expect(sql).not.toMatch(/status = 'active'/);
    expect(params).toEqual([ORG]);
  });
});

describe('client resource creation', () => {
  it('refuses callers who lack a global platform administrator grant and writes nothing', async () => {
    query.mockResolvedValueOnce([]);
    await expect(createClientResource(baseCreate)).rejects.toThrow('Active platform administrator grant required');
    expect(sqlCalls()).toHaveLength(1);
    expect(sqlCalls()[0][0]).toMatch(/role = 'portal_admin'\s+AND org_id IS NULL/);
  });

  it('refuses to attach a resource to a client org that is not active', async () => {
    query.mockResolvedValueOnce([{ id: 'g-1' }]).mockResolvedValueOnce([]);
    await expect(createClientResource(baseCreate)).rejects.toThrow('Active client organization not found');
    expect(sqlCalls().some(([sql]) => sql.includes('INSERT INTO client_resources'))).toBe(false);
  });

  it('refuses an offering-scoped resource when the org has no active entitlement to that offering', async () => {
    query.mockResolvedValueOnce([{ id: 'g-1' }]).mockResolvedValueOnce([{ id: ORG }]).mockResolvedValueOnce([]);
    await expect(createClientResource({ ...baseCreate, offeringId: 'fai' })).rejects.toThrow(
      'An active offering entitlement is required',
    );
    expect(sqlCalls()[2][1]).toEqual([ORG, 'fai']);
  });

  it('skips the entitlement lookup for org-wide resources', async () => {
    query
      .mockResolvedValueOnce([{ id: 'g-1' }])
      .mockResolvedValueOnce([{ id: ORG }])
      .mockResolvedValueOnce([{ id: 'res-1' }])
      .mockResolvedValueOnce([]);
    await expect(createClientResource(baseCreate)).resolves.toEqual({ id: 'res-1' });
    expect(sqlCalls().some(([sql]) => sql.includes('FROM entitlements'))).toBe(false);
  });

  it('inserts the resource attributed to the actor and audits it with the offering in metadata', async () => {
    query
      .mockResolvedValueOnce([{ id: 'g-1' }])
      .mockResolvedValueOnce([{ id: ORG }])
      .mockResolvedValueOnce([{ id: 'ent-1' }])
      .mockResolvedValueOnce([{ id: 'res-1' }])
      .mockResolvedValueOnce([]);
    await createClientResource({ ...baseCreate, offeringId: 'lending' });
    const insert = sqlCalls()[3];
    expect(insert[1]).toEqual([ORG, 'Onboarding guide', 'Start here', 'Guides', 'https://docs.example.com/guide', 'lending', ACTOR]);
    const audit = sqlCalls()[4];
    expect(audit[0]).toMatch(/'client_resource\.create'/);
    expect(audit[1]).toEqual([ACTOR, 'res-1', ORG, 'req-1', JSON.stringify({ offering_id: 'lending' })]);
  });

  it('rejects a non-HTTPS resource link at the service layer, not only in the route', async () => {
    query
      .mockResolvedValueOnce([{ id: 'g-1' }])
      .mockResolvedValueOnce([{ id: ORG }])
      .mockResolvedValueOnce([{ id: 'res-1' }])
      .mockResolvedValueOnce([]);
    await expect(createClientResource({ ...baseCreate, resourceUrl: 'http://insecure.example.com/doc' })).rejects.toThrow();
  });
});

describe('client resource archiving', () => {
  it('archives only an active resource of the given org and audits the archive', async () => {
    query.mockResolvedValueOnce([{ id: 'g-1' }]).mockResolvedValueOnce([{ id: 'res-1' }]).mockResolvedValueOnce([]);
    await expect(archiveClientResource({ actorId: ACTOR, orgId: ORG, resourceId: 'res-1', requestId: 'r' })).resolves.toEqual({ id: 'res-1' });
    const update = sqlCalls()[1];
    expect(update[0]).toMatch(/UPDATE client_resources SET status = 'archived'/);
    expect(update[0]).toMatch(/WHERE id = \$1 AND org_id = \$2 AND status = 'active'/);
    expect(update[1]).toEqual(['res-1', ORG]);
    expect(sqlCalls()[2][1]).toEqual([ACTOR, 'res-1', ORG, 'r']);
  });

  it('reports a resource from another org (or already archived) as not found', async () => {
    query.mockResolvedValueOnce([{ id: 'g-1' }]).mockResolvedValueOnce([]);
    await expect(archiveClientResource({ actorId: ACTOR, orgId: ORG, resourceId: 'other', requestId: 'r' })).rejects.toThrow(
      'Active client resource not found',
    );
    expect(sqlCalls()).toHaveLength(2);
  });

  it('refuses archiving for a caller without a platform administrator grant', async () => {
    query.mockResolvedValueOnce([]);
    await expect(archiveClientResource({ actorId: ACTOR, orgId: ORG, resourceId: 'res-1', requestId: 'r' })).rejects.toThrow(
      'Active platform administrator grant required',
    );
  });
});
