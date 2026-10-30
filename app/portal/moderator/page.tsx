import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { getModerationOverview } from '@/app/api/(services)/moderation/service';
import Link from 'next/link';
import { OBSERVATIONS, REPORTS, orgById } from '@/app/(config)/mock/portal';
import { ObsStatus } from '@/app/(ui)/components/portal/kit/Status';
import { Card, PageHeader, PillLink, PortalContainer, SectionTitle, StatTile, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { isFlagged, isQueued, isReviewable } from '@/app/(ui)/components/portal/staff/rules';
import { RefreshThemesButton } from '@/app/(ui)/components/portal/staff/RefreshThemesButton';

export const instant = false;

export default async function ModeratorOverviewPage() {
  const session = await requirePortalPage('portal:moderator:read');
  const globalModerator = session?.grants.some((grant) => grant.role === 'learning_moderator'
    && grant.org_id === null && !grant.revoked_at);
  const realOverview = session
    ? await getModerationOverview(globalModerator ? undefined : session.activeWorkspace?.orgId)
    : null;
  const visible = OBSERVATIONS.filter(isReviewable);
  const demoQueue = visible.filter(isQueued);
  const awaiting = realOverview?.awaiting_review ?? demoQueue.length;
  const flagged = realOverview?.flagged_sensitive ?? visible.filter(isFlagged).length;
  const openReports = realOverview?.open_reports ?? REPORTS.filter((r) => r.status === 'Open').length;
  const top = realOverview?.queue.map((row) => ({
    id: row.id,
    title: String(row.source_payload.title ?? 'Untitled contribution'),
    orgName: row.org_name,
    author: row.author_name,
    state: row.state as import('@/app/(config)/mock/portal').ObsState,
  })) ?? demoQueue.slice(0, 3).map((o) => ({
    id: o.id, title: o.title, orgName: orgById(o.orgId)?.name ?? 'Demo organisation', author: o.author, state: o.state,
  }));

  return (
    <>
      <PageHeader title="Learning moderation" description="Review what members contribute before it is shared. Moderators do not see private drafts." />
      <PortalContainer className="py-8 md:py-10">
        <div className="grid gap-5 md:grid-cols-3">
          <StatTile label="Awaiting review" value={awaiting} hint="Submitted or needs clarification" />
          <StatTile label="Flagged sensitive" value={flagged} hint="Automated scan, you decide" />
          <StatTile label="Open reports" value={openReports} hint="From other organisations" />
        </div>

        {session && <Card className="mt-6 flex flex-wrap items-center justify-between gap-3"><div><h2 className="font-semibold text-az-navy">Approved learning themes</h2><p className="mt-1 text-sm text-az-text-muted">Themes group active approved copies by offering, observation type and publication month. Small cohorts below the configured threshold are omitted.</p></div><RefreshThemesButton /></Card>}

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
                    <p className="mt-1 text-sm text-az-text-muted">{o.orgName} · {o.author}</p>
                  </div>
                  <ObsStatus state={o.state} />
                </li>
              ))}
            </ul>
          )}
        </Card>
        {!session && <SyntheticNote />}
      </PortalContainer>
    </>
  );
}
