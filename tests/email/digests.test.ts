import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { enqueueEmail } from '@/app/api/(services)/email/outbox';
import { deliverSavedSearchDigests } from '@/app/api/(services)/learning/digests';
import { mockDb } from '../support/db';
import { routeSql, type SqlRoute } from './sql-router';

jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));
jest.mock('@/app/api/(services)/email/outbox', () => ({ enqueueEmail: jest.fn() }));

const ORIGIN = 'https://portal.example.test';
const WEEK = '2026-10-26';

type SearchRow = {
  id: string; name: string; filters: Record<string, string>; email: string; user_id: string; org_id: string; since: Date;
};
type CopyRow = { id: string; title: string; offering: string | null; observation_type: string | null; published_at: Date };

const search = (overrides: Partial<SearchRow> = {}): SearchRow => ({
  id: 's1', name: 'Audit watch', filters: {}, email: 'ana@example.test', user_id: 'u1', org_id: 'o1',
  since: new Date('2026-10-24'), ...overrides,
});

const db = mockDb({ query, queryOne, transaction });
const enqueue = enqueueEmail as unknown as jest.Mock;

/**
 * Routes one digest run. `searches` maps a saved-search id to its locked row (missing = not due),
 * `copies` is the shared-learning result for any search that reaches the copies query.
 */
function installRoutes(ids: string[], searches: Record<string, SearchRow>, copies: CopyRow[], extra: SqlRoute[] = []) {
  const routes: SqlRoute[] = [
    ...extra,
    ['ORDER BY COALESCE(last_digest_at', () => ids.map((id) => ({ id }))],
    ['FOR UPDATE OF ss SKIP LOCKED', ([id]) => (searches[id as string] ? [searches[id as string]] : [])],
    ['FROM shared_copies s', () => copies],
    ["date_trunc('week'", () => [{ week_start: WEEK }]],
    ['UPDATE client_saved_searches SET last_digest_at', () => []],
  ];
  const { impl, unmatched } = routeSql(routes);
  db.query.mockImplementation(impl);
  return unmatched;
}

const copy = (id: string, title: string, offering: string | null = null): CopyRow => ({
  id, title, offering, observation_type: null, published_at: new Date('2026-10-30'),
});

const callsContaining = (fragment: string) =>
  db.query.mock.calls.filter(([sql]) => String(sql).includes(fragment));

beforeEach(() => {
  db.query.mockReset();
  db.queryOne.mockReset();
  db.transaction.mockReset();
  mockDb({ query, queryOne, transaction });
  enqueue.mockReset().mockResolvedValue('email-1');
});

describe('deliverSavedSearchDigests', () => {
  it('queues one digest with absolute shared-learning links built from the origin', async () => {
    installRoutes(['s1'], { s1: search() }, [copy('c-1', 'Revenue recognition', 'Banking'), copy('c-2', 'Ledger close')]);
    await expect(deliverSavedSearchDigests(100, ORIGIN)).resolves.toEqual({ due: 1, processed: 1, queued: 1 });

    expect(enqueue).toHaveBeenCalledTimes(1);
    const [, email] = enqueue.mock.calls[0];
    expect(email).toMatchObject({
      idempotencyKey: `saved-search-digest:s1:${WEEK}`,
      recipient: 'ana@example.test',
      subject: 'Weekly shared learning digest: Audit watch',
    });
    for (const id of ['c-1', 'c-2']) {
      expect(email.html).toContain(`${ORIGIN}/portal/client/shared-learning/${id}`);
      expect(email.text).toContain(`${ORIGIN}/portal/client/shared-learning/${id}`);
    }
    expect(email.html).toContain(`href="${ORIGIN}/portal/client/shared-learning"`);
    expect(email.text).toContain('Revenue recognition — Banking');
  });

  it('records the digest run on the saved search', async () => {
    installRoutes(['s1'], { s1: search() }, [copy('c-1', 'Revenue recognition')]);
    await deliverSavedSearchDigests(100, ORIGIN);
    expect(callsContaining('UPDATE client_saved_searches SET last_digest_at')[0][1]).toEqual(['s1']);
  });

  it('queues nothing when no approved copies match, but still closes the run', async () => {
    installRoutes(['s1'], { s1: search() }, []);
    await expect(deliverSavedSearchDigests(100, ORIGIN)).resolves.toEqual({ due: 1, processed: 1, queued: 0 });
    expect(enqueue).not.toHaveBeenCalled();
    expect(callsContaining('UPDATE client_saved_searches SET last_digest_at')).toHaveLength(1);
  });

  it('passes the saved-search filters into the copies query as parameters', async () => {
    installRoutes(['s1'], { s1: search({ filters: { offering: 'Banking' } }) }, []);
    await deliverSavedSearchDigests(100, ORIGIN);
    const copiesCall = callsContaining('FROM shared_copies s')[0];
    // $2/$3 carry the sandbox scope (is_sandbox flag, org id); filters follow.
    expect(copiesCall[0]).toContain("s.reviewed_payload->>'offering' = $4");
    expect(copiesCall[1]).toHaveLength(4);
    expect(copiesCall[1][3]).toBe('Banking');
  });

  it('skips a saved search that is no longer due or was locked elsewhere', async () => {
    installRoutes(['s1'], {}, []);
    await expect(deliverSavedSearchDigests(100, ORIGIN)).resolves.toEqual({ due: 1, processed: 0, queued: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('keeps processing other searches when one fails', async () => {
    installRoutes(['s1', 's2'], {}, [copy('c-9', 'Ledger close')], [
      ['FOR UPDATE OF ss SKIP LOCKED', ([id]) => {
        if (id === 's1') throw new Error('lock timeout');
        return [search({ id: 's2', name: 'Second' })];
      }],
    ]);
    await expect(deliverSavedSearchDigests(100, ORIGIN)).resolves.toEqual({ due: 2, processed: 1, queued: 1 });
    expect(enqueue.mock.calls[0][1].subject).toBe('Weekly shared learning digest: Second');
  });

  it.each([
    [0, 1], [-3, 1], [150, 150], [999, 200],
  ])('clamps a requested batch of %i to %i', async (requested, applied) => {
    installRoutes([], {}, []);
    await deliverSavedSearchDigests(requested, ORIGIN);
    expect(callsContaining('ORDER BY COALESCE(last_digest_at')[0][1]).toEqual([applied]);
  });
});
