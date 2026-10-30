/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn(), default: jest.fn() }));
jest.mock('@/app/api/(services)/resources/service', () => ({ listClientResources: jest.fn() }));
jest.mock('@/app/api/(services)/sandbox/service', () => ({ runSandboxDemo: jest.fn() }));

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listClientResources } from '@/app/api/(services)/resources/service';
import { runSandboxDemo } from '@/app/api/(services)/sandbox/service';
import { GET as getClientResources } from '@/app/api/v1/client/resources/route';
import { POST as postDemoRun } from '@/app/api/v1/demos/[offeringId]/runs/route';
import { IDS, makeRequest, makeSession, readJson, routeParams, expectNoInternals } from './fixtures';

const getSessionMock = jest.mocked(getSession);
const authorizeMock = jest.mocked(authorize);
const listResourcesMock = jest.mocked(listClientResources);
const runDemoMock = jest.mocked(runSandboxDemo);

beforeEach(() => {
  authorizeMock.mockResolvedValue({ allowed: true });
});

describe('GET /api/v1/client/resources', () => {
  it('rejects an unauthenticated request with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await getClientResources();
    expect(response.status).toBe(401);
    expect(listResourcesMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an employee workspace that is not a sandbox', { orgType: 'azentio' as const }],
    ['no active workspace', { noWorkspace: true }],
  ])('returns 403 for %s without consulting authorize', async (_label, options) => {
    getSessionMock.mockResolvedValue(makeSession(options));
    const response = await getClientResources();
    expect(response.status).toBe(403);
    expect(authorizeMock).not.toHaveBeenCalled();
    expect(listResourcesMock).not.toHaveBeenCalled();
  });

  it('returns 403 with the authorize reason when the portal read permission is denied', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'Insufficient permission for this action' });
    const response = await getClientResources();
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Insufficient permission for this action' });
    expect(authorizeMock).toHaveBeenCalledWith({ action: 'portal:client:read' });
    expect(listResourcesMock).not.toHaveBeenCalled();
  });

  it('lists resources for the session active org and returns them under data with a private cache header', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    listResourcesMock.mockResolvedValue([{ id: 'r1' }] as never);
    const response = await getClientResources();
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: [{ id: 'r1' }] });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(listResourcesMock).toHaveBeenCalledWith(IDS.orgA);
  });

  it('allows a sandbox workspace even when it is an employee org', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio', isSandbox: true }));
    listResourcesMock.mockResolvedValue([] as never);
    const response = await getClientResources();
    expect(response.status).toBe(200);
  });
});

describe('POST /api/v1/demos/[offeringId]/runs', () => {
  const body = { scenario_key: 'synthetic-seasonality' };
  const run = (offeringId: string, init: Parameters<typeof makeRequest>[1] = { body }) =>
    postDemoRun(makeRequest(`/api/v1/demos/${offeringId}/runs`, init), routeParams({ offeringId }));

  beforeEach(() => {
    runDemoMock.mockResolvedValue({ id: 'run-1' } as never);
  });

  it('rejects an unauthenticated run with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await run('FAI');
    expect(response.status).toBe(401);
    expect(runDemoMock).not.toHaveBeenCalled();
  });

  it.each([
    ['no active workspace', { noWorkspace: true }],
    ['an employee workspace that is not a sandbox', { orgType: 'azentio' as const }],
  ])('returns 409 when the caller has %s', async (_label, options) => {
    getSessionMock.mockResolvedValue(makeSession(options));
    const response = await run('FAI');
    expect(response.status).toBe(409);
    expect(runDemoMock).not.toHaveBeenCalled();
  });

  it('returns 404 for an offering that has no sandbox, without authorizing', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    const response = await run('does-not-exist');
    expect(response.status).toBe(404);
    expect(authorizeMock).not.toHaveBeenCalled();
  });

  it('authorizes demo:run against the sandbox resource and entitlement for that offering', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    await run('FAI');
    expect(authorizeMock).toHaveBeenCalledWith({
      action: 'demo:run',
      resource: { type: 'sandbox', offeringId: 'FAI', feature: 'sandbox', requireEntitlement: true },
    });
  });

  it('answers a denied entitlement with 404 so the existence of the sandbox is not disclosed', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'This workspace is not entitled to the requested offering' });
    const response = await run('FAI');
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Sandbox not found' });
    expect(runDemoMock).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', { rawBody: '{nope' }, 400],
    ['a missing scenario key', { body: {} }, 422],
    ['an empty scenario key', { body: { scenario_key: '' } }, 422],
    ['a scenario that belongs to another offering', { body: { scenario_key: 'synthetic-claim-routing' } }, 422],
  ])('rejects %s with %i and never runs the demo', async (_label, init, status) => {
    getSessionMock.mockResolvedValue(makeSession());
    const response = await run('FAI', init);
    expect(response.status).toBe(status);
    expect(runDemoMock).not.toHaveBeenCalled();
  });

  it('runs the demo for the session active org and returns 201 with a no-store header', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    const response = await run('FAI');
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({ data: { id: 'run-1' } });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    const [demo, orgId, userId] = runDemoMock.mock.calls[0];
    expect(demo).toMatchObject({ id: 'FAI', scenarioKey: 'synthetic-seasonality' });
    expect(orgId).toBe(IDS.orgA);
    expect(userId).toBe(IDS.user);
  });

  it('ignores a tenant id in the body and runs against the session active org', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    await run('FAI', { body: { scenario_key: 'synthetic-seasonality', org_id: IDS.orgC } });
    expect(runDemoMock.mock.calls[0][1]).toBe(IDS.orgA);
  });

  it('truncates a caller-supplied request id to 100 characters', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    await run('FAI', { body, headers: { 'x-request-id': 'r'.repeat(250) } });
    expect(runDemoMock.mock.calls[0][3]).toHaveLength(100);
  });

  it('maps an entitlement failure from the service to 404', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    runDemoMock.mockRejectedValue(new Error('Workspace is not entitled'));
    const response = await run('FAI');
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Sandbox not found' });
  });

  it('maps a membership failure from the service to 403 with its message', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    runDemoMock.mockRejectedValue(new Error('No active membership for this workspace'));
    const response = await run('FAI');
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'No active membership for this workspace' });
  });

  it('returns a generic 500 without internals when the run cannot be saved', async () => {
    getSessionMock.mockResolvedValue(makeSession());
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    runDemoMock.mockRejectedValue(new Error('duplicate key value violates unique constraint "sandbox_runs_pkey"'));
    const response = await run('FAI');
    expect(response.status).toBe(500);
    const serialized = JSON.stringify(await readJson(response));
    expect(serialized).toBe(JSON.stringify({ error: 'Sandbox run could not be saved' }));
    expectNoInternals(serialized);
    consoleSpy.mockRestore();
  });
});
