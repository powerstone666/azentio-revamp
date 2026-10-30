import { notFound } from 'next/navigation';
import { z } from 'zod';
import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { getAuthorContributionForEdit } from '@/app/api/(services)/contributions/service';
import { PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';
import { ObservationForm, type ObservationFormValues } from '@/app/(ui)/components/portal/client/ObservationForm';
import { currentOrg, ownObservation } from '@/app/(ui)/components/portal/client/shared';
import { observationsOf } from '@/app/(config)/mock/portal';

export const instant = false;

export function generateStaticParams() {
  return observationsOf(currentOrg().id).map((observation) => ({ id: observation.id }));
}

interface Props { params: Promise<{ id: string }> }

const emptyConsents = { a: false, b: false, c: false, d: false, e: false };

export default async function EditObservationPage({ params }: Props) {
  const session = await requirePortalPage('portal:client:read');
  const { id } = await params;
  let title: string;
  let initial: ObservationFormValues;
  if (session?.activeWorkspace) {
    const parsed = z.string().uuid().safeParse(id);
    if (!parsed.success) notFound();
    const record = await getAuthorContributionForEdit(parsed.data, session.user.id, session.activeWorkspace.orgId);
    if (!record) notFound();
    const payload = record.current_payload;
    const choices = record.consent_choices ?? {};
    title = String(payload.title ?? 'Untitled contribution');
    initial = {
      title,
      type: String(payload.observation_type ?? 'market_observation'),
      description: String(payload.body ?? ''),
      offering: String(payload.offering ?? ''),
      industry: String(payload.industry ?? ''),
      region: String(payload.region ?? ''),
      periodStart: String(payload.observation_period_start ?? ''),
      periodEnd: String(payload.observation_period_end ?? ''),
      evidence: String(payload.evidence_type ?? 'other'),
      confidence: String(payload.confidence ?? 'medium'),
      links: Array.isArray(payload.reference_links) ? payload.reference_links.map(String).join('\n') : '',
      scope: record.visibility === 'author' ? 'private' : record.visibility === 'org' ? 'org' : 'community',
      consents: {
        a: choices.store_process === true,
        b: choices.publish_reviewed === true,
        c: choices.attribute === true,
        d: choices.model_training === true,
        e: choices.semantic_analysis === true,
      },
    };
  } else {
    const observation = ownObservation(id);
    const mockType = observation.type.toLowerCase().replaceAll(' ', '_');
    title = observation.title;
    initial = {
      title: observation.title,
      type: mockType === 'trend' ? 'emerging_trend' : mockType,
      description: observation.source ?? '',
      offering: '',
      industry: '',
      region: '',
      periodStart: observation.period,
      periodEnd: '',
      evidence: 'other',
      confidence: observation.confidence.toLowerCase(),
      scope: observation.scope,
      consents: observation.consents ?? emptyConsents,
    };
  }

  return (
    <>
      <PageHeader
        title="Edit observation"
        description={title}
        crumbs={[{ label: 'Observations', href: '/portal/client/observations' }, { label: title, href: `/portal/client/observations/${id}` }, { label: 'Edit' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <div className="mx-auto max-w-3xl">
          <ObservationForm initial={initial} contributionId={session ? id : undefined} demoPreview={!session} />
        </div>
      </PortalContainer>
    </>
  );
}
