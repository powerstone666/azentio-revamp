/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn(), default: jest.fn() }));
jest.mock('@/app/api/(services)/learning/shared-learning', () => ({
  searchApprovedCopies: jest.fn(),
  suggestApprovedCopyFacets: jest.fn(),
}));
jest.mock('@/app/api/(services)/learning/personalization', () => ({
  createSavedSearch: jest.fn(),
  listSavedSearches: jest.fn(),
  deleteSavedSearch: jest.fn(),
}));

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { searchApprovedCopies, suggestApprovedCopyFacets } from '@/app/api/(services)/learning/shared-learning';
import { createSavedSearch, deleteSavedSearch, listSavedSearches } from '@/app/api/(services)/learning/personalization';
import { GET as searchGet } from '@/app/api/v1/search/route';
import { GET as exportGet } from '@/app/api/v1/search/export/route';
import { GET as suggestionsGet } from '@/app/api/v1/search/suggestions/route';
import { GET as savedGet, POST as savedPost } from '@/app/api/v1/search/saved/route';
import { DELETE as savedDelete } from '@/app/api/v1/search/saved/[id]/route';
import { IDS, makeRequest, makeSession, readJson, routeParams, expectNoInternals } from './fixtures';

const getSessionMock = jest.mocked(getSession);
const authorizeMock = jest.mocked(authorize);
const searchMock = jest.mocked(searchApprovedCopies);
const suggestMock = jest.mocked(suggestApprovedCopyFacets);
const listSavedMock = jest.mocked(listSavedSearches);
const createSavedMock = jest.mocked(createSavedSearch);
const deleteSavedMock = jest.mocked(deleteSavedSearch);

const url = (path: string, query = '') => makeRequest(`${path}${query}`);

beforeEach(() => {
  getSessionMock.mockResolvedValue(makeSession());
  authorizeMock.mockResolvedValue({ allowed: true });
});

describe('GET /api/v1/search', () => {
  beforeEach(() => {
    searchMock.mockResolvedValue({ data: [], totalCount: 0, hasMore: false, nextCursor: null } as never);
  });

  it('rejects an unauthenticated search with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await searchGet(url('/api/v1/search'));
    expect(response.status).toBe(401);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('returns 403 with the authorize reason when search:read is denied', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'An active workspace membership is required' });
    const response = await searchGet(url('/api/v1/search'));
    expect(response.status).toBe(403);
    expect(await readJson(response)).toEqual({ error: 'An active workspace membership is required' });
    expect(authorizeMock).toHaveBeenCalledWith({ action: 'search:read' });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it.each([
    ['an unparseable period start', '?period_start=yesterday'],
    ['a limit of zero', '?limit=0'],
    ['a limit above 100', '?limit=101'],
    ['a non-numeric limit', '?limit=many'],
    ['a query longer than 500 characters', `?q=${'a'.repeat(501)}`],
  ])('rejects %s with 422', async (_label, query) => {
    const response = await searchGet(url('/api/v1/search', query));
    expect(response.status).toBe(422);
    expect(await readJson(response)).toMatchObject({ error: 'Invalid search filters' });
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('passes validated filters and the default limit to the service, with no org for a client workspace', async () => {
    await searchGet(url('/api/v1/search', '?q=credit&offering=FAI&period_start=2026-01-01'));
    const [filters, orgId] = searchMock.mock.calls[0];
    expect(filters).toMatchObject({ q: 'credit', offering: 'FAI', period_start: '2026-01-01', limit: 20 });
    expect(orgId).toBeUndefined();
  });

  it('scopes a sandbox workspace search to its active org', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio', isSandbox: true }));
    await searchGet(url('/api/v1/search'));
    expect(searchMock.mock.calls[0][1]).toBe(IDS.orgA);
  });

  it('ignores an org id supplied in the query string', async () => {
    await searchGet(url('/api/v1/search', `?org_id=${IDS.orgC}`));
    const [filters, orgId] = searchMock.mock.calls[0];
    expect(filters).not.toHaveProperty('org_id');
    expect(filters).not.toHaveProperty('orgId');
    expect(orgId).toBeUndefined();
  });

  it('returns the service page as the body with a private no-store cache header', async () => {
    searchMock.mockResolvedValue({ data: [{ id: 'c1' }], totalCount: 1, hasMore: false, nextCursor: null } as never);
    const response = await searchGet(url('/api/v1/search'));
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: [{ id: 'c1' }], totalCount: 1, hasMore: false, nextCursor: null });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
  });

  it('maps a service failure (such as a bad cursor) to 400 without leaking the error', async () => {
    searchMock.mockRejectedValue(new Error('invalid cursor payload: SELECT * FROM copies'));
    const response = await searchGet(url('/api/v1/search', '?cursor=zzz'));
    expect(response.status).toBe(400);
    const serialized = JSON.stringify(await readJson(response));
    expect(serialized).toBe(JSON.stringify({ error: 'Invalid search cursor' }));
    expectNoInternals(serialized);
  });
});

describe('GET /api/v1/search/export', () => {
  const COLUMNS = [
    'id', 'title', 'observation_type', 'offering', 'industry', 'region',
    'observation_period_start', 'observation_period_end', 'evidence_type',
    'confidence', 'body', 'published_at',
  ];
  const cell = (value: string) => `"${value}"`;

  it('rejects an unauthenticated export with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await exportGet(url('/api/v1/search/export'));
    expect(response.status).toBe(401);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('returns 403 when search:read is denied', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'Insufficient permission for this action' });
    const response = await exportGet(url('/api/v1/search/export'));
    expect(response.status).toBe(403);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('rejects invalid filters with 422 before exporting', async () => {
    const response = await exportGet(url('/api/v1/search/export', '?period_end=2026-13-40'));
    expect(response.status).toBe(422);
    expect(searchMock).not.toHaveBeenCalled();
  });

  it('streams a UTF-8 BOM, CRLF-separated CSV with an attachment filename and no-store cache header', async () => {
    searchMock.mockResolvedValueOnce({ data: [{ id: 'c1', title: 'Hello' }], totalCount: 1, hasMore: false, nextCursor: null } as never);
    const response = await exportGet(url('/api/v1/search/export'));
    expect(response.status).toBe(200);
    // response.text() strips a leading BOM per the Fetch spec, so inspect the raw bytes for it.
    const bytes = new Uint8Array(await response.arrayBuffer());
    expect(Array.from(bytes.slice(0, 3))).toEqual([0xef, 0xbb, 0xbf]);
    const text = new TextDecoder('utf-8', { ignoreBOM: true }).decode(bytes);
    const lines = text.slice(1).split('\r\n');
    expect(lines).toHaveLength(2);
    expect(lines[0]).toBe(COLUMNS.map((column) => `"${column}"`).join(','));
    expect(lines[1].startsWith(`"c1","Hello"`)).toBe(true);
    expect(response.headers.get('Content-Type')).toBe('text/csv; charset=utf-8');
    expect(response.headers.get('Content-Disposition')).toMatch(/^attachment; filename="shared-learning-\d{4}-\d{2}-\d{2}\.csv"$/);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(response.headers.get('X-Exported-Rows')).toBe('1');
    expect(response.headers.get('X-Total-Matching-Rows')).toBe('1');
  });

  it.each([
    ['a formula starting with =', '=HYPERLINK("x")', `"'=HYPERLINK(""x"")"`],
    ['a formula starting with +', '+SUM(A1)', `"'+SUM(A1)"`],
    ['a formula starting with -', '-2+3', `"'-2+3"`],
    ['a formula starting with @', '@cmd', `"'@cmd"`],
    ['a value starting with a tab', '\tcmd', `"'\tcmd"`],
    ['a value with leading spaces before =', '  =1+1', `"'  =1+1"`],
    ['an embedded double quote', 'say "hi"', `"say ""hi"""`],
    ['an ordinary value', 'Safe value', cell('Safe value')],
  ])('neutralises %s in the CSV', async (_label, value, expectedCell) => {
    searchMock.mockResolvedValueOnce({ data: [{ id: 'c1', title: value }], totalCount: 1, hasMore: false, nextCursor: null } as never);
    const text = await (await exportGet(url('/api/v1/search/export'))).text();
    const dataLine = text.split('\r\n')[1];
    expect(dataLine).toContain(`"c1",${expectedCell},`);
  });

  it('follows the cursor across pages and reports the total from the first page', async () => {
    searchMock
      .mockResolvedValueOnce({ data: [{ id: 'a' }], totalCount: 2, hasMore: true, nextCursor: 'page-2' } as never)
      .mockResolvedValueOnce({ data: [{ id: 'b' }], totalCount: 99, hasMore: false, nextCursor: null } as never);
    const response = await exportGet(url('/api/v1/search/export'));
    expect(searchMock).toHaveBeenCalledTimes(2);
    expect(searchMock.mock.calls[1][0]).toMatchObject({ cursor: 'page-2' });
    expect(response.headers.get('X-Exported-Rows')).toBe('2');
    expect(response.headers.get('X-Total-Matching-Rows')).toBe('2');
  });

  it('caps the export at 500 rows even when the service keeps reporting more pages', async () => {
    searchMock.mockImplementation(async () => ({
      data: Array.from({ length: 100 }, (_, i) => ({ id: `row-${i}` })),
      totalCount: 10_000,
      hasMore: true,
      nextCursor: 'more',
    }) as never);
    const response = await exportGet(url('/api/v1/search/export'));
    expect(response.headers.get('X-Exported-Rows')).toBe('500');
    expect(searchMock).toHaveBeenCalledTimes(5);
    expect(searchMock.mock.calls.every(([filters]) => (filters as { limit: number }).limit <= 100)).toBe(true);
  });

  it('returns a generic 400 without internals when the export query fails', async () => {
    searchMock.mockRejectedValue(new Error('canceling statement due to statement timeout'));
    const response = await exportGet(url('/api/v1/search/export'));
    expect(response.status).toBe(400);
    const serialized = JSON.stringify(await readJson(response));
    expect(serialized).toBe(JSON.stringify({ error: 'Unable to export matching shared learning' }));
    expectNoInternals(serialized);
  });
});

describe('GET /api/v1/search/suggestions', () => {
  beforeEach(() => {
    suggestMock.mockResolvedValue(['FAI'] as never);
  });

  it('rejects an unauthenticated request with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await suggestionsGet(url('/api/v1/search/suggestions', '?field=offering'))).status).toBe(401);
  });

  it.each([
    ['an unknown facet field', '?field=country'],
    ['a missing field', ''],
    ['a query longer than 100 characters', `?field=industry&q=${'x'.repeat(101)}`],
  ])('rejects %s with 422', async (_label, query) => {
    const response = await suggestionsGet(url('/api/v1/search/suggestions', query));
    expect(response.status).toBe(422);
    expect(suggestMock).not.toHaveBeenCalled();
  });

  it('returns facet suggestions under data with a private no-store cache header', async () => {
    const response = await suggestionsGet(url('/api/v1/search/suggestions', '?field=offering&q=F'));
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: ['FAI'] });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(suggestMock).toHaveBeenCalledWith('offering', 'F', undefined);
  });

  it('scopes suggestions to the active org only for a sandbox workspace', async () => {
    getSessionMock.mockResolvedValue(makeSession({ orgType: 'azentio', isSandbox: true }));
    await suggestionsGet(url('/api/v1/search/suggestions', '?field=region'));
    expect(suggestMock).toHaveBeenCalledWith('region', undefined, IDS.orgA);
  });
});

describe('saved searches /api/v1/search/saved', () => {
  const validBody = { name: 'Credit seasonality', filters: { q: 'credit', offering: 'FAI' } };

  it.each([
    ['GET', () => savedGet()],
    ['POST', () => savedPost(makeRequest('/api/v1/search/saved', { body: validBody }))],
  ])('rejects an unauthenticated %s with 401', async (_method, call) => {
    getSessionMock.mockResolvedValue(null);
    expect((await call()).status).toBe(401);
    expect(listSavedMock).not.toHaveBeenCalled();
    expect(createSavedMock).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', () => savedGet()],
    ['POST', () => savedPost(makeRequest('/api/v1/search/saved', { body: validBody }))],
  ])('returns 409 for %s when no workspace is selected', async (_method, call) => {
    getSessionMock.mockResolvedValue(makeSession({ noWorkspace: true }));
    expect((await call()).status).toBe(409);
    expect(authorizeMock).not.toHaveBeenCalled();
  });

  it.each([
    ['GET', () => savedGet()],
    ['POST', () => savedPost(makeRequest('/api/v1/search/saved', { body: validBody }))],
  ])('returns 403 for %s when search:personalize is denied', async (_method, call) => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'Insufficient permission for this action' });
    expect((await call()).status).toBe(403);
    expect(authorizeMock).toHaveBeenCalledWith({ action: 'search:personalize' });
  });

  it('lists the saved searches for this user and active org with a private no-store header', async () => {
    listSavedMock.mockResolvedValue([{ id: IDS.record }] as never);
    const response = await savedGet();
    expect(await readJson(response)).toEqual({ data: [{ id: IDS.record }] });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
    expect(listSavedMock).toHaveBeenCalledWith(IDS.user, IDS.orgA);
  });

  it.each([
    ['malformed JSON', { rawBody: '[' }, 400],
    ['a missing name', { body: { filters: {} } }, 422],
    ['a blank name', { body: { name: '   ', filters: {} } }, 422],
    ['a name longer than 80 characters', { body: { name: 'n'.repeat(81), filters: {} } }, 422],
    ['a non-boolean digest flag', { body: { ...validBody, digest_enabled: 'yes' } }, 422],
    ['an invalid period in the filters', { body: { name: 'Bad', filters: { period_start: 'soon' } } }, 422],
  ])('rejects %s with %i and does not save', async (_label, init, status) => {
    const response = await savedPost(makeRequest('/api/v1/search/saved', init));
    expect(response.status).toBe(status);
    expect(createSavedMock).not.toHaveBeenCalled();
  });

  it('saves the search for the session user and active org with digests off by default', async () => {
    createSavedMock.mockResolvedValue({ id: IDS.record } as never);
    const response = await savedPost(makeRequest('/api/v1/search/saved', { body: validBody }));
    expect(response.status).toBe(201);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record } });
    const [userId, orgId, input] = createSavedMock.mock.calls[0];
    expect(userId).toBe(IDS.user);
    expect(orgId).toBe(IDS.orgA);
    expect(input).toMatchObject({ name: 'Credit seasonality', digest_enabled: false });
  });

  it('ignores a tenant id in the body and saves against the session active org', async () => {
    createSavedMock.mockResolvedValue({ id: IDS.record } as never);
    await savedPost(makeRequest('/api/v1/search/saved', { body: { ...validBody, org_id: IDS.orgC } }));
    const [, orgId, input] = createSavedMock.mock.calls[0];
    expect(orgId).toBe(IDS.orgA);
    expect(input).not.toHaveProperty('org_id');
  });

  it('maps a save failure to 403 with a fixed message', async () => {
    createSavedMock.mockRejectedValue(new Error('duplicate key value violates unique constraint'));
    const response = await savedPost(makeRequest('/api/v1/search/saved', { body: validBody }));
    expect(response.status).toBe(403);
    const serialized = JSON.stringify(await readJson(response));
    expect(serialized).toBe(JSON.stringify({ error: 'Unable to save this search' }));
    expectNoInternals(serialized);
  });
});

describe('DELETE /api/v1/search/saved/[id]', () => {
  const remove = (id: string) => savedDelete(makeRequest(`/api/v1/search/saved/${id}`, { method: 'DELETE' }), routeParams({ id }));

  it('rejects an unauthenticated delete with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    expect((await remove(IDS.record)).status).toBe(401);
    expect(deleteSavedMock).not.toHaveBeenCalled();
  });

  it('returns 403 when search:personalize is denied', async () => {
    authorizeMock.mockResolvedValue({ allowed: false, reason: 'Insufficient permission for this action' });
    expect((await remove(IDS.record)).status).toBe(403);
    expect(deleteSavedMock).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed id without calling the service', async () => {
    const response = await remove('not-a-uuid');
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Saved search not found' });
    expect(deleteSavedMock).not.toHaveBeenCalled();
  });

  it('returns 204 with no body when the saved search is deleted, scoped to the user and active org', async () => {
    deleteSavedMock.mockResolvedValue(true as never);
    const response = await remove(IDS.record);
    expect(response.status).toBe(204);
    expect(await response.text()).toBe('');
    expect(deleteSavedMock).toHaveBeenCalledWith(IDS.record, IDS.user, IDS.orgA);
  });

  it('returns 404 when the saved search does not belong to the user or org', async () => {
    deleteSavedMock.mockResolvedValue(false as never);
    const response = await remove(IDS.record);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Saved search not found' });
  });
});
