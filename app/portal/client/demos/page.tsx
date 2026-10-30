import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { SANDBOX_DEMOS } from '@/app/(config)/sandbox';
import { listEntitledSandboxDemos } from '@/app/api/(services)/sandbox/service';
import { Card, PageHeader, PillLink, PortalContainer, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { currentOrg } from '@/app/(ui)/components/portal/client/shared';
import { demosFor } from '@/app/(config)/mock/portal';

export const instant = false;

export default async function ClientDemosPage() {
  const session = await requirePortalPage('portal:client:read');
  const demos = session?.activeWorkspace
    ? (await listEntitledSandboxDemos(session.activeWorkspace.orgId))
        .flatMap((offeringId) => {
          const demo = SANDBOX_DEMOS.find((item) => item.id === offeringId);
          return demo ? [demo] : [];
        })
    : demosFor(currentOrg());

  return (
    <>
      <PageHeader
        title="Sandbox demos"
        description="Entitled product demonstrations run with deterministic synthetic scenarios. No customer data is uploaded."
      />
      <PortalContainer className="py-8 md:py-10">
        {demos.length === 0 ? (
          <p className="text-sm text-az-text-muted">No demos are entitled to your organisation.</p>
        ) : (
          <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
            {demos.map((d) => (
              <Card key={d.id} className="flex flex-col">
                <p className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">{'offering' in d ? d.offering : d.id}</p>
                <h2 className="mt-2 text-lg font-semibold text-az-navy">{d.name}</h2>
                <p className="mt-2 flex-1 text-sm text-az-text">{d.blurb}</p>
                <div className="mt-5">
                  <PillLink href={`/portal/client/demos/${d.id}`} tone="outline">Open demo</PillLink>
                </div>
              </Card>
            ))}
          </div>
        )}
        {!session && <SyntheticNote />}
      </PortalContainer>
    </>
  );
}
