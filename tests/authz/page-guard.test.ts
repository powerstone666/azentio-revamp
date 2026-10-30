import { cookies } from 'next/headers';
import { redirect, notFound } from 'next/navigation';
import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { redirectToLoginOrOnboarding } from '@/app/api/(services)/authz/onboarding-redirect';
import { getSession } from '@/app/api/(services)/authz/session';
import { isDemoOnboardingEnabled } from '@/app/api/(services)/onboarding/flag';
import { getVerifiedIdentity } from '@/app/api/(services)/onboarding/service';
import { MOCK_PERSONA_COOKIE } from '@/app/(ui)/components/portal/signin/mockSession';
import { PERSONAS } from '@/app/(config)/personas';
import { ORG_A, grant, membership, session } from './fixtures';

jest.mock('next/headers', () => ({ headers: jest.fn(), cookies: jest.fn() }));
jest.mock('next/navigation', () => ({
  redirect: jest.fn((url: string) => { throw new Error(`NEXT_REDIRECT:${url}`); }),
  notFound: jest.fn(() => { throw new Error('NEXT_NOT_FOUND'); }),
}));
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn(), verifySession: jest.fn() }));
jest.mock('@/app/api/(services)/onboarding/flag', () => ({ isDemoOnboardingEnabled: jest.fn(() => false) }));
jest.mock('@/app/api/(services)/onboarding/service', () => ({ getVerifiedIdentity: jest.fn() }));
jest.mock('@/app/api/(db)/client', () => ({ query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {} }));

const mockCookies = cookies as unknown as jest.Mock;
const mockGetSession = getSession as unknown as jest.Mock;
const mockOnboardingEnabled = isDemoOnboardingEnabled as unknown as jest.Mock;
const mockVerifiedIdentity = getVerifiedIdentity as unknown as jest.Mock;
const mockRedirect = redirect as unknown as jest.Mock;
const mockNotFound = notFound as unknown as jest.Mock;

/** Only the given cookie name is present; everything else is absent. */
function setCookie(name: string, value?: string) {
  mockCookies.mockResolvedValue({
    get: (n: string) => (n === name && value !== undefined ? { name, value } : undefined),
  });
}

const PERSONA_EMAIL = PERSONAS[0].email;

beforeEach(() => {
  setCookie('none');
  mockOnboardingEnabled.mockReturnValue(false);
  mockVerifiedIdentity.mockResolvedValue(null);
});

describe('requirePortalPage: demo persona cookie', () => {
  it('returns null for a recognised persona cookie without resolving a session', async () => {
    setCookie(MOCK_PERSONA_COOKIE, encodeURIComponent(PERSONA_EMAIL));
    expect(await requirePortalPage('portal:admin:read')).toBeNull();
    expect(mockGetSession).not.toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('falls through to real session checks for an unknown persona email', async () => {
    setCookie(MOCK_PERSONA_COOKIE, encodeURIComponent('nobody@example.com'));
    mockGetSession.mockResolvedValue(null);
    await expect(requirePortalPage('portal:admin:read')).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mockGetSession).toHaveBeenCalled();
  });

  it('falls through to real session checks for a malformed persona cookie', async () => {
    setCookie(MOCK_PERSONA_COOKIE, '%E0%A4%A');
    mockGetSession.mockResolvedValue(null);
    await expect(requirePortalPage('portal:admin:read')).rejects.toThrow('NEXT_REDIRECT:/login');
  });
});

describe('requirePortalPage: unauthenticated visitors', () => {
  it('redirects to /login when there is no session and onboarding is off', async () => {
    mockGetSession.mockResolvedValue(null);
    await expect(requirePortalPage('portal:client:read')).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mockRedirect).toHaveBeenCalledWith('/login');
    expect(mockVerifiedIdentity).not.toHaveBeenCalled();
  });
});

describe('requirePortalPage: authorized and forbidden sessions', () => {
  it('returns the session when the action is permitted', async () => {
    const s = session({ memberships: [membership(ORG_A, 'client_member')], activeOrg: ORG_A });
    mockGetSession.mockResolvedValue(s);
    expect(await requirePortalPage('portal:client:read')).toBe(s);
    expect(mockNotFound).not.toHaveBeenCalled();
  });

  it.each([
    ['a client_member on an admin page', 'portal:admin:read', [membership(ORG_A, 'client_member')], []],
    ['an employee on the moderator page', 'portal:moderator:read', [membership(ORG_A, 'employee')], []],
    ['an org-scoped portal_admin on the platform admin page', 'portal:admin:read', [membership(ORG_A, 'client_member')], [grant('portal_admin', { orgId: ORG_A })]],
    ['a product_owner on the publisher page', 'content:manage', [membership(ORG_A, 'employee')], [grant('product_owner', { orgId: ORG_A, offeringId: 'o-1' })]],
  ])('calls notFound (no redirect) for %s', async (_label, action, memberships, grants) => {
    mockGetSession.mockResolvedValue(session({ memberships, grants, activeOrg: ORG_A }));
    await expect(requirePortalPage(action)).rejects.toThrow('NEXT_NOT_FOUND');
    expect(mockNotFound).toHaveBeenCalled();
    expect(mockRedirect).not.toHaveBeenCalled();
  });

  it('allows the platform portal_admin on the admin page', async () => {
    const s = session({ grants: [grant('portal_admin')] });
    mockGetSession.mockResolvedValue(s);
    expect(await requirePortalPage('portal:admin:read')).toBe(s);
  });
});

describe('redirectToLoginOrOnboarding', () => {
  it('sends a signed-in visitor with no workspace to /onboarding when demo onboarding is enabled and the identity is verified', async () => {
    mockOnboardingEnabled.mockReturnValue(true);
    mockVerifiedIdentity.mockResolvedValue({ email: 'new@example.com', name: null });
    await expect(redirectToLoginOrOnboarding()).rejects.toThrow('NEXT_REDIRECT:/onboarding');
  });

  it('sends to /login when demo onboarding is enabled but there is no verified identity', async () => {
    mockOnboardingEnabled.mockReturnValue(true);
    mockVerifiedIdentity.mockResolvedValue(null);
    await expect(redirectToLoginOrOnboarding()).rejects.toThrow('NEXT_REDIRECT:/login');
  });

  it('sends to /login without checking identity when demo onboarding is disabled', async () => {
    mockOnboardingEnabled.mockReturnValue(false);
    mockVerifiedIdentity.mockResolvedValue({ email: 'new@example.com', name: null });
    await expect(redirectToLoginOrOnboarding()).rejects.toThrow('NEXT_REDIRECT:/login');
    expect(mockVerifiedIdentity).not.toHaveBeenCalled();
  });
});
