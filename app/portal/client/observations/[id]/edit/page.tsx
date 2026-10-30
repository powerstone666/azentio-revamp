import { PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';
import { ObservationForm } from '@/app/(ui)/components/portal/client/ObservationForm';
import { currentOrg, ownObservation } from '@/app/(ui)/components/portal/client/shared';
import { observationsOf } from '@/app/(config)/mock/portal';

export const instant = false;

export function generateStaticParams() {
  return observationsOf(currentOrg().id).map((o) => ({ id: o.id }));
}

interface Props {
  params: Promise<{ id: string }>;
}

export default async function EditObservationPage({ params }: Props) {
  const { id } = await params;
  const o = ownObservation(id);

  return (
    <>
      <PageHeader
        title="Edit observation"
        description={o.title}
        crumbs={[{ label: 'Observations', href: '/portal/client/observations' }, { label: o.title, href: `/portal/client/observations/${o.id}` }, { label: 'Edit' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <div className="mx-auto max-w-3xl">
          <ObservationForm
            mode="edit"
            initial={{
              title: o.title,
              type: o.type,
              description: o.source ?? '',
              period: o.period,
              evidence: o.evidence,
              scope: o.scope,
              consents: o.consents,
            }}
          />
        </div>
      </PortalContainer>
    </>
  );
}
