import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { searchApprovedCopies, suggestApprovedCopyFacets } from '@/app/api/(services)/learning/shared-learning';
import { listBookmarkedCopies, listSavedSearches } from '@/app/api/(services)/learning/personalization';
import { searchQuerySchema, type SearchQueryInput } from '@/app/(common-lib)/types/schemas';
import Link from 'next/link';
import { Card, PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { sharedObservations } from '@/app/(ui)/components/portal/client/shared';
import { BookmarkButton, SharedLearningPersonalization } from '@/app/(ui)/components/portal/client/SharedLearningPersonalization';

export const instant = false;

type SearchParams = Promise<Record<string, string | string[] | undefined>>;
const TOPICS = [
  ['market_observation', 'Market observation'], ['emerging_trend', 'Emerging trend'],
  ['operational_challenge', 'Operational challenge'], ['product_gap', 'Product gap'],
  ['successful_practice', 'Successful practice'], ['improvement_suggestion', 'Improvement suggestion'],
];
const DEMO_TOPIC_BY_LABEL: Record<string, string> = {
  'market observation': 'market_observation', trend: 'emerging_trend',
  'operational challenge': 'operational_challenge', 'product gap': 'product_gap',
  'successful practice': 'successful_practice', 'improvement suggestion': 'improvement_suggestion',
};

function getParam(params: Record<string, string | string[] | undefined>, key: string) {
  const value = params[key];
  return Array.isArray(value) ? value[0] : value;
}

function buildSearchHref(input: SearchQueryInput, cursor?: string | null) {
  const params = new URLSearchParams();
  for (const key of ['q', 'offering', 'industry', 'region', 'period_start', 'period_end', 'topic'] as const) {
    if (input[key]) params.set(key, String(input[key]));
  }
  params.set('limit', String(input.limit));
  if (cursor) params.set('cursor', cursor);
  return `/portal/client/shared-learning?${params.toString()}`;
}

export default async function SharedLearningPage({ searchParams }: { searchParams: SearchParams }) {
  const session = await requirePortalPage('portal:client:read');
  const raw = await searchParams;
  const parsed = searchQuerySchema.safeParse({
    q: getParam(raw, 'q'), offering: getParam(raw, 'offering'), industry: getParam(raw, 'industry'),
    region: getParam(raw, 'region'), period_start: getParam(raw, 'period_start'),
    period_end: getParam(raw, 'period_end'), topic: getParam(raw, 'topic'),
    cursor: getParam(raw, 'cursor'), limit: getParam(raw, 'limit'),
  });
  const filters: SearchQueryInput = parsed.success ? parsed.data : { q: undefined, limit: 20 };
  let result: Awaited<ReturnType<typeof searchApprovedCopies>> | null = null;
  let savedSearches: Awaited<ReturnType<typeof listSavedSearches>> = [];
  let bookmarkedCopies: Awaited<ReturnType<typeof listBookmarkedCopies>> = [];
  if (session) {
    [result, savedSearches, bookmarkedCopies] = await Promise.all([
      searchApprovedCopies(filters, session.activeWorkspace!.isSandbox ? session.activeWorkspace!.orgId : undefined),
      listSavedSearches(session.user.id, session.activeWorkspace!.orgId),
      listBookmarkedCopies(session.user.id, session.activeWorkspace!.orgId),
    ]);
  }
  let [offeringSuggestions, industrySuggestions, regionSuggestions]: [string[], string[], string[]] = [[], [], []];
  if (session) {
    [offeringSuggestions, industrySuggestions, regionSuggestions] = await Promise.all([
      suggestApprovedCopyFacets('offering', undefined, session.activeWorkspace!.isSandbox ? session.activeWorkspace!.orgId : undefined),
      suggestApprovedCopyFacets('industry', undefined, session.activeWorkspace!.isSandbox ? session.activeWorkspace!.orgId : undefined),
      suggestApprovedCopyFacets('region', undefined, session.activeWorkspace!.isSandbox ? session.activeWorkspace!.orgId : undefined),
    ]);
  }
  const bookmarkedIds = new Set(bookmarkedCopies.map((item) => item.id));
  const demoRows = !session ? sharedObservations().filter((item) => {
    if (filters.q && !`${item.title} ${item.shared ?? ''} ${item.type}`.toLowerCase().includes(filters.q.toLowerCase())) return false;
    if (filters.topic && DEMO_TOPIC_BY_LABEL[item.type.toLowerCase()] !== filters.topic) return false;
    return true;
  }).map((item) => ({ ...item, bookmarked: false })) : [];
  const items = result
    ? result.data.map((item) => ({
        id: String(item.id),
        title: String(item.title ?? 'Shared observation'),
        type: String(item.observation_type ?? 'Observation'),
        confidence: String(item.confidence ?? 'Unrated'),
        period: [item.observation_period_start, item.observation_period_end].filter((value) => typeof value === 'string').join(' – ') || 'Not provided',
        evidence: String(item.evidence_type ?? 'Not specified'),
        shared: String(item.body ?? ''),
        bookmarked: bookmarkedIds.has(String(item.id)),
      }))
    : demoRows;
  const queryInput = filters;

  return (
    <>
      <PageHeader
        title="Shared learning"
        description="Reviewed shared copies from the learning community. Search and filters apply only to approved, currently visible shared content."
      />
      <PortalContainer className="py-8 md:py-10">
        <form action="/portal/client/shared-learning" method="get" className="grid gap-4 rounded-[12px] bg-white p-5 shadow-card md:grid-cols-3">
          <label className="text-sm font-semibold text-az-navy md:col-span-3">Search shared learning
            <input name="q" type="search" defaultValue={filters.q ?? ''} placeholder="Search reviewed text" className="mt-1 w-full rounded-[50px] border border-az-grey-bg px-5 py-2.5 text-[15px] font-normal text-az-text outline-none focus:border-az-green" />
          </label>
          <label className="text-sm font-semibold text-az-navy">Offering<input name="offering" list="offering-suggestions" defaultValue={filters.offering ?? ''} maxLength={100} disabled={!session} className="mt-1 w-full rounded-xl border border-az-grey-bg px-4 py-2.5 font-normal disabled:bg-az-grey-bg/60" /><datalist id="offering-suggestions">{offeringSuggestions.map((value) => <option key={value} value={value} />)}</datalist></label>
          <label className="text-sm font-semibold text-az-navy">Industry<input name="industry" list="industry-suggestions" defaultValue={filters.industry ?? ''} maxLength={100} disabled={!session} className="mt-1 w-full rounded-xl border border-az-grey-bg px-4 py-2.5 font-normal disabled:bg-az-grey-bg/60" /><datalist id="industry-suggestions">{industrySuggestions.map((value) => <option key={value} value={value} />)}</datalist></label>
          <label className="text-sm font-semibold text-az-navy">Region<input name="region" list="region-suggestions" defaultValue={filters.region ?? ''} maxLength={100} disabled={!session} className="mt-1 w-full rounded-xl border border-az-grey-bg px-4 py-2.5 font-normal disabled:bg-az-grey-bg/60" /><datalist id="region-suggestions">{regionSuggestions.map((value) => <option key={value} value={value} />)}</datalist></label>
          <label className="text-sm font-semibold text-az-navy">Period starts on or after<input name="period_start" type="date" defaultValue={filters.period_start ?? ''} disabled={!session} className="mt-1 w-full rounded-xl border border-az-grey-bg px-4 py-2.5 font-normal disabled:bg-az-grey-bg/60" /></label>
          <label className="text-sm font-semibold text-az-navy">Period ends on or before<input name="period_end" type="date" defaultValue={filters.period_end ?? ''} disabled={!session} className="mt-1 w-full rounded-xl border border-az-grey-bg px-4 py-2.5 font-normal disabled:bg-az-grey-bg/60" /></label>
          <label className="text-sm font-semibold text-az-navy">Topic
            <select name="topic" defaultValue={filters.topic ?? ''} className="mt-1 w-full rounded-xl border border-az-grey-bg bg-white px-4 py-2.5 font-normal"><option value="">All topics</option>{TOPICS.map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select>
          </label>
          <div className="flex flex-wrap items-end gap-3 md:col-span-3">
            <button type="submit" className="rounded-full bg-az-mint px-6 py-2.5 text-sm font-semibold text-az-navy">Search</button>
            <Link href="/portal/client/shared-learning" className="rounded-full border border-az-grey-bg px-6 py-2.5 text-sm font-semibold text-az-navy">Clear filters</Link>
            <span className="text-xs text-az-text-muted">Date filters match ISO formatted observation periods.</span>
          </div>
        </form>
        {session && <SharedLearningPersonalization filters={filters} initialSearches={savedSearches} />}
        {session && bookmarkedCopies.length > 0 && <section className="mt-6 rounded-[12px] border border-az-grey-bg bg-white p-5"><h2 className="text-sm font-semibold text-az-navy">Your bookmarks</h2><ul className="mt-3 flex flex-wrap gap-x-5 gap-y-2">{bookmarkedCopies.map((item) => <li key={item.id}><Link href={`/portal/client/shared-learning/${item.id}`} className="text-sm text-az-navy underline-offset-4 hover:underline">{String(item.reviewed_payload.title ?? 'Shared contribution')}</Link></li>)}</ul></section>}
        {!session && <p className="mt-3 text-xs text-az-text-muted">Demo preview uses synthetic shared observations. Only text and topic filters are available in this preview.</p>}
        <div className="mt-6 flex flex-wrap items-center justify-between gap-3">
          <p className="text-sm text-az-text-muted">{result?.totalCount === null ? `${items.length} results shown; total withheld for small-cohort privacy` : `${result?.totalCount ?? items.length} matching ${result?.totalCount === 1 ? 'result' : 'results'} · ${items.length} on this page`}</p>
          {session && <Link href={buildSearchHref(queryInput).replace('/portal/client/shared-learning', '/api/v1/search/export')} className="rounded-full border border-az-navy px-5 py-2 text-sm font-semibold text-az-navy">Export up to 500 rows as CSV</Link>}
        </div>

        <ul className="mt-4 grid gap-5 md:grid-cols-2">
          {items.map((item) => (
            <li key={item.id}>
              <Card className="flex h-full flex-col">
                <div className="flex flex-wrap gap-2"><Pill tone="grey">{item.type}</Pill><Pill tone="mint">Confidence: {item.confidence}</Pill></div>
                <h2 className="mt-4 text-lg font-semibold text-az-navy"><Link href={`/portal/client/shared-learning/${item.id}`} className="underline-offset-4 hover:underline">{item.title}</Link></h2>
                {session && <div className="mt-3"><BookmarkButton sharedCopyId={String(item.id)} initialBookmarked={item.bookmarked} /></div>}
                <p className="mt-2 text-xs text-az-text-muted">Period: {item.period} · Evidence: {item.evidence}</p>
                {item.shared && <p className="mt-3 text-sm leading-relaxed text-az-text">{item.shared}</p>}
              </Card>
            </li>
          ))}
        </ul>
        {items.length === 0 && <p className="mt-8 text-sm text-az-text-muted">No shared learning matches these filters.</p>}
        {session && result?.hasMore && <div className="mt-8"><Link href={buildSearchHref(queryInput, result.nextCursor)} className="rounded-full border border-az-navy px-6 py-2.5 text-sm font-semibold text-az-navy">Next page</Link></div>}
      </PortalContainer>
    </>
  );
}
