/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn(), default: jest.fn() }));
jest.mock('@/app/api/(services)/releases/service', () => ({
  listClientReleaseNotes: jest.fn(),
  listEmployeeReleaseNotes: jest.fn(),
  createReleaseNote: jest.fn(),
  getReleaseNoteScope: jest.fn(),
  updateReleaseNoteDraft: jest.fn(),
  publishReleaseNote: jest.fn(),
  archiveReleaseNote: jest.fn(),
}));

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import {
  archiveReleaseNote, createReleaseNote, getReleaseNoteScope, listClientReleaseNotes,
  listEmployeeReleaseNotes, publishReleaseNote, updateReleaseNoteDraft,
} from '@/app/api/(services)/releases/service';
import { GET, POST } from '@/app/api/v1/release-notes/route';
import { PATCH } from '@/app/api/v1/release-notes/[id]/route';
import { POST as publishPost } from '@/app/api/v1/release-notes/[id]/publish/route';
import { POST as archivePost } from '@/app/api/v1/release-notes/[id]/archive/route';
import { IDS, makeRequest, makeSession, readJson, routeParams, expectNoInternals } from './fixtures';

const getSessionMock = jest.mocked(getSession);
const authorizeMock = jest.mocked(authorize);
const listClientMock = jest.mocked(listClientReleaseNotes);
const listEmployeeMock = jest.mocked(listEmployeeReleaseNotes);
const createMock = jest.mocked(createReleaseNote);
const scopeMock = jest.mocked(getReleaseNoteScope);
const updateMock = jest.mocked(updateReleaseNoteDraft);
const publishMock = jest.mocked(publishReleaseNote);
const archiveMock = jest.mocked(archiveReleaseNote);

const validCreate = {
  title: 'Release 2.4 notes',
  body: 'Shared learning search now supports saved filters.',
  audience: 'clients',
};

beforeEach(() => {
  getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio', role: 'employee' }));
  authorizeMock.mockResolvedValue({ allowed: true });
  scopeMock.mockResolvedValue({ id: IDS.record, offering_id: 'fai', status: 'draft' } as never);
});

describe('GET /api/v1/release-notes', () => {
  it('rejects an unauthenticated request with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await GET()).status).toBe(401);
    expect(listEmployeeMock).not.toHaveBeenCalled();
    expect(listClientMock).not.toHaveBeenCalled();
  });

  it('returns 409 when no workspace is selected', async () => {
    getSessionMock.mockResolvedValue(makeSession({ noWorkspace: true }));
    const response = await GET();
    expect(response.status).toBe(409);
    expect(await readJson(response)).toEqual({ error: 'Select a workspace first' });
  });

  it('uses the employee permission and employee list for an Azentio workspace', async () => {
    listEmployeeMock.mockResolvedValue([{ id: IDS.record }] as never);
    const response = await GET();
    expect(authorizeMock).toHaveBeenCalledWith({ action: 'portal:employee:read' });
    expect(listEmployeeMock).toHaveBeenCalledWith(IDS.user, IDS.orgA);
    expect(await readJson(response)).toEqual({ data: [{ id: IDS.record }] });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('uses the client permission and client list for a client workspace', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
    listClientMock.mockResolvedValue([] as never);
    const response = await GET();
    expect(authorizeMock).toHaveBeenCalledWith({ action: 'portal:client:read' });
    expect(listClientMock).toHaveBeenCalledWith(IDS.user, IDS.orgA);
    expect(response.status).toBe(200);
  });

  it('returns 403 with the authorize reason when the audience permission is denied', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'Insufficient permission for this action' });
    const response = await GET();
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Insufficient permission for this action' });
    expect(listEmployeeMock).not.toHaveBeenCalled();
  });

  it('returns a fixed 403 when the list query fails', async () => {
    listEmployeeMock.mockRejectedValue(new Error('timeout'));
    const response = await GET();
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Unable to load release notes' });
  });
});

describe('POST /api/v1/release-notes', () => {
  const post = (init: Parameters<typeof makeRequest>[1] = { body: validCreate }) =>
    POST(makeRequest('/api/v1/release-notes', init));

  beforeEach(() => {
    createMock.mockResolvedValue({ id: IDS.record, title: validCreate.title } as never);
  });

  it('rejects an unauthenticated create with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await post()).status).toBe(401);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('returns 409 when no workspace is selected', async () => {
    getSessionMock.mockResolvedValue(makeSession({ noWorkspace: true }));
    expect((await post()).status).toBe(409);
  });

  it.each([
    ['malformed JSON', { rawBody: '{' }, 400],
    ['a title shorter than 3 characters', { body: { ...validCreate, title: 'ab' } }, 422],
    ['a body shorter than 10 characters', { body: { ...validCreate, body: 'short' } }, 422],
    ['an audience outside the enum', { body: { ...validCreate, audience: 'public' } }, 422],
    ['an org id that is not a UUID', { body: { ...validCreate, org_id: 'org-1' } }, 422],
    ['an empty offering id', { body: { ...validCreate, offering_id: '' } }, 422],
    ['a smuggled active org id (strict schema)', { body: { ...validCreate, active_org_id: IDS.orgC } }, 422],
    ['a client-set status (strict schema)', { body: { ...validCreate, status: 'published' } }, 422],
  ])('rejects %s with %i and creates nothing', async (_label, init, status) => {
    const response = await post(init);
    expect(response.status).toBe(status);
    expect(createMock).not.toHaveBeenCalled();
  });

  it('checks release-notes:manage scoped to the requested offering before creating', async () => {
    await post({ body: { ...validCreate, offering_id: 'fai' } });
    expect(authorizeMock).toHaveBeenCalledWith({
      action: 'release-notes:manage',
      resource: { type: 'release_note', offeringId: 'fai' },
    });
  });

  it('returns 403 and creates nothing when release-notes:manage is denied', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'Insufficient permission for this action' });
    const response = await post();
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Insufficient permission for this action' });
    expect(createMock).not.toHaveBeenCalled();
  });

  it('creates a draft for the session user and active org, with trimmed text and null defaults', async () => {
    const response = await post({ body: { ...validCreate, title: '  Release 2.4 notes  ' } });
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record, title: validCreate.title } });
    expect(createMock).toHaveBeenCalledWith(expect.objectContaining({
      actorId: IDS.user,
      activeOrgId: IDS.orgA,
      title: validCreate.title,
      audience: 'clients',
      offeringId: null,
      orgId: null,
    }));
  });

  it('maps a business rule failure from the service to 422 with its message', async () => {
    createMock.mockRejectedValue(new Error('Active client organization not found'));
    const response = await post({ body: { ...validCreate, org_id: IDS.orgB } });
    expect(response.status).toBe(422);
    expect(await readJson(response)).toEqual({ error: 'Active client organization not found' });
  });

  it('maps a grant failure from the service to 403', async () => {
    createMock.mockRejectedValue(new Error('Release manager grant is required'));
    expect((await post()).status).toBe(403);
  });

  // Known defect: any non-grant Error text is echoed to the client, so raw database or driver messages leak.
  it('does not echo raw infrastructure error text to the client on create', async () => {
    createMock.mockRejectedValue(new Error('duplicate key value violates unique constraint "release_notes_pkey"'));
    const response = await post();
    const serialized = JSON.stringify(await readJson(response));
    expectNoInternals(serialized);
    expect(response.status).toBe(500);
  });
});

describe('PATCH /api/v1/release-notes/[id]', () => {
  const update = (id: string, init: Parameters<typeof makeRequest>[1] = { method: 'PATCH', body: { title: 'Updated title', body: 'Updated body text here.' } }) =>
    PATCH(makeRequest(`/api/v1/release-notes/${id}`, init), routeParams({ id }));

  beforeEach(() => {
    updateMock.mockResolvedValue({ id: IDS.record } as never);
  });

  it('rejects an unauthenticated update with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await update(IDS.record)).status).toBe(401);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed id without loading the note', async () => {
    const response = await update('nope');
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Release note not found' });
    expect(scopeMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the note does not exist', async () => {
    scopeMock.mockResolvedValue(null as never);
    expect((await update(IDS.record)).status).toBe(404);
  });

  it('returns 404 rather than 403 when the note is outside the caller\'s management scope', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'x' });
    const response = await update(IDS.record);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Release note not found' });
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('authorizes against the stored offering of the note, not a body-supplied one', async () => {
    await update(IDS.record, { method: 'PATCH', body: { title: 'Updated title', body: 'Updated body text here.', offering_id: 'lending' } });
    expect(authorizeMock).toHaveBeenCalledWith({
      action: 'release-notes:manage',
      resource: { type: 'release_note', offeringId: 'fai' },
    });
  });

  it.each([
    ['malformed JSON', { method: 'PATCH', rawBody: '[' }, 400],
    ['a title shorter than 3 characters', { method: 'PATCH', body: { title: 'x', body: 'Updated body text here.' } }, 422],
    ['an extra audience field (strict schema)', { method: 'PATCH', body: { title: 'Updated title', body: 'Updated body text here.', audience: 'employees' } }, 422],
  ])('rejects %s with %i and does not update', async (_label, init, status) => {
    const response = await update(IDS.record, init);
    expect(response.status).toBe(status);
    expect(updateMock).not.toHaveBeenCalled();
  });

  it('updates the draft using the stored offering and the session active org', async () => {
    const response = await update(IDS.record);
    expect(response.status).toBe(200);
    expect(updateMock).toHaveBeenCalledWith(expect.objectContaining({
      id: IDS.record,
      actorId: IDS.user,
      activeOrgId: IDS.orgA,
      offeringId: 'fai',
    }));
  });

  it('maps a state conflict from the service to 409', async () => {
    updateMock.mockRejectedValue(new Error('Release note is in a state that cannot be edited'));
    const response = await update(IDS.record);
    expect(response.status).toBe(409);
    expect(await readJson(response)).toEqual({ error: 'Release note is in a state that cannot be edited' });
  });

  // Known defect: a non-state Error message is echoed verbatim with a 403, so raw driver text reaches the client.
  it('does not echo raw infrastructure error text to the client on update', async () => {
    updateMock.mockRejectedValue(new Error('canceling statement due to statement timeout'));
    const response = await update(IDS.record);
    expectNoInternals(JSON.stringify(await readJson(response)));
    expect(response.status).toBe(500);
  });
});

describe('POST /api/v1/release-notes/[id]/publish', () => {
  const publish = (id: string) => publishPost(makeRequest(`/api/v1/release-notes/${id}/publish`, { method: 'POST' }), routeParams({ id }));

  beforeEach(() => {
    publishMock.mockResolvedValue({ id: IDS.record, status: 'published' } as never);
  });

  it('rejects an unauthenticated publish with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await publish(IDS.record)).status).toBe(401);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed id', async () => {
    expect((await publish('x')).status).toBe(404);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the note is missing or outside scope, without publishing', async () => {
    scopeMock.mockResolvedValueOnce(null as never);
    expect((await publish(IDS.record)).status).toBe(404);
    authorizeMock.mockResolvedValueOnce({ allowed: false, reason: 'x' });
    expect((await publish(IDS.record)).status).toBe(404);
    expect(publishMock).not.toHaveBeenCalled();
  });

  it('publishes the note in the session active org and returns it under data', async () => {
    const response = await publish(IDS.record);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record, status: 'published' } });
    expect(publishMock).toHaveBeenCalledWith(expect.objectContaining({ id: IDS.record, actorId: IDS.user, activeOrgId: IDS.orgA, offeringId: 'fai' }));
  });

  it('maps an invalid status transition to 409, a grant failure to 403 and anything else to a generic 500', async () => {
    publishMock.mockRejectedValueOnce(new Error('Invalid transition from archived'));
    expect((await publish(IDS.record)).status).toBe(409);
    publishMock.mockRejectedValueOnce(new Error('Release-note publishing grant is no longer active'));
    expect((await publish(IDS.record)).status).toBe(403);
    publishMock.mockRejectedValueOnce(new Error('connection terminated unexpectedly'));
    const response = await publish(IDS.record);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await response.json())).not.toContain('connection terminated');
  });
});

describe('POST /api/v1/release-notes/[id]/archive', () => {
  const archive = (id: string) => archivePost(makeRequest(`/api/v1/release-notes/${id}/archive`, { method: 'POST' }), routeParams({ id }));

  beforeEach(() => {
    archiveMock.mockResolvedValue({ id: IDS.record, status: 'archived' } as never);
  });

  it('rejects an unauthenticated archive with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await archive(IDS.record)).status).toBe(401);
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the note is outside the management scope', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'x' });
    expect((await archive(IDS.record)).status).toBe(404);
    expect(archiveMock).not.toHaveBeenCalled();
  });

  it('archives the note for the session active org and returns it under data', async () => {
    const response = await archive(IDS.record);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record, status: 'archived' } });
    expect(archiveMock).toHaveBeenCalledWith(expect.objectContaining({ id: IDS.record, activeOrgId: IDS.orgA }));
  });

  it('maps an invalid transition to 409', async () => {
    archiveMock.mockRejectedValue(new Error('Invalid transition from draft'));
    const response = await archive(IDS.record);
    expect(response.status).toBe(409);
    expect(await readJson(response)).toEqual({ error: 'Invalid transition from draft' });
  });
});
