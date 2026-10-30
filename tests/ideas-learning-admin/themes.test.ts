import { query, queryOne, transaction } from '@/app/api/(db)/client';
import {
  getActiveApprovedCopiesByIds, getApprovedCopy, getVisibleTheme, listApprovedCopies, listProductOwnerThemePriorities,
  listVisibleThemes, refreshGeneratedThemes, searchApprovedCopies, suggestApprovedCopyFacets,
} from '@/app/api/(services)/learning/shared-learning';
import { mockDb } from '@/tests/support/db';
import { UUID_A, callsMatching, metadataOf, respondTo, sqlCalls } from './helpers';

jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

const ENV_KEYS = ['MIN_DISTINCT_ORGS', 'SEMANTIC_THEME_SIMILARITY'] as const;
const savedEnv: Record<string, string | undefined> = {};

beforeAll(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
});

afterAll(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  query.mockResolvedValue([]);
  queryOne.mockResolvedValue(null);
  mockDb({ query, queryOne, transaction });
});

/**
 * Loads a fresh copy of the service with MIN_DISTINCT_ORGS set, because the value is read at import time.
 * The db client is loaded in the same isolated registry so the service and the mock it uses are the same.
 */
function loadWithEnv(value: string | undefined) {
  const previous = process.env.MIN_DISTINCT_ORGS;
  if (value === undefined) delete process.env.MIN_DISTINCT_ORGS;
  else process.env.MIN_DISTINCT_ORGS = value;
  try {
    let service: typeof import('@/app/api/(services)/learning/shared-learning') | undefined;
    let client: { query: jest.Mock; queryOne: jest.Mock; transaction: jest.Mock } | undefined;
    jest.isolateModules(() => {
      service = jest.requireActual<typeof import('@/app/api/(services)/learning/shared-learning')>(
        '@/app/api/(services)/learning/shared-learning',
      );
      client = jest.requireMock<typeof import('@/app/api/(db)/client')>('@/app/api/(db)/client');
    });
    mockDb(client!);
    return { service: service!, client: client! };
  } finally {
    if (previous === undefined) delete process.env.MIN_DISTINCT_ORGS;
    else process.env.MIN_DISTINCT_ORGS = previous;
  }
}

describe('MIN_DISTINCT_ORGS threshold', () => {
  it.each([
    ['unset', undefined, 3],
    ['5', '5', 5],
    ['3', '3', 3],
    ['2 (below the floor)', '2', 3],
    ['not a number', 'abc', 3],
    ['fractional', '3.5', 3],
    ['empty string', '', 3],
  ])('uses %s as the distinct organisation threshold (expected %i)', (_label, value, expected) => {
    expect(loadWithEnv(value).service.MIN_DISTINCT_ORGS).toBe(expected);
  });

  it('passes the configured threshold into theme visibility queries', async () => {
    const { service, client } = loadWithEnv('5');
    client.query.mockResolvedValue([]);
    await service.listVisibleThemes();
    const [{ sql, params }] = sqlCalls(client.query);
    expect(sql).toContain('HAVING count(DISTINCT c.org_id) >= CASE WHEN $1::uuid IS NULL THEN $2 ELSE 1 END');
    expect(params).toEqual([null, 5]);
  });
});

describe('visible theme thresholds', () => {
  it('shows a production theme only when distinct contributing organisations meet the threshold (listing)', async () => {
    await listVisibleThemes();
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain('HAVING count(DISTINCT c.org_id) >= CASE WHEN $1::uuid IS NULL THEN $2 ELSE 1 END');
    expect(params).toEqual([null, 3]);
  });

  it('limits a sandbox workspace listing to the sandbox organisation\'s own evidence', async () => {
    await listVisibleThemes('org-9');
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain('$1::uuid IS NOT NULL AND o.is_sandbox = true AND c.org_id = $1');
    expect(params).toEqual(['org-9', 3]);
  });

  it('counts organisations rather than posts when showing a single theme', async () => {
    await getVisibleTheme(UUID_A);
    const [{ sql, params }] = sqlCalls(queryOne);
    expect(sql).toContain('count(DISTINCT c.org_id)::int AS distinct_org_count');
    expect(sql).toContain('HAVING count(DISTINCT c.org_id) >= CASE WHEN $2::uuid IS NULL THEN $3 ELSE 1 END');
    expect(params).toEqual([UUID_A, null, 3]);
  });

  it('returns null and skips loading evidence when the theme is below threshold', async () => {
    await expect(getVisibleTheme(UUID_A)).resolves.toBeNull();
    expect(query).not.toHaveBeenCalled();
  });

  it('returns theme evidence with a sample caveat once the theme is visible', async () => {
    queryOne.mockResolvedValueOnce({ id: UUID_A, title: 'Pricing', distinct_org_count: 3 });
    query.mockResolvedValueOnce([{ id: 'copy-1', contribution_id: 'c-1', reviewed_payload: { title: 'Slow quotes' }, published_at: new Date('2026-05-01') }]);
    const theme = await getVisibleTheme(UUID_A);
    expect(theme?.sample_note).toContain('may not represent the broader market');
    expect(theme?.evidence[0]).toMatchObject({ id: 'copy-1', title: 'Slow quotes' });
  });

  it('lists only themes whose evidence comes from production organisations', async () => {
    await listVisibleThemes();
    expect(sqlCalls(query)[0].sql).toContain('(($1::uuid IS NULL AND o.is_sandbox = false)');
  });

  it('returns no product-owner priorities without querying when there are no theme ids', async () => {
    await expect(listProductOwnerThemePriorities([])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('applies the threshold to product-owner priority lookups too', async () => {
    await listProductOwnerThemePriorities([UUID_A]);
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain('HAVING count(DISTINCT c.org_id) >= CASE WHEN $2::uuid IS NULL THEN $3 ELSE 1 END');
    expect(params).toEqual([[UUID_A], null, 3]);
  });
});

describe('refreshGeneratedThemes', () => {
  type Row = Record<string, unknown>;

  function candidate(sharedCopyId: string, orgId: string, embedding: number[], overrides: Row = {}): Row {
    return {
      shared_copy_id: sharedCopyId,
      org_id: orgId,
      offering: 'FAI',
      topic: 'pricing',
      evidence_quality: 'moderate',
      needs_evidence_org_id: null,
      period_start: new Date('2026-03-01T00:00:00Z'),
      model: 'embed-v1',
      dims: embedding.length,
      embedding,
      ...overrides,
    };
  }

  function respondRefresh({ monthly = [] as Row[], semantic = [] as Row[] } = {}) {
    respondTo(query, [
      ['e.embedding', semantic],
      ['WITH eligible AS', monthly],
      ['INSERT INTO themes', [{ id: 'theme-1' }]],
    ]);
  }

  function themeInserts() {
    return callsMatching(query, 'INSERT INTO themes');
  }

  it('serializes refreshes with an advisory lock and rebuilds theme evidence from scratch', async () => {
    respondRefresh();
    await refreshGeneratedThemes('user-admin', 'req-1');
    const statements = sqlCalls(query).map((call) => call.sql);
    expect(statements[0]).toContain('pg_advisory_xact_lock');
    const deleteIndex = statements.findIndex((sql) => sql.startsWith('DELETE FROM theme_evidence'));
    const firstEvidenceInsert = statements.findIndex((sql) => sql.startsWith('INSERT INTO theme_evidence'));
    expect(deleteIndex).toBeGreaterThan(0);
    expect(firstEvidenceInsert === -1 || deleteIndex < firstEvidenceInsert).toBe(true);
  });

  it('only counts published, consented, production evidence and requires distinct organisations at the threshold', async () => {
    respondRefresh();
    await refreshGeneratedThemes('user-admin', 'req-1');
    const eligible = callsMatching(query, 'WITH eligible AS')[0];
    expect(eligible.sql).toContain("c.visibility = 'community_proposed'");
    expect(eligible.sql).toContain("co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL");
    expect(eligible.sql).toContain('JOIN organizations o ON o.id = c.org_id AND o.is_sandbox = false');
    expect(eligible.sql).toContain('count(DISTINCT org_id)::int AS distinct_org_count');
    expect(eligible.sql).toContain('WHERE current_period.distinct_org_count >= $1');
    expect(eligible.params).toEqual([3]);
  });

  it('requires a separate semantic_analysis consent before a document joins semantic clusters', async () => {
    respondRefresh();
    await refreshGeneratedThemes('user-admin', 'req-1');
    const semantic = callsMatching(query, 'e.embedding')[0];
    expect(semantic.sql).toContain("semantic.purpose = 'semantic_analysis' AND semantic.choice = true");
  });

  it('creates a theme from three distinct organisations with similar observations', async () => {
    respondRefresh({
      semantic: [
        candidate('copy-a', 'org-A', [1, 0, 0]),
        candidate('copy-b', 'org-B', [0.99, 0.1, 0]),
        candidate('copy-c', 'org-C', [0.98, 0.05, 0.1]),
      ],
    });
    await expect(refreshGeneratedThemes('user-admin', 'req-1')).resolves.toEqual({ themes: 1, minimumDistinctOrganizations: 3 });
    const [insert] = themeInserts();
    expect(insert.params[7]).toBe(3);
    expect(callsMatching(query, 'INSERT INTO theme_evidence')).toHaveLength(3);
  });

  it('does not create a theme from several observations by one organisation', async () => {
    respondRefresh({
      semantic: [
        candidate('copy-a', 'org-A', [1, 0, 0]),
        candidate('copy-b', 'org-A', [0.99, 0.1, 0]),
        candidate('copy-c', 'org-A', [0.98, 0.05, 0.1]),
      ],
    });
    await refreshGeneratedThemes('user-admin', 'req-1');
    expect(themeInserts()).toHaveLength(0);
  });

  it('does not create a theme from only two distinct organisations', async () => {
    respondRefresh({
      semantic: [
        candidate('copy-a', 'org-A', [1, 0, 0]),
        candidate('copy-b', 'org-B', [0.99, 0.1, 0]),
        candidate('copy-c', 'org-A', [0.98, 0.05, 0.1]),
      ],
    });
    await refreshGeneratedThemes('user-admin', 'req-1');
    expect(themeInserts()).toHaveLength(0);
  });

  it('does not cluster observations that are dissimilar even when they come from three organisations', async () => {
    respondRefresh({
      semantic: [
        candidate('copy-a', 'org-A', [1, 0, 0]),
        candidate('copy-b', 'org-B', [0, 1, 0]),
        candidate('copy-c', 'org-C', [0, 0, 1]),
      ],
    });
    await refreshGeneratedThemes('user-admin', 'req-1');
    expect(themeInserts()).toHaveLength(0);
  });

  it('keeps observations from different embedding models in separate buckets', async () => {
    respondRefresh({
      semantic: [
        candidate('copy-a', 'org-A', [1, 0, 0]),
        candidate('copy-b', 'org-B', [0.99, 0.1, 0]),
        candidate('copy-c', 'org-C', [0.98, 0.05, 0.1], { model: 'embed-v2' }),
      ],
    });
    await refreshGeneratedThemes('user-admin', 'req-1');
    expect(themeInserts()).toHaveLength(0);
  });

  it('labels semantic groups as machine-suggested and warns that similarity is not proof of cause', async () => {
    respondRefresh({
      semantic: [
        candidate('copy-a', 'org-A', [1, 0, 0]),
        candidate('copy-b', 'org-B', [0.99, 0.1, 0]),
        candidate('copy-c', 'org-C', [0.98, 0.05, 0.1]),
      ],
    });
    await refreshGeneratedThemes('user-admin', 'req-1');
    const [insert] = themeInserts();
    expect(insert.params[0]).toMatch(/^semantic:/);
    expect(insert.params[1]).toBe('Related observations · FAI');
    expect(insert.params[6]).toContain('not proof that the observations share a cause');
  });

  it.each([
    ['only one organisation is strong', 1, 'monitor'],
    ['three organisations rate evidence strong', 3, 'candidate_review'],
  ])('sets review priority when %s', async (_label, strongOrgs, expected) => {
    const rows = ['org-A', 'org-B', 'org-C'].map((org, index) => candidate(`copy-${index}`, org, [1, 0.01 * index, 0], {
      evidence_quality: index < strongOrgs ? 'strong' : 'weak',
    }));
    respondRefresh({ semantic: rows });
    await refreshGeneratedThemes('user-admin', 'req-1');
    expect(themeInserts()[0].params[8]).toBe(expected);
  });

  it('prioritises evidence review when three organisations say the evidence is missing', async () => {
    const rows = ['org-A', 'org-B', 'org-C'].map((org, index) => candidate(`copy-${index}`, org, [1, 0.01 * index, 0], {
      needs_evidence_org_id: org,
    }));
    respondRefresh({ semantic: rows });
    await refreshGeneratedThemes('user-admin', 'req-1');
    expect(themeInserts()[0].params[8]).toBe('evidence_review');
  });

  it.each([
    ['no previous-month data', { distinct_org_count: 4, previous_org_count: null }, 'Month-over-month direction is withheld'],
    ['previous month below threshold', { distinct_org_count: 4, previous_org_count: 2 }, 'Month-over-month direction is withheld'],
    ['growth from a previous month meeting the threshold', { distinct_org_count: 5, previous_org_count: 3 }, 'More distinct organisations contributed'],
    ['decline from a previous month meeting the threshold', { distinct_org_count: 3, previous_org_count: 4 }, 'Fewer distinct organisations contributed'],
    ['level month over month', { distinct_org_count: 4, previous_org_count: 4 }, 'level with the previous month'],
  ])('describes the trend for %s', async (_label, counts, phrase) => {
    respondRefresh({
      monthly: [{
        offering: 'FAI', topic: 'pricing', period_start: new Date('2026-04-01T00:00:00Z'),
        period_end: new Date('2026-04-30T23:59:59Z'), strong_org_count: 0, needs_evidence_org_count: 0,
        shared_copy_ids: ['copy-1'], ...counts,
      }],
    });
    await refreshGeneratedThemes('user-admin', 'req-1');
    const [insert] = themeInserts();
    expect(insert.params[6]).toContain(phrase);
    expect(insert.params[6]).toContain('Recurring pricing in approved, shared observations');
  });

  it('archives themes that no longer have qualifying evidence', async () => {
    respondRefresh();
    await refreshGeneratedThemes('user-admin', 'req-1');
    const [archive] = callsMatching(query, "SET status = 'archived'");
    expect(archive.sql).toContain("generated_key IS NOT NULL AND status <> 'archived' AND id <> ALL($1::uuid[])");
    expect(archive.params).toEqual([[]]);
  });

  it('writes an audit row with the number of themes and the threshold used', async () => {
    respondRefresh({
      semantic: [
        candidate('copy-a', 'org-A', [1, 0, 0]),
        candidate('copy-b', 'org-B', [0.99, 0.1, 0]),
        candidate('copy-c', 'org-C', [0.98, 0.05, 0.1]),
      ],
    });
    await refreshGeneratedThemes('user-admin', 'req-9');
    const [audit] = callsMatching(query, 'INSERT INTO audit_log');
    expect(audit.sql).toContain("'learning.themes_refresh'");
    expect(audit.params).toContain('req-9');
    expect(metadataOf(audit.params)).toEqual({ themes: 1, minimum_distinct_organizations: 3 });
  });

  it('does not form a theme from three organisations when the configured threshold is five', async () => {
    const { service, client } = loadWithEnv('5');
    respondTo(client.query, [
      ['e.embedding', [
        candidate('copy-a', 'org-A', [1, 0, 0]),
        candidate('copy-b', 'org-B', [0.99, 0.1, 0]),
        candidate('copy-c', 'org-C', [0.98, 0.05, 0.1]),
      ]],
      ['WITH eligible AS', []],
    ]);
    await expect(service.refreshGeneratedThemes('user-admin', 'req-1')).resolves.toEqual({ themes: 0, minimumDistinctOrganizations: 5 });
    expect(callsMatching(client.query, 'INSERT INTO themes')).toHaveLength(0);
  });
});

describe('approved copy search and visibility', () => {
  const copyRow = (id: string, publishedAt = '2026-05-01T00:00:00.000Z') => ({
    id, reviewed_payload: { title: `Copy ${id}`, offering: 'FAI' }, published_at: new Date(publishedAt),
  });

  it('rejects a cursor that does not decode to a valid position', async () => {
    const bad = Buffer.from(JSON.stringify({ id: 'not-a-uuid', publishedAt: '2026-05-01' })).toString('base64url');
    await expect(searchApprovedCopies({ limit: 20, cursor: bad } as never)).rejects.toThrow('Invalid search cursor');
    await expect(searchApprovedCopies({ limit: 20, cursor: '%%%' } as never)).rejects.toThrow('Invalid search cursor');
    expect(query).not.toHaveBeenCalled();
  });

  it('pages with a keyset cursor built from the last returned row', async () => {
    query.mockResolvedValueOnce([copyRow(UUID_A), copyRow('6f1c2b1e-2222-4a2b-9c3d-000000000002'), copyRow('6f1c2b1e-3333-4a2b-9c3d-000000000003')]);
    queryOne.mockResolvedValueOnce({ total_count: 3, distinct_org_count: 3 });
    const page = await searchApprovedCopies({ limit: 2 } as never);
    expect(page.hasMore).toBe(true);
    expect(page.data).toHaveLength(2);
    const decoded = JSON.parse(Buffer.from(page.nextCursor!, 'base64url').toString('utf8'));
    expect(decoded.id).toBe('6f1c2b1e-2222-4a2b-9c3d-000000000002');
    expect(sqlCalls(query)[0].params.at(-1)).toBe(3);
  });

  it('supplies the next keyset position as a bound parameter when a cursor is given', async () => {
    const cursor = Buffer.from(JSON.stringify({ id: UUID_A, publishedAt: '2026-05-01T00:00:00.000Z' })).toString('base64url');
    await searchApprovedCopies({ limit: 10, cursor } as never);
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain('(s.published_at, s.id) < ($1::timestamptz, $2::uuid)');
    expect(params.slice(0, 2)).toEqual(['2026-05-01T00:00:00.000Z', UUID_A]);
  });

  it.each([
    ['production', undefined, 'o.is_sandbox = false'],
    ['sandbox', 'org-9', 'o.is_sandbox = true AND c.org_id = $'],
  ])('restricts %s search results to the matching organisation scope', async (_label, sandboxOrg, fragment) => {
    await searchApprovedCopies({ limit: 5 } as never, sandboxOrg);
    expect(sqlCalls(query)[0].sql).toContain(fragment);
    expect(sqlCalls(queryOne)[0].sql).toContain(fragment);
  });

  it('suppresses exact result counts below the cohort threshold to limit differencing', async () => {
    query.mockResolvedValueOnce([copyRow(UUID_A)]);
    queryOne.mockResolvedValueOnce({ total_count: 12, distinct_org_count: 2 });
    await expect(searchApprovedCopies({ limit: 20 } as never)).resolves.toMatchObject({ totalCount: null });
  });

  it('reports the exact count once the result set spans the threshold number of organisations', async () => {
    query.mockResolvedValueOnce([copyRow(UUID_A)]);
    queryOne.mockResolvedValueOnce({ total_count: 12, distinct_org_count: 3 });
    await expect(searchApprovedCopies({ limit: 20 } as never)).resolves.toMatchObject({ totalCount: 12, hasMore: false, nextCursor: null });
  });

  it('applies each search filter as a bound parameter', async () => {
    await searchApprovedCopies({ limit: 20, q: 'pricing', offering: 'FAI', topic: 'pricing', region: 'EMEA' } as never);
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain("to_tsvector('english', s.reviewed_payload::text) @@ plainto_tsquery('english', $1)");
    expect(sql).toContain("s.reviewed_payload->>'offering' = $2");
    expect(sql).toContain("s.reviewed_payload->>'region' = $3");
    expect(sql).toContain("s.reviewed_payload->>'observation_type' = $4");
    expect(params.slice(0, 4)).toEqual(['pricing', 'FAI', 'EMEA', 'pricing']);
  });

  it('hides facet values from production that fewer than the threshold of organisations contribute', async () => {
    await suggestApprovedCopyFacets('offering', 'fa');
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain('HAVING $3::uuid IS NOT NULL OR count(DISTINCT c.org_id) >= $2');
    expect(params).toEqual(['fa', 3, null]);
  });

  it('trims facet prefixes and passes sandbox scope through without the organisation floor', async () => {
    await suggestApprovedCopyFacets('region', '   ', 'org-9');
    expect(sqlCalls(query)[0].params).toEqual([null, 3, 'org-9']);
  });

  // Possible bug: the unscoped listing no longer excludes sandbox organisations' copies (it has no callers today).
  it('lists approved copies only from production organisations', async () => {
    await listApprovedCopies();
    expect(sqlCalls(query)[0].sql).toContain('o.is_sandbox = false');
  });

  it('returns nothing without querying when no approved copy ids are requested', async () => {
    await expect(getActiveApprovedCopiesByIds([])).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('requires publish consent and an active, non-withdrawn contribution to read a single approved copy', async () => {
    await getApprovedCopy(UUID_A);
    const [{ sql, params }] = sqlCalls(queryOne);
    expect(sql).toContain("co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL");
    expect(sql).toContain("c.state = 'published' AND c.withdrawn_at IS NULL");
    expect(sql).toContain("c.visibility = 'community_proposed'");
    expect(sql).toContain('(($2::uuid IS NULL AND o.is_sandbox = false)');
    expect(params).toEqual([UUID_A, null]);
  });

  // Possible bug: the batched lookup used by AIRA's evidence refresh no longer excludes sandbox copies, so a
  // sandbox copy id can be resolved and its body returned. Previously the query joined production organisations only.
  it('keeps sandbox copies out of production lookups for batched ids', async () => {
    await getActiveApprovedCopiesByIds([UUID_A]);
    expect(sqlCalls(query)[0].sql).toContain('o.is_sandbox = false');
  });
});
