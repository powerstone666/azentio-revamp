/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn(), default: jest.fn() }));
jest.mock('@/app/api/(services)/employee/service', () => ({
  createEmployeeExperiment: jest.fn(),
  listEmployeeExperiments: jest.fn(),
  listEmployeeKnowledge: jest.fn(),
  saveEmployeeKnowledgeFeedback: jest.fn(),
  runEmployeePlayground: jest.fn(),
  saveEmployeePlaygroundFeedback: jest.fn(),
}));
jest.mock('@/app/api/(services)/employee/teams', () => ({
  createHackathonTeam: jest.fn(),
  listHackathonTeams: jest.fn(),
  joinHackathonTeam: jest.fn(),
  leaveHackathonTeam: jest.fn(),
  createHackathonTeamPost: jest.fn(),
  listHackathonTeamPosts: jest.fn(),
}));

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import {
  createEmployeeExperiment, listEmployeeExperiments, listEmployeeKnowledge, saveEmployeeKnowledgeFeedback,
  runEmployeePlayground, saveEmployeePlaygroundFeedback,
} from '@/app/api/(services)/employee/service';
import {
  createHackathonTeam, createHackathonTeamPost, joinHackathonTeam, leaveHackathonTeam,
  listHackathonTeamPosts, listHackathonTeams,
} from '@/app/api/(services)/employee/teams';
import { GET as experimentsGet, POST as experimentsPost } from '@/app/api/v1/employee/experiments/route';
import { GET as teamsGet, POST as teamsPost } from '@/app/api/v1/employee/hackathon-teams/route';
import { POST as memberJoin, DELETE as memberLeave } from '@/app/api/v1/employee/hackathon-teams/[id]/members/route';
import { GET as postsGet, POST as postsPost } from '@/app/api/v1/employee/hackathon-teams/[id]/posts/route';
import { GET as knowledgeGet } from '@/app/api/v1/employee/knowledge/route';
import { PUT as knowledgeFeedbackPut } from '@/app/api/v1/employee/knowledge/[id]/feedback/route';
import { POST as playgroundPost } from '@/app/api/v1/employee/playground/runs/route';
import { PUT as playgroundFeedbackPut } from '@/app/api/v1/employee/playground/runs/[runId]/feedback/route';
import { IDS, makeRequest, makeSession, readJson, routeParams, expectNoInternals } from './fixtures';

const getSessionMock = jest.mocked(getSession);
const authorizeMock = jest.mocked(authorize);
const experimentsListMock = jest.mocked(listEmployeeExperiments);
const experimentCreateMock = jest.mocked(createEmployeeExperiment);
const knowledgeListMock = jest.mocked(listEmployeeKnowledge);
const knowledgeFeedbackMock = jest.mocked(saveEmployeeKnowledgeFeedback);
const playgroundRunMock = jest.mocked(runEmployeePlayground);
const playgroundFeedbackMock = jest.mocked(saveEmployeePlaygroundFeedback);
const teamCreateMock = jest.mocked(createHackathonTeam);
const teamsListMock = jest.mocked(listHackathonTeams);
const joinMock = jest.mocked(joinHackathonTeam);
const leaveMock = jest.mocked(leaveHackathonTeam);
const postCreateMock = jest.mocked(createHackathonTeamPost);
const postListMock = jest.mocked(listHackathonTeamPosts);

const withId = (id: string) => routeParams({ id });

beforeEach(() => {
  getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio' }));
  authorizeMock.mockResolvedValue({ allowed: true });
});

describe('employee experiments /api/v1/employee/experiments', () => {
  const body = { title: 'Loan triage pilot', problem_statement: 'Analysts re-key application data by hand.', offering: 'Lending' };

  it.each([
    ['GET', () => experimentsGet()],
    ['POST', () => experimentsPost(makeRequest('/api/v1/employee/experiments', { body }))],
  ])('rejects an unauthenticated %s with 401', async (_method, call) => {
    getSessionMock.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
  });

  it.each([
    ['a client workspace', () => makeSession({ orgType: 'client' })],
    ['no workspace', () => makeSession({ noWorkspace: true })],
  ])('returns 403 for %s on GET', async (_label, build) => {
    getSessionMock.mockResolvedValue(build());
    const response = await experimentsGet();
    expect(response.status).toBe(403);
    expect(experimentsListMock).not.toHaveBeenCalled();
  });

  it('returns 403 when portal:employee:read is denied', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'x' });
    expect((await experimentsGet()).status).toBe(403);
    expect(authorizeMock).toHaveBeenCalledWith({ action: 'portal:employee:read' });
  });

  it('lists experiments for the active employee org with a no-store header', async () => {
    experimentsListMock.mockResolvedValue([{ id: IDS.record }] as never);
    const response = await experimentsGet();
    expect(await readJson(response)).toEqual({ data: [{ id: IDS.record }] });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(experimentsListMock).toHaveBeenCalledWith(IDS.orgA);
  });

  it.each([
    ['malformed JSON', { rawBody: '{' }, 400],
    ['a title shorter than 3 characters', { body: { ...body, title: 'ab' } }, 422],
    ['a problem statement shorter than 10 characters', { body: { ...body, problem_statement: 'short' } }, 422],
    ['a missing offering', { body: { title: body.title, problem_statement: body.problem_statement } }, 422],
  ])('rejects %s with %i and creates nothing', async (_label, init, status) => {
    const response = await experimentsPost(makeRequest('/api/v1/employee/experiments', init));
    expect(response.status).toBe(status);
    expect(experimentCreateMock).not.toHaveBeenCalled();
  });

  it('creates the experiment for the session user and active org with an empty default approach', async () => {
    experimentCreateMock.mockResolvedValue({ id: IDS.record } as never);
    const response = await experimentsPost(makeRequest('/api/v1/employee/experiments', { body: { ...body, org_id: IDS.orgC } }));
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record } });
    expect(experimentCreateMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: IDS.user,
      orgId: IDS.orgA,
      title: body.title,
      problemStatement: body.problem_statement,
      offering: 'Lending',
      proposedApproach: '',
    }));
  });

  it('returns 403 when the membership is no longer active', async () => {
    experimentCreateMock.mockRejectedValue(new Error('No active membership for this user'));
    const response = await experimentsPost(makeRequest('/api/v1/employee/experiments', { body }));
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Employee access is no longer active' });
  });

  it('returns a generic 500 without internals for other failures', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    experimentCreateMock.mockRejectedValue(new Error('relation "employee_experiments" does not exist'));
    const response = await experimentsPost(makeRequest('/api/v1/employee/experiments', { body }));
    expect(response.status).toBe(500);
    const serialized = JSON.stringify(await readJson(response));
    expect(serialized).toBe(JSON.stringify({ error: 'Unable to save the experiment' }));
    expectNoInternals(serialized);
    consoleSpy.mockRestore();
  });
});

describe('hackathon teams /api/v1/employee/hackathon-teams', () => {
  const teamBody = { name: 'Credit Copilot', description: 'Helping analysts review credit memos faster.' };

  it('rejects an unauthenticated GET with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await teamsGet()).status).toBe(401);
    expect(teamsListMock).not.toHaveBeenCalled();
  });

  it('returns 403 when employee access is denied or there is no workspace', async () => {
    authorizeMock.mockResolvedValueOnce({ allowed: false, reason: 'x' });
    expect((await teamsGet()).status).toBe(403);
    getSessionMock.mockResolvedValueOnce(makeSession({ noWorkspace: true }));
    expect((await teamsGet()).status).toBe(403);
  });

  it('lists teams for the session user and active org under data', async () => {
    teamsListMock.mockResolvedValue([{ id: IDS.record }] as never);
    const response = await teamsGet();
    expect(await readJson(response)).toEqual({ data: [{ id: IDS.record }] });
    expect(teamsListMock).toHaveBeenCalledWith(IDS.user, IDS.orgA);
  });

  it('returns a fixed 403 when listing fails', async () => {
    teamsListMock.mockRejectedValue(new Error('timeout'));
    const response = await teamsGet();
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Unable to load employee hackathon teams' });
  });

  it.each([
    ['malformed JSON', { rawBody: 'x' }, 400],
    ['a name shorter than 3 characters', { body: { ...teamBody, name: 'ab' } }, 422],
    ['a description shorter than 10 characters', { body: { ...teamBody, description: 'tiny' } }, 422],
    ['a smuggled org id (strict schema)', { body: { ...teamBody, org_id: IDS.orgC } }, 422],
  ])('rejects %s with %i and creates nothing', async (_label, init, status) => {
    const response = await teamsPost(makeRequest('/api/v1/employee/hackathon-teams', init));
    expect(response.status).toBe(status);
    expect(teamCreateMock).not.toHaveBeenCalled();
  });

  it('creates the team for the session user and active org and returns 201', async () => {
    teamCreateMock.mockResolvedValue({ id: IDS.record } as never);
    const response = await teamsPost(makeRequest('/api/v1/employee/hackathon-teams', { body: teamBody }));
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record } });
    expect(teamCreateMock).toHaveBeenCalledWith(IDS.user, IDS.orgA, teamBody, expect.any(String));
  });

  it('returns a fixed 403 when the create fails', async () => {
    teamCreateMock.mockRejectedValue(new Error('duplicate team name'));
    const response = await teamsPost(makeRequest('/api/v1/employee/hackathon-teams', { body: teamBody }));
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Unable to create team; verify active employee access' });
  });
});

describe('team membership /api/v1/employee/hackathon-teams/[id]/members', () => {
  it('rejects an unauthenticated join with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await memberJoin(makeRequest(`/api/v1/employee/hackathon-teams/${IDS.record}/members`, { method: 'POST' }), withId(IDS.record));
    expect(response.status).toBe(401);
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed team id on join', async () => {
    const response = await memberJoin(makeRequest('/api/v1/employee/hackathon-teams/x/members', { method: 'POST' }), withId('x'));
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Open team not found' });
    expect(joinMock).not.toHaveBeenCalled();
  });

  it('joins the team as the session user in the active org', async () => {
    joinMock.mockResolvedValue({ team_id: IDS.record } as never);
    const response = await memberJoin(makeRequest(`/api/v1/employee/hackathon-teams/${IDS.record}/members`, { method: 'POST' }), withId(IDS.record));
    expect(await readJson(response)).toEqual({ data: { team_id: IDS.record } });
    expect(joinMock).toHaveBeenCalledWith(IDS.record, IDS.user, IDS.orgA, expect.any(String));
  });

  it('returns 404 when the team is not open or access has lapsed', async () => {
    joinMock.mockRejectedValue(new Error('Team is full'));
    const response = await memberJoin(makeRequest(`/api/v1/employee/hackathon-teams/${IDS.record}/members`, { method: 'POST' }), withId(IDS.record));
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Open team not found or employee access is no longer active' });
  });

  it('returns 404 for a malformed id on leave', async () => {
    const response = await memberLeave(makeRequest('/api/v1/employee/hackathon-teams/x/members', { method: 'DELETE' }), withId('x'));
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Team membership not found' });
    expect(leaveMock).not.toHaveBeenCalled();
  });

  it('removes the caller from the team in the active org', async () => {
    leaveMock.mockResolvedValue({ left: true } as never);
    const response = await memberLeave(makeRequest(`/api/v1/employee/hackathon-teams/${IDS.record}/members`, { method: 'DELETE' }), withId(IDS.record));
    expect(await readJson(response)).toEqual({ data: { left: true } });
    expect(leaveMock).toHaveBeenCalledWith(IDS.record, IDS.user, IDS.orgA, expect.any(String));
  });

  it('maps the last-owner rule to 409 with its message', async () => {
    leaveMock.mockRejectedValue(new Error('Promote another member before leaving'));
    const response = await memberLeave(makeRequest(`/api/v1/employee/hackathon-teams/${IDS.record}/members`, { method: 'DELETE' }), withId(IDS.record));
    expect(response.status).toBe(409);
    expect(await readJson(response)).toEqual({ error: 'Promote another member before leaving' });
  });

  // Known defect: any leave error text is echoed to the client, so raw database messages can leak.
  it('does not echo raw database error text when leaving fails', async () => {
    leaveMock.mockRejectedValue(new Error('could not serialize access due to concurrent update'));
    const response = await memberLeave(makeRequest(`/api/v1/employee/hackathon-teams/${IDS.record}/members`, { method: 'DELETE' }), withId(IDS.record));
    expectNoInternals(JSON.stringify(await readJson(response)));
    expect(response.status).toBe(500);
  });
});

describe('team space /api/v1/employee/hackathon-teams/[id]/posts', () => {
  it('rejects an unauthenticated GET with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await postsGet(makeRequest('/x'), withId(IDS.record))).status).toBe(401);
  });

  it('returns 404 for a malformed team id', async () => {
    const response = await postsGet(makeRequest('/x'), withId('bad'));
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Team space not found' });
    expect(postListMock).not.toHaveBeenCalled();
  });

  it('lists posts for a team the caller can see', async () => {
    postListMock.mockResolvedValue([{ id: 'p1' }] as never);
    const response = await postsGet(makeRequest('/x'), withId(IDS.record));
    expect(await readJson(response)).toEqual({ data: [{ id: 'p1' }] });
    expect(postListMock).toHaveBeenCalledWith(IDS.record, IDS.user, IDS.orgA);
  });

  it('returns 404 when the caller is not a team member', async () => {
    postListMock.mockRejectedValue(new Error('not a member'));
    const response = await postsGet(makeRequest('/x'), withId(IDS.record));
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Team space not found' });
  });

  it.each([
    ['an empty body', { body: { body: '' } }, 422],
    ['an extra field (strict schema)', { body: { body: 'Hello team', author_id: IDS.otherUser } }, 422],
    ['malformed JSON', { rawBody: '{' }, 400],
  ])('rejects %s with %i and posts nothing', async (_label, init, status) => {
    const response = await postsPost(makeRequest('/x', { method: 'POST', ...init }), withId(IDS.record));
    expect(response.status).toBe(status);
    expect(postCreateMock).not.toHaveBeenCalled();
  });

  it('creates a post as the session user and returns 201', async () => {
    postCreateMock.mockResolvedValue({ id: 'p2' } as never);
    const response = await postsPost(makeRequest('/x', { method: 'POST', body: { body: 'Kickoff at 10' } }), withId(IDS.record));
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({ data: { id: 'p2' } });
    expect(postCreateMock).toHaveBeenCalledWith(IDS.record, IDS.user, IDS.orgA, { body: 'Kickoff at 10' }, expect.any(String));
  });

  it('returns 404 when the caller is not a member of the team', async () => {
    postCreateMock.mockRejectedValue(new Error('not a member'));
    const response = await postsPost(makeRequest('/x', { method: 'POST', body: { body: 'Hi' } }), withId(IDS.record));
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Team membership required' });
  });
});

describe('employee knowledge /api/v1/employee/knowledge', () => {
  it('rejects an unauthenticated GET with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await knowledgeGet()).status).toBe(401);
  });

  it('returns 403 for a client workspace without consulting authorize', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
    expect((await knowledgeGet()).status).toBe(403);
    expect(authorizeMock).not.toHaveBeenCalled();
  });

  it('returns 403 with the authorize reason when employee read is denied', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'Insufficient permission for this action' });
    const response = await knowledgeGet();
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'Insufficient permission for this action' });
  });

  it('lists knowledge for the session user in the active org with a no-store header', async () => {
    knowledgeListMock.mockResolvedValue([{ id: IDS.record }] as never);
    const response = await knowledgeGet();
    expect(await readJson(response)).toEqual({ data: [{ id: IDS.record }] });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(knowledgeListMock).toHaveBeenCalledWith(IDS.user, IDS.orgA);
  });
});

describe('knowledge feedback /api/v1/employee/knowledge/[id]/feedback', () => {
  const put = (id: string, body: unknown) =>
    knowledgeFeedbackPut(makeRequest(`/api/v1/employee/knowledge/${id}/feedback`, { method: 'PUT', body }), withId(id));

  it('returns 403 for a client workspace', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
    expect((await put(IDS.record, { helpful: true })).status).toBe(403);
    expect(knowledgeFeedbackMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed knowledge id', async () => {
    const response = await put('nope', { helpful: true });
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Knowledge item not found' });
  });

  it.each([
    ['malformed JSON', 'raw', 400],
    ['a non-boolean helpful flag', { helpful: 'yes' }, 422],
    ['a missing helpful flag', { note: 'Useful' }, 422],
    ['a note longer than 1000 characters', { helpful: true, note: 'n'.repeat(1001) }, 422],
  ])('rejects %s with %i and saves nothing', async (_label, body, status) => {
    const response = body === 'raw'
      ? await knowledgeFeedbackPut(makeRequest(`/api/v1/employee/knowledge/${IDS.record}/feedback`, { method: 'PUT', rawBody: '{' }), withId(IDS.record))
      : await put(IDS.record, body);
    expect(response.status).toBe(status);
    expect(knowledgeFeedbackMock).not.toHaveBeenCalled();
  });

  it('saves feedback with an empty default note for the session user and active org', async () => {
    knowledgeFeedbackMock.mockResolvedValue({ id: 'f1' } as never);
    const response = await put(IDS.record, { helpful: false });
    expect(await readJson(response)).toEqual({ data: { id: 'f1' } });
    expect(knowledgeFeedbackMock).toHaveBeenCalledWith({
      userId: IDS.user, orgId: IDS.orgA, itemId: IDS.record, helpful: false, note: '',
    });
  });

  it('maps a missing item or membership to 404', async () => {
    knowledgeFeedbackMock.mockRejectedValue(new Error('Knowledge item not found'));
    expect((await put(IDS.record, { helpful: true })).status).toBe(404);
  });

  it('returns a generic 500 without internals for other failures', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    knowledgeFeedbackMock.mockRejectedValue(new Error('deadlock detected'));
    const response = await put(IDS.record, { helpful: true });
    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({ error: 'Unable to save feedback' });
    consoleSpy.mockRestore();
  });
});

describe('playground runs /api/v1/employee/playground/runs', () => {
  it('rejects an unauthenticated run with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await playgroundPost(makeRequest('/api/v1/employee/playground/runs', { body: { offering_id: 'fai' } }));
    expect(response.status).toBe(401);
    expect(playgroundRunMock).not.toHaveBeenCalled();
  });

  it('rejects a client workspace with 403 and runs nothing', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'client' }));
    expect((await playgroundPost(makeRequest('/api/v1/employee/playground/runs', { body: { offering_id: 'fai' } }))).status).toBe(403);
    expect(playgroundRunMock).not.toHaveBeenCalled();
  });

  it.each([
    ['malformed JSON', { rawBody: '{' }, 400],
    ['an offering outside the scenario list', { body: { offering_id: 'insurance' } }, 422],
    ['a missing offering', { body: {} }, 422],
  ])('rejects %s with %i and runs nothing', async (_label, init, status) => {
    const response = await playgroundPost(makeRequest('/api/v1/employee/playground/runs', init));
    expect(response.status).toBe(status);
    expect(playgroundRunMock).not.toHaveBeenCalled();
  });

  it('runs the scenario for the session user and active org and returns 201 with no-store', async () => {
    playgroundRunMock.mockResolvedValue({ id: IDS.record } as never);
    const response = await playgroundPost(makeRequest('/api/v1/employee/playground/runs', { body: { offering_id: 'amlock' } }));
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record } });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(playgroundRunMock).toHaveBeenCalledWith(expect.objectContaining({
      userId: IDS.user, orgId: IDS.orgA, offeringId: 'amlock',
    }));
  });

  it('maps a lapsed membership to 403', async () => {
    playgroundRunMock.mockRejectedValue(new Error('membership inactive'));
    expect((await playgroundPost(makeRequest('/api/v1/employee/playground/runs', { body: { offering_id: 'fai' } }))).status).toBe(403);
  });

  it('returns a generic 500 without internals for other failures', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    playgroundRunMock.mockRejectedValue(new Error('insert violates not-null constraint'));
    const response = await playgroundPost(makeRequest('/api/v1/employee/playground/runs', { body: { offering_id: 'fai' } }));
    expect(response.status).toBe(500);
    expect(await readJson(response)).toEqual({ error: 'Playground run could not be saved' });
    consoleSpy.mockRestore();
  });
});

describe('playground feedback /api/v1/employee/playground/runs/[runId]/feedback', () => {
  const put = (runId: string, body: unknown) =>
    playgroundFeedbackPut(makeRequest(`/api/v1/employee/playground/runs/${runId}/feedback`, { method: 'PUT', body }), routeParams({ runId }));

  it('returns 404 for a malformed run id', async () => {
    const response = await put('nope', { rating: 'Useful' });
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Playground run not found' });
    expect(playgroundFeedbackMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an unknown rating', { rating: 'Great' }, 422],
    ['a comment longer than 2000 characters', { rating: 'Useful', comment: 'c'.repeat(2001) }, 422],
  ])('rejects %s with %i and saves nothing', async (_label, body, status) => {
    expect((await put(IDS.record, body)).status).toBe(status);
    expect(playgroundFeedbackMock).not.toHaveBeenCalled();
  });

  it('saves the rating with a default empty comment for the session user and active org', async () => {
    playgroundFeedbackMock.mockResolvedValue({ id: 'pf1' } as never);
    const response = await put(IDS.record, { rating: 'Needs more evidence' });
    expect(await readJson(response)).toEqual({ data: { id: 'pf1' } });
    expect(playgroundFeedbackMock).toHaveBeenCalledWith({
      userId: IDS.user, orgId: IDS.orgA, runId: IDS.record, rating: 'Needs more evidence', comment: '',
    });
  });

  it('maps a missing run to 404 and a lapsed membership to 403', async () => {
    playgroundFeedbackMock.mockRejectedValueOnce(new Error('Playground run not found'));
    expect((await put(IDS.record, { rating: 'Useful' })).status).toBe(404);
    playgroundFeedbackMock.mockRejectedValueOnce(new Error('membership inactive'));
    expect((await put(IDS.record, { rating: 'Useful' })).status).toBe(403);
  });
});
