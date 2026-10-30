import type { AppSession, Membership, MembershipStatus, PortalRole, RoleGrant } from '@/app/(common-lib)/types';

// Shared fixtures for the authorization tests. Not a test file (no .test. infix).

export const USER_ID = 'user-1';
export const ORG_A = 'org-a';
export const ORG_B = 'org-b';
export const OFFER_1 = 'offer-1';
export const OFFER_2 = 'offer-2';

export const past = () => new Date(Date.now() - 60 * 60 * 1000);
export const future = () => new Date(Date.now() + 60 * 60 * 1000);

export function membership(orgId: string, role: PortalRole, status: MembershipStatus = 'active'): Membership {
  return {
    id: `m-${orgId}-${role}-${status}`,
    org_id: orgId,
    user_id: USER_ID,
    role,
    status,
    joined_at: new Date('2026-01-01T00:00:00Z'),
  };
}

/** Omit orgId for a platform-level (global) grant. */
export function grant(
  role: PortalRole,
  scope: { orgId?: string; offeringId?: string | null; expiresAt?: Date | null; revokedAt?: Date | null } = {},
): RoleGrant {
  return {
    id: `g-${role}-${scope.orgId ?? 'global'}-${scope.offeringId ?? 'any'}`,
    org_id: scope.orgId ?? null,
    user_id: USER_ID,
    role,
    offering_id: scope.offeringId ?? null,
    granted_by: 'admin-1',
    expires_at: scope.expiresAt ?? null,
    revoked_at: scope.revokedAt ?? null,
  };
}

export interface SessionSetup {
  memberships?: Membership[];
  grants?: RoleGrant[];
  /** Org id the session has selected as its active workspace (only if an active membership exists). */
  activeOrg?: string;
}

export function session({ memberships = [], grants = [], activeOrg }: SessionSetup = {}): AppSession {
  const active = activeOrg
    ? memberships.find((m) => m.org_id === activeOrg && m.status === 'active')
    : undefined;
  return {
    user: {
      id: USER_ID,
      email: 'user@example.com',
      display_name: 'Test User',
      verified_at: new Date('2026-01-01T00:00:00Z'),
      disabled_at: null,
      created_at: new Date('2026-01-01T00:00:00Z'),
    },
    memberships,
    grants,
    activeWorkspace: active
      ? { orgId: active.org_id, orgName: `Org ${active.org_id}`, orgType: 'client', role: active.role, isSandbox: false }
      : null,
  };
}
