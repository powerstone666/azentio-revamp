import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { notFound } from 'next/navigation';
import { getApprovedCopy } from '@/app/api/(services)/learning/shared-learning';
import { isBookmarked } from '@/app/api/(services)/learning/personalization';
import { Card, PageHeader, PillButton, PortalContainer, SectionTitle } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { PreviewNote } from '@/app/(ui)/components/portal/client/PreviewNote';
import { ReportContributionForm } from '@/app/(ui)/components/portal/client/ReportContributionForm';
import { sharedObservation, sharedObservations } from '@/app/(ui)/components/portal/client/shared';
import { BookmarkButton } from '@/app/(ui)/components/portal/client/SharedLearningPersonalization';
import { listCommunityComments } from '@/app/api/(services)/learning/comments';
import { SharedComments } from '@/app/(ui)/components/portal/client/SharedComments';
import { SharedCopyFeedback } from '@/app/(ui)/components/portal/client/SharedCopyFeedback';

export const instant = false;

export function generateStaticParams() {
  return sharedObservations().map((o) => ({ sharedCopyId: o.id }));
}

interface Props {
  params: Promise<{ sharedCopyId: string }>;
}

export default async function SharedCopyDetailPage({ params }: Props) {
  const session = await requirePortalPage('portal:client:read');
  const { sharedCopyId } = await params;
  const copy = session ? await getApprovedCopy(sharedCopyId, session.activeWorkspace?.isSandbox ? session.activeWorkspace.orgId : undefined) : null;
  if (session && !copy) notFound();
  const bookmarked = session?.activeWorkspace
    ? await isBookmarked(sharedCopyId, session.user.id, session.activeWorkspace.orgId)
    : false;
  const comments = session?.activeWorkspace
    ? await listCommunityComments(sharedCopyId, session.user.id, session.activeWorkspace.orgId)
    : [];
  const payload = copy?.reviewed_payload;
  const demoObservation = !session ? sharedObservation(sharedCopyId) : null;
  if (!session && !demoObservation) notFound();
  const o = demoObservation ?? {
    id: sharedCopyId,
    title: String(payload?.title ?? 'Shared observation'),
    type: String(payload?.observation_type ?? 'Observation'),
    confidence: String(payload?.confidence ?? 'Unrated'),
    period: [payload?.observation_period_start, payload?.observation_period_end].filter((value) => typeof value === 'string').join(' – ') || 'Not provided',
    evidence: String(payload?.evidence_type ?? 'Not specified'),
    shared: String(payload?.body ?? ''),
  };

  return (
    <>
      <PageHeader
        title={o.title}
        crumbs={[{ label: 'Shared learning', href: '/portal/client/shared-learning' }, { label: 'Shared copy' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <Card className="max-w-3xl">
          <div className="flex flex-wrap gap-2">
            <Pill tone="grey">{o.type}</Pill>
            <Pill tone="mint">Confidence: {o.confidence}</Pill>
          </div>
          <dl className="mt-6 grid gap-5 sm:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Period</dt>
              <dd className="mt-1 text-sm text-az-text">{o.period}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Evidence type</dt>
              <dd className="mt-1 text-sm text-az-text">{o.evidence}</dd>
            </div>
            {session && <div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Reviewer-assessed evidence quality</dt><dd className="mt-1 text-sm capitalize text-az-text">{copy?.evidence_quality ?? 'Not assessed'}</dd></div>}
          </dl>
          <div className="mt-8">
            <SectionTitle>Reviewed shared text</SectionTitle>
            <p className="text-sm leading-relaxed text-az-text">
              {o.shared ?? 'No shared text is published for this contribution. Only the reviewed title and fields are shown.'}
            </p>
          </div>
          <div className="mt-8 border-t border-az-grey-bg pt-6">
            {session ? <div className="space-y-6"><BookmarkButton sharedCopyId={sharedCopyId} initialBookmarked={bookmarked} /><SharedCopyFeedback sharedCopyId={sharedCopyId} initialValue={null} /><ReportContributionForm sharedCopyId={sharedCopyId} /></div> : <div className="mt-4"><PillButton tone="outline" disabled>Report this contribution</PillButton><PreviewNote /></div>}
          </div>
          {session && <SharedComments sharedCopyId={sharedCopyId} initialComments={comments} />}
        </Card>
      </PortalContainer>
    </>
  );
}
