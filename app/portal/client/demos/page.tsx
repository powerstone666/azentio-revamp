import { Card, PageHeader, PillLink, PortalContainer, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { currentOrg } from '@/app/(ui)/components/portal/client/shared';
import { demosFor } from '@/app/(config)/mock/portal';

export default function ClientDemosPage() {
  const demos = demosFor(currentOrg());

  return (
    <>
      <PageHeader
        title="Sandbox demos"
        description="Sandboxes and guided demonstrations for the offerings your organisation is entitled to. Everything runs on synthetic data."
      />
      <PortalContainer className="py-8 md:py-10">
        {demos.length === 0 ? (
          <p className="text-sm text-az-text-muted">No demos are entitled to your organisation.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {demos.map((d) => (
              <Card key={d.id} className="flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">{d.offering}</p>
                <h2 className="mt-2 text-lg font-semibold text-az-navy">{d.name}</h2>
                <p className="mt-2 flex-1 text-sm text-az-text">{d.blurb}</p>
                <div className="mt-5">
                  <PillLink href={`/portal/client/demos/${d.id}`} tone="outline">Open demo</PillLink>
                </div>
              </Card>
            ))}
          </div>
        )}
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
