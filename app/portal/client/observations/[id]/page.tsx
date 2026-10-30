import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { getContributionCurrentConsents, getLatestClarification, getWorkspaceContribution } from '@/app/api/(services)/contributions/service';
import { ContributionActions } from '@/app/(ui)/components/portal/client/ContributionActions';
import { ConsentRevocationButton } from '@/app/(ui)/components/portal/client/ConsentRevocationButton';
import { PageHeader, PillButton, PortalContainer, Card, SectionTitle, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { Pill, ObsStatus } from '@/app/(ui)/components/portal/kit/Status';
import { PreviewNote } from '@/app/(ui)/components/portal/client/PreviewNote';
import { CONSENT_ITEMS, currentOrg, ownObservation } from '@/app/(ui)/components/portal/client/shared';
import { SCOPE_LABEL, observationsOf } from '@/app/(config)/mock/portal';
import { notFound } from 'next/navigation';
import { z } from 'zod';

export const instant = false;

export function generateStaticParams() {
  return observationsOf(currentOrg().id).map((o) => ({ id: o.id }));
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function ObservationDetailPage({ params }: Props) {
  const session = await requirePortalPage('portal:client:read');
  const { id } = await params;
  if (session?.activeWorkspace) {
    const parsedId = z.string().uuid().safeParse(id);
    if (!parsedId.success) notFound();
    const record = await getWorkspaceContribution(parsedId.data, session.user.id, session.activeWorkspace.orgId);
    if (!record) notFound();
    const payload = record.current_payload as Record<string, unknown>;
    const shared = record.shared_payload as Record<string, unknown> | null;
    const isAuthor = record.author_user_id === session.user.id;
    const choices = isAuthor ? (await getContributionCurrentConsents(parsedId.data, session.user.id))?.choices ?? {} : {};
    const clarification = isAuthor && record.state === 'needs_clarification'
      ? await getLatestClarification(parsedId.data)
      : null;
    const periodStart = String(payload.observation_period_start ?? '');
    const periodEnd = String(payload.observation_period_end ?? '');
    const period = periodStart || periodEnd ? `${periodStart || '—'} – ${periodEnd || '—'}` : 'Not provided';
    return (
      <>
        <PageHeader title={String(payload.title ?? 'Contribution')} crumbs={[{ label: 'Observations', href: '/portal/client/observations' }, { label: parsedId.data }]} actions={<ContributionActions id={parsedId.data} state={String(record.state)} isAuthor={isAuthor} />} />
        <PortalContainer className="py-8 md:py-10">
          <Card>
            <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Status</dt><dd className="mt-2"><ObsStatus state={String(record.state) as Parameters<typeof ObsStatus>[0]['state']} /></dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Scope</dt><dd className="mt-2 text-sm text-az-text">{SCOPE_LABEL[record.visibility === 'author' ? 'private' : record.visibility === 'org' ? 'org' : 'community']}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Version</dt><dd className="mt-2 text-sm text-az-text">{String(record.version)}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Updated</dt><dd className="mt-2 text-sm text-az-text">{new Date(String(record.updated_at)).toLocaleString()}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Type</dt><dd className="mt-2 text-sm text-az-text">{String(payload.observation_type ?? 'Observation')}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Period</dt><dd className="mt-2 text-sm text-az-text">{period}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Evidence</dt><dd className="mt-2 text-sm text-az-text">{String(payload.evidence_type ?? 'Not specified')}</dd></div>
              <div><dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Confidence</dt><dd className="mt-2 text-sm text-az-text">{String(payload.confidence ?? 'Not rated')}</dd></div>
            </dl>
            {clarification?.decision_note && <div className="mt-6 rounded-[12px] border-l-4 border-az-green bg-az-mint-tint p-4"><p className="font-semibold text-az-navy">Moderator requested clarification</p><p className="mt-2 whitespace-pre-line text-sm text-az-text">{clarification.decision_note}</p></div>}
            {isAuthor && <div className="mt-8 border-t border-az-grey-bg pt-6">
              <h2 className="text-base font-semibold text-az-navy">Your consent choices for this version</h2>
              <ul className="mt-3 divide-y divide-az-grey-bg">{CONSENT_ITEMS.map((item) => {
                const purpose = ({ a: 'store_process', b: 'publish_reviewed', c: 'attribute', d: 'model_training', e: 'semantic_analysis' } as const)[item.key];
                return <li key={item.key} className="flex flex-wrap items-center justify-between gap-3 py-3"><span className="text-sm text-az-text">{item.label}</span><span className="flex items-center gap-3">{choices[purpose] ? <Pill tone="mint">Granted</Pill> : <Pill>Not granted</Pill>}{choices[purpose] && <ConsentRevocationButton contributionId={parsedId.data} purpose={purpose} />}</span></li>;
              })}</ul>
            </div>}
          </Card>
          <div className="mt-8 grid gap-6 md:grid-cols-2">
            <Card><SectionTitle>{isAuthor ? 'Private source' : 'Organisation contribution'}</SectionTitle><p className="whitespace-pre-line text-sm leading-relaxed text-az-text">{String(payload.body ?? 'No source text is stored.')}</p></Card>
            <Card><SectionTitle>Reviewed shared copy</SectionTitle><p className="whitespace-pre-line text-sm leading-relaxed text-az-text">{String(shared?.body ?? 'No shared copy has been published.')}</p></Card>
          </div>
        </PortalContainer>
      </>
    );
  }
  const o = ownObservation(id);

  return (
    <>
      <PageHeader
        title={o.title}
        crumbs={[{ label: 'Observations', href: '/portal/client/observations' }, { label: o.id }]}
        actions={
          <>
            <PillButton tone="outline" disabled>Edit</PillButton>
            <PillButton tone="outline" disabled>Withdraw</PillButton>
          </>
        }
      />
      <PortalContainer className="py-8 md:py-10">
        <Card>
          <dl className="grid gap-x-8 gap-y-5 sm:grid-cols-2 lg:grid-cols-4">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Status</dt>
              <dd className="mt-2"><ObsStatus state={o.state} /></dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Scope</dt>
              <dd className="mt-2 text-sm text-az-text">{SCOPE_LABEL[o.scope]}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Version</dt>
              <dd className="mt-2 text-sm text-az-text">{o.version}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Updated</dt>
              <dd className="mt-2 text-sm text-az-text">{o.updated}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Type</dt>
              <dd className="mt-2 text-sm text-az-text">{o.type}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Period</dt>
              <dd className="mt-2 text-sm text-az-text">{o.period}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Evidence</dt>
              <dd className="mt-2 text-sm text-az-text">{o.evidence}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Confidence</dt>
              <dd className="mt-2 text-sm text-az-text">{o.confidence}</dd>
            </div>
          </dl>

          <div className="mt-8 border-t border-az-grey-bg pt-6">
            <h2 className="text-base font-semibold text-az-navy">Consents</h2>
            <ul className="mt-3 divide-y divide-az-grey-bg">
              {CONSENT_ITEMS.map((c) => {
                const granted = o.consents[c.key];
                return (
                  <li key={c.key} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="text-sm text-az-text">({c.key}) {c.label}</span>
                    {granted ? <Pill tone="mint">Granted</Pill> : <Pill>Not granted</Pill>}
                  </li>
                );
              })}
            </ul>
          </div>

          {o.flagged && o.flagged.length > 0 && (
            <div className="mt-6 rounded-[12px] border-l-4 border-az-error bg-az-grey-bg/60 p-4 text-sm text-az-text">
              <p className="font-semibold text-az-error">Automatic checks flagged this text</p>
              <ul className="mt-2 list-disc pl-5">
                {o.flagged.map((f) => <li key={f}>{f}</li>)}
              </ul>
            </div>
          )}
        </Card>

        <div className="mt-8 grid gap-6 md:grid-cols-2">
          <Card>
            <SectionTitle>Private source</SectionTitle>
            <p className="whitespace-pre-line text-sm leading-relaxed text-az-text">
              {o.source ?? 'No private source text is stored for this observation.'}
            </p>
          </Card>
          <Card>
            <SectionTitle>Shared copy</SectionTitle>
            <p className="whitespace-pre-line text-sm leading-relaxed text-az-text">
              {o.shared ?? (o.state === 'published' ? 'Published without a shared text.' : 'Not published. A shared copy appears only after moderator review.')}
            </p>
          </Card>
        </div>

        {o.note && (
          <Card className="mt-8">
            <h2 className="text-base font-semibold text-az-navy">Note</h2>
            <p className="mt-2 text-sm text-az-text">{o.note}</p>
          </Card>
        )}

        <div className="mt-8">
          <PreviewNote />
        </div>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
