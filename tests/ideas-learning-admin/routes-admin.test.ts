import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import {
  createAdminEntitlement, createAdminOrganization, createAdminRoleGrant, listAdminEligibleEmployees,
  listAdminOrganizations, listAdminRoleGrants, revokeAdminEntitlement, revokeAdminRoleGrant, updateAdminOrganization,
} from '@/app/api/(services)/admin/service';
import { deliverEmailOutboxItem } from '@/app/api/(services)/email/outbox';
import { archiveClientResource, createClientResource, listAdminClientResources } from '@/app/api/(services)/resources/service';
import { GET as orgsGet, POST as orgsPost } from '@/app/api/v1/admin/organizations/route';
import { PATCH as orgPatch } from '@/app/api/v1/admin/organizations/[id]/route';
import { POST as orgEntitlementPost } from '@/app/api/v1/admin/organizations/[id]/entitlements/route';
import { GET as resourcesGet, POST as resourcesPost } from '@/app/api/v1/admin/organizations/[id]/resources/route';
import { DELETE as resourceDelete } from '@/app/api/v1/admin/organizations/[id]/resources/[resourceId]/route';
import { GET as grantsGet, POST as grantsPost } from '@/app/api/v1/admin/role-grants/route';
import { DELETE as grantDelete } from '@/app/api/v1/admin/role-grants/[id]/route';
import { DELETE as entitlementDelete } from '@/app/api/v1/admin/entitlements/[id]/route';
import { UUID_A, UUID_B, jsonRequest, routeContext, sessionFixture } from './helpers';

jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn() }));
jest.mock('@/app/api/(services)/admin/service', () => ({
  listAdminOrganizations: jest.fn(), createAdminOrganization: jest.fn(), updateAdminOrganization: jest.fn(),
  createAdminEntitlement: jest.fn(), revokeAdminEntitlement: jest.fn(), createAdminRoleGrant: jest.fn(),
  listAdminRoleGrants: jest.fn(), listAdminEligibleEmployees: jest.fn(), revokeAdminRoleGrant: jest.fn(),
}));
jest.mock('@/app/api/(services)/email/outbox', () => ({ enqueueEmail: jest.fn(), deliverEmailOutboxItem: jest.fn() }));
jest.mock('@/app/api/(services)/resources/service', () => ({
  listAdminClientResources: jest.fn(), createClientResource: jest.fn(), archiveClientResource: jest.fn(),
}));

const BASE = 'http://portal.test/api/v1/admin';

beforeEach(() => {
  jest.mocked(getSession).mockResolvedValue(sessionFixture({ activeWorkspace: null }) as never);
  jest.mocked(authorize).mockResolvedValue({ allowed: true });
  jest.mocked(deliverEmailOutboxItem).mockResolvedValue('sent');
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('admin organisations', () => {
  it('GET returns 401 without a session and 403 with the authorization reason when denied', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await orgsGet()).status).toBe(401);

    jest.mocked(getSession).mockResolvedValue(sessionFixture() as never);
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Action is not permitted' });
    const denied = await orgsGet();
    expect(authorize).toHaveBeenCalledWith({ action: 'organizations:list' });
    expect(denied.status).toBe(403);
  });

  it('GET lists organisations without caching', async () => {
    jest.mocked(listAdminOrganizations).mockResolvedValue([{ id: UUID_A }] as never);
    const response = await orgsGet();
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ data: [{ id: UUID_A }] });
  });

  it('POST requires the organisations:manage action', async () => {
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Action is not permitted' });
    const response = await orgsPost(jsonRequest(`${BASE}/organizations`, { name: 'Acme', type: 'azentio' }));
    expect(authorize).toHaveBeenCalledWith({ action: 'organizations:manage' });
    expect(response.status).toBe(403);
  });

  it('POST returns 400 for a body that is not JSON', async () => {
    expect((await orgsPost(jsonRequest(`${BASE}/organizations`, '{nope'))).status).toBe(400);
  });

  it.each([
    ['a one-letter name', { name: 'A', type: 'azentio' }],
    ['a client organisation without an initial admin email', { name: 'Acme', type: 'client' }],
    ['a client organisation with a malformed admin email', { name: 'Acme', type: 'client', initial_admin_email: 'not-an-email' }],
    ['an unknown organisation type', { name: 'Acme', type: 'partner' }],
  ])('POST returns 422 for %s', async (_label, body) => {
    expect((await orgsPost(jsonRequest(`${BASE}/organizations`, body))).status).toBe(422);
    expect(createAdminOrganization).not.toHaveBeenCalled();
  });

  it('POST creates an Azentio organisation without sending an email', async () => {
    jest.mocked(createAdminOrganization).mockResolvedValue({ id: UUID_A, name: 'Azentio Labs', type: 'azentio', status: 'active', email_outbox_id: null } as never);
    const response = await orgsPost(jsonRequest(`${BASE}/organizations`, { name: 'Azentio Labs', type: 'azentio' }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: UUID_A, name: 'Azentio Labs', type: 'azentio', status: 'active' }, email_status: null });
    expect(deliverEmailOutboxItem).not.toHaveBeenCalled();
  });

  it('POST creates a client organisation, passes a fresh invitation token and reports whether the email was sent', async () => {
    jest.mocked(createAdminOrganization).mockResolvedValue({ id: UUID_A, name: 'Acme', type: 'client', status: 'active', email_outbox_id: 'outbox-1' } as never);
    const response = await orgsPost(jsonRequest(`${BASE}/organizations`, { name: 'Acme', type: 'client', initial_admin_email: 'admin@acme.test' }));
    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ email_status: 'sent' });
    const input = jest.mocked(createAdminOrganization).mock.calls[0][0];
    expect(input).toMatchObject({ actorId: 'user-1', name: 'Acme', type: 'client', initialAdminEmail: 'admin@acme.test', origin: 'http://portal.test' });
    expect(input.invitationToken).toHaveLength(43);
    expect(input.invitationId).toMatch(/^[0-9a-f-]{36}$/);
  });

  it('POST reports the email as queued when delivery is deferred', async () => {
    jest.mocked(createAdminOrganization).mockResolvedValue({ id: UUID_A, name: 'Acme', type: 'client', status: 'active', email_outbox_id: 'outbox-1' } as never);
    jest.mocked(deliverEmailOutboxItem).mockResolvedValue('queued');
    const response = await orgsPost(jsonRequest(`${BASE}/organizations`, { name: 'Acme', type: 'client', initial_admin_email: 'admin@acme.test' }));
    expect(await response.json()).toMatchObject({ email_status: 'queued' });
  });

  it.each([
    ['a lost platform administrator grant', 'Active platform administrator grant required', 403],
    ['a duplicate organisation name', 'duplicate key value violates unique constraint organizations_name_ci', 409],
  ])('POST maps %s to %i', async (_label, message, status) => {
    jest.mocked(createAdminOrganization).mockRejectedValue(new Error(message));
    expect((await orgsPost(jsonRequest(`${BASE}/organizations`, { name: 'Acme', type: 'azentio' }))).status).toBe(status);
  });

  it('POST hides unexpected failures behind a generic 500', async () => {
    jest.mocked(createAdminOrganization).mockRejectedValue(new Error('socket hang up'));
    const response = await orgsPost(jsonRequest(`${BASE}/organizations`, { name: 'Acme', type: 'azentio' }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to create the organisation' });
  });

  it('PATCH validates the status and maps a missing client organisation to 404', async () => {
    const patch = (body: unknown, id = UUID_A) => orgPatch(jsonRequest(`${BASE}/organizations/${id}`, body), routeContext({ id }));
    expect((await patch({ status: 'deleted' })).status).toBe(422);
    expect((await patch({ status: 'active' }, 'nope')).status).toBe(404);
    jest.mocked(updateAdminOrganization).mockRejectedValue(new Error('Client organization not found'));
    const missing = await patch({ status: 'suspended' });
    expect(missing.status).toBe(404);
    expect(await missing.json()).toEqual({ error: 'Organization not found' });
  });

  it('PATCH applies a valid status change', async () => {
    jest.mocked(updateAdminOrganization).mockResolvedValue({ id: UUID_A, status: 'suspended' } as never);
    const response = await orgPatch(jsonRequest(`${BASE}/organizations/${UUID_A}`, { status: 'suspended' }), routeContext({ id: UUID_A }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { id: UUID_A, status: 'suspended' } });
  });
});

describe('admin role grants', () => {
  it('GET returns grants and eligible employees for organisations:list holders', async () => {
    jest.mocked(listAdminRoleGrants).mockResolvedValue([{ id: 'g1' }] as never);
    jest.mocked(listAdminEligibleEmployees).mockResolvedValue([{ id: UUID_B }] as never);
    const response = await grantsGet();
    expect(authorize).toHaveBeenCalledWith({ action: 'organizations:list' });
    expect(await response.json()).toEqual({ data: { grants: [{ id: 'g1' }], employees: [{ id: UUID_B }] } });
  });

  const validGrant = { user_id: UUID_B, role: 'product_owner', offering_id: 'FAI' };

  it('POST returns 401 without a session and 403 without organisations:manage', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await grantsPost(jsonRequest(`${BASE}/role-grants`, validGrant))).status).toBe(401);
    jest.mocked(getSession).mockResolvedValue(sessionFixture() as never);
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Action is not permitted' });
    expect((await grantsPost(jsonRequest(`${BASE}/role-grants`, validGrant))).status).toBe(403);
  });

  it.each([
    ['an unknown role', { ...validGrant, role: 'admin' }],
    ['an offering outside the catalogue', { ...validGrant, offering_id: 'Unknown' }],
    ['a non-ISO expiry', { ...validGrant, expires_at: 'next week' }],
    ['a malformed user id', { ...validGrant, user_id: 'abc' }],
  ])('POST returns 422 for %s', async (_label, body) => {
    expect((await grantsPost(jsonRequest(`${BASE}/role-grants`, body))).status).toBe(422);
    expect(createAdminRoleGrant).not.toHaveBeenCalled();
  });

  it('POST creates a grant with platform-wide and unexpiring defaults and returns 201', async () => {
    jest.mocked(createAdminRoleGrant).mockResolvedValue({ id: 'g-new' } as never);
    const response = await grantsPost(jsonRequest(`${BASE}/role-grants`, { user_id: UUID_B, role: 'learning_moderator' }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: 'g-new' } });
    expect(createAdminRoleGrant).toHaveBeenCalledWith(expect.objectContaining({
      userId: UUID_B, orgId: null, role: 'learning_moderator', offeringId: null, expiresAt: null,
    }));
  });

  it.each([
    ['an existing active grant', 'An active grant already exists', 409],
    ['a non-admin actor', 'Active platform administrator grant required', 403],
    ['a target who is not an active employee', 'Target must be a verified active employee', 403],
    ['a past expiry', 'Grant expiry must be in the future', 422],
    ['a product owner grant without an offering', 'Product owner grants require an offering', 422],
    ['an offering on a non-product-owner role', 'Only product owner grants can be offering-scoped', 422],
    ['a platform admin grant scoped to an organisation', 'Portal administrator grants must be platform-wide', 422],
  ])('POST maps %s to %i', async (_label, message, status) => {
    jest.mocked(createAdminRoleGrant).mockRejectedValue(new Error(message));
    const response = await grantsPost(jsonRequest(`${BASE}/role-grants`, validGrant));
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
  });

  it('POST answers a self-grant attempt with a client error rather than 500', async () => {
    jest.mocked(createAdminRoleGrant).mockRejectedValue(new Error('You cannot grant a role to yourself'));
    expect((await grantsPost(jsonRequest(`${BASE}/role-grants`, validGrant))).status).toBe(422);
  });

  it('POST answers a grant to an inactive organisation with a client error rather than 500', async () => {
    jest.mocked(createAdminRoleGrant).mockRejectedValue(new Error('Scoped grants can only target an active Azentio organization'));
    expect((await grantsPost(jsonRequest(`${BASE}/role-grants`, validGrant))).status).toBe(422);
  });

  it.each([
    ['the last platform administrator', 'The last platform administrator grant cannot be revoked', 409],
    ['a missing grant', 'Active role grant not found', 404],
  ])('DELETE maps %s to %i', async (_label, message, status) => {
    jest.mocked(revokeAdminRoleGrant).mockRejectedValue(new Error(message));
    expect((await grantDelete(new Request('http://t'), routeContext({ id: UUID_A }))).status).toBe(status);
  });

  it('DELETE returns 404 for a malformed id and 200 with the revoked grant on success', async () => {
    expect((await grantDelete(new Request('http://t'), routeContext({ id: 'bad' }))).status).toBe(404);
    jest.mocked(revokeAdminRoleGrant).mockResolvedValue({ id: UUID_A, revoked: true } as never);
    const response = await grantDelete(new Request('http://t'), routeContext({ id: UUID_A }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { id: UUID_A, revoked: true } });
  });
});

describe('admin entitlements', () => {
  it('DELETE maps a missing entitlement to 404 and revokes an active one', async () => {
    expect((await entitlementDelete(new Request('http://t'), routeContext({ id: 'bad' }))).status).toBe(404);
    jest.mocked(revokeAdminEntitlement).mockRejectedValue(new Error('Active entitlement not found'));
    expect((await entitlementDelete(new Request('http://t'), routeContext({ id: UUID_A }))).status).toBe(404);
    jest.mocked(revokeAdminEntitlement).mockResolvedValue({ id: UUID_A, status: 'revoked' } as never);
    const response = await entitlementDelete(new Request('http://t'), routeContext({ id: UUID_A }));
    expect(await response.json()).toEqual({ data: { id: UUID_A, status: 'revoked' } });
  });

  const entitlementPost = (body: unknown, id = UUID_A) => orgEntitlementPost(jsonRequest(`${BASE}/organizations/${id}/entitlements`, body), routeContext({ id }));

  it.each([
    ['an offering outside the sandbox catalogue', { offering_id: 'Digital' }],
    ['a feature other than sandbox', { offering_id: 'FAI', feature: 'premium' }],
  ])('POST returns 422 for %s', async (_label, body) => {
    expect((await entitlementPost(body)).status).toBe(422);
    expect(createAdminEntitlement).not.toHaveBeenCalled();
  });

  it('POST defaults the feature to sandbox and returns 201', async () => {
    jest.mocked(createAdminEntitlement).mockResolvedValue({ id: 'ent-1' } as never);
    const response = await entitlementPost({ offering_id: 'FAI' });
    expect(response.status).toBe(201);
    expect(jest.mocked(createAdminEntitlement).mock.calls[0][0]).toMatchObject({ orgId: UUID_A, offeringId: 'FAI', feature: 'sandbox' });
  });

  it('POST reports a malformed organisation id as 404', async () => {
    expect((await entitlementPost({ offering_id: 'FAI' }, 'nope')).status).toBe(404);
  });

  it.each([
    ['a duplicate entitlement', 'An active entitlement already exists', 409],
    ['a missing organisation', 'Active client organization not found', 404],
  ])('POST maps %s to %i', async (_label, message, status) => {
    jest.mocked(createAdminEntitlement).mockRejectedValue(new Error(message));
    expect((await entitlementPost({ offering_id: 'FAI' })).status).toBe(status);
  });
});

describe('admin client resources', () => {
  const resourcesUrl = `${BASE}/organizations/${UUID_A}/resources`;
  const resourceBody = { title: 'Onboarding guide', category: 'Guides', resource_url: 'https://docs.example.com/guide' };
  const postResource = (body: unknown) => resourcesPost(jsonRequest(resourcesUrl, body), routeContext({ id: UUID_A }));

  it('GET lists resources for the organisation', async () => {
    jest.mocked(listAdminClientResources).mockResolvedValue([{ id: 'r1' }] as never);
    const response = await resourcesGet(new Request(resourcesUrl), routeContext({ id: UUID_A }));
    expect(listAdminClientResources).toHaveBeenCalledWith(UUID_A);
    expect(await response.json()).toEqual({ data: [{ id: 'r1' }] });
  });

  it.each([
    ['a plain http link', { ...resourceBody, resource_url: 'http://docs.example.com/guide' }],
    ['a title shorter than three characters', { ...resourceBody, title: 'ab' }],
  ])('POST returns 422 for %s', async (_label, body) => {
    expect((await postResource(body)).status).toBe(422);
    expect(createClientResource).not.toHaveBeenCalled();
  });

  it('POST creates a resource for the organisation and returns 201', async () => {
    jest.mocked(createClientResource).mockResolvedValue({ id: 'r-new' } as never);
    const response = await postResource(resourceBody);
    expect(response.status).toBe(201);
    expect(createClientResource).toHaveBeenCalledWith(expect.objectContaining({ orgId: UUID_A, offeringId: null, resourceUrl: resourceBody.resource_url }));
  });

  it.each([
    ['an administrator check failure', 'Platform administrator grant is no longer active', 403],
    ['a duplicate entitlement', 'entitlement required', 409],
    ['a missing organisation', 'organization not found', 404],
  ])('POST maps %s to %i', async (_label, message, status) => {
    jest.mocked(createClientResource).mockRejectedValue(new Error(message));
    expect((await postResource(resourceBody)).status).toBe(status);
  });

  it('DELETE archives the resource and returns 204 with no body', async () => {
    const response = await resourceDelete(new Request('http://t'), { params: Promise.resolve({ id: UUID_A, resourceId: UUID_B }) });
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(archiveClientResource).toHaveBeenCalledWith(expect.objectContaining({ orgId: UUID_A, resourceId: UUID_B }));
  });

  it('DELETE returns 404 for malformed ids and for resources that cannot be archived', async () => {
    expect((await resourceDelete(new Request('http://t'), { params: Promise.resolve({ id: 'x', resourceId: UUID_B }) })).status).toBe(404);
    jest.mocked(archiveClientResource).mockRejectedValue(new Error('Client resource not found'));
    expect((await resourceDelete(new Request('http://t'), { params: Promise.resolve({ id: UUID_A, resourceId: UUID_B }) })).status).toBe(404);
  });
});
