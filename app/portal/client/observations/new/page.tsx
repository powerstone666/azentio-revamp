import { PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';
import { ObservationForm } from '@/app/(ui)/components/portal/client/ObservationForm';

export default function NewObservationPage() {
  return (
    <>
      <PageHeader
        title="New observation"
        description="Describe a pattern you have seen in general terms. Choose who may see it and what you consent to."
        crumbs={[{ label: 'Observations', href: '/portal/client/observations' }, { label: 'New' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <div className="mx-auto max-w-3xl">
          <ObservationForm mode="new" />
        </div>
      </PortalContainer>
    </>
  );
}
