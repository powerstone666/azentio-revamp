/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(db)/client', () => ({ query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {} }));

import { getSession } from '@/app/api/(services)/authz/session';
import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '@/tests/support/db';
import { GET, POST } from '@/app/api/v1/workspaces/route';
import { IDS, makeRequest, makeSession, readJson } from './fixtures';

const getSessionMock = jest.mocked(getSession);
const db = mockDb({ query, queryOne, transaction });

const originalEnv = process.env.NODE_ENV;
afterEach(() => {
  (process.env as Record<string, string | undefined>).NODE_ENV = originalEnv;
});

describe('GET /api/v1/workspaces', () => {
  it('rejects an unauthenticated request with 401 and does not query memberships', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: 'Authentication required' });
    expect(db.query).not.toHaveBeenCalled();
  });

  it('lists only the signed-in user\'s active memberships under a data key', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    const rows = [{ membership_id: IDS.membershipA, org_id: IDS.orgA, org_name: 'Acme Bank', org_type: 'client', role: 'client_member', status: 'active' }];
    db.query.mockResolvedValueOnce(rows);
    const response = await GET();
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: rows });
    expect(db.query).toHaveBeenCalledTimes(1);
    const [sql, params] = db.query.mock.calls[0];
    expect(sql).toMatch(/m\.user_id = \$1/);
    expect(sql).toMatch(/m\.status = 'active'/);
    expect(params).toEqual([IDS.user]);
  });
});

describe('POST /api/v1/workspaces (select active workspace)', () => {
  it('rejects an unauthenticated selection with 401 and sets no cookie', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await POST(makeRequest('/api/v1/workspaces', { body: { membership_id: IDS.membershipA } }));
    expect(response.status).toBe(401);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(db.queryOne).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', { rawBody: '{"membership_id": ' }, 400],
    ['an empty object', { body: {} }, 422],
    ['a membership id that is not a UUID', { body: { membership_id: 'abc' } }, 422],
    ['a numeric membership id', { body: { membership_id: 42 } }, 422],
  ])('rejects %s with %i before touching the database', async (_label, init, status) => {
    getSessionMock.mockResolvedValue(makeSession());
    const response = await POST(makeRequest('/api/v1/workspaces', init));
    expect(response.status).toBe(status);
    expect(response.headers.get('Set-Cookie')).toBeNull();
    expect(db.queryOne).not.toHaveBeenCalled();
  });

  it('returns 404 when the membership does not belong to the signed-in user', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    db.queryOne.mockResolvedValueOnce(null);
    const response = await POST(makeRequest('/api/v1/workspaces', { body: { membership_id: IDS.membershipB } }));
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Workspace membership not found' });
    expect(response.headers.get('Set-Cookie')).toBeNull();
  });

  it('scopes the membership lookup to the session user rather than any body-supplied user', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    db.queryOne.mockResolvedValueOnce({ org_id: IDS.orgB });
    await POST(makeRequest('/api/v1/workspaces', { body: { membership_id: IDS.membershipB, user_id: IDS.otherUser } }));
    const [sql, params] = db.queryOne.mock.calls[0];
    expect(sql).toMatch(/m\.user_id = \$2/);
    expect(params).toEqual([IDS.membershipB, IDS.user]);
  });

  it('sets the azentio_active_org cookie to the org resolved from the database and returns it', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    db.queryOne.mockResolvedValueOnce({ org_id: IDS.orgB });
    const response = await POST(makeRequest('/api/v1/workspaces', { body: { membership_id: IDS.membershipB } }));
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: { membership_id: IDS.membershipB, org_id: IDS.orgB } });
    expect(response.headers.get('Set-Cookie')).toBe(
      `azentio_active_org=${IDS.orgB}; Path=/; HttpOnly; SameSite=Lax`,
    );
  });

  it.each([
    ['production', '; Secure'],
    ['development', ''],
  ])('marks the cookie Secure only in production (NODE_ENV=%s)', async (env, suffix) => {
    (process.env as Record<string, string | undefined>).NODE_ENV = env;
    getSessionMock.mockResolvedValue(makeSession());
    db.queryOne.mockResolvedValueOnce({ org_id: IDS.orgB });
    const response = await POST(makeRequest('/api/v1/workspaces', { body: { membership_id: IDS.membershipB } }));
    expect(response.headers.get('Set-Cookie')).toBe(
      `azentio_active_org=${IDS.orgB}; Path=/; HttpOnly; SameSite=Lax${suffix}`,
    );
  });

  it('ignores a tenant id supplied in the body and uses the org the membership actually belongs to', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    db.queryOne.mockResolvedValueOnce({ org_id: IDS.orgB });
    const response = await POST(makeRequest('/api/v1/workspaces', {
      body: { membership_id: IDS.membershipB, org_id: IDS.orgC },
    }));
    const body = await readJson(response);
    expect(body.data.org_id).toBe(IDS.orgB);
    expect(response.headers.get('Set-Cookie')).toContain(`azentio_active_org=${IDS.orgB};`);
    expect(response.headers.get('Set-Cookie')).not.toContain(IDS.orgC);
    expect(db.queryOne.mock.calls[0][1]).not.toContain(IDS.orgC);
  });
});
