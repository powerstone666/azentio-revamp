import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { enqueueEmail } from '@/app/api/(services)/email/outbox';
import { deliverSavedSearchDigests } from '@/app/api/(services)/learning/digests';
import { MIN_DISTINCT_ORGS } from '@/app/api/(services)/learning/shared-learning';
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
  is_sandbox: boolean;
};
type CopyRow = { id: string; title: string; offering: string | null; observation_type: string | null; published_at: Date };
type TrendRow = {
  id: string; title: string; offering: string | null; period_start: string; period_end: string;
  distinct_org_count: number; newly_visible: boolean;
};

const search = (overrides: Partial<SearchRow> = {}): SearchRow => ({
  id: 's1', name: 'Audit watch', filters: {}, email: 'ana@example.test', user_id: 'u1', org_id: 'o1',
  since: new Date('2026-10-24'), is_sandbox: false, ...overrides,
});

const trend = (overrides: Partial<TrendRow> = {}): TrendRow => ({
  id: 't-1', title: 'Ledger timing', offering: 'Banking', period_start: '2026-07-01', period_end: '2026-09-30',
  distinct_org_count: 3, newly_visible: false, ...overrides,
});

const db = mockDb({ query, queryOne, transaction });
const enqueue = enqueueEmail as unknown as jest.Mock;

/**
 * Routes one digest run. `searches` maps a saved-search id to its locked row (missing = not due),
 * `copies` is the shared-learning result for any search that reaches the copies query.
 */
function installRoutes(
  ids: string[], searches: Record<string, SearchRow>, copies: CopyRow[], extra: SqlRoute[] = [], themes: TrendRow[] = [],
) {
  const routes: SqlRoute[] = [
    ...extra,
    ['ORDER BY COALESCE(last_digest_at', () => ids.map((id) => ({ id }))],
    ['FOR UPDATE OF ss SKIP LOCKED', ([id]) => (searches[id as string] ? [searches[id as string]] : [])],
    ['FROM themes t', () => themes],
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

describe('trend changes in the saved-search digest', () => {
  it('adds a count-only trend section with the caveat sentence', async () => {
    installRoutes(['s1'], { s1: search() }, [], [], [trend({ newly_visible: true, distinct_org_count: 4 })]);
    await deliverSavedSearchDigests(100, ORIGIN);

    expect(enqueue).toHaveBeenCalledTimes(1);
    const [, email] = enqueue.mock.calls[0];
    expect(email.text).toContain('Trend changes this past week:');
    expect(email.text).toContain('• Ledger timing — Banking');
    expect(email.text).toContain('Newly visible · 4 organisations · Period: 2026-07-01 to 2026-09-30');
    expect(email.text).toContain('A theme is a signal from reviewed contributions, not proof of market prevalence.');
    expect(email.html).toContain('Ledger timing');
  });

  it('uses "Evidence is growing" for a theme that was already visible', async () => {
    installRoutes(['s1'], { s1: search() }, [], [], [trend()]);
    await deliverSavedSearchDigests(100, ORIGIN);
    const [, email] = enqueue.mock.calls[0];
    expect(email.text).toContain('Evidence is growing · 3 organisations');
    expect(email.text).not.toContain('Newly visible');
  });

  it('queues a digest when only trends changed, without the new-copies section', async () => {
    installRoutes(['s1'], { s1: search() }, [], [], [trend()]);
    await expect(deliverSavedSearchDigests(100, ORIGIN)).resolves.toEqual({ due: 1, processed: 1, queued: 1 });
    expect(enqueue).toHaveBeenCalledTimes(1);
    const [, email] = enqueue.mock.calls[0];
    expect(email.subject).toBe('Weekly shared learning digest: Audit watch');
    expect(email.text).not.toContain('New approved shared learning');
    expect(email.text).toContain('Trend changes this past week:');
    expect(email.text).toContain('This digest contains only reviewed community copies.');
  });

  it('keeps the existing idempotency key when trends are included', async () => {
    installRoutes(['s1'], { s1: search() }, [copy('c-1', 'Revenue recognition')], [], [trend()]);
    await deliverSavedSearchDigests(100, ORIGIN);
    expect(enqueue.mock.calls[0][1]).toMatchObject({ idempotencyKey: `saved-search-digest:s1:${WEEK}` });
  });

  it('queues nothing when neither new copies nor trend changes exist', async () => {
    installRoutes(['s1'], { s1: search() }, [], [], []);
    await expect(deliverSavedSearchDigests(100, ORIGIN)).resolves.toEqual({ due: 1, processed: 1, queued: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('scopes the theme query to production organisations and the MIN_DISTINCT_ORGS threshold', async () => {
    installRoutes(['s1'], { s1: search() }, [], [], []);
    await deliverSavedSearchDigests(100, ORIGIN);
    const [sql, params] = callsContaining('FROM themes t')[0];
    expect(sql).toContain("t.status IN ('emerging', 'active')");
    expect(sql).toContain('o.is_sandbox = false');
    expect(sql).toContain("co.purpose = 'publish_reviewed'");
    expect(sql).toContain('HAVING count(DISTINCT c.org_id) >=');
    expect(params[1]).toBe(false);
    expect(params[3]).toBe(MIN_DISTINCT_ORGS);
  });

  it('scopes the theme query to the sandbox organisation for sandbox searches', async () => {
    installRoutes(['s1'], { s1: search({ is_sandbox: true, org_id: 'org-sandbox' }) }, [], [], []);
    await deliverSavedSearchDigests(100, ORIGIN);
    const [sql, params] = callsContaining('FROM themes t')[0];
    expect(sql).toContain('o.is_sandbox = true AND c.org_id = $3::uuid');
    expect(params[1]).toBe(true);
    expect(params[2]).toBe('org-sandbox');
  });

  it('passes offering and topic filters to the theme query as parameters', async () => {
    installRoutes(['s1'], { s1: search({ filters: { offering: 'Banking', topic: 'Ledger close' } }) }, [], [], []);
    await deliverSavedSearchDigests(100, ORIGIN);
    const [sql, params] = callsContaining('FROM themes t')[0];
    expect(sql).toContain('t.offering = $5');
    expect(sql).toContain('t.topic = $6');
    expect(sql).not.toContain('Banking');
    expect(sql).not.toContain('Ledger close');
    expect(params[4]).toBe('Banking');
    expect(params[5]).toBe('Ledger close');
  });

  it('never selects organisation names into the trend section', async () => {
    installRoutes(['s1'], { s1: search() }, [], [], [trend()]);
    await deliverSavedSearchDigests(100, ORIGIN);
    const [sql] = callsContaining('FROM themes t')[0];
    expect(sql).not.toMatch(/\bo\.name\b|organizations\.name|org_name|organisation_name/);
    const [, email] = enqueue.mock.calls[0];
    expect(email.text).toMatch(/3 organisations/);
    expect(email.text).not.toMatch(/Org(anisation)? [A-Z]/);
  });
});
