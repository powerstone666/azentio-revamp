jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { readFileSync } from 'node:fs';
import path from 'node:path';
import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import { createPublicSubmission } from '@/app/api/(services)/public-submissions/service';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
type SqlCall = [string, unknown[]?];
const sqlCalls = () => query.mock.calls as SqlCall[];

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

const demoInput = {
  type: 'demo_enquiry' as const,
  email: '  Asha.Rao@Example.COM ',
  organization: '  Acme Bank  ',
  payload: { first: 'Asha', consent: true },
};

describe('createPublicSubmission normalisation and duplicate handling', () => {
  it('lower-cases and trims the email and trims the organisation before anything is stored', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await createPublicSubmission(demoInput);
    expect(sqlCalls()[0][1]).toEqual(['demo_enquiry:asha.rao@example.com']);
    expect(sqlCalls()[1][1]).toEqual(['demo_enquiry', 'asha.rao@example.com']);
    const insert = sqlCalls()[2];
    expect(insert[1]?.slice(0, 3)).toEqual(['demo_enquiry', 'asha.rao@example.com', 'Acme Bank']);
  });

  it('takes a transaction-scoped advisory lock keyed by form and address before the duplicate check', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await createPublicSubmission(demoInput);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(sqlCalls()[0][0]).toMatch(/pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
    expect(sqlCalls()[1][0]).toMatch(/created_at > now\(\) - interval '60 seconds'/);
  });

  it('acknowledges a repeat from the same address within 60 seconds without inserting a second row', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ id: 'existing' }]);
    await expect(createPublicSubmission(demoInput)).resolves.toEqual({ accepted: true });
    expect(sqlCalls().some(([sql]) => sql.includes('INSERT INTO public_submissions'))).toBe(false);
  });

  it('scopes the duplicate window to the same form type so a hackathon sign-up is not blocked by a demo request', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await createPublicSubmission({ ...demoInput, type: 'hackathon_registration' });
    expect(sqlCalls()[1][0]).toMatch(/WHERE submission_type = \$1 AND lower\(email\) = \$2/);
    expect(sqlCalls()[1][1]).toEqual(['hackathon_registration', 'asha.rao@example.com']);
  });
});

describe('createPublicSubmission insert', () => {
  it('stores the payload as JSON with the current privacy notice version and a fresh UUID request id', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await createPublicSubmission(demoInput);
    const insert = sqlCalls()[2];
    expect(insert[1]?.[3]).toBe(JSON.stringify(demoInput.payload));
    expect(insert[1]?.[4]).toBe('2026-10-v1');
    expect(insert[1]?.[5]).toMatch(UUID_V4);
  });

  it('generates a different request id for each accepted submission', async () => {
    query.mockResolvedValue([]);
    await createPublicSubmission(demoInput);
    await createPublicSubmission({ ...demoInput, email: 'other@example.com' });
    const ids = sqlCalls().filter(([sql]) => sql.includes('INSERT INTO public_submissions')).map(([, params]) => params?.[5]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toEqual(ids[1]);
  });

  it('lets the database stamp consent: the insert never supplies consented_at, and the column defaults to now()', async () => {
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);
    await createPublicSubmission(demoInput);
    const insertSql = sqlCalls()[2][0];
    expect(insertSql).not.toMatch(/consented_at/);
    const schema = readFileSync(path.join(process.cwd(), 'app/api/(db)/schema/initial.sql'), 'utf8');
    expect(schema).toMatch(/consented_at\s+TIMESTAMPTZ NOT NULL DEFAULT now\(\)/);
  });

  it('is restricted to the two known submission types by the schema check constraint', () => {
    const schema = readFileSync(path.join(process.cwd(), 'app/api/(db)/schema/initial.sql'), 'utf8');
    expect(schema).toMatch(/submission_type\s+TEXT NOT NULL CHECK \(submission_type IN \('demo_enquiry', 'hackathon_registration'\)\)/);
    expect(schema).toMatch(/request_id\s+TEXT NOT NULL UNIQUE/);
  });
});
