/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn(), default: jest.fn() }));
jest.mock('@/app/api/(services)/broadcasts/service', () => ({
  createBroadcast: jest.fn(),
  listClientBroadcasts: jest.fn(),
  listClientOrganizationsForPublisher: jest.fn(),
  listEmployeeBroadcasts: jest.fn(),
  listManagedBroadcasts: jest.fn(),
  updateBroadcast: jest.fn(),
  getClientBroadcastTarget: jest.fn(),
  getEmployeeBroadcastTarget: jest.fn(),
}));

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import {
  createBroadcast, getClientBroadcastTarget, getEmployeeBroadcastTarget, listClientBroadcasts,
  listClientOrganizationsForPublisher, listEmployeeBroadcasts, listManagedBroadcasts, updateBroadcast,
} from '@/app/api/(services)/broadcasts/service';
import { GET, POST, OPTIONS } from '@/app/api/v1/broadcasts/route';
import { PATCH } from '@/app/api/v1/broadcasts/[id]/route';
import { GET as mediaGet } from '@/app/api/v1/broadcasts/[id]/media/route';
import { IDS, makeRequest, makeSession, readJson, routeParams, expectNoInternals } from './fixtures';

const getSessionMock = jest.mocked(getSession);
const authorizeMock = jest.mocked(authorize);
const createMock = jest.mocked(createBroadcast);
const listClientMock = jest.mocked(listClientBroadcasts);
const listEmployeeMock = jest.mocked(listEmployeeBroadcasts);
const listManagedMock = jest.mocked(listManagedBroadcasts);
const listClientOrgsMock = jest.mocked(listClientOrganizationsForPublisher);
const updateMock = jest.mocked(updateBroadcast);
const clientTargetMock = jest.mocked(getClientBroadcastTarget);
const employeeTargetMock = jest.mocked(getEmployeeBroadcastTarget);

/** Allow only the listed authorize actions; everything else is denied. */
function allow(...actions: string[]) {
  authorizeMock.mockImplementation(async ({ action }) => (
    actions.includes(action) ? { allowed: true } : { allowed: false, reason: 'Insufficient permission for this action' }
  ));
}

const validCreate = {
  title: 'Quarterly product webinar',
  starts_at: '2026-06-01T10:00:00Z',
  ends_at: '2026-06-01T11:00:00Z',
  join_url: 'https://meet.example.com/abc',
};

beforeEach(() => {
  getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio' }));
  allow('portal:employee:read', 'broadcast:manage');
  createMock.mockResolvedValue({ id: IDS.record } as never);
});

describe('GET /api/v1/broadcasts', () => {
  it('rejects an unauthenticated request with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await GET();
    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: 'Authentication and an active workspace are required' });
  });

  it('returns 401 when no workspace is active', async () => {
    getSessionMock.mockResolvedValue(makeSession({ noWorkspace: true }));
    expect((await GET()).status).toBe(401);
  });

  it('returns client sessions under data for a client workspace with no management block', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
    allow('portal:client:read');
    listClientMock.mockResolvedValue([{ id: IDS.record }] as never);
    const response = await GET();
    expect(authorizeMock).toHaveBeenCalledWith({ action: 'portal:client:read' });
    expect(await readJson(response)).toEqual({ data: [{ id: IDS.record }] });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(listClientMock).toHaveBeenCalledWith(IDS.orgA);
  });

  it('returns 403 for a client workspace denied portal:client:read', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
    allow();
    const response = await GET();
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Broadcast access required' });
    expect(listClientMock).not.toHaveBeenCalled();
  });

  it('returns employee sessions with management data for a publisher', async () => {
    listEmployeeMock.mockResolvedValue([{ id: 'e1' }] as never);
    listManagedMock.mockResolvedValue([{ id: 'm1' }] as never);
    listClientOrgsMock.mockResolvedValue([{ id: IDS.orgB }] as never);
    const response = await GET();
    expect(await readJson(response)).toEqual({
      data: [{ id: 'e1' }],
      management: { sessions: [{ id: 'm1' }], clientOrganizations: [{ id: IDS.orgB }] },
    });
    expect(listClientOrgsMock).toHaveBeenCalledWith(IDS.user, IDS.orgA);
  });

  it('omits client organisations for a sandbox workspace', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio', isSandbox: true }));
    listEmployeeMock.mockResolvedValue([] as never);
    listManagedMock.mockResolvedValue([] as never);
    const response = await GET();
    expect((await readJson(response)).management.clientOrganizations).toEqual([]);
    expect(listClientOrgsMock).not.toHaveBeenCalled();
  });

  it('returns no management block when the caller can read but not manage broadcasts', async () => {
    allow('portal:employee:read');
    listEmployeeMock.mockResolvedValue([] as never);
    const response = await GET();
    expect(response.status).toBe(200);
    expect((await readJson(response)).management).toBeNull();
    expect(listManagedMock).not.toHaveBeenCalled();
  });

  it('returns 403 when neither employee read nor broadcast management is allowed', async () => {
    allow();
    expect((await GET()).status).toBe(403);
    expect(listEmployeeMock).not.toHaveBeenCalled();
  });
});

describe('POST /api/v1/broadcasts', () => {
  const post = (body: unknown = validCreate) => POST(makeRequest('/api/v1/broadcasts', { body }));

  it('rejects an unauthenticated create with 401 and creates nothing', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await post();
    expect(response.status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a client workspace', () => makeSession({ orgType: 'client' })],
    ['no active workspace', () => makeSession({ noWorkspace: true })],
  ])('returns 403 for %s and creates nothing', async (_label, build) => {
    getSessionMock.mockResolvedValue(build());
    expect((await post()).status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns 403 when broadcast:manage is denied', async () => {
    allow('portal:employee:read');
    const response = await post();
    expect(response.status).toBe(403);
    expect(createMock).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', { rawBody: '{"title":' }, 400],
    ['a title shorter than 3 characters', { body: { ...validCreate, title: 'ab' } }, 422],
    ['a start time without a timezone', { body: { ...validCreate, starts_at: '2026-06-01T10:00:00' } }, 422],
    ['an end time before the start time', { body: { ...validCreate, ends_at: '2026-06-01T09:00:00Z' } }, 422],
    ['a plain http join link', { body: { ...validCreate, join_url: 'http://meet.example.com/abc' } }, 422],
    ['a javascript: join link', { body: { ...validCreate, join_url: 'javascript:alert(1)' } }, 422],
    ['an audience outside the enum', { body: { ...validCreate, audience: 'public' } }, 422],
    ['more than 100 invited organisations', { body: { ...validCreate, invited_org_ids: Array.from({ length: 101 }, () => IDS.orgB) } }, 422],
    ['an invited organisation id that is not a UUID', { body: { ...validCreate, invited_org_ids: ['org-b'] } }, 422],
    ['a tenant id in the body (strict schema)', { body: { ...validCreate, org_id: IDS.orgC } }, 422],
  ])('rejects %s with %i and creates nothing', async (_label, init, status) => {
    const response = await POST(makeRequest('/api/v1/broadcasts', init));
    expect(response.status).toBe(status);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('requires at least one invited client workspace for a client webinar outside a sandbox', async () => {
    const response = await post({ ...validCreate, audience: 'clients', invited_org_ids: [] });
    expect(response.status).toBe(422);
    expect(await readJson(response)).toEqual({ error: 'Invite at least one client workspace to schedule a client webinar' });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('allows a client webinar with no invitees inside a sandbox workspace', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio', isSandbox: true }));
    const response = await post({ ...validCreate, audience: 'clients', invited_org_ids: [] });
    expect(response.status).toBe(201);
  });

  it('creates the session for the active org with camelCase fields and defaults applied', async () => {
    const response = await post({ title: 'Quarterly product webinar', starts_at: validCreate.starts_at });
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record } });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(createMock).toHaveBeenCalledWith({
      userId: IDS.user,
      orgId: IDS.orgA,
      requestId: expect.any(String),
      title: 'Quarterly product webinar',
      description: '',
      startsAt: validCreate.starts_at,
      endsAt: null,
      joinUrl: null,
      recordingUrl: null,
      audience: 'employees',
      invitedOrgIds: [],
    });
  });

  it('passes an invited client organisation list through to the service', async () => {
    await post({ ...validCreate, audience: 'clients', invited_org_ids: [IDS.orgB] });
    expect(createMock.mock.calls[0][0]).toMatchObject({ audience: 'clients', invitedOrgIds: [IDS.orgB] });
  });

  it('returns 403 for a grant or membership failure from the service', async () => {
    createMock.mockRejectedValue(new Error('Active publisher grant missing'));
    const response = await post();
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Active publisher grant missing' });
  });

  it('returns 422 for a client workspace rule failure from the service', async () => {
    createMock.mockRejectedValue(new Error('Invited organisation is not a client workspace'));
    expect((await post()).status).toBe(422);
  });

  it('returns 403 when the service rejects external workspaces', async () => {
    createMock.mockRejectedValue(new Error('Cannot host this session in external workspaces'));
    expect((await post()).status).toBe(403);
  });

  it('answers a non-URL recording link with 422 instead of throwing', async () => {
    const response = await POST(makeRequest('/api/v1/broadcasts', { body: { ...validCreate, recording_url: 'recording' } }));
    expect(response.status).toBe(422);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns a generic 500 without internals for an unexpected failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    createMock.mockRejectedValue(new Error('insert into broadcasts violates foreign key constraint'));
    const response = await post();
    expect(response.status).toBe(500);
    const serialized = JSON.stringify(await readJson(response));
    expect(serialized).toBe(JSON.stringify({ error: 'Unable to create the session' }));
    expectNoInternals(serialized);
    consoleSpy.mockRestore();
  });

  it('advertises its allowed methods from OPTIONS', async () => {
    const response = await OPTIONS();
    expect(response.status).toBe(204);
    expect(response.headers.get('Allow')).toBe('GET, POST, OPTIONS');
  });
});

describe('PATCH /api/v1/broadcasts/[id]', () => {
  const update = (id: string, body: unknown = { status: 'live' }) =>
    PATCH(makeRequest(`/api/v1/broadcasts/${id}`, { method: 'PATCH', body }), routeParams({ id }));

  beforeEach(() => {
    updateMock.mockResolvedValue({ id: IDS.record, status: 'live' } as never);
  });

  it('requires sign-in (401) for anonymous callers and hides the session behind 404 for employee-less workspaces', async () => {
    getSessionMock.mockResolvedValue(null);
    const anonymous = await update(IDS.record);
    expect(anonymous.status).toBe(401);
    expect(await readJson(anonymous)).toEqual({ error: 'Authentication required' });
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
    expect((await update(IDS.record)).status).toBe(404);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed id or when broadcast:manage is denied', async () => {
    expect((await update('bad-id')).status).toBe(404);
    allow('portal:employee:read');
    const response = await update(IDS.record);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Session not found' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown status', { status: 'paused' }, 422],
    ['a missing status', {}, 422],
    ['a non-https join link', { status: 'scheduled', join_url: 'http://meet.example.com' }, 422],
    ['a javascript: recording link', { status: 'recorded', recording_url: 'javascript:void(0)' }, 422],
  ])('rejects %s with %i and does not update', async (_label, body, status) => {
    const response = await update(IDS.record, body);
    expect(response.status).toBe(status);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('answers a non-URL join link with 422 instead of throwing', async () => {
    const response = await update(IDS.record, { status: 'scheduled', join_url: 'not a url' });
    expect(response.status).toBe(422);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('updates the session status for the active org and returns it under data', async () => {
    const response = await update(IDS.record, { status: 'recorded', recording_url: 'https://video.example.com/rec' });
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record, status: 'live' } });
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: IDS.user,
      orgId: IDS.orgA,
      id: IDS.record,
      status: 'recorded',
      joinUrl: null,
      recordingUrl: 'https://video.example.com/rec',
    }));
  });

  it('maps a not-found or grant failure to 404 with the generic message', async () => {
    updateMock.mockRejectedValue(new Error('Session not found in this organisation'));
    const response = await update(IDS.record);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Session not found' });
  });

  it('maps an invalid transition to 409 with its message', async () => {
    updateMock.mockRejectedValue(new Error('Invalid transition from cancelled to live'));
    const response = await update(IDS.record);
    expect(response.status).toBe(409);
    expect(await readJson(response)).toEqual({ error: 'Invalid transition from cancelled to live' });
  });

  it('returns a generic 500 without internals for an unexpected failure', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    updateMock.mockRejectedValue(new Error('deadlock detected at broadcasts row'));
    const response = await update(IDS.record);
    expect(response.status).toBe(500);
    const serialized = JSON.stringify(await readJson(response));
    expect(serialized).toBe(JSON.stringify({ error: 'Unable to update the session' }));
    expectNoInternals(serialized);
    consoleSpy.mockRestore();
  });
});

describe('GET /api/v1/broadcasts/[id]/media', () => {
  const media = (id: string, query: string) =>
    mediaGet(makeRequest(`/api/v1/broadcasts/${id}/media${query}`), routeParams({ id }));

  beforeEach(() => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio' }));
    allow('portal:employee:read', 'portal:client:read');
    employeeTargetMock.mockResolvedValue('https://meet.example.com/abc' as never);
    clientTargetMock.mockResolvedValue('https://video.example.com/rec' as never);
  });

  it.each([
    ['an anonymous caller', () => getSessionMock.mockResolvedValue(null)],
    ['a caller with no active workspace', () => getSessionMock.mockResolvedValue(makeSession({ noWorkspace: true }))],
  ])('returns 404 with no body for %s', async (_label, arrange) => {
    arrange();
    const response = await media(IDS.record, '?kind=join');
    expect(response.status).toBe(404);
    expect(await response.text()).toBe('');
    expect(employeeTargetMock).not.toHaveBeenCalled();
  });

  it.each([
    ['a malformed id', 'not-a-uuid', '?kind=join'],
    ['an unknown kind', IDS.record, '?kind=download'],
    ['a missing kind', IDS.record, ''],
  ])('returns 404 for %s before resolving any target', async (_label, id, query) => {
    const response = await media(id, query);
    expect(response.status).toBe(404);
    expect(employeeTargetMock).not.toHaveBeenCalled();
    expect(clientTargetMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the caller is denied the relevant read permission', async () => {
    allow();
    const response = await media(IDS.record, '?kind=join');
    expect(response.status).toBe(404);
    expect(employeeTargetMock).not.toHaveBeenCalled();
  });

  it('redirects an employee to the join link with no-referrer and no-store headers', async () => {
    const response = await media(IDS.record, '?kind=join');
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://meet.example.com/abc');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('Referrer-Policy')).toBe('no-referrer');
    expect(employeeTargetMock).toHaveBeenCalledWith(IDS.orgA, IDS.record, 'join');
    expect(authorizeMock).toHaveBeenCalledWith({ action: 'portal:employee:read' });
  });

  it('redirects a client to the recording using the client target lookup', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
    const response = await media(IDS.record, '?kind=recording');
    expect(response.status).toBe(302);
    expect(response.headers.get('Location')).toBe('https://video.example.com/rec');
    expect(clientTargetMock).toHaveBeenCalledWith(IDS.orgA, IDS.record, 'recording');
    expect(authorizeMock).toHaveBeenCalledWith({ action: 'portal:client:read' });
  });

  it('returns 404 when no target is configured', async () => {
    clientTargetMock.mockResolvedValue(null as never);
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
    expect((await media(IDS.record, '?kind=join')).status).toBe(404);
  });

  it.each([
    ['a plain http link', 'http://meet.example.com/abc'],
    ['a javascript: link', 'javascript:alert(1)'],
  ])('never redirects to %s', async (_label, target) => {
    employeeTargetMock.mockResolvedValue(target as never);
    const response = await media(IDS.record, '?kind=join');
    expect(response.status).toBe(404);
    expect(response.headers.get('Location')).toBeNull();
  });
});
