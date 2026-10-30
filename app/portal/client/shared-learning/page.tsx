import Link from 'next/link';
import { Card, PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { FilterChips } from '@/app/(ui)/components/portal/client/FilterChips';
import { sharedObservations } from '@/app/(ui)/components/portal/client/shared';

export default function SharedLearningPage() {
  const items = sharedObservations();

  return (
    <>
      <PageHeader
        title="Shared learning"
        description="Reviewed shared copies from the learning community. Each card shows only the reviewed text, period, evidence type and confidence."
      />
      <PortalContainer className="py-8 md:py-10">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <label className="sr-only" htmlFor="shared-search">Search shared learning</label>
          <input
            id="shared-search"
            type="search"
            placeholder="Search shared learning"
            className="w-full rounded-[50px] border border-az-grey-bg bg-white px-5 py-2.5 text-[15px] text-az-text outline-none transition-colors duration-150 focus:border-az-green md:max-w-md"
          />
          <FilterChips items={['All', 'Market observation', 'Trend', 'Operational challenge', 'Product gap', 'Successful practice']} active="All" />
        </div>
        <p className="mt-3 text-xs text-az-text-muted">Search and filters are shown for layout only in this preview.</p>

        <ul className="mt-8 grid gap-5 md:grid-cols-2">
          {items.map((o) => (
            <li key={o.id}>
              <Card className="flex h-full flex-col">
                <div className="flex flex-wrap gap-2">
                  <Pill tone="grey">{o.type}</Pill>
                  <Pill tone="mint">Confidence: {o.confidence}</Pill>
                </div>
                <h2 className="mt-4 text-lg font-semibold text-az-navy">
                  <Link href={`/portal/client/shared-learning/${o.id}`} className="underline-offset-4 hover:underline">{o.title}</Link>
                </h2>
                <p className="mt-2 text-xs text-az-text-muted">
                  Period: {o.period} · Evidence: {o.evidence}
                </p>
                {o.shared && <p className="mt-3 text-sm leading-relaxed text-az-text">{o.shared}</p>}
              </Card>
            </li>
          ))}
        </ul>
        {items.length === 0 && <p className="mt-8 text-sm text-az-text-muted">No shared learning is published yet.</p>}
      </PortalContainer>
    </>
  );
}
