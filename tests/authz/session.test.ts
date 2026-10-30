import { headers } from 'next/headers';
import { auth } from '@/app/api/(services)/auth/better-auth-config';
import { query, queryOne } from '@/app/api/(db)/client';
import { verifySession, getSession } from '@/app/api/(services)/authz/session';
import { ORG_A, ORG_B, USER_ID, grant, membership } from './fixtures';

jest.mock('next/headers', () => ({ headers: jest.fn(), cookies: jest.fn() }));
jest.mock('@/app/api/(services)/auth/better-auth-config', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('@/app/api/(db)/client', () => ({ query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {} }));

const mockHeaders = headers as unknown as jest.Mock;
const mockAuthGetSession = auth.api.getSession as unknown as jest.Mock;
const mockQuery = query as unknown as jest.Mock;
const mockQueryOne = queryOne as unknown as jest.Mock;

const USER_ROW = {
  id: USER_ID, email: 'user@example.com', display_name: 'Test User',
  verified_at: new Date('2026-01-01'), disabled_at: null, created_at: new Date('2026-01-01'),
};

function membershipRow(orgId: string, role: string, extra: Partial<Record<string, unknown>> = {}) {
  return {
    ...membership(orgId, role as never),
    org_name: `Org ${orgId}`, org_type: 'client', is_sandbox: false, ...extra,
  };
}

/** Sets the incoming request headers (host + optional cookie) that verifySession reads. */
function requestWith(cookie = '', host = 'azentio.ai') {
  const h = new Headers({ host });
  if (cookie) h.set('cookie', cookie);
  mockHeaders.mockResolvedValue(h);
}

function signedInAs(email = 'User@Example.com', emailVerified = true) {
  mockAuthGetSession.mockResolvedValue({ user: { email, emailVerified } });
}

beforeEach(() => {
  delete process.env.VERCEL;
  requestWith();
  signedInAs();
  mockQueryOne.mockResolvedValue(USER_ROW);
  mockQuery.mockReset();
});

describe('verifySession: authentication and user checks', () => {
  it('returns null when Better Auth reports no session, without touching the database', async () => {
    mockAuthGetSession.mockResolvedValue(null);
    expect(await verifySession()).toBeNull();
    expect(mockQueryOne).not.toHaveBeenCalled();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it.each([
    ['an unverified email', 'user@example.com', false],
    ['a missing email', '', true],
  ])('returns null for a Better Auth session with %s', async (_label, email, verified) => {
    signedInAs(email, verified);
    expect(await verifySession()).toBeNull();
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('returns null when no verified, enabled app user matches the email', async () => {
    mockQueryOne.mockResolvedValueOnce(undefined);
    expect(await verifySession()).toBeNull();
    expect(mockQuery).not.toHaveBeenCalled();
  });

  it('looks the user up case-insensitively and excludes disabled or unverified users in SQL', async () => {
    mockQueryOne.mockResolvedValueOnce(undefined);
    await verifySession();
    const [sql, params] = mockQueryOne.mock.calls[0];
    expect(sql).toContain('lower(email) = lower($1)');
    expect(sql).toContain('disabled_at IS NULL');
    expect(sql).toContain('verified_at IS NOT NULL');
    expect(params).toEqual(['User@Example.com']);
  });

  it('returns null for a user with no active memberships', async () => {
    mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    expect(await verifySession()).toBeNull();
  });

  it('excludes employee memberships for non-azentio emails outside sandbox orgs (checked in SQL)', async () => {
    mockQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await verifySession();
    const [sql, params] = mockQuery.mock.calls[0];
    expect(sql).toContain("m.role <> 'employee'");
    expect(sql).toContain("o.is_sandbox");
    expect(sql).toContain("'%@azentio.com'");
    expect(params).toEqual([USER_ID, 'user@example.com']); // normalised DB email, not the auth-provider casing
  });
});

describe('verifySession: active workspace selection', () => {
  it('auto-selects the only membership when no cookie is set', async () => {
    mockQuery.mockResolvedValueOnce([membershipRow(ORG_A, 'client_member')]).mockResolvedValueOnce([]);
    const s = await verifySession();
    expect(s?.activeWorkspace).toEqual({
      orgId: ORG_A, orgName: `Org ${ORG_A}`, orgType: 'client', role: 'client_member', isSandbox: false,
    });
  });

  it('auto-selects the only membership even when the cookie names an org the user is not in', async () => {
    requestWith(`azentio_active_org=${ORG_B}`);
    mockQuery.mockResolvedValueOnce([membershipRow(ORG_A, 'client_member')]).mockResolvedValueOnce([]);
    const s = await verifySession();
    expect(s?.activeWorkspace?.orgId).toBe(ORG_A);
  });

  it('selects the membership named by the azentio_active_org cookie when several memberships exist', async () => {
    requestWith(`azentio_active_org=${ORG_B}`);
    mockQuery
      .mockResolvedValueOnce([membershipRow(ORG_A, 'client_member'), membershipRow(ORG_B, 'client_admin')])
      .mockResolvedValueOnce([]);
    const s = await verifySession();
    expect(s?.activeWorkspace).toMatchObject({ orgId: ORG_B, role: 'client_admin' });
  });

  it.each([
    ['another cookie before it', `theme=dark; azentio_active_org=${ORG_B}`],
    ['another cookie after it', `azentio_active_org=${ORG_B}; theme=dark`],
  ])('parses the active org cookie with %s', async (_label, cookie) => {
    requestWith(cookie);
    mockQuery
      .mockResolvedValueOnce([membershipRow(ORG_A, 'client_member'), membershipRow(ORG_B, 'client_member')])
      .mockResolvedValueOnce([]);
    expect((await verifySession())?.activeWorkspace?.orgId).toBe(ORG_B);
  });

  it('ignores a cookie whose name only ends with azentio_active_org', async () => {
    requestWith(`my_azentio_active_org=${ORG_B}`);
    mockQuery
      .mockResolvedValueOnce([membershipRow(ORG_A, 'client_member'), membershipRow(ORG_B, 'client_member')])
      .mockResolvedValueOnce([]);
    expect((await verifySession())?.activeWorkspace).toBeNull();
  });

  it('leaves the workspace unselected when several memberships exist and no cookie picks one', async () => {
    mockQuery
      .mockResolvedValueOnce([membershipRow(ORG_A, 'client_member'), membershipRow(ORG_B, 'client_member')])
      .mockResolvedValueOnce([]);
    const s = await verifySession();
    expect(s?.activeWorkspace).toBeNull();
    expect(s?.memberships).toHaveLength(2);
  });

  it('does not select a workspace from a cookie naming an org outside the memberships (no forged tenant)', async () => {
    requestWith(`azentio_active_org=${'org-forged'}`);
    mockQuery
      .mockResolvedValueOnce([membershipRow(ORG_A, 'client_member'), membershipRow(ORG_B, 'client_member')])
      .mockResolvedValueOnce([]);
    expect((await verifySession())?.activeWorkspace).toBeNull();
  });

  it('returns the grants query result unchanged and filters revoked or expired grants in SQL', async () => {
    const grants = [grant('learning_moderator')];
    mockQuery.mockResolvedValueOnce([membershipRow(ORG_A, 'client_member')]).mockResolvedValueOnce(grants);
    const s = await verifySession();
    expect(s?.grants).toBe(grants);
    const [grantSql] = mockQuery.mock.calls[1];
    expect(grantSql).toContain('revoked_at IS NULL');
    expect(grantSql).toContain('expires_at > now()');
  });

  it('exposes the memberships and the verified user on the session', async () => {
    mockQuery.mockResolvedValueOnce([membershipRow(ORG_A, 'client_admin')]).mockResolvedValueOnce([]);
    const s = await verifySession();
    expect(s?.user).toMatchObject({ id: USER_ID, email: 'user@example.com' });
    expect(s?.memberships[0]).toMatchObject({ org_id: ORG_A, role: 'client_admin' });
  });
});

describe('verifySession: request validation', () => {
  it('rejects a request whose host header is not a valid hostname before calling auth', async () => {
    requestWith('', 'evil.example/path');
    await expect(verifySession()).rejects.toThrow('Cannot determine the request host for authentication');
    expect(mockAuthGetSession).not.toHaveBeenCalled();
  });

  it('passes the incoming request headers (not a synthetic request) to Better Auth', async () => {
    mockQuery.mockResolvedValueOnce([membershipRow(ORG_A, 'client_member')]).mockResolvedValueOnce([]);
    requestWith('azentio_active_org=' + ORG_A);
    await verifySession();
    expect(mockAuthGetSession).toHaveBeenCalledWith({ headers: expect.any(Headers) });
  });
});

describe('getSession', () => {
  it('is the exported, request-cached resolver for verifySession', async () => {
    mockAuthGetSession.mockResolvedValue(null);
    expect(typeof getSession).toBe('function');
    expect(await getSession()).toBeNull();
  });
});
