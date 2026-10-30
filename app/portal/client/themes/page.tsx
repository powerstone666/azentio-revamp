import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listVisibleThemes } from '@/app/api/(services)/learning/shared-learning';
import Link from 'next/link';
import { Card, PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { THEMES, type Theme } from '@/app/(config)/mock/portal';

export const instant = false;

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const one = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value)?.trim() || undefined;
const FIELD = 'mt-1 w-full rounded-[12px] border border-az-grey-bg bg-white px-3 py-2 text-sm text-az-text outline-none focus:border-az-green';

export default async function ThemesPage({ searchParams }: { searchParams: Promise<Record<string, string | string[] | undefined>> }) {
  const query = await searchParams;
  const offering = one(query.offering)?.slice(0, 60);
  const topic = one(query.topic)?.slice(0, 60);
  const periodStart = one(query.period_start);
  const periodEnd = one(query.period_end);
  const filters = {
    offering, topic,
    period_start: periodStart && DATE.test(periodStart) ? periodStart : undefined,
    period_end: periodEnd && DATE.test(periodEnd) ? periodEnd : undefined,
  };
  const session = await requirePortalPage('portal:client:read');
  const themes: Theme[] = session
    ? (await listVisibleThemes(session.activeWorkspace?.isSandbox ? session.activeWorkspace.orgId : undefined, filters)).map((theme) => ({
        id: String(theme.id),
        shown: true,
        offering: String(theme.offering ?? 'Multiple offerings'),
        orgs: Number(theme.distinct_org_count),
        posts: 0,
        title: String(theme.title),
        summary: String(theme.safe_summary),
        confidence: 'Varies by evidence',
        periods: `${new Date(String(theme.period_start)).toLocaleDateString()} – ${new Date(String(theme.period_end)).toLocaleDateString()}`,
        evidence: [],
      }))
    : THEMES;
  return (
    <>
      <PageHeader
        title="Community themes"
        description={session?.activeWorkspace?.isSandbox
          ? 'Synthetic example in the shared demo workspace. It is a walkthrough, not cross-organisation evidence or market prevalence.'
          : 'Patterns across contributing organisations. A theme appears only when enough organisations have contributed.'}
      />
      <PortalContainer className="py-8 md:py-10">
        <form method="get" aria-label="Filter themes" className="mb-6 grid gap-3 rounded-[12px] bg-white p-4 shadow-card sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
          <label className="text-sm font-semibold text-az-navy">Offering<input name="offering" defaultValue={offering} placeholder="e.g. FAI" className={FIELD} /></label>
          <label className="text-sm font-semibold text-az-navy">Topic<input name="topic" defaultValue={topic} placeholder="e.g. market_observation" className={FIELD} /></label>
          <label className="text-sm font-semibold text-az-navy">Period from<input type="date" name="period_start" defaultValue={filters.period_start} className={FIELD} /></label>
          <label className="text-sm font-semibold text-az-navy">Period to<input type="date" name="period_end" defaultValue={filters.period_end} className={FIELD} /></label>
          <div className="flex gap-2">
            <button className="cursor-pointer rounded-full bg-az-mint px-5 py-2 text-sm font-semibold text-az-navy transition-all active:scale-[0.96] disabled:cursor-not-allowed disabled:opacity-50">Filter</button>
            <Link href="/portal/client/themes" className="rounded-full border border-az-grey-bg px-5 py-2 text-sm font-semibold text-az-navy">Clear</Link>
          </div>
        </form>
        {themes.length === 0 && <p className="text-sm text-az-text-muted">No themes match these filters. A theme appears only when enough organisations have contributed.</p>}
        <ul className="grid gap-5 md:grid-cols-2">
          {themes.map((t) => {
            return t.shown ? (
              <li key={t.id}>
                <Card className="flex h-full flex-col">
                  <div className="flex flex-wrap gap-2">
                    <Pill tone="grey">{t.offering}</Pill>
                    <Pill tone="mint">Based on {t.orgs} {t.orgs === 1 ? 'organisation' : 'organisations'}</Pill>
                  </div>
                  <h2 className="mt-4 text-lg font-semibold text-az-navy">
                    <Link href={`/portal/client/themes/${t.id}`} className="underline-offset-4 hover:underline">{t.title}</Link>
                  </h2>
                  <p className="mt-2 text-sm text-az-text">{t.summary}</p>
                  <p className="mt-4 text-xs text-az-text-muted">Confidence mix: {t.confidence} · Periods: {t.periods}</p>
                  {t.orgs === 3 && (
                    <p className="mt-3 rounded-[12px] bg-az-grey-bg px-3 py-2 text-xs text-az-text">Small sample. Treat as a signal, not as market prevalence.</p>
                  )}
                </Card>
              </li>
            ) : (
              <li key={t.id}>
                <Card className="flex h-full flex-col justify-center">
                  <p className="text-sm text-az-text-muted">Not enough contributing organisations to show.</p>
                </Card>
              </li>
            );
          })}
        </ul>
      </PortalContainer>
    </>
  );
}
