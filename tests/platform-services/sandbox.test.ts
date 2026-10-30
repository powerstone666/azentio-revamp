jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import { listEntitledSandboxDemos, listSandboxRuns, runSandboxDemo } from '@/app/api/(services)/sandbox/service';
import type { SandboxDemo } from '@/app/(config)/sandbox';

const ORG = 'org-sandbox';
const USER = 'user-1';
const demo: SandboxDemo = {
  id: 'FAI',
  name: 'Financial Analysis Intelligence',
  blurb: 'Synthetic blurb',
  scenarioKey: 'synthetic-seasonality',
  scenarioTitle: 'Synthetic seasonal cash-flow cohort',
  scenarioInput: { dataset: 'synthetic', borrower_count: 240 },
  scenarioOutput: { summary: 'Synthetic summary', evidence: ['Synthetic cohort only'], limitation: 'Illustration only' },
};

type SqlCall = [string, unknown[]?];
const sqlCalls = () => query.mock.calls as SqlCall[];

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

describe('sandbox entitlements and history', () => {
  it('returns only offerings with an active, in-window entitlement for sandbox features', async () => {
    query.mockResolvedValueOnce([{ offering_id: 'FAI' }, { offering_id: 'Lending' }]);
    await expect(listEntitledSandboxDemos(ORG)).resolves.toEqual(['FAI', 'Lending']);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE org_id = \$1 AND status = 'active'/);
    expect(sql).toMatch(/valid_from <= now\(\) AND \(valid_to IS NULL OR valid_to > now\(\)\)/);
    expect(sql).toMatch(/\(feature IS NULL OR feature = 'sandbox'\)/);
    expect(params).toEqual([ORG]);
  });

  it('lists runs only for the same org, user and offering, newest first and capped at 10', async () => {
    query.mockResolvedValueOnce([]);
    await listSandboxRuns(ORG, USER, 'FAI');
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE org_id = \$1 AND user_id = \$2 AND offering_id = \$3/);
    expect(sql).toMatch(/ORDER BY created_at DESC, id DESC LIMIT 10/);
    expect(params).toEqual([ORG, USER, 'FAI']);
  });
});

describe('runSandboxDemo access control', () => {
  it('refuses a user who is not an active client member of the workspace', async () => {
    query.mockResolvedValueOnce([]);
    await expect(runSandboxDemo(demo, ORG, USER, 'req-1')).rejects.toThrow('Active client membership is required');
    expect(sqlCalls()).toHaveLength(1);
  });

  it('limits the role-grant membership path to sandbox workspaces only', async () => {
    query.mockResolvedValueOnce([]);
    await expect(runSandboxDemo(demo, ORG, USER, 'req-1')).rejects.toThrow();
    const [membershipSql] = sqlCalls()[0];
    expect(membershipSql).toMatch(/o\.type = 'client' AND o\.status = 'active'/);
    expect(membershipSql).toMatch(/m\.role IN \('client_member', 'client_admin'\) OR \(o\.is_sandbox = true AND EXISTS/);
    expect(membershipSql).toMatch(/g\.role IN \('client_member', 'client_admin'\)/);
  });

  it('refuses to run a demo the workspace is not entitled to, and writes no run or audit', async () => {
    query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([]);
    await expect(runSandboxDemo(demo, ORG, USER, 'req-1')).rejects.toThrow('This workspace is not entitled to this sandbox');
    expect(sqlCalls()[1][1]).toEqual([ORG, demo.id]);
    expect(sqlCalls().some(([sql]) => sql.includes('INSERT INTO sandbox_runs'))).toBe(false);
  });
});

describe('runSandboxDemo writes', () => {
  it('stores a synthetic run isolated by org and user, audits it as synthetic, and returns the snapshots', async () => {
    const createdAt = new Date('2026-10-31T09:00:00Z');
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ id: 'ent-1' }])
      .mockResolvedValueOnce([{ id: 'run-1', created_at: createdAt }])
      .mockResolvedValueOnce([]);

    await expect(runSandboxDemo(demo, ORG, USER, 'req-9')).resolves.toEqual({
      id: 'run-1',
      offering_id: 'FAI',
      scenario_key: 'synthetic-seasonality',
      input_snapshot: demo.scenarioInput,
      output_snapshot: demo.scenarioOutput,
      created_at: createdAt,
    });
    expect(transaction).toHaveBeenCalledTimes(1);

    const insert = sqlCalls()[2];
    expect(insert[0]).toMatch(/INSERT INTO sandbox_runs \(org_id, user_id, offering_id, scenario_key, input_snapshot, output_snapshot\)/);
    expect(insert[1]).toEqual([
      ORG, USER, 'FAI', 'synthetic-seasonality',
      JSON.stringify(demo.scenarioInput), JSON.stringify(demo.scenarioOutput),
    ]);

    const audit = sqlCalls()[3];
    expect(audit[0]).toMatch(/'sandbox\.run'/);
    expect(audit[1]).toEqual([
      USER, 'run-1', ORG, 'req-9',
      JSON.stringify({ offering_id: 'FAI', scenario_key: 'synthetic-seasonality', synthetic: true }),
    ]);
  });

  it('checks the entitlement with the caller org and the demo offering before inserting', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ id: 'ent-1' }])
      .mockResolvedValueOnce([{ id: 'run-1', created_at: new Date() }])
      .mockResolvedValueOnce([]);
    await runSandboxDemo(demo, ORG, USER, 'req-9');
    const entitlementSql = sqlCalls()[1];
    expect(entitlementSql[0]).toMatch(/WHERE org_id = \$1 AND offering_id = \$2 AND status = 'active'/);
    expect(entitlementSql[0]).toMatch(/FOR SHARE/);
    expect(entitlementSql[1]).toEqual([ORG, 'FAI']);
  });
});
