import { authorize, type AuthorizeParams, type AuthorizeResult } from '@/app/api/(services)/authz/authorize';
import { getSession } from '@/app/api/(services)/authz/session';
import { queryOne } from '@/app/api/(db)/client';
import { ORG_A, ORG_B, OFFER_1, OFFER_2, USER_ID, grant, membership, past, future, session, type SessionSetup } from './fixtures';

jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn(), verifySession: jest.fn() }));
jest.mock('@/app/api/(db)/client', () => ({ query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {} }));

const mockGetSession = getSession as unknown as jest.Mock;
const mockQueryOne = queryOne as unknown as jest.Mock;

const ALL_ACTIONS = [
  'workspace:list', 'workspace:select', 'contribution:list', 'contribution:create', 'contribution:update',
  'contribution:submit', 'contribution:withdraw', 'contribution:read', 'contribution:moderate', 'contribution:report',
  'community-comment:read', 'community-comment:create', 'community-comment:report', 'shared-learning:read',
  'demo:run', 'search:read', 'search:personalize', 'themes:read', 'ideas:read', 'ideas:owner-read', 'ideas:create',
  'ideas:update', 'members:list', 'members:invite', 'members:revoke', 'organizations:list', 'organizations:manage',
  'audit:list', 'portal:client:read', 'portal:client-admin:read', 'portal:employee:read', 'portal:moderator:read',
  'portal:product-owner:read', 'broadcast:manage', 'content:manage', 'release-notes:manage', 'portal:admin:read',
];

const CLIENT_ACTIONS = [
  'contribution:list', 'contribution:create', 'contribution:update', 'contribution:submit',
  'contribution:withdraw', 'contribution:read', 'demo:run', 'search:personalize', 'portal:client:read',
];

const MEMBERSHIP_ONLY_ACTIONS = [
  'workspace:list', 'workspace:select', 'contribution:report', 'community-comment:read',
  'community-comment:create', 'community-comment:report', 'shared-learning:read', 'search:read',
  'themes:read', 'ideas:read',
];

type Setup = SessionSetup | null;

/** Signs in as the given session (or unauthenticated when null) and runs authorize. */
async function decide(setup: Setup, params: AuthorizeParams): Promise<AuthorizeResult> {
  mockGetSession.mockResolvedValue(setup === null ? null : session(setup));
  return authorize(params);
}

const CLIENT_MEMBER_A: SessionSetup = { memberships: [membership(ORG_A, 'client_member')], activeOrg: ORG_A };
const CLIENT_ADMIN_A: SessionSetup = { memberships: [membership(ORG_A, 'client_admin')], activeOrg: ORG_A };
const EMPLOYEE_A: SessionSetup = { memberships: [membership(ORG_A, 'employee')], activeOrg: ORG_A };

beforeEach(() => {
  mockQueryOne.mockReset();
});

describe('authorize: unauthenticated and unknown actions', () => {
  it.each(ALL_ACTIONS)('denies %s when there is no authenticated session', async (action) => {
    const result = await decide(null, { action });
    expect(result).toEqual({ allowed: false, reason: 'Authentication required' });
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it.each(['nope:do', 'contribution:delete', '', 'Contribution:List', 'contribution:list ' ])(
    'denies the unregistered action %j even for a platform admin',
    async (action) => {
      const result = await decide({ grants: [grant('portal_admin')] }, { action });
      expect(result).toEqual({ allowed: false, reason: 'Action is not permitted' });
    },
  );

  // BUG (authz/authorize.ts, POLICIES lookup): POLICIES is a plain object literal, so inherited
  // Object.prototype keys such as "constructor" resolve to truthy values and skip the deny-by-default branch.
  it('denies inherited Object.prototype keys (constructor, __proto__, toString) as unregistered actions', async () => {
    for (const action of ['constructor', '__proto__', 'toString', 'hasOwnProperty']) {
      const result = await decide(CLIENT_MEMBER_A, { action });
      expect({ action, allowed: result.allowed }).toEqual({ action, allowed: false });
    }
  });
});

describe('authorize: client workspace actions (role via membership)', () => {
  it.each(CLIENT_ACTIONS)('allows %s for a client_member of the active workspace', async (action) => {
    expect((await decide(CLIENT_MEMBER_A, { action })).allowed).toBe(true);
  });

  it.each(CLIENT_ACTIONS)('allows %s for a client_admin of the active workspace', async (action) => {
    expect((await decide(CLIENT_ADMIN_A, { action })).allowed).toBe(true);
  });

  it.each(CLIENT_ACTIONS)('denies %s for an employee membership, which implies no client role', async (action) => {
    expect(await decide(EMPLOYEE_A, { action })).toEqual({ allowed: false, reason: 'Insufficient permission for this action' });
  });

  it.each(CLIENT_ACTIONS)('denies %s when there is no active workspace', async (action) => {
    expect(await decide({ memberships: [membership(ORG_A, 'client_member')] }, { action })).toEqual({
      allowed: false,
      reason: 'An active workspace is required',
    });
  });

  it('denies a global learning_moderator grant on a client action (grants do not imply client roles)', async () => {
    const result = await decide({ grants: [grant('learning_moderator')] }, { action: 'contribution:create' });
    expect(result.allowed).toBe(false);
  });

  it('denies a client_member for an org-scoped client_admin-only action even when the membership is active', async () => {
    expect((await decide(CLIENT_MEMBER_A, { action: 'members:invite' })).allowed).toBe(false);
  });
});

describe('authorize: membership-only actions', () => {
  it.each(MEMBERSHIP_ONLY_ACTIONS)('allows %s for an employee membership in the active workspace', async (action) => {
    expect((await decide(EMPLOYEE_A, { action })).allowed).toBe(true);
  });

  it.each(MEMBERSHIP_ONLY_ACTIONS)('denies %s for a product_owner grant with no membership', async (action) => {
    const result = await decide({ grants: [grant('product_owner', { orgId: ORG_A, offeringId: OFFER_1 })] }, { action });
    expect(result.allowed).toBe(false);
  });

  it.each(MEMBERSHIP_ONLY_ACTIONS)('denies %s when the membership is only invited, not active', async (action) => {
    const setup = { memberships: [membership(ORG_A, 'client_member', 'invited')], activeOrg: ORG_A };
    expect((await decide(setup, { action })).allowed).toBe(false);
  });

  it.each(MEMBERSHIP_ONLY_ACTIONS)('denies %s when the membership is revoked', async (action) => {
    const setup = { memberships: [membership(ORG_A, 'client_admin', 'revoked')], activeOrg: ORG_A };
    expect((await decide(setup, { action })).allowed).toBe(false);
  });

  it('denies workspace:list for a membership in another org than the active workspace', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member'), membership(ORG_B, 'client_member')] };
    expect(await decide(setup, { action: 'workspace:list' })).toEqual({
      allowed: false,
      reason: 'An active workspace membership is required',
    });
  });
});

describe('authorize: client_admin actions (members:*)', () => {
  it.each(['members:list', 'members:invite', 'members:revoke'])('allows %s for a client_admin membership', async (action) => {
    expect((await decide(CLIENT_ADMIN_A, { action })).allowed).toBe(true);
  });

  it.each(['members:list', 'members:invite', 'members:revoke'])('denies %s for a client_member', async (action) => {
    expect((await decide(CLIENT_MEMBER_A, { action })).allowed).toBe(false);
  });

  it.each(['members:list', 'members:invite', 'members:revoke'])('allows %s for an org-scoped client_admin grant', async (action) => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('client_admin', { orgId: ORG_A })], activeOrg: ORG_A };
    expect((await decide(setup, { action })).allowed).toBe(true);
  });

  it.each(['members:list', 'members:invite', 'members:revoke'])('denies %s for a platform-level client_admin grant (client_admin is org-scoped only)', async (action) => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('client_admin')], activeOrg: ORG_A };
    expect((await decide(setup, { action })).allowed).toBe(false);
  });

  it('denies a client_admin membership in org A when the resource belongs to org B', async () => {
    const result = await decide(CLIENT_ADMIN_A, { action: 'members:invite', resource: { type: 'member', orgId: ORG_B } });
    expect(result).toEqual({ allowed: false, reason: 'Resource is outside the active workspace' });
  });
});

describe('authorize: moderation, audit and other global-or-org grants', () => {
  it('allows contribution:moderate for an org-scoped moderator grant in the active workspace', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('learning_moderator', { orgId: ORG_A })], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'contribution:moderate' })).allowed).toBe(true);
  });

  it('allows contribution:moderate for a platform-level moderator grant with no active workspace', async () => {
    expect((await decide({ grants: [grant('learning_moderator')] }, { action: 'contribution:moderate' })).allowed).toBe(true);
  });

  it('allows contribution:moderate on a resource in another org when the moderator grant is platform-level', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('learning_moderator')], activeOrg: ORG_A };
    const result = await decide(setup, { action: 'contribution:moderate', resource: { type: 'contribution', id: 'c-1', orgId: ORG_B } });
    expect(result.allowed).toBe(true);
  });

  it('denies contribution:moderate on a resource in another org when the moderator grant is scoped to the active org', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('learning_moderator', { orgId: ORG_A })], activeOrg: ORG_A };
    const result = await decide(setup, { action: 'contribution:moderate', resource: { type: 'contribution', id: 'c-1', orgId: ORG_B } });
    expect(result).toEqual({ allowed: false, reason: 'Resource is outside the active workspace' });
  });

  it('denies contribution:moderate for a content_publisher platform grant (no moderation by implication)', async () => {
    expect((await decide({ grants: [grant('content_publisher')] }, { action: 'contribution:moderate' })).allowed).toBe(false);
  });

  it.each([
    ['portal_admin platform grant', [grant('portal_admin')]],
    ['learning_moderator platform grant', [grant('learning_moderator')]],
  ])('allows audit:list for a %s with no active workspace', async (_label, grants) => {
    expect((await decide({ grants }, { action: 'audit:list' })).allowed).toBe(true);
  });

  it('allows audit:list for an org-scoped portal_admin grant in the active workspace', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('portal_admin', { orgId: ORG_A })], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'audit:list' })).allowed).toBe(true);
  });

  it('denies audit:list for a client_admin membership', async () => {
    expect((await decide(CLIENT_ADMIN_A, { action: 'audit:list' })).allowed).toBe(false);
  });

  it('allows portal:moderator:read for a platform moderator grant and denies it for an employee', async () => {
    expect((await decide({ grants: [grant('learning_moderator')] }, { action: 'portal:moderator:read' })).allowed).toBe(true);
    expect((await decide(EMPLOYEE_A, { action: 'portal:moderator:read' })).allowed).toBe(false);
  });
});

describe('authorize: portal_admin platform-only actions (globalOnly)', () => {
  it.each(['organizations:list', 'organizations:manage', 'portal:admin:read'])(
    'allows %s for a platform-level portal_admin grant with no active workspace',
    async (action) => {
      expect((await decide({ grants: [grant('portal_admin')] }, { action })).allowed).toBe(true);
    },
  );

  it.each(['organizations:list', 'organizations:manage', 'portal:admin:read'])(
    'denies %s for an org-scoped portal_admin grant (globalOnly ignores org scope)',
    async (action) => {
      const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('portal_admin', { orgId: ORG_A })], activeOrg: ORG_A };
      expect((await decide(setup, { action })).allowed).toBe(false);
    },
  );

  it('allows organizations:list for a platform portal_admin acting on a resource in any org', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('portal_admin')], activeOrg: ORG_A };
    const result = await decide(setup, { action: 'organizations:list', resource: { type: 'organization', orgId: ORG_B } });
    expect(result.allowed).toBe(true);
  });

  it('denies organizations:list for a learning_moderator platform grant', async () => {
    expect((await decide({ grants: [grant('learning_moderator')] }, { action: 'organizations:list' })).allowed).toBe(false);
  });
});

describe('authorize: content publisher actions', () => {
  it('allows content:manage for an org-scoped publisher grant in the active workspace', async () => {
    const setup = { memberships: [membership(ORG_A, 'employee')], grants: [grant('content_publisher', { orgId: ORG_A })], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'content:manage' })).allowed).toBe(true);
  });

  it('denies content:manage for a publisher-like membership, since membership never implies a publisher role', async () => {
    const setup = { memberships: [membership(ORG_A, 'content_publisher')], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'content:manage' })).allowed).toBe(false);
  });

  it('allows broadcast:manage for a platform publisher grant with no active workspace', async () => {
    expect((await decide({ grants: [grant('content_publisher')] }, { action: 'broadcast:manage' })).allowed).toBe(true);
  });

  it('allows content:manage for a platform publisher grant when an org is active', async () => {
    const setup = { memberships: [membership(ORG_A, 'employee')], grants: [grant('content_publisher')], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'content:manage' })).allowed).toBe(true);
  });

  it('denies content:manage for a learning_moderator grant', async () => {
    const setup = { memberships: [membership(ORG_A, 'employee')], grants: [grant('learning_moderator')], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'content:manage' })).allowed).toBe(false);
  });
});

describe('authorize: product_owner and offering assignment', () => {
  const PO_A_OFFER_1: SessionSetup = {
    memberships: [membership(ORG_A, 'employee')],
    grants: [grant('product_owner', { orgId: ORG_A, offeringId: OFFER_1 })],
    activeOrg: ORG_A,
  };

  it.each(['ideas:owner-read', 'ideas:create', 'ideas:update'])(
    'allows %s for a product_owner assigned to the resource offering',
    async (action) => {
      const result = await decide(PO_A_OFFER_1, { action, resource: { type: 'idea', id: 'i-1', orgId: ORG_A, offeringId: OFFER_1 } });
      expect(result.allowed).toBe(true);
    },
  );

  it.each(['ideas:owner-read', 'ideas:create', 'ideas:update'])(
    'denies %s for a product_owner assigned to a different offering',
    async (action) => {
      const result = await decide(PO_A_OFFER_1, { action, resource: { type: 'idea', orgId: ORG_A, offeringId: OFFER_2 } });
      expect(result).toEqual({ allowed: false, reason: 'Insufficient permission for this action' });
    },
  );

  it.each(['ideas:owner-read', 'ideas:create', 'ideas:update'])(
    'denies %s when the resource names no offering (assignment is required)',
    async (action) => {
      expect((await decide(PO_A_OFFER_1, { action, resource: { type: 'idea', orgId: ORG_A } })).allowed).toBe(false);
    },
  );

  it('denies ideas:update for an unassigned product_owner grant (offering_id null)', async () => {
    const setup = { ...PO_A_OFFER_1, grants: [grant('product_owner', { orgId: ORG_A, offeringId: null })] };
    expect((await decide(setup, { action: 'ideas:update', resource: { type: 'idea', orgId: ORG_A, offeringId: OFFER_1 } })).allowed).toBe(false);
  });

  it('allows ideas:update through a platform-level product_owner grant assigned to the offering', async () => {
    const setup = { memberships: [membership(ORG_A, 'employee')], grants: [grant('product_owner', { offeringId: OFFER_1 })], activeOrg: ORG_A };
    const result = await decide(setup, { action: 'ideas:update', resource: { type: 'idea', orgId: ORG_A, offeringId: OFFER_1 } });
    expect(result.allowed).toBe(true);
  });

  it('allows ideas:owner-read in an org without membership when a platform product_owner grant covers the offering', async () => {
    const setup = { grants: [grant('product_owner', { offeringId: OFFER_1 })] };
    const result = await decide(setup, { action: 'ideas:owner-read', resource: { type: 'idea', orgId: ORG_B, offeringId: OFFER_1 } });
    expect(result.allowed).toBe(true);
  });

  it('denies ideas:update on an org resource with no membership even with a matching org-scoped grant', async () => {
    const setup = { memberships: [membership(ORG_A, 'employee')], grants: [grant('product_owner', { orgId: ORG_B, offeringId: OFFER_1 })], activeOrg: ORG_A };
    const result = await decide(setup, { action: 'ideas:update', resource: { type: 'idea', orgId: ORG_B, offeringId: OFFER_1 } });
    expect(result.allowed).toBe(false);
  });

  it('denies ideas:update for an expired product_owner assignment', async () => {
    const setup = { ...PO_A_OFFER_1, grants: [grant('product_owner', { orgId: ORG_A, offeringId: OFFER_1, expiresAt: past() })] };
    expect((await decide(setup, { action: 'ideas:update', resource: { type: 'idea', orgId: ORG_A, offeringId: OFFER_1 } })).allowed).toBe(false);
  });

  it('allows portal:product-owner:read for an org product_owner grant without naming an offering', async () => {
    expect((await decide(PO_A_OFFER_1, { action: 'portal:product-owner:read' })).allowed).toBe(true);
  });

  it('allows release-notes:manage for a product_owner assigned to the offering and denies it without one', async () => {
    const withOffering = await decide(PO_A_OFFER_1, { action: 'release-notes:manage', resource: { type: 'release-note', orgId: ORG_A, offeringId: OFFER_1 } });
    const withoutOffering = await decide(PO_A_OFFER_1, { action: 'release-notes:manage', resource: { type: 'release-note', orgId: ORG_A } });
    expect(withOffering.allowed).toBe(true);
    expect(withoutOffering.allowed).toBe(false);
  });
});

describe('authorize: expired and revoked grants', () => {
  it('denies contribution:moderate for an expired org-scoped moderator grant', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('learning_moderator', { orgId: ORG_A, expiresAt: past() })], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'contribution:moderate' })).allowed).toBe(false);
  });

  it('denies contribution:moderate for a revoked org-scoped moderator grant', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('learning_moderator', { orgId: ORG_A, revokedAt: past() })], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'contribution:moderate' })).allowed).toBe(false);
  });

  it('allows contribution:moderate for a moderator grant whose expiry is in the future', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('learning_moderator', { orgId: ORG_A, expiresAt: future() })], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'contribution:moderate' })).allowed).toBe(true);
  });

  it('denies contribution:moderate for an expired platform-level moderator grant with no workspace', async () => {
    expect((await decide({ grants: [grant('learning_moderator', { expiresAt: past() })] }, { action: 'contribution:moderate' })).allowed).toBe(false);
  });

  it('denies contribution:moderate for a revoked platform-level moderator grant on another org resource', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('learning_moderator', { revokedAt: past() })], activeOrg: ORG_A };
    const result = await decide(setup, { action: 'contribution:moderate', resource: { type: 'contribution', id: 'c-1', orgId: ORG_B } });
    expect(result.allowed).toBe(false);
  });

  it('denies organizations:list for an expired platform portal_admin grant', async () => {
    expect((await decide({ grants: [grant('portal_admin', { expiresAt: past() })] }, { action: 'organizations:list' })).allowed).toBe(false);
  });

  it('denies content:manage for an expired publisher grant', async () => {
    const setup = { memberships: [membership(ORG_A, 'employee')], grants: [grant('content_publisher', { orgId: ORG_A, expiresAt: past() })], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'content:manage' })).allowed).toBe(false);
  });

  it('denies a revoked grant even when the grant is otherwise valid for the active org', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('client_admin', { orgId: ORG_A, revokedAt: past() })], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'members:list' })).allowed).toBe(false);
  });
});

describe('authorize: workspace scope and resource org', () => {
  const BOTH_ORGS: SessionSetup = {
    memberships: [membership(ORG_A, 'client_member'), membership(ORG_B, 'client_member')],
    activeOrg: ORG_A,
  };

  it('denies a resource in another org even when the user is an active member of that org', async () => {
    const result = await decide(BOTH_ORGS, { action: 'contribution:read', resource: { type: 'contribution', id: 'c-1', orgId: ORG_B } });
    expect(result).toEqual({ allowed: false, reason: 'Resource is outside the active workspace' });
  });

  it('allows a resource in the active workspace org', async () => {
    const result = await decide(BOTH_ORGS, { action: 'contribution:read', resource: { type: 'contribution', id: 'c-1', orgId: ORG_A } });
    expect(result.allowed).toBe(true);
  });

  it('denies a resource in an org where the user has no membership', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member')], activeOrg: ORG_A };
    const result = await decide(setup, { action: 'contribution:read', resource: { type: 'contribution', id: 'c-1', orgId: ORG_B } });
    expect(result.allowed).toBe(false);
  });

  it('denies when the caller-supplied activeWorkspace does not match the session workspace', async () => {
    const result = await decide(CLIENT_MEMBER_A, { action: 'contribution:list', activeWorkspace: { orgId: ORG_B, role: 'client_member' } });
    expect(result).toEqual({ allowed: false, reason: 'Workspace does not match the authenticated session' });
  });

  it('allows when the caller-supplied activeWorkspace matches the session workspace', async () => {
    const result = await decide(CLIENT_MEMBER_A, { action: 'contribution:list', activeWorkspace: { orgId: ORG_A, role: 'client_member' } });
    expect(result.allowed).toBe(true);
  });

  it('denies a caller-supplied activeWorkspace when the session has no active workspace', async () => {
    const result = await decide({ grants: [grant('portal_admin')] }, { action: 'audit:list', activeWorkspace: { orgId: ORG_A, role: 'client_member' } });
    expect(result.allowed).toBe(false);
  });

  it('ignores a null caller-supplied activeWorkspace', async () => {
    const result = await decide(CLIENT_MEMBER_A, { action: 'contribution:list', activeWorkspace: null });
    expect(result.allowed).toBe(true);
  });
});

describe('authorize: support access (time-boxed portal_admin)', () => {
  const SUPPORT_CONTEXT: SessionSetup = {
    memberships: [membership(ORG_A, 'client_member')],
    grants: [grant('portal_admin', { orgId: ORG_B })],
    activeOrg: ORG_A,
  };
  const CONTRIBUTION_IN_B = { type: 'contribution', id: 'c-1', orgId: ORG_B };

  it('allows contribution:read in another org when an active support_access row covers the contribution', async () => {
    mockQueryOne.mockResolvedValueOnce({ allowed: true });
    const result = await decide(SUPPORT_CONTEXT, { action: 'contribution:read', resource: CONTRIBUTION_IN_B });
    expect(result.allowed).toBe(true);
  });

  it('checks support_access for the portal admin, the resource org and the requested contribution id', async () => {
    mockQueryOne.mockResolvedValueOnce({ allowed: true });
    await decide(SUPPORT_CONTEXT, { action: 'contribution:read', resource: CONTRIBUTION_IN_B });
    expect(mockQueryOne).toHaveBeenCalledTimes(1);
    const [sql, args] = mockQueryOne.mock.calls[0];
    expect(sql).toContain('support_access');
    expect(sql).toContain('revoked_at IS NULL');
    expect(sql).toContain('expires_at > now()');
    expect(args).toEqual([USER_ID, ORG_B, 'c-1']);
  });

  it('denies contribution:read in another org when no active support_access row exists', async () => {
    mockQueryOne.mockResolvedValueOnce({ allowed: false });
    const result = await decide(SUPPORT_CONTEXT, { action: 'contribution:read', resource: CONTRIBUTION_IN_B });
    expect(result).toEqual({ allowed: false, reason: 'Resource is outside the active workspace' });
  });

  it('denies contribution:read when the support_access lookup returns no row', async () => {
    mockQueryOne.mockResolvedValueOnce(undefined);
    expect((await decide(SUPPORT_CONTEXT, { action: 'contribution:read', resource: CONTRIBUTION_IN_B })).allowed).toBe(false);
  });

  it('does not query support_access when the caller has no portal_admin grant in the resource org', async () => {
    const setup = { memberships: [membership(ORG_A, 'client_member'), membership(ORG_B, 'client_member')], activeOrg: ORG_A };
    const result = await decide(setup, { action: 'contribution:read', resource: CONTRIBUTION_IN_B });
    expect(result.allowed).toBe(false);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('does not extend support access to a non-contribution resource', async () => {
    mockQueryOne.mockResolvedValueOnce({ allowed: true });
    const result = await decide(SUPPORT_CONTEXT, { action: 'contribution:read', resource: { type: 'shared-copy', id: 's-1', orgId: ORG_B } });
    expect(result.allowed).toBe(false);
  });

  it('allows support access through a platform-level portal_admin grant', async () => {
    mockQueryOne.mockResolvedValueOnce({ allowed: true });
    const setup = { memberships: [membership(ORG_A, 'client_member')], grants: [grant('portal_admin')], activeOrg: ORG_A };
    expect((await decide(setup, { action: 'contribution:read', resource: CONTRIBUTION_IN_B })).allowed).toBe(true);
  });

  it('does not let a time-boxed support grant authorise contribution:update (read-only scope)', async () => {
    mockQueryOne.mockResolvedValueOnce({ allowed: true });
    const result = await decide(SUPPORT_CONTEXT, { action: 'contribution:update', resource: CONTRIBUTION_IN_B });
    expect(result.allowed).toBe(false);
  });
});

describe('authorize: entitlement checks (requireEntitlement)', () => {
  const OFFERING = { type: 'offering', offeringId: OFFER_1, requireEntitlement: true };

  it('allows a role-permitted action when the workspace holds an active entitlement', async () => {
    mockQueryOne.mockResolvedValueOnce({ allowed: true });
    const result = await decide(CLIENT_MEMBER_A, { action: 'demo:run', resource: OFFERING });
    expect(result.allowed).toBe(true);
    expect(mockQueryOne).toHaveBeenCalledWith(expect.stringContaining('entitlements'), [ORG_A, OFFER_1, null]);
  });

  it('passes the requested feature to the entitlement lookup', async () => {
    mockQueryOne.mockResolvedValueOnce({ allowed: true });
    await decide(CLIENT_MEMBER_A, { action: 'demo:run', resource: { ...OFFERING, feature: 'playbook' } });
    expect(mockQueryOne).toHaveBeenCalledWith(expect.any(String), [ORG_A, OFFER_1, 'playbook']);
  });

  it('denies a role-permitted action when the workspace is not entitled to the offering', async () => {
    mockQueryOne.mockResolvedValueOnce({ allowed: false });
    const result = await decide(CLIENT_MEMBER_A, { action: 'demo:run', resource: OFFERING });
    expect(result).toEqual({ allowed: false, reason: 'This workspace is not entitled to the requested offering' });
  });

  it('denies when the entitlement lookup returns no row', async () => {
    mockQueryOne.mockResolvedValueOnce(undefined);
    expect((await decide(CLIENT_MEMBER_A, { action: 'demo:run', resource: OFFERING })).allowed).toBe(false);
  });

  it('checks the entitlement against the resource org when it differs from the workspace', async () => {
    mockQueryOne.mockResolvedValueOnce({ allowed: true });
    const setup = { memberships: [membership(ORG_A, 'client_member'), membership(ORG_B, 'client_member')], activeOrg: ORG_A };
    await decide(setup, { action: 'demo:run', resource: { ...OFFERING, orgId: ORG_A } });
    expect(mockQueryOne).toHaveBeenCalledWith(expect.any(String), [ORG_A, OFFER_1, null]);
  });

  it('does not run the entitlement lookup when the role check already denied the action', async () => {
    const result = await decide(EMPLOYEE_A, { action: 'demo:run', resource: OFFERING });
    expect(result).toEqual({ allowed: false, reason: 'Insufficient permission for this action' });
    expect(mockQueryOne).not.toHaveBeenCalled();
  });

  it('skips the entitlement lookup when requireEntitlement is false', async () => {
    const result = await decide(CLIENT_MEMBER_A, { action: 'demo:run', resource: { ...OFFERING, requireEntitlement: false } });
    expect(result.allowed).toBe(true);
    expect(mockQueryOne).not.toHaveBeenCalled();
  });
});

describe('authorize: employee portal access', () => {
  it('allows portal:employee:read for an employee membership and for a content_publisher grant', async () => {
    expect((await decide(EMPLOYEE_A, { action: 'portal:employee:read' })).allowed).toBe(true);
    const publisher = { memberships: [membership(ORG_A, 'employee')], grants: [grant('content_publisher', { orgId: ORG_A })], activeOrg: ORG_A };
    expect((await decide(publisher, { action: 'portal:employee:read' })).allowed).toBe(true);
  });

  it('denies portal:employee:read for a client_member', async () => {
    expect((await decide(CLIENT_MEMBER_A, { action: 'portal:employee:read' })).allowed).toBe(false);
  });

  it('denies portal:client-admin:read for a client_member and allows it for a client_admin', async () => {
    expect((await decide(CLIENT_MEMBER_A, { action: 'portal:client-admin:read' })).allowed).toBe(false);
    expect((await decide(CLIENT_ADMIN_A, { action: 'portal:client-admin:read' })).allowed).toBe(true);
  });
});
