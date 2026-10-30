/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn(), default: jest.fn() }));
jest.mock('@/app/api/(services)/employee/service', () => ({
  createEmployeeKnowledge: jest.fn(),
  updateEmployeeKnowledge: jest.fn(),
  listEmployeeKnowledge: jest.fn(),
  saveEmployeeKnowledgeFeedback: jest.fn(),
  saveEmployeeExperimentFeedback: jest.fn(),
  createEmployeeExperiment: jest.fn(),
  listEmployeeExperiments: jest.fn(),
}));

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import {
  createEmployeeExperiment, createEmployeeKnowledge, saveEmployeeExperimentFeedback, updateEmployeeKnowledge,
} from '@/app/api/(services)/employee/service';
import { POST as knowledgePost } from '@/app/api/v1/employee/knowledge/route';
import { PATCH as knowledgePatch } from '@/app/api/v1/employee/knowledge/[id]/route';
import { PUT as experimentFeedbackPut } from '@/app/api/v1/employee/experiments/[id]/feedback/route';
import { POST as experimentsPost } from '@/app/api/v1/employee/experiments/route';
import { validReviewDate } from '@/app/(common-lib)/review-date';
import { IDS, makeRequest, makeSession, readJson, routeParams } from './fixtures';

const createKnowledge = jest.mocked(createEmployeeKnowledge);
const updateKnowledge = jest.mocked(updateEmployeeKnowledge);
const experimentFeedback = jest.mocked(saveEmployeeExperimentFeedback);
const createExperiment = jest.mocked(createEmployeeExperiment);

const FUTURE = new Date(Date.now() + 60 * 86_400_000).toISOString().slice(0, 10);
const withId = (id: string) => routeParams({ id });
const guide = { title: 'Triage guide', body: 'How we triage alerts each morning.', review_at: FUTURE, status: 'draft' };

beforeEach(() => {
  jest.clearAllMocks();
  jest.mocked(getSession).mockResolvedValue(makeSession({ orgType: 'azentio' }));
  jest.mocked(authorize).mockResolvedValue({ allowed: true });
});

describe('validReviewDate', () => {
  const day = (offset: number) => new Date(Date.now() + offset * 86_400_000).toISOString().slice(0, 10);
  it.each([
    ['today', day(0), true],
    ['a future date', day(90), true],
    ['yesterday', day(-1), false],
    ['more than two years out', day(800), false],
    ['not a date', 'tomorrow', false],
    ['an impossible calendar date', '2027-02-30', false],
    ['the wrong shape', '15/01/2027', false],
  ])('%s', (_label, value, expected) => {
    expect(validReviewDate(value)).toBe(expected);
  });
});

describe('POST /api/v1/employee/knowledge', () => {
  const post = (body: unknown) => knowledgePost(makeRequest('/api/v1/employee/knowledge', { body }));

  it('rejects anonymous callers with 401 and non-employee workspaces with 403', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await post(guide)).status).toBe(401);
    jest.mocked(getSession).mockResolvedValue(makeSession({ orgType: 'client' }));
    expect((await post(guide)).status).toBe(403);
    expect(createKnowledge).not.toHaveBeenCalled();
  });

  it('is denied when portal:employee:read is denied', async () => {
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Insufficient permission for this action' });
    expect((await post(guide)).status).toBe(403);
    expect(createKnowledge).not.toHaveBeenCalled();
  });

  it.each([
    ['a short title', { ...guide, title: 'ab' }],
    ['a short body', { ...guide, body: 'short' }],
    ['a past review date', { ...guide, review_at: '2020-01-01' }],
    ['a missing review date', { title: guide.title, body: guide.body }],
    ['an unknown status', { ...guide, status: 'archived' }],
  ])('returns 422 for %s', async (_label, body) => {
    expect((await post(body)).status).toBe(422);
    expect(createKnowledge).not.toHaveBeenCalled();
  });

  it('creates the guide for the caller and workspace and returns 201', async () => {
    createKnowledge.mockResolvedValue({ id: IDS.record } as never);
    const response = await post(guide);
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record } });
    expect(createKnowledge).toHaveBeenCalledWith(expect.objectContaining({
      userId: IDS.user, orgId: IDS.orgA, title: 'Triage guide', reviewAt: FUTURE, status: 'draft',
    }));
  });

  it('hides unexpected failures behind a generic 500', async () => {
    createKnowledge.mockRejectedValue(new Error('duplicate key value violates unique constraint'));
    const response = await post(guide);
    expect(response.status).toBe(500);
    expect(JSON.stringify(await readJson(response))).not.toContain('duplicate key');
  });
});

describe('PATCH /api/v1/employee/knowledge/[id]', () => {
  const patch = (id: string, body: unknown) => knowledgePatch(makeRequest(`/api/v1/employee/knowledge/${id}`, { method: 'PATCH', body }), withId(id));

  it('returns 404 for a malformed id and 422 for an empty or invalid change', async () => {
    expect((await patch('bad', { status: 'published' })).status).toBe(404);
    expect((await patch(IDS.record, {})).status).toBe(422);
    expect((await patch(IDS.record, { status: 'deleted' })).status).toBe(422);
    expect(updateKnowledge).not.toHaveBeenCalled();
  });

  it('passes only the supplied fields to the owner-scoped service', async () => {
    updateKnowledge.mockResolvedValue({ id: IDS.record } as never);
    const response = await patch(IDS.record, { review_at: FUTURE });
    expect(response.status).toBe(200);
    expect(updateKnowledge).toHaveBeenCalledWith(expect.objectContaining({
      userId: IDS.user, orgId: IDS.orgA, itemId: IDS.record, reviewAt: FUTURE, status: undefined, title: undefined,
    }));
  });

  it('answers 404 when the guide is not the caller’s', async () => {
    updateKnowledge.mockRejectedValue(new Error('Knowledge item not found'));
    expect((await patch(IDS.record, { status: 'archived' })).status).toBe(404);
  });
});

describe('PUT /api/v1/employee/experiments/[id]/feedback', () => {
  const put = (id: string, body: unknown) => experimentFeedbackPut(makeRequest(`/api/v1/employee/experiments/${id}/feedback`, { method: 'PUT', body }), withId(id));

  it('requires an employee session', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await put(IDS.record, { helpful: true })).status).toBe(401);
    jest.mocked(getSession).mockResolvedValue(makeSession({ orgType: 'client' }));
    expect((await put(IDS.record, { helpful: true })).status).toBe(403);
    expect(experimentFeedback).not.toHaveBeenCalled();
  });

  it('validates the id and body', async () => {
    expect((await put('bad', { helpful: true })).status).toBe(404);
    expect((await put(IDS.record, { helpful: 'yes' })).status).toBe(422);
    expect((await put(IDS.record, { helpful: true, note: 'x'.repeat(1001) })).status).toBe(422);
  });

  it('saves feedback for the caller and maps a missing experiment to 404', async () => {
    experimentFeedback.mockResolvedValue({ id: 'f1' } as never);
    expect((await put(IDS.record, { helpful: false, note: 'Needs a clearer scope' })).status).toBe(200);
    expect(experimentFeedback).toHaveBeenCalledWith({ userId: IDS.user, orgId: IDS.orgA, experimentId: IDS.record, helpful: false, note: 'Needs a clearer scope' });
    experimentFeedback.mockRejectedValue(new Error('Experiment not found'));
    expect((await put(IDS.record, { helpful: true })).status).toBe(404);
  });
});

describe('POST /api/v1/employee/experiments review date', () => {
  const body = { title: 'Loan triage pilot', problem_statement: 'Analysts re-key application data by hand.', offering: 'Lending' };

  it('accepts an optional future review date and rejects a past one', async () => {
    createExperiment.mockResolvedValue({ id: IDS.record } as never);
    expect((await experimentsPost(makeRequest('/api/v1/employee/experiments', { body: { ...body, review_at: FUTURE } }))).status).toBe(201);
    expect(createExperiment).toHaveBeenCalledWith(expect.objectContaining({ reviewAt: FUTURE }));
    createExperiment.mockClear();
    expect((await experimentsPost(makeRequest('/api/v1/employee/experiments', { body: { ...body, review_at: '2020-01-01' } }))).status).toBe(422);
    expect(createExperiment).not.toHaveBeenCalled();
  });
});
