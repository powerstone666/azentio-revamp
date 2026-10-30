import { isDemoOnboardingEnabled } from '@/app/api/(services)/onboarding/flag';
import {
  OnboardingError,
  getVerifiedIdentity,
  listOwnDemoRoles,
  provisionDemoWorkspaces,
} from '@/app/api/(services)/onboarding/service';
import { GET, POST } from '@/app/api/v1/onboarding/route';

jest.mock('@/app/api/(services)/onboarding/flag', () => ({ isDemoOnboardingEnabled: jest.fn() }));
jest.mock('@/app/api/(services)/onboarding/service', () => {
  class OnboardingError extends Error {
    status: number;
    constructor(message: string, status = 400) {
      super(message);
      this.status = status;
    }
  }
  return {
    OnboardingError,
    getVerifiedIdentity: jest.fn(),
    listOwnDemoRoles: jest.fn(),
    provisionDemoWorkspaces: jest.fn(),
  };
});

const flagMock = isDemoOnboardingEnabled as unknown as jest.Mock;
const identityMock = getVerifiedIdentity as unknown as jest.Mock;
const rolesMock = listOwnDemoRoles as unknown as jest.Mock;
const provisionMock = provisionDemoWorkspaces as unknown as jest.Mock;

const SIGNED_IN = { email: 'priya.sharma@x.com', name: null };
const WORKSPACE = {
  membership_id: 'm-1', org_id: 'org-1', org_name: 'Azentio Shared Demo', role: 'employee', created: true,
};

const URL_ = 'https://azentio.ai/api/v1/onboarding';

function post(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request(URL_, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-forwarded-host': 'azentio.ai', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

beforeEach(() => {
  flagMock.mockReturnValue(true);
  identityMock.mockResolvedValue(SIGNED_IN);
  rolesMock.mockResolvedValue([]);
  provisionMock.mockResolvedValue([WORKSPACE]);
});

describe('GET /api/v1/onboarding', () => {
  it('returns 404 when demo onboarding is disabled, without looking up the session', async () => {
    flagMock.mockReturnValue(false);
    const res = await GET();
    expect(res.status).toBe(404);
    expect(identityMock).not.toHaveBeenCalled();
  });

  it('returns 401 when there is no verified identity', async () => {
    identityMock.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(401);
    expect(rolesMock).not.toHaveBeenCalled();
  });

  it('returns the signed-in user\'s demo roles', async () => {
    rolesMock.mockResolvedValue(['employee']);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(rolesMock).toHaveBeenCalledWith('priya.sharma@x.com');
    await expect(res.json()).resolves.toEqual({ data: { roles: ['employee'] } });
  });
});

describe('POST /api/v1/onboarding gating', () => {
  it('returns 404 when demo onboarding is disabled, even for a cross-origin request', async () => {
    flagMock.mockReturnValue(false);
    const res = await POST(post({ roles: ['employee'] }, { origin: 'https://evil.example' }));
    expect(res.status).toBe(404);
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it('returns 403 for a cross-origin Origin before checking the session', async () => {
    identityMock.mockResolvedValue(null);
    const res = await POST(post({ roles: ['employee'] }, { origin: 'https://evil.example' }));
    expect(res.status).toBe(403);
    expect(identityMock).not.toHaveBeenCalled();
    expect(provisionMock).not.toHaveBeenCalled();
  });

  it.each(['not a url', 'a bare word'])('returns 403 for a malformed Origin header %p', async (origin) => {
    const res = await POST(post({ roles: ['employee'] }, { origin }));
    expect(res.status).toBe(403);
  });

  it('accepts an Origin that matches the forwarded host', async () => {
    const res = await POST(post({ roles: ['employee'] }, { origin: 'https://azentio.ai' }));
    expect(res.status).toBe(201);
  });

  it('accepts a request with no Origin header', async () => {
    const res = await POST(post({ roles: ['employee'] }));
    expect(res.status).toBe(201);
  });

  it('returns 401 without an identity and provisions nothing', async () => {
    identityMock.mockResolvedValue(null);
    const res = await POST(post({ roles: ['employee'] }));
    expect(res.status).toBe(401);
    expect(provisionMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/onboarding body validation', () => {
  it.each<[string, unknown]>([
    ['portal_admin is requested', { roles: ['portal_admin'] }],
    ['portal_admin is mixed with a valid role', { roles: ['employee', 'portal_admin'] }],
    ['the roles array is empty', { roles: [] }],
    ['more than one role is requested', { roles: ['employee', 'client_member'] }],
    ['roles is missing', {}],
    ['roles is not an array', { roles: 'employee' }],
    ['a role id is unknown', { roles: ['admin'] }],
    ['there are more roles than self-serve roles', { roles: Array(7).fill('employee') }],
    ['the body is not JSON', 'not json'],
    ['there is no body', undefined],
  ])('returns 400 when %s', async (_label, body) => {
    const res = await POST(post(body));
    expect(res.status).toBe(400);
    await expect(res.json()).resolves.toEqual({ error: 'Choose one role.' });
    expect(provisionMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/onboarding provisioning', () => {
  it('returns 201 with the provisioned workspaces and passes the parsed roles through', async () => {
    const res = await POST(post({ roles: ['employee'] }));
    expect(res.status).toBe(201);
    expect(provisionMock).toHaveBeenCalledWith(SIGNED_IN, ['employee']);
    await expect(res.json()).resolves.toEqual({ data: { workspaces: [WORKSPACE] } });
  });

  it.each<[number, string]>([
    [403, 'This account has been disabled.'],
    [409, 'You already have a demo role. Each account can try one role.'],
    [503, 'The shared demo workspace is unavailable.'],
  ])('propagates OnboardingError status %i with its message', async (status, message) => {
    provisionMock.mockRejectedValue(new OnboardingError(message, status));
    const res = await POST(post({ roles: ['employee'] }));
    expect(res.status).toBe(status);
    await expect(res.json()).resolves.toEqual({ error: message });
  });

  it('turns an unexpected error into a generic 500 without leaking details', async () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    provisionMock.mockRejectedValue(new Error('connect ECONNREFUSED postgres://app:hunter2@db.internal'));
    const res = await POST(post({ roles: ['employee'] }));
    expect(res.status).toBe(500);
    const text = await res.text();
    expect(JSON.parse(text)).toEqual({ error: 'Could not set up your demo workspace.' });
    expect(text).not.toContain('hunter2');
    expect(text).not.toContain('ECONNREFUSED');
    spy.mockRestore();
  });
});
