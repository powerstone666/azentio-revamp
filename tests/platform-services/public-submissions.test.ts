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
  origin: 'http://localhost',
};

/** No recipient is configured in tests, so no outbox row is queued. */
const INSERTED = [{ id: 'sub-1' }];

/** Routes the service's queries by fragment: the recent-duplicate lookup returns `recent`, the insert returns the new row. */
function respond(recent: unknown[] = []) {
  query.mockImplementation(async (sql: string) => {
    if (sql.includes("created_at > now() - interval '60 seconds'")) return recent;
    if (sql.includes('INSERT INTO public_submissions')) return INSERTED;
    return [];
  });
}
const insertCall = () => sqlCalls().find(([sql]) => sql.includes('INSERT INTO public_submissions'))!;

describe('createPublicSubmission normalisation', () => {
  it('lower-cases and trims the email and trims the organisation before anything is stored', async () => {
    respond();
    await createPublicSubmission(demoInput);
    const insert = insertCall();
    expect(insert[0]).toMatch(/INSERT INTO public_submissions/);
    expect(insert[1]?.slice(0, 3)).toEqual(['demo_enquiry', 'asha.rao@example.com', 'Acme Bank']);
  });

  it('writes a single row inside a transaction and returns no outbox id when no recipient is configured', async () => {
    respond();
    const result = await createPublicSubmission(demoInput);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(sqlCalls().filter(([sql]) => sql.includes('INSERT INTO public_submissions'))).toHaveLength(1);
    expect(result).toEqual({ accepted: true, id: 'sub-1', email_outbox_id: null });
  });

  it('takes a transaction-scoped advisory lock keyed by form and address before the duplicate check', async () => {
    respond();
    await createPublicSubmission(demoInput);
    expect(transaction).toHaveBeenCalledTimes(1);
    expect(sqlCalls()[0][0]).toMatch(/pg_advisory_xact_lock\(hashtextextended\(\$1, 0\)\)/);
    expect(sqlCalls()[0][1]).toEqual(['public-submission:demo_enquiry:asha.rao@example.com']);
    expect(sqlCalls()[1][0]).toMatch(/created_at > now\(\) - interval '60 seconds'/);
    expect(sqlCalls()[2][0]).toMatch(/INSERT INTO public_submissions/);
  });

  it('acknowledges a repeat from the same address within 60 seconds without inserting or mailing again', async () => {
    respond([{ id: 'existing' }]);
    await expect(createPublicSubmission(demoInput)).resolves.toEqual({ accepted: true, id: 'existing', email_outbox_id: null });
    expect(sqlCalls().some(([sql]) => sql.includes('INSERT INTO public_submissions'))).toBe(false);
  });

  it('scopes the duplicate window to the same form type so a hackathon sign-up is not blocked by a demo request', async () => {
    respond();
    await createPublicSubmission({ ...demoInput, type: 'hackathon_registration' });
    const lookup = sqlCalls()[1];
    expect(lookup[0]).toMatch(/WHERE submission_type = \$1 AND lower\(email\) = \$2/);
    expect(lookup[1]).toEqual(['hackathon_registration', 'asha.rao@example.com']);
  });
});

describe('createPublicSubmission insert', () => {
  it('stores the payload as JSON with the current privacy notice version and a fresh UUID request id', async () => {
    respond();
    await createPublicSubmission(demoInput);
    const insert = insertCall();
    expect(insert[1]?.[3]).toBe(JSON.stringify(demoInput.payload));
    expect(insert[1]?.[4]).toBe('2026-10-v1');
    expect(insert[1]?.[5]).toMatch(UUID_V4);
  });

  it('generates a different request id for each accepted submission', async () => {
    respond();
    await createPublicSubmission(demoInput);
    await createPublicSubmission({ ...demoInput, email: 'other@example.com' });
    const ids = sqlCalls().filter(([sql]) => sql.includes('INSERT INTO public_submissions')).map(([, params]) => params?.[5]);
    expect(ids).toHaveLength(2);
    expect(ids[0]).not.toEqual(ids[1]);
  });

  it('lets the database stamp consent: the insert never supplies consented_at, and the column defaults to now()', async () => {
    respond();
    await createPublicSubmission(demoInput);
    const insertSql = insertCall()[0];
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
