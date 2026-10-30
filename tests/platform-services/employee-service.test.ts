jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import {
  createEmployeeExperiment,
  listEmployeeExperiments,
  listEmployeeKnowledge,
  runEmployeePlayground,
  saveEmployeeKnowledgeFeedback,
  saveEmployeePlaygroundFeedback,
} from '@/app/api/(services)/employee/service';
import { OFFERINGS, SCENARIOS, type OfferingId } from '@/app/(ui)/components/portal/employee/playground-data';

const USER = 'user-1';
const ORG = 'org-azentio';
const SANDBOX_ORG = 'org-sandbox';

type SqlCall = [string, unknown[]?];
const sqlCalls = () => query.mock.calls as SqlCall[];

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

describe('employee membership gate (requireEmployee)', () => {
  it.each([
    ['createEmployeeExperiment', () => createEmployeeExperiment({
      userId: USER, orgId: ORG, requestId: 'r', title: 'Idea', problemStatement: 'Problem', offering: 'fai', proposedApproach: 'Approach',
    })],
    ['runEmployeePlayground', () => runEmployeePlayground({ userId: USER, orgId: ORG, requestId: 'r', offeringId: 'fai' })],
    ['saveEmployeeKnowledgeFeedback', () => saveEmployeeKnowledgeFeedback({ userId: USER, orgId: ORG, itemId: 'k1', helpful: true, note: '' })],
    ['saveEmployeePlaygroundFeedback', () => saveEmployeePlaygroundFeedback({ userId: USER, orgId: ORG, runId: 'run-1', rating: 'Useful', comment: '' })],
  ])('%s refuses callers without an active employee membership and writes nothing', async (_name, call) => {
    query.mockResolvedValueOnce([]);
    await expect(call()).rejects.toThrow('Active employee membership required');
    expect(sqlCalls()).toHaveLength(1);
    expect(sqlCalls()[0][0]).toMatch(/\(m\.role = 'employee' AND o\.type = 'azentio'\)/);
  });

  it('accepts a sandbox user only through an employee or content_publisher grant in that sandbox', async () => {
    query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([{ id: 'exp-s' }]).mockResolvedValueOnce([]);
    await createEmployeeExperiment({ userId: USER, orgId: SANDBOX_ORG, requestId: 'r', title: 'Idea', problemStatement: 'P', offering: 'fai', proposedApproach: 'A' });
    const gate = sqlCalls()[0][0];
    expect(gate).toMatch(/o\.is_sandbox = true AND EXISTS/);
    expect(gate).toMatch(/g\.role IN \('employee', 'content_publisher'\)/);
    expect(gate).toMatch(/g\.revoked_at IS NULL AND \(g\.expires_at IS NULL OR g\.expires_at > now\(\)\)/);
  });
});

describe('employee experiments', () => {
  it('lists experiments of the workspace plus global (null org) ones only outside sandboxes', async () => {
    query.mockResolvedValueOnce([]);
    await listEmployeeExperiments(ORG, USER);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE e\.org_id = \$1 OR \(e\.org_id IS NULL AND workspace\.is_sandbox = false\)/);
    expect(sql).toMatch(/workspace\.status = 'active'/);
    expect(params).toEqual([ORG, USER]);
  });

  it('stores experiments against the workspace only when it is a sandbox; otherwise they are global (null org)', async () => {
    query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([{ id: 'exp-1' }]).mockResolvedValueOnce([]);
    await expect(createEmployeeExperiment({
      userId: USER, orgId: ORG, requestId: 'req-2', title: 'Idea', problemStatement: 'Problem', offering: 'lending', proposedApproach: 'Approach',
    })).resolves.toEqual({ id: 'exp-1' });
    expect(transaction).toHaveBeenCalledTimes(1);
    const insert = sqlCalls()[1];
    expect(insert[0]).toMatch(/CASE WHEN \(SELECT is_sandbox FROM organizations WHERE id = \$1\) THEN \$1 ELSE NULL END/);
    expect(insert[1]).toEqual([ORG, USER, 'Idea', 'Problem', 'lending', 'Approach', null]); // review date defaults in SQL
    expect(sqlCalls()[2][1]).toEqual([USER, 'exp-1', ORG, 'req-2']);
    expect(sqlCalls()[2][0]).toMatch(/'employee\.experiment\.create'/);
  });
});

describe('employee knowledge', () => {
  it('lists only published items for the workspace or global items outside sandboxes, with the caller\'s own feedback', async () => {
    query.mockResolvedValueOnce([]);
    await listEmployeeKnowledge(USER, ORG);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE \(k\.status = 'published' OR \(k\.owner_user_id = \$1 AND k\.status = 'draft'\)\)/);
    expect(sql).toMatch(/\(k\.org_id = \$2 OR \(k\.org_id IS NULL AND workspace\.is_sandbox = false\)\)/);
    expect(sql).toMatch(/LEFT JOIN employee_knowledge_feedback f ON f\.item_id = k\.id AND f\.user_id = \$1/);
    expect(params).toEqual([USER, ORG]);
  });

  it('refuses feedback on an item that is draft, archived, or outside the workspace scope', async () => {
    query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([]);
    await expect(saveEmployeeKnowledgeFeedback({ userId: USER, orgId: ORG, itemId: 'k-x', helpful: false, note: 'n' })).rejects.toThrow(
      'Knowledge item not found',
    );
    const lookup = sqlCalls()[1];
    expect(lookup[0]).toMatch(/k\.status = 'published'/);
    expect(lookup[1]).toEqual(['k-x', ORG]);
    expect(sqlCalls().filter(([sql]) => sql.includes('INSERT INTO employee_knowledge_feedback'))).toHaveLength(0);
  });

  it('upserts one feedback row per user and item, replacing the earlier verdict', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ id: 'k1' }])
      .mockResolvedValueOnce([{ id: 'fb-1' }]);
    await expect(saveEmployeeKnowledgeFeedback({ userId: USER, orgId: ORG, itemId: 'k1', helpful: false, note: 'Out of date' })).resolves.toEqual({ id: 'fb-1' });
    const upsert = sqlCalls()[2];
    expect(upsert[0]).toMatch(/ON CONFLICT \(item_id, user_id\) DO UPDATE/);
    expect(upsert[0]).toMatch(/SET helpful = EXCLUDED\.helpful, note = EXCLUDED\.note, updated_at = now\(\)/);
    expect(upsert[1]).toEqual(['k1', USER, false, 'Out of date']);
  });
});

describe('employee playground', () => {
  it.each(OFFERINGS.map((offering) => [offering.id]))(
    'stores a synthetic run for offering %s with the fixed scenario snapshot and synthetic audit metadata',
    async (offeringId: string) => {
      const id = offeringId as OfferingId;
      const createdAt = new Date('2026-10-31T10:00:00Z');
      query
        .mockResolvedValueOnce([{ id: 'm-1' }])
        .mockResolvedValueOnce([{ id: 'run-1', created_at: createdAt }])
        .mockResolvedValueOnce([]);

      const result = await runEmployeePlayground({ userId: USER, orgId: ORG, requestId: 'req-p', offeringId: id });

      const scenario = SCENARIOS[id];
      const expectedInput = { caption: scenario.inputsCaption, columns: scenario.columns, rows: scenario.rows };
      const expectedOutput = { lines: scenario.output, evidence: scenario.evidence };
      expect(result).toEqual({
        id: 'run-1', created_at: createdAt, offering_id: id, input_snapshot: expectedInput, output_snapshot: expectedOutput,
      });
      const insert = sqlCalls()[1];
      expect(insert[1]).toEqual([ORG, USER, id, id, JSON.stringify(expectedInput), JSON.stringify(expectedOutput)]);
      expect(JSON.parse(sqlCalls()[2][1]?.[4] as string)).toEqual({ offering_id: id, synthetic: true });
    },
  );

  it('rejects an unknown offering before opening a transaction or touching the database', async () => {
    await expect(runEmployeePlayground({
      userId: USER, orgId: ORG, requestId: 'r', offeringId: 'nope' as OfferingId,
    })).rejects.toThrow('Playground scenario not found');
    expect(transaction).not.toHaveBeenCalled();
    expect(query).not.toHaveBeenCalled();
  });

  it('only lets the owner of a run leave feedback on that run, scoped by org and user', async () => {
    query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([]);
    await expect(saveEmployeePlaygroundFeedback({ userId: USER, orgId: ORG, runId: 'run-9', rating: 'Useful', comment: '' })).rejects.toThrow(
      'Playground run not found',
    );
    const lookup = sqlCalls()[1];
    expect(lookup[0]).toMatch(/WHERE id = \$1 AND org_id = \$2 AND user_id = \$3/);
    expect(lookup[1]).toEqual(['run-9', ORG, USER]);
  });

  it('upserts the rating and comment per run and user', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ id: 'run-1' }])
      .mockResolvedValueOnce([{ id: 'fb-1' }]);
    await saveEmployeePlaygroundFeedback({ userId: USER, orgId: ORG, runId: 'run-1', rating: 'Needs more evidence', comment: 'Show the source' });
    const upsert = sqlCalls()[2];
    expect(upsert[0]).toMatch(/ON CONFLICT \(run_id, user_id\) DO UPDATE/);
    expect(upsert[1]).toEqual(['run-1', ORG, USER, 'Needs more evidence', 'Show the source']);
  });
});
