/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn(), default: jest.fn() }));
jest.mock('@/app/api/(services)/support/access', () => ({
  grantOrganizationSupportAccess: jest.fn(),
  listSupportAccessGrants: jest.fn(),
  revokeOrganizationSupportAccess: jest.fn(),
}));
jest.mock('@/app/api/(services)/support/service', () => ({
  createClientSupportTicket: jest.fn(),
  listClientSupportTickets: jest.fn(),
  getClientSupportTicket: jest.fn(),
  listSupportAccessibleOrganizations: jest.fn(),
  listSupportTicketsForOrganization: jest.fn(),
}));
jest.mock('@/app/api/(services)/support/outbox', () => ({ deliverSupportTicketOutboxForTicket: jest.fn() }));

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import {
  grantOrganizationSupportAccess, listSupportAccessGrants, revokeOrganizationSupportAccess,
} from '@/app/api/(services)/support/access';
import {
  createClientSupportTicket, getClientSupportTicket, listClientSupportTickets,
  listSupportAccessibleOrganizations, listSupportTicketsForOrganization,
} from '@/app/api/(services)/support/service';
import { deliverSupportTicketOutboxForTicket } from '@/app/api/(services)/support/outbox';
import { GET as accessGet, POST as accessPost } from '@/app/api/v1/support-access/route';
import { DELETE as accessDelete } from '@/app/api/v1/support-access/[id]/route';
import { GET as ticketsGet, POST as ticketsPost } from '@/app/api/v1/support-tickets/route';
import { GET as ticketGet } from '@/app/api/v1/support-tickets/[id]/route';
import { GET as adminTicketsGet } from '@/app/api/v1/support-tickets/admin/route';
import { IDS, makeRequest, makeSession, readJson, routeParams, expectNoInternals } from './fixtures';

const getSessionMock = jest.mocked(getSession);
const authorizeMock = jest.mocked(authorize);
const listGrantsMock = jest.mocked(listSupportAccessGrants);
const grantMock = jest.mocked(grantOrganizationSupportAccess);
const revokeMock = jest.mocked(revokeOrganizationSupportAccess);
const createTicketMock = jest.mocked(createClientSupportTicket);
const listTicketsMock = jest.mocked(listClientSupportTickets);
const getTicketMock = jest.mocked(getClientSupportTicket);
const accessibleOrgsMock = jest.mocked(listSupportAccessibleOrganizations);
const adminTicketsMock = jest.mocked(listSupportTicketsForOrganization);
const deliverMock = jest.mocked(deliverSupportTicketOutboxForTicket);

const DENIED_ADMIN = 'Global portal administrator access required';

beforeEach(() => {
  getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio', role: 'portal_admin' }));
  authorizeMock.mockResolvedValue({ allowed: true });
  deliverMock.mockResolvedValue(undefined as never);
});

describe('support access grants /api/v1/support-access', () => {
  const grantBody = {
    portal_admin_id: IDS.otherUser,
    org_id: IDS.orgB,
    reason: 'Investigating a reported login failure',
    duration_hours: 24,
  };

  describe('GET', () => {
    it('rejects an unauthenticated request with 401', async () => {
      getSessionMock.mockResolvedValue(null);
      expect((await accessGet()).status).toBe(401);
      expect(listGrantsMock).not.toHaveBeenCalled();
    });

    it('returns 403 for a signed-in user without global portal admin access', async () => {
      authorizeMock.mockResolvedValue({ allowed: false, reason: 'Insufficient permission for this action' });
      const response = await accessGet();
      expect(response.status).toBe(403);
      expect(await readJson(response)).toEqual({ error: DENIED_ADMIN });
      expect(authorizeMock).toHaveBeenCalledWith({ action: 'portal:admin:read' });
      expect(listGrantsMock).not.toHaveBeenCalled();
    });

    it('lists grants under data with a private no-store header', async () => {
      listGrantsMock.mockResolvedValue([{ id: IDS.grant }] as never);
      const response = await accessGet();
      expect(response.status).toBe(200);
      expect(await readJson(response)).toEqual({ data: [{ id: IDS.grant }] });
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    });
  });

  describe('POST', () => {
    it('rejects an unauthenticated grant with 401 and creates nothing', async () => {
      getSessionMock.mockResolvedValue(null);
      expect((await accessPost(makeRequest('/api/v1/support-access', { body: grantBody }))).status).toBe(401);
      expect(grantMock).not.toHaveBeenCalled();
    });

    it('returns 403 for a non-admin and never reaches the grant service', async () => {
      authorizeMock.mockResolvedValue({ allowed: false, reason: 'x' });
      const response = await accessPost(makeRequest('/api/v1/support-access', { body: grantBody }));
      expect(response.status).toBe(403);
      expect(grantMock).not.toHaveBeenCalled();
    });

    it.each([
      ['malformed JSON', { rawBody: '{"reason":' }, 400],
      ['a reason shorter than 10 characters after trimming', { body: { ...grantBody, reason: '   short   ' } }, 422],
      ['a reason longer than 1000 characters', { body: { ...grantBody, reason: 'r'.repeat(1001) } }, 422],
      ['a duration of zero hours', { body: { ...grantBody, duration_hours: 0 } }, 422],
      ['a duration above 72 hours', { body: { ...grantBody, duration_hours: 73 } }, 422],
      ['a fractional duration', { body: { ...grantBody, duration_hours: 1.5 } }, 422],
      ['a portal admin id that is not a UUID', { body: { ...grantBody, portal_admin_id: 'me' } }, 422],
      ['an org id that is not a UUID', { body: { ...grantBody, org_id: '1' } }, 422],
      ['an actor id smuggled into the body', { body: { ...grantBody, actor_id: IDS.otherUser } }, 422],
    ])('rejects %s with %i and never grants', async (_label, init, status) => {
      const response = await accessPost(makeRequest('/api/v1/support-access', init));
      expect(response.status).toBe(status);
      expect(grantMock).not.toHaveBeenCalled();
    });

    it('grants access with the trimmed reason and the session user as the actor', async () => {
      grantMock.mockResolvedValue({ id: IDS.grant } as never);
      const response = await accessPost(makeRequest('/api/v1/support-access', {
        body: { ...grantBody, reason: `   ${grantBody.reason}   ` },
      }));
      expect(response.status).toBe(201);
      expect(await readJson(response)).toEqual({ data: { id: IDS.grant } });
      expect(grantMock).toHaveBeenCalledWith(expect.objectContaining({
        actorId: IDS.user,
        portalAdminId: IDS.otherUser,
        orgId: IDS.orgB,
        reason: grantBody.reason,
        durationHours: 24,
      }));
    });

    it('truncates a caller-supplied request id to 100 characters', async () => {
      grantMock.mockResolvedValue({} as never);
      await accessPost(makeRequest('/api/v1/support-access', { body: grantBody, headers: { 'x-request-id': 'q'.repeat(300) } }));
      expect(grantMock.mock.calls[0][0].requestId).toHaveLength(100);
    });

    it.each([
      ['already exists', 'Active support access already exists', 409],
      ['an unknown organisation', 'Active organisation not found', 404],
      ['a non-administrator grantee', 'Grantee is not a portal administrator', 403],
    ])('maps a service error for %s to %i with its message', async (_label, message, status) => {
      grantMock.mockRejectedValue(new Error(message));
      const response = await accessPost(makeRequest('/api/v1/support-access', { body: grantBody }));
      expect(response.status).toBe(status);
      expect(await readJson(response)).toEqual({ error: message });
    });

    it('returns a generic 500 without internals for an unexpected service failure', async () => {
      grantMock.mockRejectedValue(new Error('insert into support_access violates check constraint "support_access_hours"'));
      const response = await accessPost(makeRequest('/api/v1/support-access', { body: grantBody }));
      expect(response.status).toBe(500);
      const serialized = JSON.stringify(await readJson(response));
      expect(serialized).toBe(JSON.stringify({ error: 'Unable to grant support access' }));
      expectNoInternals(serialized);
    });
  });
});

describe('DELETE /api/v1/support-access/[id]', () => {
  const revoke = (id: string) => accessDelete(makeRequest(`/api/v1/support-access/${id}`, { method: 'DELETE' }), routeParams({ id }));

  it('rejects an unauthenticated revoke with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await revoke(IDS.grant)).status).toBe(401);
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller is not a global portal admin', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'x' });
    const response = await revoke(IDS.grant);
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: DENIED_ADMIN });
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed id without calling the service', async () => {
    const response = await revoke('not-a-uuid');
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Support access not found' });
    expect(revokeMock).not.toHaveBeenCalled();
  });

  it('revokes the grant with the session user as the actor and returns it under data', async () => {
    revokeMock.mockResolvedValue({ id: IDS.grant, revoked_at: '2026-01-01T00:00:00.000Z' } as never);
    const response = await revoke(IDS.grant);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: { id: IDS.grant, revoked_at: '2026-01-01T00:00:00.000Z' } });
    expect(revokeMock).toHaveBeenCalledWith(expect.objectContaining({ actorId: IDS.user, accessId: IDS.grant }));
  });

  it.each([
    ['not found', 'Support access not found', 404],
    ['an administrator check failure', 'Actor is not an administrator', 403],
  ])('maps a %s service error to %i', async (_label, message, status) => {
    revokeMock.mockRejectedValue(new Error(message));
    const response = await revoke(IDS.grant);
    expect(response.status).toBe(status);
    expect(await readJson(response)).toEqual({ error: status === 404 ? 'Support access not found' : message });
  });

  it('returns a generic 500 without internals for an unexpected failure', async () => {
    revokeMock.mockRejectedValue(new Error('deadlock detected'));
    const response = await revoke(IDS.grant);
    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({ error: 'Unable to revoke support access' });
  });
});

describe('support tickets /api/v1/support-tickets', () => {
  const ticketBody = { subject: 'Cannot open statements', details: 'The statements page shows a blank screen.', category: 'technical_issue' };

  describe('GET', () => {
    it('rejects an unauthenticated request with 401', async () => {
      getSessionMock.mockResolvedValue(null);
      expect((await ticketsGet()).status).toBe(401);
      expect(listTicketsMock).not.toHaveBeenCalled();
    });

    it.each([
      ['an employee workspace', () => makeSession({ orgType: 'azentio' })],
      ['no active workspace', () => makeSession({ noWorkspace: true })],
    ])('returns 403 for %s', async (_label, build) => {
      getSessionMock.mockResolvedValue(build());
      const response = await ticketsGet();
      expect(response.status).toBe(403);
      expect(await readJson(response)).toEqual({ error: 'Client workspace access required' });
      expect(listTicketsMock).not.toHaveBeenCalled();
    });

    it('returns 403 when portal:client:read is denied even in a client workspace', async () => {
      getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
      authorizeMock.mockResolvedValue({ allowed: false, reason: 'x' });
      expect((await ticketsGet()).status).toBe(403);
      expect(authorizeMock).toHaveBeenCalledWith({ action: 'portal:client:read' });
    });

    it('lists the signed-in user\'s tickets in the active client org with a private no-store header', async () => {
      getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
      listTicketsMock.mockResolvedValue([{ id: IDS.record }] as never);
      const response = await ticketsGet();
      expect(response.status).toBe(200);
      expect(await readJson(response)).toEqual({ data: [{ id: IDS.record }] });
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(listTicketsMock).toHaveBeenCalledWith(IDS.user, IDS.orgA);
    });
  });

  describe('POST', () => {
    beforeEach(() => {
      getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
    });

    it('rejects an unauthenticated ticket with 401', async () => {
      getSessionMock.mockResolvedValue(null);
      expect((await ticketsPost(makeRequest('/api/v1/support-tickets', { body: ticketBody }))).status).toBe(401);
      expect(createTicketMock).not.toHaveBeenCalled();
    });

    it('returns 403 for an employee workspace and creates nothing', async () => {
      getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio' }));
      expect((await ticketsPost(makeRequest('/api/v1/support-tickets', { body: ticketBody }))).status).toBe(403);
      expect(createTicketMock).not.toHaveBeenCalled();
    });

    it.each([
      ['malformed JSON', { rawBody: 'nope' }, 400],
      ['a subject shorter than 5 characters', { body: { ...ticketBody, subject: 'Hi' } }, 422],
      ['a subject longer than 200 characters', { body: { ...ticketBody, subject: 's'.repeat(201) } }, 422],
      ['details shorter than 10 characters', { body: { ...ticketBody, details: 'short' } }, 422],
      ['an unknown category', { body: { ...ticketBody, category: 'billing' } }, 422],
      ['a tenant id in the body (strict schema)', { body: { ...ticketBody, org_id: IDS.orgC } }, 422],
      ['a user id in the body (strict schema)', { body: { ...ticketBody, user_id: IDS.otherUser } }, 422],
    ])('rejects %s with %i and creates nothing', async (_label, init, status) => {
      const response = await ticketsPost(makeRequest('/api/v1/support-tickets', init));
      expect(response.status).toBe(status);
      expect(createTicketMock).not.toHaveBeenCalled();
    });

    it('creates the ticket for the session user and active org, then attempts outbox delivery', async () => {
      createTicketMock.mockResolvedValue({ id: IDS.record, subject: ticketBody.subject } as never);
      const response = await ticketsPost(makeRequest('/api/v1/support-tickets', { body: ticketBody }));
      expect(response.status).toBe(201);
      expect(await readJson(response)).toEqual({ data: { id: IDS.record, subject: ticketBody.subject } });
      expect(response.headers.get('Cache-Control')).toBe('private, no-store');
      expect(createTicketMock).toHaveBeenCalledWith(expect.objectContaining({
        userId: IDS.user,
        orgId: IDS.orgA,
        subject: ticketBody.subject,
        details: ticketBody.details,
        category: 'technical_issue',
      }));
      expect(deliverMock).toHaveBeenCalledWith(IDS.record);
    });

    it('still returns 201 when the immediate outbox delivery attempt fails', async () => {
      createTicketMock.mockResolvedValue({ id: IDS.record } as never);
      deliverMock.mockRejectedValue(new Error('smtp unavailable'));
      const response = await ticketsPost(makeRequest('/api/v1/support-tickets', { body: ticketBody }));
      expect(response.status).toBe(201);
    });

    it('returns a fixed 403 without internals when the create service fails', async () => {
      createTicketMock.mockRejectedValue(new Error('relation "support_tickets" does not exist'));
      const response = await ticketsPost(makeRequest('/api/v1/support-tickets', { body: ticketBody }));
      expect(response.status).toBe(403);
      const serialized = JSON.stringify(await readJson(response));
      expect(serialized).toBe(JSON.stringify({ error: 'Unable to create support ticket' }));
      expectNoInternals(serialized);
    });
  });
});

describe('GET /api/v1/support-tickets/[id]', () => {
  const load = (id: string) => ticketGet(makeRequest(`/api/v1/support-tickets/${id}`), routeParams({ id }));

  beforeEach(() => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
  });

  it('rejects an unauthenticated request with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await load(IDS.record)).status).toBe(401);
    expect(getTicketMock).not.toHaveBeenCalled();
  });

  it('returns 403 for an employee workspace', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio' }));
    expect((await load(IDS.record)).status).toBe(403);
    expect(getTicketMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed id without querying', async () => {
    const response = await load('123');
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Support ticket not found' });
    expect(getTicketMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the ticket is not visible to this user and org', async () => {
    getTicketMock.mockResolvedValue(null as never);
    const response = await load(IDS.record);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Support ticket not found' });
  });

  it('scopes the lookup to the requesting user and active org and returns the ticket under data', async () => {
    getTicketMock.mockResolvedValue({ id: IDS.record } as never);
    const response = await load(IDS.record);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record } });
    expect(getTicketMock).toHaveBeenCalledWith(IDS.record, IDS.user, IDS.orgA);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns a fixed 403 without internals when the lookup fails', async () => {
    getTicketMock.mockRejectedValue(new Error('timeout acquiring connection from pool'));
    const response = await load(IDS.record);
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Unable to load support ticket' });
  });
});

describe('GET /api/v1/support-tickets/admin', () => {
  const adminGet = (query = '') => adminTicketsGet(makeRequest(`/api/v1/support-tickets/admin${query}`));

  it('rejects an unauthenticated request with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await adminGet()).status).toBe(401);
    expect(accessibleOrgsMock).not.toHaveBeenCalled();
  });

  it('returns 403 when the caller lacks portal admin access', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'x' });
    const response = await adminGet();
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Portal administrator access required' });
    expect(authorizeMock).toHaveBeenCalledWith({ action: 'portal:admin:read' });
  });

  it('lists the organisations the admin can support when no org is requested', async () => {
    accessibleOrgsMock.mockResolvedValue([{ id: IDS.orgB }] as never);
    const response = await adminGet();
    expect(await readJson(response)).toEqual({ data: { organizations: [{ id: IDS.orgB }] } });
    expect(accessibleOrgsMock).toHaveBeenCalledWith(IDS.user);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it.each(['not-a-uuid', '0', `${IDS.orgB},${IDS.orgC}`])('rejects org_id=%s with 422', async (orgId) => {
    const response = await adminGet(`?org_id=${orgId}`);
    expect(response.status).toBe(422);
    expect(await readJson(response)).toEqual({ error: 'Invalid organisation' });
    expect(adminTicketsMock).not.toHaveBeenCalled();
  });

  it('returns tickets for an org the admin has active access to', async () => {
    adminTicketsMock.mockResolvedValue([{ id: IDS.record }] as never);
    const response = await adminGet(`?org_id=${IDS.orgB}`);
    expect(await readJson(response)).toEqual({ data: { tickets: [{ id: IDS.record }] } });
    expect(adminTicketsMock).toHaveBeenCalledWith(IDS.user, IDS.orgB);
  });

  it('returns 403 when the admin has no active support access to the requested org', async () => {
    adminTicketsMock.mockRejectedValue(new Error('no active support access'));
    const response = await adminGet(`?org_id=${IDS.orgB}`);
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Active support access is required for this organisation' });
  });
});
