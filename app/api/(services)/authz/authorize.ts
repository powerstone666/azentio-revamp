import 'server-only';

import type { AppSession, PortalRole } from '@/app/(common-lib)/types';
import { queryOne } from '@/app/api/(db)/client';
import { getSession } from './session';

export interface AuthorizeParams {
  action: string;
  resource?: {
    type: string;
    id?: string;
    orgId?: string;
    offeringId?: string;
    feature?: string;
    requireEntitlement?: boolean;
  };
  activeWorkspace?: { orgId: string; role: PortalRole } | null;
}

export interface AuthorizeResult {
  allowed: boolean;
  reason?: string;
}

type Policy = { roles?: PortalRole[]; membership?: boolean; allowGlobalGrant?: boolean };

const POLICIES: Record<string, Policy> = {
  'workspace:list': { membership: true },
  'workspace:select': { membership: true },
  'contribution:list': { roles: ['client_member', 'client_admin'] },
  'contribution:create': { roles: ['client_member', 'client_admin'] },
  'contribution:update': { roles: ['client_member', 'client_admin'] },
  'contribution:submit': { roles: ['client_member', 'client_admin'] },
  'contribution:withdraw': { roles: ['client_member', 'client_admin'] },
  'contribution:read': { roles: ['client_member', 'client_admin'] },
  'contribution:moderate': { roles: ['learning_moderator'], allowGlobalGrant: true },
  'contribution:report': { membership: true },
  'shared-learning:read': { membership: true },
  'search:read': { membership: true },
  'themes:read': { membership: true },
  'ideas:read': { membership: true },
  'ideas:create': { roles: ['product_owner'], allowGlobalGrant: true },
  'ideas:update': { roles: ['product_owner'], allowGlobalGrant: true },
  'members:list': { roles: ['client_admin'] },
  'members:invite': { roles: ['client_admin'] },
  'members:revoke': { roles: ['client_admin'] },
  'organizations:list': { roles: ['portal_admin'], allowGlobalGrant: true },
  'organizations:manage': { roles: ['portal_admin'], allowGlobalGrant: true },
  'audit:list': { roles: ['portal_admin', 'learning_moderator'], allowGlobalGrant: true },
};

function hasRoleInScope(session: AppSession, role: PortalRole, orgId: string, allowGlobalGrant: boolean, offeringId?: string) {
  const membershipHasRole = ['employee', 'client_member', 'client_admin'].includes(role)
    && session.memberships.some(
    (membership) => membership.org_id === orgId && membership.status === 'active' && membership.role === role,
  );
  if (membershipHasRole) return true;

  return session.grants.some((grant) => {
    if (grant.role !== role || grant.revoked_at) return false;
    if (role === 'product_owner' && (!offeringId || grant.offering_id !== offeringId)) return false;
    if (offeringId && grant.offering_id && grant.offering_id !== offeringId) return false;
    if (grant.expires_at && new Date(grant.expires_at).getTime() <= Date.now()) return false;
    return grant.org_id === orgId || (allowGlobalGrant && grant.org_id === null);
  });
}

function hasActiveMembership(session: AppSession, orgId: string) {
  return session.memberships.some((membership) => membership.org_id === orgId && membership.status === 'active');
}

function hasUnexpiredGlobalGrant(session: AppSession, role: PortalRole) {
  return session.grants.some((grant) => grant.role === role && grant.org_id === null && !grant.revoked_at
    && (!grant.expires_at || new Date(grant.expires_at).getTime() > Date.now()));
}

export async function authorize(params: AuthorizeParams): Promise<AuthorizeResult> {
  const session = await getSession();
  if (!session) return { allowed: false, reason: 'Authentication required' };

  const policy = POLICIES[params.action];
  if (!policy) return { allowed: false, reason: 'Action is not permitted' };

  const workspace = session.activeWorkspace;
  if (params.activeWorkspace && params.activeWorkspace.orgId !== workspace?.orgId) {
    return { allowed: false, reason: 'Workspace does not match the authenticated session' };
  }

  const orgId = params.resource?.orgId ?? workspace?.orgId;
  let hasSupportGrant = false;
  if (params.resource?.orgId) {
    const resourceOrgId = params.resource.orgId;
    const isMember = hasActiveMembership(session, resourceOrgId);
    const hasGlobalActionGrant = policy.allowGlobalGrant === true && (policy.roles ?? []).some((role) =>
      hasUnexpiredGlobalGrant(session, role),
    );
    const hasExplicitSupportRole = hasRoleInScope(session, 'portal_admin', resourceOrgId, true);
    const support = hasGlobalActionGrant || !hasExplicitSupportRole ? null : await queryOne<{ allowed: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM support_access
         WHERE portal_admin_id = $1 AND org_id = $2
           AND revoked_at IS NULL AND expires_at > now()
           AND ($3::uuid IS NULL OR contribution_id = $3::uuid)
       ) AS allowed`,
      [session.user.id, params.resource.orgId, params.resource.type === 'contribution' ? params.resource.id ?? null : null],
    );
    hasSupportGrant = params.resource.type === 'contribution'
      && hasExplicitSupportRole
      && support?.allowed === true;
    const isActiveWorkspace = workspace?.orgId === resourceOrgId;
    if (!isActiveWorkspace && !hasGlobalActionGrant && !hasSupportGrant) {
      return { allowed: false, reason: 'Resource is outside the active workspace' };
    }
    if (!isMember && !hasGlobalActionGrant && !hasSupportGrant) {
      return { allowed: false, reason: 'Resource is outside the active membership scope' };
    }
  }

  if (policy.membership && (!orgId || !hasActiveMembership(session, orgId))) {
    return { allowed: false, reason: 'An active workspace membership is required' };
  }

  if (policy.roles) {
    if (!orgId && !policy.allowGlobalGrant) {
      return { allowed: false, reason: 'An active workspace is required' };
    }
    const allowed = policy.roles.some((role) => orgId
      ? hasRoleInScope(session, role, orgId, policy.allowGlobalGrant === true, params.resource?.offeringId)
      : hasUnexpiredGlobalGrant(session, role));
    if (!allowed && !hasSupportGrant) return { allowed: false, reason: 'Insufficient permission for this action' };
  }

  if (params.resource?.offeringId && params.resource.requireEntitlement) {
    if (!orgId) return { allowed: false, reason: 'An active workspace is required' };
    const entitlement = await queryOne<{ allowed: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM entitlements
         WHERE org_id = $1 AND offering_id = $2 AND status = 'active'
           AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now())
           AND (feature IS NULL OR feature = $3)
       ) AS allowed`,
      [orgId, params.resource.offeringId, params.resource.feature ?? null],
    );
    if (!entitlement?.allowed) return { allowed: false, reason: 'This workspace is not entitled to the requested offering' };
  }

  return { allowed: true };
}

export default authorize;
