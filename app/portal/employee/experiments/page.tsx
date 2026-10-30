import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listEmployeeExperiments } from '@/app/api/(services)/employee/service';
import { EXPERIMENTS } from '@/app/(config)/mock/portal';
import { PageHeader, PortalContainer, Card, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import ExperimentSubmissionForm from '@/app/(ui)/components/portal/employee/ExperimentSubmissionForm';

export const instant = false;

export default async function EmployeeExperimentsPage() {
  const session = await requirePortalPage('portal:employee:read');
  if (!session) return <><PageHeader title="Experiments" description="Internal prototypes and hackathon ideas. Employees only." crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Experiments' }]} /><PortalContainer className="py-8 md:py-10"><Card className="mb-6"><p className="text-sm text-az-text">Demo preview. All displayed experiment data is synthetic.</p></Card><div className="grid gap-4 md:grid-cols-2">{EXPERIMENTS.map((item) => <Card key={item.id}><div className="flex items-center justify-between gap-3"><h2 className="font-semibold text-az-navy">{item.name}</h2><Pill tone="mint">{item.status}</Pill></div><p className="mt-2 text-sm text-az-text">{item.note}</p><p className="mt-3 text-xs text-az-text-muted">Owner: {item.owner}</p></Card>)}</div><SyntheticNote /></PortalContainer></>;

  const experiments = await listEmployeeExperiments(session.activeWorkspace!.orgId);
  return <><PageHeader title="Experiments" description="Internal prototypes and hackathon ideas. Employees only." crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Experiments' }]} /><PortalContainer className="py-8 md:py-10"><Card className="mb-6 border-l-4 border-az-navy"><div className="flex flex-wrap items-center gap-3"><Pill tone="navy">Employees only</Pill><p className="text-sm text-az-text">These submissions stay inside the employee workspace and are not exposed to clients, public search or AIRA.</p></div></Card><div className="grid items-start gap-6 lg:grid-cols-[1fr_1.2fr]"><ExperimentSubmissionForm /><div className="space-y-4">{experiments.length === 0 ? <Card><p className="text-sm text-az-text-muted">No employee experiments have been submitted yet.</p></Card> : experiments.map((item) => <Card key={String(item.id)}><div className="flex flex-wrap items-center justify-between gap-3"><h2 className="font-semibold text-az-navy">{String(item.title)}</h2><Pill tone="mint">{String(item.status).replaceAll('_', ' ')}</Pill></div><p className="mt-2 text-sm text-az-text">{String(item.problem_statement)}</p><p className="mt-3 text-xs text-az-text-muted">{String(item.offering)} · Submitted by {String(item.owner)} · {new Date(String(item.created_at)).toLocaleDateString()}</p></Card>)}</div></div></PortalContainer></>;
}
