import { headers } from 'next/headers';
import { auth } from '@/app/api/(services)/auth/better-auth-config';
import { createAuthApiRequest } from '@/app/api/(services)/auth/request-origin';
import { query } from '@/app/api/(db)/client';
import { getVerifiedIdentity, listOwnDemoRoles } from '@/app/api/(services)/onboarding/service';
import { SELF_SERVICE_ONBOARDING_ROLE_IDS } from '@/app/(config)/onboarding';
import { callsMatching, installFakeDb } from './helpers';

jest.mock('next/headers', () => ({ headers: jest.fn() }));
jest.mock('@/app/api/(services)/auth/better-auth-config', () => ({
  auth: { api: { getSession: jest.fn() } },
}));
jest.mock('@/app/api/(services)/auth/request-origin', () => ({ createAuthApiRequest: jest.fn() }));
jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

const headersMock = headers as unknown as jest.Mock;
const getSession = (auth.api as unknown as { getSession: jest.Mock }).getSession;
const createRequest = createAuthApiRequest as unknown as jest.Mock;
const q = query as unknown as jest.Mock;

beforeEach(() => {
  const incoming = new Headers({ cookie: 'session=test' });
  headersMock.mockResolvedValue(incoming);
  createRequest.mockReturnValue(new Request('https://azentio.ai/'));
});

describe('getVerifiedIdentity', () => {
  it.each<[string, unknown]>([
    ['there is no session', null],
    ['the session has no user', {}],
    ['the user object is empty', { user: {} }],
    ['the user has no email', { user: { email: '', emailVerified: true } }],
    ['the email is unverified', { user: { email: 'priya@x.com', emailVerified: false } }],
    ['emailVerified is missing', { user: { email: 'priya@x.com' } }],
  ])('returns null when %s', async (_label, session) => {
    getSession.mockResolvedValue(session);
    await expect(getVerifiedIdentity()).resolves.toBeNull();
  });

  it('lowercases the verified email address', async () => {
    getSession.mockResolvedValue({ user: { email: 'Priya.Sharma@X.COM', emailVerified: true, name: 'Priya' } });
    await expect(getVerifiedIdentity()).resolves.toEqual({ email: 'priya.sharma@x.com', name: 'Priya' });
  });

  it.each<[string | null | undefined, string | null]>([
    ['  Priya Sharma  ', 'Priya Sharma'],
    ['   ', null],
    [undefined, null],
    [null, null],
  ])('trims the session name %p into %p', async (name, expected) => {
    getSession.mockResolvedValue({ user: { email: 'priya@x.com', emailVerified: true, name } });
    await expect(getVerifiedIdentity()).resolves.toEqual({ email: 'priya@x.com', name: expected });
  });

  it('passes the incoming request headers to host validation and to the session lookup', async () => {
    const incoming = await headersMock();
    getSession.mockResolvedValue({ user: { email: 'priya@x.com', emailVerified: true } });
    await getVerifiedIdentity();
    expect(createRequest).toHaveBeenCalledWith(incoming);
    expect(getSession).toHaveBeenCalledWith({ headers: incoming });
  });

  it('rejects without reading the session when the host fails validation', async () => {
    createRequest.mockImplementation(() => {
      throw new Error('Invalid host');
    });
    await expect(getVerifiedIdentity()).rejects.toThrow('Invalid host');
    expect(getSession).not.toHaveBeenCalled();
  });
});

describe('listOwnDemoRoles', () => {
  it('returns the role of every row found for the email', async () => {
    q.mockResolvedValueOnce([{ role: 'employee' }, { role: 'product_owner' }]);
    await expect(listOwnDemoRoles('priya@x.com')).resolves.toEqual(['employee', 'product_owner']);
  });

  it('returns an empty list when the user holds no demo roles', async () => {
    q.mockResolvedValueOnce([]);
    await expect(listOwnDemoRoles('nobody@x.com')).resolves.toEqual([]);
  });

  it('queries by the email case-insensitively and limits roles to the self-serve list', async () => {
    installFakeDb(q);
    q.mockResolvedValueOnce([]);
    await listOwnDemoRoles('Priya@X.com');
    const [call] = callsMatching(q, 'JOIN users u');
    expect(call.params[0]).toBe('Priya@X.com');
    expect(call.params[1]).toEqual([...SELF_SERVICE_ONBOARDING_ROLE_IDS]);
    expect(call.sql).toContain('lower(u.email) = lower($1)');
  });

  it.each([
    ['only counts active memberships', "m.status = 'active'"],
    ['ignores revoked grants', 'g.revoked_at IS NULL'],
    ['ignores expired grants', 'g.expires_at > now()'],
    ['only counts sandbox organisations', 'o.is_sandbox'],
    ['only counts active organisations', "o.status = 'active'"],
  ])('%s', async (_label, guard) => {
    q.mockResolvedValueOnce([]);
    await listOwnDemoRoles('priya@x.com');
    const sql = String(q.mock.calls[0][0]).replace(/\s+/g, ' ');
    expect(sql).toContain(guard);
  });
});
