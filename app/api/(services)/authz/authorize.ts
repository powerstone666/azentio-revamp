import 'server-only';

import type { AppSession, PortalRole } from '@/app/(common-lib)/types';
import { getSession } from './session';

// ─── Public API ───

/**
 * Parameters for the server-only `authorize()` call.
 *
 * Every Server Component, Server Action, and route handler that gates access
 * MUST call `authorize()` with the specific action + resource it intends to
 * operate on.  Layouts MAY call `getSession()` for display purposes but MUST
 * NOT gate authorization in shared layouts — that is the page/action's job.
 */
export interface AuthorizeParams {
  /** Short action code, e.g. 'contribution:create', 'workspace:select'. */
  action: string;

  /** Optional resource context for fine-grained checks. */
  resource?: {
    type: string;
    id?: string;
    orgId?: string;
  };

  /** The session's active workspace (passed through for convenience). */
  activeWorkspace?: {
    orgId: string;
    role: PortalRole;
  } | null;
}

export interface AuthorizeResult {
  allowed: boolean;
  /** Human-readable reason when denied. Never exposes implementation details. */
  reason?: string;
}

// ─── Role hierarchy ───
// Higher index = broader privileges. Used for coarse-grained checks.

const ROLE_WEIGHT: Record<PortalRole, number> = {
  employee: 0,
  client_member: 1,
  client_admin: 2,
  learning_moderator: 3,
  content_publisher: 4,
  product_owner: 5,
  portal_admin: 6,
};

const MINIMUM_ROLE_WEIGHT = 1; // client_member or above

// ─── Implementation ───

/**
 * Verify that the current request is authorised to perform `action` on an
 * optional `resource`.
 *
 * ## Deny-by-default
 * If no session is found the function returns `{ allowed: false }` immediately.
 *
 * ## Checks performed (M1 placeholder → real logic)
 * 1. **Session existence** — is the user authenticated?
 * 2. **Audience alignment** — does the resource's org match the active workspace?
 * 3. **Tenant membership** — is the user an active member of the target org?
 * 4. **Permission grants** — does the user hold a RoleGrant permitting the action?
 * 5. **Entitlement checks** — does the org have the required offering/feature
 *    entitlements?
 *
 * ## M1 wiring
 * Replace the placeholder body with real SQL queries against memberships,
 * role_grants, and entitlements tables.  Keep the deny-by-default posture.
 */
export async function authorize(
  params: AuthorizeParams,
): Promise<AuthorizeResult> {
  const session: AppSession | null = await getSession();

  // ── 1. Session check ──
  if (!session) {
    return { allowed: false, reason: 'Authentication required' };
  }

  // ── 2. Active workspace check ──
  // Every authorised action must happen within a selected workspace context.
  const workspace = params.activeWorkspace ?? session.activeWorkspace;
  if (!workspace) {
    return {
      allowed: false,
      reason: 'No active workspace selected',
    };
  }

  // ── 3. Minimum role check ──
  const weight = ROLE_WEIGHT[workspace.role] ?? -1;
  if (weight < MINIMUM_ROLE_WEIGHT) {
    return {
      allowed: false,
      reason: 'Insufficient role for this workspace',
    };
  }

  // ── 4. Resource-audience alignment (when resource.orgId is provided) ──
  if (params.resource?.orgId && params.resource.orgId !== workspace.orgId) {
    return {
      allowed: false,
      reason: 'Resource does not belong to the active workspace',
    };
  }

  // ── M1: Replace the placeholder below with real permission-grant and
  //        entitlement queries against the database. ──
  // const grants = session.grants.filter(...)
  // const entitlements = await query<Entitlement>(...)
  // if (!hasRequiredEntitlement(...)) return { allowed: false, reason: '...' }

  return { allowed: true };
}

export default authorize;