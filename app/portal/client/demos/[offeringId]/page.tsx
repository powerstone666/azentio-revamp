import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { getSandboxDemo } from '@/app/(config)/sandbox';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listSandboxRuns } from '@/app/api/(services)/sandbox/service';
import { SandboxDemoRunner } from '@/app/(ui)/components/portal/client/SandboxDemoRunner';
import { notFound } from 'next/navigation';
import { Card, PageHeader, PortalContainer, SectionTitle, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { currentOrg } from '@/app/(ui)/components/portal/client/shared';
import { demosFor } from '@/app/(config)/mock/portal';

export const instant = false;

export function generateStaticParams() {
  return demosFor(currentOrg()).map((d) => ({ offeringId: d.id }));
}

interface Props {
  params: Promise<{ offeringId: string }>;
}

const STEPS = [
  { title: 'Choose a synthetic scenario', body: 'Pick one of the prepared borrowers or accounts. All of them are invented.' },
  { title: 'Run the sandbox', body: 'The sandbox applies the offering to the scenario and produces a simulated output.' },
  { title: 'Review the simulated output', body: 'Read the output and its reasoning notes. It is for learning, not for a credit or compliance decision.' },
];

export default async function ClientDemoRunnerPage({ params }: Props) {
  const session = await requirePortalPage('portal:client:read');
  const { offeringId } = await params;
  if (session?.activeWorkspace) {
    const sandbox = getSandboxDemo(offeringId);
    if (!sandbox) notFound();
    const permission = await authorize({
      action: 'demo:run',
      resource: { type: 'sandbox', offeringId: sandbox.id, feature: 'sandbox', requireEntitlement: true },
    });
    if (!permission.allowed) notFound();
    const runs = await listSandboxRuns(session.activeWorkspace.orgId, session.user.id, sandbox.id);
    return (
      <>
        <PageHeader title={sandbox.name} description={sandbox.blurb} crumbs={[{ label: 'Sandbox demos', href: '/portal/client/demos' }, { label: sandbox.id }]} />
        <PortalContainer className="py-8 md:py-10"><SandboxDemoRunner demo={sandbox} initialRuns={runs} /></PortalContainer>
      </>
    );
  }
  const demo = demosFor(currentOrg()).find((d) => d.id === offeringId);
  if (!demo) notFound();

  return (
    <>
      <PageHeader
        title={demo.name}
        description={demo.blurb}
        crumbs={[{ label: 'Sandbox demos', href: '/portal/client/demos' }, { label: demo.offering }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <div role="note" className="rounded-[12px] border-l-4 border-az-navy bg-az-grey-bg/60 px-5 py-4 text-sm font-semibold text-az-navy">
          Simulated with synthetic data. Not a decision.
        </div>

        <section className="mt-10" aria-labelledby="guided-heading">
          <SectionTitle>
            <span id="guided-heading">Guided sandbox</span>
          </SectionTitle>
          <ol className="grid gap-5 md:grid-cols-3">
            {STEPS.map((s, i) => (
              <li key={s.title}>
                <Card className="h-full">
                  <p className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">Step {i + 1}</p>
                  <h3 className="mt-2 text-base font-semibold text-az-navy">{s.title}</h3>
                  <p className="mt-2 text-sm text-az-text">{s.body}</p>
                </Card>
              </li>
            ))}
          </ol>
          <p className="mt-4 text-xs text-az-text-muted">The steps are shown for orientation. The sandbox does not run in this preview.</p>
        </section>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
