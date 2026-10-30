import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listEmployeeKnowledge } from '@/app/api/(services)/employee/service';
import { KNOWLEDGE } from '@/app/(config)/mock/portal';
import { PageHeader, PortalContainer, Card, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import KnowledgeFeedback from '@/app/(ui)/components/portal/employee/KnowledgeFeedback';

export const instant = false;

export default async function EmployeeKnowledgePage() {
  const session = await requirePortalPage('portal:employee:read');
  if (!session) return <><PageHeader title="Knowledge library" description="Internal guides with owners and review dates. Employees only." crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Knowledge library' }]} /><PortalContainer className="py-8 md:py-10"><Card className="mb-8 border-l-4 border-az-navy"><p className="text-sm text-az-text">Demo preview. All displayed guide details are synthetic.</p></Card><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{KNOWLEDGE.map((item) => <Card key={item.id}><Pill tone="navy">Employees only</Pill><h2 className="mt-4 text-[18px] font-semibold text-az-navy">{item.title}</h2><p className="mt-3 text-sm text-az-text">Owner: {item.owner}</p><p className="mt-1 text-sm text-az-text-muted">{item.review}</p></Card>)}</div><SyntheticNote /></PortalContainer></>;

  const items = await listEmployeeKnowledge(session.user.id, session.activeWorkspace!.orgId);
  return <><PageHeader title="Knowledge library" description="Internal guides with accountable owners, review dates and employee feedback." crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Knowledge library' }]} /><PortalContainer className="py-8 md:py-10"><Card className="mb-8 border-l-4 border-az-navy"><div className="flex flex-wrap items-center gap-3"><Pill tone="navy">Employees only</Pill><p className="text-sm text-az-text">Published employee guides are isolated from client and public search and AIRA retrieval.</p></div></Card>{items.length === 0 ? <Card><p className="text-sm text-az-text-muted">No published employee guides are available yet.</p></Card> : <div className="grid gap-5 md:grid-cols-2">{items.map((item) => <Card key={String(item.id)}><div className="flex items-start justify-between gap-3"><h2 className="text-[18px] font-semibold text-az-navy">{String(item.title)}</h2><Pill tone="navy">Employees only</Pill></div><p className="mt-4 whitespace-pre-wrap text-sm leading-relaxed text-az-text">{String(item.body)}</p><p className="mt-4 text-xs text-az-text-muted">Owner: {String(item.owner)} · Review by {new Date(String(item.review_at)).toLocaleDateString()}</p><KnowledgeFeedback itemId={String(item.id)} initialHelpful={typeof item.my_helpful === 'boolean' ? item.my_helpful : null} initialNote={String(item.my_note ?? '')} /></Card>)}</div>}</PortalContainer></>;
}
