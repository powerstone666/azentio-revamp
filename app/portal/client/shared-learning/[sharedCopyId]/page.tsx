import { Card, PageHeader, PillButton, PortalContainer, SectionTitle } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { PreviewNote } from '@/app/(ui)/components/portal/client/PreviewNote';
import { sharedObservation, sharedObservations } from '@/app/(ui)/components/portal/client/shared';

export const instant = false;

export function generateStaticParams() {
  return sharedObservations().map((o) => ({ sharedCopyId: o.id }));
}

interface Props {
  params: Promise<{ sharedCopyId: string }>;
}

export default async function SharedCopyDetailPage({ params }: Props) {
  const { sharedCopyId } = await params;
  const o = sharedObservation(sharedCopyId);

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
          </dl>
          <div className="mt-8">
            <SectionTitle>Reviewed shared text</SectionTitle>
            <p className="text-sm leading-relaxed text-az-text">
              {o.shared ?? 'No shared text is published for this contribution. Only the reviewed title and fields are shown.'}
            </p>
          </div>
          <div className="mt-8 border-t border-az-grey-bg pt-6">
            <PillButton tone="outline" disabled>Report this contribution</PillButton>
            <div className="mt-4">
              <PreviewNote />
            </div>
          </div>
        </Card>
      </PortalContainer>
    </>
  );
}
