import Link from 'next/link';
import { OBSERVATIONS, REPORTS, orgById } from '@/app/(config)/mock/portal';
import { ObsStatus } from '@/app/(ui)/components/portal/kit/Status';
import { Card, PageHeader, PillLink, PortalContainer, SectionTitle, StatTile, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { isFlagged, isQueued, isReviewable } from '@/app/(ui)/components/portal/staff/rules';

export default function ModeratorOverviewPage() {
  const visible = OBSERVATIONS.filter(isReviewable);
  const queue = visible.filter(isQueued);
  const awaiting = queue.length;
  const flagged = visible.filter(isFlagged).length;
  const openReports = REPORTS.filter((r) => r.status === 'Open').length;
  const top = queue.slice(0, 3);

  return (
    <>
      <PageHeader title="Learning moderation" description="Review what members contribute before it is shared. Moderators do not see private drafts." />
      <PortalContainer className="py-8 md:py-10">
        <div className="grid gap-5 md:grid-cols-3">
          <StatTile label="Awaiting review" value={awaiting} hint="Submitted or needs clarification" />
          <StatTile label="Flagged sensitive" value={flagged} hint="Automated scan, you decide" />
          <StatTile label="Open reports" value={openReports} hint="From other organisations" />
        </div>

        <Card className="mt-8">
          <SectionTitle action={<PillLink href="/portal/moderator/queue" tone="mint">Open review queue</PillLink>}>Top of the queue</SectionTitle>
          {top.length === 0 ? (
            <p className="text-sm text-az-text-muted">Nothing is waiting for review.</p>
          ) : (
            <ul className="divide-y divide-az-grey-bg">
              {top.map((o) => (
                <li key={o.id} className="flex flex-wrap items-center justify-between gap-3 py-4">
                  <div>
                    <Link href={`/portal/moderator/review/${o.id}`} className="font-semibold text-az-navy underline decoration-az-mint decoration-2 underline-offset-4 transition-colors duration-150 hover:text-az-green">
                      {o.title}
                    </Link>
                    <p className="mt-1 text-sm text-az-text-muted">{orgById(o.orgId)?.name} · {o.author}</p>
                  </div>
                  <ObsStatus state={o.state} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
