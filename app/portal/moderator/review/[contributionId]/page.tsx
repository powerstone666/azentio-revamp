import { notFound } from 'next/navigation';
import { OBSERVATIONS, SCOPE_LABEL, getObservation, orgById } from '@/app/(config)/mock/portal';
import { ObsStatus } from '@/app/(ui)/components/portal/kit/Status';
import { Card, PageHeader, PillButton, PortalContainer, SectionTitle, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { EVIDENCE_QUALITY, REASON_CODES, REDACTION_RULES, isFlagged, isReviewable } from '@/app/(ui)/components/portal/staff/rules';
import { PreviewNote } from '@/app/(ui)/components/portal/staff/PreviewNote';
import ReviewEditor from '@/app/(ui)/components/portal/staff/ReviewEditor';

export const instant = false;

interface Props {
  params: Promise<{ contributionId: string }>;
}

export function generateStaticParams() {
  return OBSERVATIONS.filter(isReviewable).map((o) => ({ contributionId: o.id }));
}

export default async function ModeratorReviewPage({ params }: Props) {
  const { contributionId } = await params;
  const obs = getObservation(contributionId);
  // Private drafts are never visible to moderators.
  if (!obs || !isReviewable(obs)) notFound();

  const org = orgById(obs.orgId);
  const flags = obs.flagged ?? [];

  return (
    <>
      <PageHeader
        title={obs.title}
        crumbs={[
          { label: 'Learning moderation', href: '/portal/moderator' },
          { label: 'Review queue', href: '/portal/moderator/queue' },
          { label: obs.id },
        ]}
        actions={<ObsStatus state={obs.state} />}
      />
      <PortalContainer className="py-8 md:py-10">
        <Card className="mb-6">
          <dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2 lg:grid-cols-4">
            <div><dt className="text-az-text-muted">Organisation</dt><dd className="font-semibold text-az-navy">{org?.name}</dd></div>
            <div><dt className="text-az-text-muted">Author</dt><dd className="font-semibold text-az-navy">{obs.author}</dd></div>
            <div><dt className="text-az-text-muted">Type</dt><dd className="font-semibold text-az-navy">{obs.type}</dd></div>
            <div><dt className="text-az-text-muted">Period</dt><dd className="font-semibold text-az-navy">{obs.period}</dd></div>
            <div><dt className="text-az-text-muted">Evidence</dt><dd className="font-semibold text-az-navy">{obs.evidence}</dd></div>
            <div><dt className="text-az-text-muted">Confidence</dt><dd className="font-semibold text-az-navy">{obs.confidence}</dd></div>
            <div><dt className="text-az-text-muted">Requested scope</dt><dd className="font-semibold text-az-navy">{SCOPE_LABEL[obs.scope]}</dd></div>
            <div><dt className="text-az-text-muted">Version</dt><dd className="font-semibold text-az-navy">{obs.version}</dd></div>
          </dl>
          {obs.note && <p className="mt-5 rounded-[12px] bg-az-mint-tint px-4 py-3 text-sm text-az-navy">{obs.note}</p>}
        </Card>

        <div className="grid gap-6 lg:grid-cols-2">
          <Card>
            <SectionTitle>Private source (author and moderator only)</SectionTitle>
            {obs.source ? (
              <p className="whitespace-pre-line text-[15px] leading-relaxed text-az-text">{obs.source}</p>
            ) : (
              <p className="text-[15px] text-az-text-muted">No source text in this record</p>
            )}
            {flags.length > 0 && (
              <div className="mt-6 rounded-[12px] border-l-4 border-az-error bg-az-mint-tint p-4">
                <p className="mb-2 text-sm font-semibold text-az-navy">Flagged reasons</p>
                <ul className="list-disc space-y-1 pl-5 text-sm text-az-text">
                  {flags.map((f) => <li key={f}>{f}</li>)}
                </ul>
              </div>
            )}
            {!isFlagged(obs) && <p className="mt-6 text-sm text-az-text-muted">The sensitive-content scan found nothing.</p>}
          </Card>

          <Card>
            <SectionTitle>Shared copy (editable)</SectionTitle>
            <ReviewEditor initial={obs.shared ?? ''} />
          </Card>
        </div>

        <Card className="mt-6">
          <SectionTitle>Redaction rules</SectionTitle>
          <ul className="list-disc space-y-2 pl-5 text-[15px] text-az-text">
            {REDACTION_RULES.map((r) => <li key={r}>{r}</li>)}
          </ul>

          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <div>
              <label htmlFor="reason-code" className="mb-1.5 block text-sm font-semibold text-az-navy">Reason code</label>
              <select id="reason-code" disabled className="w-full rounded-[12px] border border-az-grey-bg bg-az-grey-bg/60 px-4 py-3 text-[15px] text-az-text">
                {REASON_CODES.map((r) => <option key={r}>{r}</option>)}
              </select>
            </div>
            <div>
              <label htmlFor="evidence-quality" className="mb-1.5 block text-sm font-semibold text-az-navy">Evidence quality</label>
              <select id="evidence-quality" disabled className="w-full rounded-[12px] border border-az-grey-bg bg-az-grey-bg/60 px-4 py-3 text-[15px] text-az-text">
                {EVIDENCE_QUALITY.map((q) => <option key={q}>{q}</option>)}
              </select>
            </div>
          </div>

          <div className="mt-8 flex flex-wrap gap-3">
            <PillButton tone="mint" disabled>Approve and publish</PillButton>
            <PillButton tone="outline" disabled>Ask for clarification</PillButton>
            <PillButton tone="outline" disabled>Return for edit</PillButton>
            <PillButton tone="navy" disabled>Reject</PillButton>
          </div>
          <div className="mt-4">
            <PreviewNote>Preview build: nothing is saved. Decisions are disabled.</PreviewNote>
          </div>
          <p className="mt-4 text-sm text-az-text-muted">The sensitive-content scan is a helper, not a guarantee. You decide.</p>
        </Card>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
