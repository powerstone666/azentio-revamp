jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import {
  createBroadcast,
  getClientBroadcastTarget,
  getEmployeeBroadcastTarget,
  listClientBroadcasts,
  listEmployeeBroadcasts,
  listManagedBroadcasts,
  updateBroadcast,
  updateBroadcastInvitations,
} from '@/app/api/(services)/broadcasts/service';

const USER = 'user-1';
const ORG = 'org-azentio';
const BROADCAST = 'bc-1';
const CLIENT_A = 'client-a';
const CLIENT_B = 'client-b';

type SqlCall = [string, unknown[]?];
const sqlCalls = () => query.mock.calls as SqlCall[];

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

const publisherOk = () => {
  query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([{ id: 'g-1' }]);
};

const baseCreate = {
  userId: USER, orgId: ORG, requestId: 'req-1', title: 'Quarterly town hall', description: 'All hands',
  startsAt: '2026-11-05T10:00:00Z', endsAt: null, joinUrl: 'https://meet.example.com/a', recordingUrl: null,
};

describe('employee and client broadcast reads', () => {
  it('lists employee broadcasts only for the org, only the employees audience, and never cancelled sessions', async () => {
    query.mockResolvedValueOnce([]);
    await listEmployeeBroadcasts(ORG);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE b\.org_id = \$1 AND b\.audience = 'employees' AND b\.status <> 'cancelled'/);
    expect(sql).toMatch(/LIMIT 100/);
    expect(params).toEqual([ORG]);
  });

  it.each([
    ['live', 'join', 'https://meet.example.com/live'],
    ['recorded', 'recording', 'https://video.example.com/rec'],
  ])('returns the %s session link for the %s target only for an employee-audience session', async (status, kind, link) => {
    query.mockResolvedValueOnce([{ join_url: 'https://meet.example.com/live', recording_url: 'https://video.example.com/rec', status }]);
    await expect(getEmployeeBroadcastTarget(ORG, BROADCAST, kind as 'join' | 'recording')).resolves.toBe(link);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE id = \$1 AND org_id = \$2 AND audience = 'employees' AND status <> 'cancelled'/);
    expect(params).toEqual([BROADCAST, ORG]);
  });

  it.each([
    ['scheduled', 'join'], ['scheduled', 'recording'], ['live', 'recording'],
    ['recorded', 'join'], ['cancelled', 'join'], ['cancelled', 'recording'],
  ])('withholds the link for a %s session when asked for the %s target', async (status, kind) => {
    query.mockResolvedValueOnce([{ join_url: 'https://x', recording_url: 'https://y', status }]);
    await expect(getEmployeeBroadcastTarget(ORG, BROADCAST, kind as 'join' | 'recording')).resolves.toBeNull();
  });

  it('returns null for an employee target that does not exist in the org', async () => {
    query.mockResolvedValueOnce([]);
    await expect(getEmployeeBroadcastTarget(ORG, BROADCAST, 'join')).resolves.toBeNull();
  });

  it('lists client broadcasts only for invited client workspaces (or own sandbox) on the clients audience', async () => {
    query.mockResolvedValueOnce([]);
    await listClientBroadcasts(CLIENT_A);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/b\.audience = 'clients'/);
    expect(sql).toMatch(/i\.org_id = \$1 OR \(o\.is_sandbox = true AND b\.org_id = \$1\)/);
    expect(sql).toMatch(/i\.revoked_at IS NULL/);
    expect(sql).toMatch(/BETWEEN now\(\) - interval '180 days' AND now\(\) \+ interval '180 days'/);
    expect(params).toEqual([CLIENT_A]);
  });

  it.each([
    ['live', 'join', true],
    ['scheduled', 'join', false],
    ['recorded', 'recording', true],
    ['cancelled', 'join', false],
  ])('client %s session %s target exposes the link: %s', async (status, kind, exposed) => {
    query.mockResolvedValueOnce([{ join_url: 'https://j', recording_url: 'https://r', status }]);
    const result = await getClientBroadcastTarget(CLIENT_A, BROADCAST, kind as 'join' | 'recording');
    expect(result !== null).toBe(exposed);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/i\.org_id = \$2 OR \(o\.is_sandbox = true AND b\.org_id = \$2\)/);
    expect(sql).toMatch(/b\.audience = 'clients'/);
    expect(params).toEqual([BROADCAST, CLIENT_A]);
  });

  it('lists managed broadcasts scoped to the publishing org and aggregates only active invitations', async () => {
    query.mockResolvedValueOnce([]);
    await listManagedBroadcasts(ORG);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE b\.org_id = \$1/);
    expect(sql).toMatch(/FILTER \(WHERE i\.revoked_at IS NULL\)/);
    expect(params).toEqual([ORG]);
  });
});

describe('createBroadcast permissions and validation', () => {
  it('refuses a user who is not an active employee of the workspace and writes nothing', async () => {
    query.mockResolvedValueOnce([]);
    await expect(createBroadcast(baseCreate)).rejects.toThrow('Active employee membership required');
    expect(sqlCalls()).toHaveLength(1);
    expect(sqlCalls()[0][0]).toMatch(/\(m\.role = 'employee' AND o\.type = 'azentio'\) OR o\.is_sandbox = true/);
  });

  it('refuses a member who lacks the content_publisher grant', async () => {
    query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([]);
    await expect(createBroadcast(baseCreate)).rejects.toThrow('Active content publisher grant required');
    expect(sqlCalls()).toHaveLength(2);
  });

  it('accepts a publisher grant that is scoped to this org or global', async () => {
    publisherOk();
    query.mockResolvedValueOnce([{ is_sandbox: false }]).mockResolvedValueOnce([{ id: BROADCAST }]).mockResolvedValueOnce([]);
    await createBroadcast(baseCreate);
    const grantSql = sqlCalls()[1][0];
    expect(grantSql).toMatch(/role = 'content_publisher'/);
    expect(grantSql).toMatch(/\(org_id = \$2 OR org_id IS NULL\)/);
  });

  it.each([
    [
      'employee audience with client invitations',
      { invitedOrgIds: [CLIENT_A] }, false,
      'Employee sessions cannot have client workspace invitations',
    ],
    [
      'sandbox workspace inviting external workspaces',
      { audience: 'clients' as const, invitedOrgIds: [CLIENT_A] }, true,
      'Demo sessions cannot invite external workspaces',
    ],
    [
      'client audience without any invitation in a non-sandbox workspace',
      { audience: 'clients' as const, invitedOrgIds: [] }, false,
      'Invite at least one client workspace',
    ],
  ])('rejects %s before inserting anything', async (_label, extra, isSandbox, message) => {
    publisherOk();
    query.mockResolvedValueOnce([{ is_sandbox: isSandbox }]);
    await expect(createBroadcast({ ...baseCreate, ...extra })).rejects.toThrow(message);
    expect(sqlCalls().some(([sql]) => sql.includes('INSERT INTO broadcast_sessions'))).toBe(false);
  });

  it('allows a sandbox client-audience session without invitations', async () => {
    publisherOk();
    query.mockResolvedValueOnce([{ is_sandbox: true }]).mockResolvedValueOnce([{ id: BROADCAST }]).mockResolvedValueOnce([]);
    await expect(createBroadcast({ ...baseCreate, audience: 'clients' })).resolves.toEqual({ id: BROADCAST });
  });

  it('rejects client invitations that include an inactive or non-client workspace', async () => {
    publisherOk();
    query
      .mockResolvedValueOnce([{ is_sandbox: false }])
      .mockResolvedValueOnce([{ id: CLIENT_A }]);
    await expect(createBroadcast({ ...baseCreate, audience: 'clients', invitedOrgIds: [CLIENT_A, CLIENT_B] })).rejects.toThrow(
      'One or more invited client workspaces are unavailable',
    );
    expect(sqlCalls().some(([sql]) => sql.includes('INSERT INTO broadcast_sessions'))).toBe(false);
  });

  it('de-duplicates repeated invitations before validating them', async () => {
    publisherOk();
    query
      .mockResolvedValueOnce([{ is_sandbox: false }])
      .mockResolvedValueOnce([{ id: CLIENT_A }])
      .mockResolvedValueOnce([{ id: BROADCAST }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
    await createBroadcast({ ...baseCreate, audience: 'clients', invitedOrgIds: [CLIENT_A, CLIENT_A] });
    // Call order: membership, grant, sandbox check, target validation, ...
    expect(sqlCalls()[3][0]).toMatch(/id = ANY\(\$1::uuid\[\]\)/);
    expect(sqlCalls()[3][1]).toEqual([[CLIENT_A]]);
  });
});

describe('createBroadcast writes', () => {
  it('creates a scheduled employee session with the caller as host and creator, audits it, and sends no invitations', async () => {
    publisherOk();
    query
      .mockResolvedValueOnce([{ is_sandbox: false }])
      .mockResolvedValueOnce([{ id: BROADCAST }])
      .mockResolvedValueOnce([]);

    await expect(createBroadcast(baseCreate)).resolves.toEqual({ id: BROADCAST });
    expect(transaction).toHaveBeenCalledTimes(1);

    const insert = sqlCalls()[3];
    expect(insert[0]).toMatch(/'scheduled', \$8, \$9, \$4\)/);
    expect(insert[1]).toEqual([
      ORG, baseCreate.title, baseCreate.description, USER, baseCreate.startsAt, null, 'employees',
      baseCreate.joinUrl, null,
    ]);
    const audit = sqlCalls()[4];
    expect(audit[0]).toMatch(/'broadcast\.create'/);
    expect(audit[1]).toEqual([USER, BROADCAST, ORG, 'req-1']);
    expect(sqlCalls().some(([sql]) => sql.includes('broadcast_session_invited_orgs'))).toBe(false);
  });

  it('invites each client workspace, notifies its members, and audits the invitation count', async () => {
    publisherOk();
    query
      .mockResolvedValueOnce([{ is_sandbox: false }])
      .mockResolvedValueOnce([{ id: CLIENT_A }, { id: CLIENT_B }])
      .mockResolvedValueOnce([{ id: BROADCAST }])
      .mockResolvedValueOnce([]) // invite A
      .mockResolvedValueOnce([]) // notify A
      .mockResolvedValueOnce([]) // invite B
      .mockResolvedValueOnce([]) // notify B
      .mockResolvedValueOnce([]) // audit create
      .mockResolvedValueOnce([]); // audit invitations

    await createBroadcast({ ...baseCreate, audience: 'clients', invitedOrgIds: [CLIENT_A, CLIENT_B] });

    const sql = sqlCalls().map(([text]) => text);
    expect(sql.filter((text) => text.includes('INSERT INTO broadcast_session_invited_orgs'))).toHaveLength(2);
    const notifications = sqlCalls().filter(([text]) => text.includes('INSERT INTO notifications'));
    expect(notifications).toHaveLength(2);
    expect(notifications[0][0]).toMatch(/o\.type = 'client' AND o\.status = 'active'/);
    expect(notifications[0][0]).toMatch(/m\.role IN \('client_member', 'client_admin'\)/);
    expect(notifications[0][1]).toEqual([CLIENT_A, JSON.stringify({ broadcast_session_id: BROADCAST, title: baseCreate.title })]);
    const invitesAudit = sqlCalls().find(([text]) => text.includes('broadcast.invitations_update'));
    expect(invitesAudit?.[1]).toEqual([USER, BROADCAST, ORG, 'req-1', JSON.stringify({ invited_org_count: 2 })]);
  });
});

describe('updateBroadcast status machine', () => {
  function queueExisting(status: string, audience = 'employees', extra: unknown[] = []) {
    publisherOk();
    query.mockResolvedValueOnce([{ id: BROADCAST, status, join_url: 'https://j', recording_url: 'https://r', audience }]);
    extra.forEach((row) => query.mockResolvedValueOnce(row as unknown[]));
    query.mockResolvedValueOnce([{ id: BROADCAST, status: 'live' }]).mockResolvedValueOnce([]);
  }

  it.each([
    ['scheduled', 'live'], ['scheduled', 'cancelled'], ['live', 'recorded'], ['live', 'cancelled'],
  ])('allows %s -> %s', async (from, to) => {
    queueExisting(from);
    await updateBroadcast({ userId: USER, orgId: ORG, requestId: 'r', id: BROADCAST, status: to as never, joinUrl: null, recordingUrl: null });
    expect(sqlCalls()[3][0]).toMatch(/UPDATE broadcast_sessions SET status = \$1/);
  });

  it.each([
    ['scheduled', 'recorded'], ['live', 'scheduled'], ['recorded', 'live'], ['cancelled', 'scheduled'], ['recorded', 'cancelled'],
  ])('rejects %s -> %s without updating', async (from, to) => {
    queueExisting(from);
    await expect(updateBroadcast({ userId: USER, orgId: ORG, requestId: 'r', id: BROADCAST, status: to as never, joinUrl: null, recordingUrl: null })).rejects.toThrow(
      'Broadcast status transition is not allowed',
    );
    expect(sqlCalls().some(([text]) => text.includes('UPDATE broadcast_sessions'))).toBe(false);
  });

  it('requires a join link before a session goes live', async () => {
    publisherOk();
    query.mockResolvedValueOnce([{ id: BROADCAST, status: 'scheduled', join_url: null, recording_url: null, audience: 'employees' }]);
    await expect(updateBroadcast({ userId: USER, orgId: ORG, requestId: 'r', id: BROADCAST, status: 'live', joinUrl: null, recordingUrl: null })).rejects.toThrow(
      'A join link is required before starting a session',
    );
  });

  it('requires a recording link before a recording is published', async () => {
    publisherOk();
    query.mockResolvedValueOnce([{ id: BROADCAST, status: 'live', join_url: 'https://j', recording_url: null, audience: 'employees' }]);
    await expect(updateBroadcast({ userId: USER, orgId: ORG, requestId: 'r', id: BROADCAST, status: 'recorded', joinUrl: null, recordingUrl: null })).rejects.toThrow(
      'A recording link is required before publishing a recording',
    );
  });

  it('keeps stored links when the caller does not supply new ones and audits the transition', async () => {
    queueExisting('live');
    await updateBroadcast({ userId: USER, orgId: ORG, requestId: 'req-5', id: BROADCAST, status: 'recorded', joinUrl: null, recordingUrl: null });
    const update = sqlCalls()[3];
    expect(update[1]).toEqual(['recorded', 'https://j', 'https://r', BROADCAST, ORG]);
    const audit = sqlCalls()[4];
    expect(audit[0]).toMatch(/'broadcast\.status_update'/);
    expect(audit[1]).toEqual([USER, BROADCAST, ORG, 'req-5', JSON.stringify({ from: 'live', to: 'recorded' })]);
  });

  it('refuses to open a client webinar that has no active invitation and is not a sandbox', async () => {
    publisherOk();
    query
      .mockResolvedValueOnce([{ id: BROADCAST, status: 'scheduled', join_url: 'https://j', recording_url: null, audience: 'clients' }])
      .mockResolvedValueOnce([{ total: 0 }])
      .mockResolvedValueOnce([{ is_sandbox: false }]);
    await expect(updateBroadcast({ userId: USER, orgId: ORG, requestId: 'r', id: BROADCAST, status: 'live', joinUrl: null, recordingUrl: null })).rejects.toThrow(
      'Invite at least one client workspace before opening this webinar',
    );
  });

  it('reports a missing or cross-org session as not found', async () => {
    publisherOk();
    query.mockResolvedValueOnce([]);
    await expect(updateBroadcast({ userId: USER, orgId: ORG, requestId: 'r', id: 'other', status: 'live', joinUrl: 'x', recordingUrl: null })).rejects.toThrow(
      'Broadcast session not found',
    );
    expect(sqlCalls()[2][1]).toEqual(['other', ORG]);
  });
});

describe('updateBroadcastInvitations', () => {
  function queueSession(overrides: Partial<{ audience: string; status: string; sandbox: boolean; targets: unknown[]; current: unknown[] }> = {}) {
    const o = { audience: 'clients', status: 'scheduled', sandbox: false, targets: [{ id: CLIENT_A }], current: [], ...overrides };
    publisherOk();
    query
      .mockResolvedValueOnce([{ is_sandbox: o.sandbox }])
      .mockResolvedValueOnce(o.audience ? [{ id: BROADCAST, audience: o.audience, status: o.status }] : [])
      .mockResolvedValueOnce(o.targets)
      .mockResolvedValueOnce(o.current)
      .mockResolvedValueOnce([{ title: 'Partner webinar' }]);
  }

  it('refuses sandbox workspaces, which cannot invite external workspaces', async () => {
    queueSession({ sandbox: true });
    await expect(updateBroadcastInvitations({ userId: USER, publisherOrgId: ORG, broadcastId: BROADCAST, invitedOrgIds: [CLIENT_A], requestId: 'r' })).rejects.toThrow(
      'Demo sessions cannot invite external workspaces',
    );
  });

  it.each([
    ['employees', 'scheduled'], ['clients', 'recorded'], ['clients', 'cancelled'],
  ])('refuses to change invitations for an %s session in status %s', async (audience, status) => {
    queueSession({ audience, status });
    await expect(updateBroadcastInvitations({ userId: USER, publisherOrgId: ORG, broadcastId: BROADCAST, invitedOrgIds: [CLIENT_A], requestId: 'r' })).rejects.toThrow(
      'Active client webinar not found',
    );
  });

  it('refuses an empty invitation list instead of silently revoking everyone', async () => {
    queueSession();
    await expect(updateBroadcastInvitations({ userId: USER, publisherOrgId: ORG, broadcastId: BROADCAST, invitedOrgIds: [], requestId: 'r' })).rejects.toThrow(
      'Invite at least one client workspace',
    );
    expect(sqlCalls().some(([text]) => text.includes('SET revoked_at = now()'))).toBe(false);
  });

  it('revokes invitations that are no longer listed, upserts the rest, and notifies only newly invited workspaces', async () => {
    queueSession({ targets: [{ id: CLIENT_A }, { id: CLIENT_B }], current: [{ org_id: CLIENT_A }] });
    query.mockResolvedValue([]);
    await expect(updateBroadcastInvitations({ userId: USER, publisherOrgId: ORG, broadcastId: BROADCAST, invitedOrgIds: [CLIENT_A, CLIENT_B, CLIENT_A], requestId: 'req-2' })).resolves.toEqual({
      broadcast_id: BROADCAST, invited_org_ids: [CLIENT_A, CLIENT_B],
    });

    const revoke = sqlCalls().find(([text]) => text.includes('SET revoked_at = now()'));
    expect(revoke?.[0]).toMatch(/NOT \(org_id = ANY\(\$2::uuid\[\]\)\)/);
    expect(revoke?.[1]).toEqual([BROADCAST, [CLIENT_A, CLIENT_B]]);

    const upserts = sqlCalls().filter(([text]) => text.includes('ON CONFLICT (broadcast_id, org_id)'));
    expect(upserts).toHaveLength(2);
    const notified = sqlCalls().filter(([text]) => text.includes('INSERT INTO notifications')).map(([, params]) => params?.[0]);
    expect(notified).toEqual([CLIENT_B]);
  });
});
