import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import {
  createIdea, getIdea, getIdeaEvidence, getIdeaHistory, getIdeaScope, listIdeas, updateIdeaStatus,
} from '@/app/api/(services)/ideas/service';
import { getVisibleTheme, listVisibleThemes } from '@/app/api/(services)/learning/shared-learning';
import { GET as listIdeasRoute, POST as createIdeaRoute } from '@/app/api/v1/ideas/route';
import { GET as getIdeaRoute, PATCH as patchIdeaRoute } from '@/app/api/v1/ideas/[id]/route';
import { GET as listThemesRoute } from '@/app/api/v1/themes/route';
import { GET as getThemeRoute } from '@/app/api/v1/themes/[id]/route';
import { UUID_A, jsonRequest, routeContext, sessionFixture } from './helpers';

jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn() }));
jest.mock('@/app/api/(services)/ideas/service', () => ({
  createIdea: jest.fn(), listIdeas: jest.fn(), getIdea: jest.fn(), getIdeaEvidence: jest.fn(),
  getIdeaHistory: jest.fn(), getIdeaScope: jest.fn(), updateIdeaStatus: jest.fn(),
}));
jest.mock('@/app/api/(services)/learning/shared-learning', () => ({
  listVisibleThemes: jest.fn(), getVisibleTheme: jest.fn(),
}));

const validIdea = {
  title: 'Faster onboarding',
  problem_statement: 'Onboarding takes several weeks for new teams',
  offering: 'FAI',
  proposed_outcome: 'Cut onboarding down to a few days',
  priority: 'high',
  audience: 'clients',
  supporting_contribution_ids: [UUID_A],
};

beforeEach(() => {
  jest.mocked(getSession).mockResolvedValue(sessionFixture() as never);
  jest.mocked(authorize).mockResolvedValue({ allowed: true });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/v1/ideas', () => {
  it('returns 401 without a session', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    const response = await listIdeasRoute();
    expect(response.status).toBe(401);
    expect(await response.json()).toEqual({ error: 'Authentication required' });
  });

  it('returns 409 when the caller has not selected a workspace', async () => {
    jest.mocked(getSession).mockResolvedValue(sessionFixture({ activeWorkspace: null }) as never);
    expect((await listIdeasRoute()).status).toBe(409);
    expect(listIdeas).not.toHaveBeenCalled();
  });

  it('returns 403 to a client workspace member who lacks ideas:read', async () => {
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'An active workspace membership is required' });
    const response = await listIdeasRoute();
    expect(response.status).toBe(403);
    expect(await response.json()).toEqual({ error: 'An active workspace membership is required' });
    expect(listIdeas).not.toHaveBeenCalled();
  });

  it('serves client ideas with a private, non-cacheable response', async () => {
    jest.mocked(listIdeas).mockResolvedValue([{ id: UUID_A }] as never);
    const response = await listIdeasRoute();
    expect(authorize).toHaveBeenCalledWith({ action: 'ideas:read' });
    expect(listIdeas).toHaveBeenCalledWith('client', [], 'org-1');
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({ data: [{ id: UUID_A }] });
  });

  it('gives internal readers only the offerings they are currently assigned to', async () => {
    const past = new Date(Date.now() - 60_000).toISOString();
    jest.mocked(getSession).mockResolvedValue(sessionFixture({
      activeWorkspace: { orgId: 'org-1', orgName: 'Azentio', orgType: 'azentio', role: 'employee', isSandbox: false },
      grants: [
        { role: 'product_owner', org_id: 'org-1', offering_id: 'FAI', revoked_at: null, expires_at: null },
        { role: 'product_owner', org_id: null, offering_id: 'Lending', revoked_at: null, expires_at: null },
        { role: 'product_owner', org_id: 'org-1', offering_id: 'Digital', revoked_at: null, expires_at: past },
        { role: 'product_owner', org_id: 'org-1', offering_id: 'AMLOCK', revoked_at: past, expires_at: null },
        { role: 'product_owner', org_id: 'other-org', offering_id: 'Insurance', revoked_at: null, expires_at: null },
        { role: 'learning_moderator', org_id: 'org-1', offering_id: 'Orion', revoked_at: null, expires_at: null },
      ],
    }) as never);
    jest.mocked(listIdeas).mockResolvedValue([]);
    await listIdeasRoute();
    expect(listIdeas).toHaveBeenCalledWith('internal', ['FAI', 'Lending'], 'org-1');
  });
});

describe('POST /api/v1/ideas', () => {
  it('returns 401 without a session', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', validIdea))).status).toBe(401);
  });

  it('returns 409 without a selected workspace', async () => {
    jest.mocked(getSession).mockResolvedValue(sessionFixture({ activeWorkspace: null }) as never);
    expect((await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', validIdea))).status).toBe(409);
  });

  it('returns 400 for a body that is not JSON', async () => {
    const response = await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', '{not json'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it('returns 422 with field details for an invalid idea and never reaches the service', async () => {
    const response = await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', { ...validIdea, title: 'ab' }));
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe('Validation failed');
    expect(createIdea).not.toHaveBeenCalled();
  });

  it('rejects an idea with no evidence references', async () => {
    const response = await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', { ...validIdea, supporting_contribution_ids: [] }));
    expect(response.status).toBe(422);
  });

  it('checks product owner rights for the idea offering before creating it', async () => {
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Product owner assignment is required' });
    const response = await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', validIdea));
    expect(authorize).toHaveBeenCalledWith({ action: 'ideas:create', resource: { type: 'idea', offeringId: 'FAI' } });
    expect(response.status).toBe(403);
    expect(createIdea).not.toHaveBeenCalled();
  });

  it('creates the idea for the caller in the active workspace and returns 201', async () => {
    jest.mocked(createIdea).mockResolvedValue({ id: 'idea-1', status: 'Proposed' } as never);
    const response = await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', validIdea, { 'x-request-id': 'x'.repeat(150) }));
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: 'idea-1', status: 'Proposed' } });
    const [, actor, orgId, requestId] = jest.mocked(createIdea).mock.calls[0];
    expect([actor, orgId]).toEqual(['user-1', 'org-1']);
    expect(requestId).toHaveLength(100);
  });

  it('maps a service evidence error to 422', async () => {
    jest.mocked(createIdea).mockRejectedValue(new Error('Evidence references are not approved'));
    expect((await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', validIdea))).status).toBe(422);
  });

  it('maps a membership or assignment error to 403', async () => {
    jest.mocked(createIdea).mockRejectedValue(new Error('Product owner assignment is no longer active for this offering'));
    expect((await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', validIdea))).status).toBe(403);
  });

  it('hides unexpected failures behind a generic 500', async () => {
    jest.mocked(createIdea).mockRejectedValue(new Error('connection reset by peer'));
    const response = await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', validIdea));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to create idea' });
  });

  it('returns 422 when an evidence reference is not an approved contribution', async () => {
    jest.mocked(createIdea).mockRejectedValue(new Error('Every evidence reference must be an active approved shared contribution'));
    expect((await createIdeaRoute(jsonRequest('http://t/api/v1/ideas', validIdea))).status).toBe(422);
  });
});

describe('GET /api/v1/ideas/[id]', () => {
  const scope = { id: UUID_A, offering: 'FAI', audience: 'clients', title: 'Faster onboarding' };

  it('returns 401 without a session', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await getIdeaRoute(new Request('http://t'), routeContext({ id: UUID_A }))).status).toBe(401);
  });

  it('returns 404 for a malformed id without touching the database', async () => {
    const response = await getIdeaRoute(new Request('http://t'), routeContext({ id: 'not-a-uuid' }));
    expect(response.status).toBe(404);
    expect(getIdeaScope).not.toHaveBeenCalled();
  });

  it('returns 404 for an idea outside the workspace', async () => {
    jest.mocked(getIdeaScope).mockResolvedValue(null as never);
    expect((await getIdeaRoute(new Request('http://t'), routeContext({ id: UUID_A }))).status).toBe(404);
  });

  it('uses the client read rule for client workspaces and reports a denial as 403', async () => {
    jest.mocked(getIdeaScope).mockResolvedValue(scope as never);
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Not entitled' });
    const response = await getIdeaRoute(new Request('http://t'), routeContext({ id: UUID_A }));
    expect(authorize).toHaveBeenCalledWith({ action: 'ideas:read' });
    expect(response.status).toBe(403);
  });

  it('hides an internal idea from a denied owner read behind a 404', async () => {
    jest.mocked(getSession).mockResolvedValue(sessionFixture({
      activeWorkspace: { orgId: 'org-1', orgName: 'Azentio', orgType: 'azentio', role: 'employee', isSandbox: false },
    }) as never);
    jest.mocked(getIdeaScope).mockResolvedValue({ ...scope, audience: 'internal' } as never);
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Product owner assignment is required' });
    const response = await getIdeaRoute(new Request('http://t'), routeContext({ id: UUID_A }));
    expect(authorize).toHaveBeenCalledWith({ action: 'ideas:owner-read', resource: { type: 'idea', id: UUID_A, offeringId: 'FAI' } });
    expect(response.status).toBe(404);
  });

  it('returns the idea with its evidence and status history', async () => {
    jest.mocked(getIdeaScope).mockResolvedValue(scope as never);
    jest.mocked(getIdea).mockResolvedValue({ id: UUID_A, title: 'Faster onboarding' } as never);
    jest.mocked(getIdeaEvidence).mockResolvedValue([{ id: 'copy-1' }] as never);
    jest.mocked(getIdeaHistory).mockResolvedValue([{ action: 'Proposed' }] as never);
    const response = await getIdeaRoute(new Request('http://t'), routeContext({ id: UUID_A }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(await response.json()).toEqual({
      data: { id: UUID_A, title: 'Faster onboarding', evidence: [{ id: 'copy-1' }], history: [{ action: 'Proposed' }] },
    });
  });

  it('returns 404 when the idea is not visible to the audience after all', async () => {
    jest.mocked(getIdeaScope).mockResolvedValue(scope as never);
    jest.mocked(getIdea).mockResolvedValue(null as never);
    expect((await getIdeaRoute(new Request('http://t'), routeContext({ id: UUID_A }))).status).toBe(404);
  });
});

describe('PATCH /api/v1/ideas/[id]', () => {
  const scope = { id: UUID_A, offering: 'FAI', audience: 'internal', title: 'Faster onboarding' };
  const patch = (body: unknown) => patchIdeaRoute(jsonRequest(`http://t/api/v1/ideas/${UUID_A}`, body), routeContext({ id: UUID_A }));

  it('returns 401 without a session', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await patch({ status: 'Under review' })).status).toBe(401);
  });

  it('returns 404 when the idea has no offering scope', async () => {
    jest.mocked(getIdeaScope).mockResolvedValue({ ...scope, offering: null } as never);
    expect((await patch({ status: 'Under review' })).status).toBe(404);
  });

  it('returns 404 rather than 403 when the caller may not update the idea', async () => {
    jest.mocked(getIdeaScope).mockResolvedValue(scope as never);
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Product owner assignment is required' });
    const response = await patch({ status: 'Under review' });
    expect(authorize).toHaveBeenCalledWith({ action: 'ideas:update', resource: { type: 'idea', id: UUID_A, offeringId: 'FAI' } });
    expect(response.status).toBe(404);
    expect(updateIdeaStatus).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    jest.mocked(getIdeaScope).mockResolvedValue(scope as never);
    const response = await patchIdeaRoute(
      jsonRequest(`http://t/api/v1/ideas/${UUID_A}`, '{bad'), routeContext({ id: UUID_A }),
    );
    expect(response.status).toBe(400);
  });

  it.each([
    ['an unknown status', { status: 'Done' }],
    ['a note over 1000 characters', { status: 'Planned', status_note: 'x'.repeat(1001) }],
  ])('returns 422 for %s', async (_label, body) => {
    jest.mocked(getIdeaScope).mockResolvedValue(scope as never);
    expect((await patch(body)).status).toBe(422);
    expect(updateIdeaStatus).not.toHaveBeenCalled();
  });

  it('maps a product owner assignment failure to 403', async () => {
    jest.mocked(getIdeaScope).mockResolvedValue(scope as never);
    jest.mocked(updateIdeaStatus).mockRejectedValue(new Error('Product owner assignment is no longer active for this offering'));
    expect((await patch({ status: 'Under review' })).status).toBe(403);
  });

  it('maps an invalid transition to 409 with a generic message', async () => {
    jest.mocked(getIdeaScope).mockResolvedValue(scope as never);
    jest.mocked(updateIdeaStatus).mockRejectedValue(new Error('This idea status transition is not allowed'));
    const response = await patch({ status: 'Released' });
    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({ error: 'Idea status could not be updated' });
  });

  it('applies the status change for the caller and returns the updated record', async () => {
    jest.mocked(getIdeaScope).mockResolvedValue(scope as never);
    jest.mocked(updateIdeaStatus).mockResolvedValue({ status: 'Under review' } as never);
    const response = await patch({ status: 'Under review', status_note: 'Triaged' });
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { status: 'Under review' } });
    expect(updateIdeaStatus).toHaveBeenCalledWith(UUID_A, 'user-1', 'org-1', 'FAI', { status: 'Under review', status_note: 'Triaged' }, expect.any(String));
  });
});

describe('themes routes', () => {
  it('GET /api/v1/themes returns 401 without a session', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await listThemesRoute()).status).toBe(401);
  });

  it('GET /api/v1/themes returns 403 with the authorization reason when themes:read is denied', async () => {
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'An active workspace membership is required' });
    const response = await listThemesRoute();
    expect(authorize).toHaveBeenCalledWith({ action: 'themes:read' });
    expect(response.status).toBe(403);
    expect(listVisibleThemes).not.toHaveBeenCalled();
  });

  it('GET /api/v1/themes shows production themes to production workspaces', async () => {
    jest.mocked(listVisibleThemes).mockResolvedValue([{ id: UUID_A }] as never);
    const response = await listThemesRoute();
    expect(listVisibleThemes).toHaveBeenCalledWith(undefined);
    expect(await response.json()).toEqual({ data: [{ id: UUID_A }] });
  });

  it('GET /api/v1/themes scopes sandbox workspaces to their own sandbox organisation', async () => {
    jest.mocked(getSession).mockResolvedValue(sessionFixture({
      activeWorkspace: { orgId: 'org-sbx', orgName: 'Sandbox', orgType: 'client', role: 'client_member', isSandbox: true },
    }) as never);
    await listThemesRoute();
    expect(listVisibleThemes).toHaveBeenCalledWith('org-sbx');
  });

  it('GET /api/v1/themes/[id] returns 401, 403 and 404 for malformed or hidden themes', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await getThemeRoute(new Request('http://t'), routeContext({ id: UUID_A }))).status).toBe(401);

    jest.mocked(getSession).mockResolvedValue(sessionFixture() as never);
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Not permitted' });
    expect((await getThemeRoute(new Request('http://t'), routeContext({ id: UUID_A }))).status).toBe(403);

    jest.mocked(authorize).mockResolvedValue({ allowed: true });
    expect((await getThemeRoute(new Request('http://t'), routeContext({ id: 'nope' }))).status).toBe(404);

    jest.mocked(getVisibleTheme).mockResolvedValue(null as never);
    expect((await getThemeRoute(new Request('http://t'), routeContext({ id: UUID_A }))).status).toBe(404);
  });

  it('GET /api/v1/themes/[id] returns the visible theme with its evidence', async () => {
    jest.mocked(getVisibleTheme).mockResolvedValue({ id: UUID_A, evidence: [] } as never);
    const response = await getThemeRoute(new Request('http://t'), routeContext({ id: UUID_A }));
    expect(getVisibleTheme).toHaveBeenCalledWith(UUID_A, undefined);
    expect(await response.json()).toEqual({ data: { id: UUID_A, evidence: [] } });
  });
});
