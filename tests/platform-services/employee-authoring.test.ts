jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import {
  createEmployeeExperiment, createEmployeeKnowledge, listEmployeeExperiments, listEmployeeKnowledge,
  saveEmployeeExperimentFeedback, updateEmployeeKnowledge,
} from '@/app/api/(services)/employee/service';

const USER = 'user-1';
const ORG = 'org-azentio';

type SqlCall = [string, unknown[]?];
const calls = () => query.mock.calls as SqlCall[];
const find = (fragment: string) => calls().filter(([sql]) => sql.includes(fragment));

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

describe('knowledge authoring', () => {
  const create = { userId: USER, orgId: ORG, requestId: 'req-1', title: 'Triage guide', body: 'How we triage alerts.', reviewAt: '2027-01-15', status: 'draft' as const };

  it('requires an active employee membership and writes nothing without one', async () => {
    query.mockResolvedValueOnce([]);
    await expect(createEmployeeKnowledge(create)).rejects.toThrow('Active employee membership required');
    expect(find('INSERT INTO employee_knowledge_items')).toHaveLength(0);
  });

  it('creates the guide owned by the caller with a review date and audits it', async () => {
    query.mockResolvedValueOnce([{ id: 'm1' }]).mockResolvedValueOnce([{ id: 'k1' }]).mockResolvedValueOnce([]);
    await expect(createEmployeeKnowledge(create)).resolves.toEqual({ id: 'k1' });
    const [sql, params] = find('INSERT INTO employee_knowledge_items')[0];
    expect(sql).toContain('owner_user_id');
    expect(params).toEqual([ORG, 'Triage guide', 'How we triage alerts.', USER, '2027-01-15', 'draft']);
    const [auditSql, auditParams] = find('INSERT INTO audit_log')[0];
    expect(auditSql).toContain("'employee.knowledge.create'");
    expect(auditParams?.[0]).toBe(USER);
  });

  it('only updates guides the caller owns, in the workspace, and keeps unspecified fields', async () => {
    query.mockResolvedValueOnce([{ id: 'm1' }]).mockResolvedValueOnce([{ id: 'k1' }]).mockResolvedValueOnce([]);
    await updateEmployeeKnowledge({ userId: USER, orgId: ORG, requestId: 'r', itemId: 'k1', reviewAt: '2027-04-01' });
    const [sql, params] = find('UPDATE employee_knowledge_items')[0];
    expect(sql).toContain('k.owner_user_id = $2');
    expect(sql).toContain('COALESCE($6::date, k.review_at)');
    expect(params).toEqual(['k1', USER, ORG, null, null, '2027-04-01', null]);
  });

  it('reports a guide that is not the caller’s as not found and writes no audit row', async () => {
    query.mockResolvedValueOnce([{ id: 'm1' }]).mockResolvedValueOnce([]);
    await expect(updateEmployeeKnowledge({ userId: USER, orgId: ORG, requestId: 'r', itemId: 'someone-elses', status: 'archived' }))
      .rejects.toThrow('Knowledge item not found');
    expect(find('INSERT INTO audit_log')).toHaveLength(0);
  });

  it('lists published guides plus the caller’s own drafts, flagging which are theirs', async () => {
    query.mockResolvedValueOnce([]);
    await listEmployeeKnowledge(USER, ORG);
    const [sql] = calls()[0];
    expect(sql).toContain("(k.status = 'published' OR (k.owner_user_id = $1 AND k.status = 'draft'))");
    expect(sql).toContain('(k.owner_user_id = $1) AS is_mine');
  });
});

describe('experiment review dates and feedback', () => {
  it('defaults the review date to 30 days out and stores an explicit one when given', async () => {
    query.mockResolvedValue([{ id: 'm1' }]);
    await createEmployeeExperiment({ userId: USER, orgId: ORG, requestId: 'r', title: 'Pilot', problemStatement: 'Problem statement', offering: 'FAI', proposedApproach: '', reviewAt: '2027-02-01' });
    const [sql, params] = find('INSERT INTO employee_experiments')[0];
    expect(sql).toContain('COALESCE($7::date, current_date + 30)');
    expect(params?.[6]).toBe('2027-02-01');
    query.mockClear();
    await createEmployeeExperiment({ userId: USER, orgId: ORG, requestId: 'r', title: 'Pilot', problemStatement: 'Problem statement', offering: 'FAI', proposedApproach: '' });
    expect(find('INSERT INTO employee_experiments')[0][1]?.[6]).toBeNull();
  });

  it('lists review dates, feedback counts and the caller’s own feedback', async () => {
    query.mockResolvedValueOnce([]);
    await listEmployeeExperiments(ORG, USER);
    const [sql, params] = calls()[0];
    expect(sql).toContain('e.review_at');
    expect(sql).toContain('helpful_count');
    expect(sql).toContain('mine.user_id = $2');
    expect(params).toEqual([ORG, USER]);
  });

  it('upserts one feedback row per user and experiment', async () => {
    query.mockResolvedValueOnce([{ id: 'm1' }]).mockResolvedValueOnce([{ id: 'e1' }]).mockResolvedValueOnce([{ id: 'f1' }]);
    await expect(saveEmployeeExperimentFeedback({ userId: USER, orgId: ORG, experimentId: 'e1', helpful: true, note: 'Worth a pilot' })).resolves.toEqual({ id: 'f1' });
    const [sql, params] = find('INSERT INTO employee_experiment_feedback')[0];
    expect(sql).toContain('ON CONFLICT (experiment_id, user_id) DO UPDATE');
    expect(params).toEqual(['e1', USER, true, 'Worth a pilot']);
  });

  it('refuses feedback on an experiment outside the workspace', async () => {
    query.mockResolvedValueOnce([{ id: 'm1' }]).mockResolvedValueOnce([]);
    await expect(saveEmployeeExperimentFeedback({ userId: USER, orgId: ORG, experimentId: 'x', helpful: false, note: '' })).rejects.toThrow('Experiment not found');
    expect(find('INSERT INTO employee_experiment_feedback')).toHaveLength(0);
  });
});
