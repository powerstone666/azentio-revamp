import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listClientResources } from '@/app/api/(services)/resources/service';
import { Card, PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

export default async function ClientResourcesPage() {
  const session = await requirePortalPage('portal:client:read');
  const resources = session?.activeWorkspace?.orgType === 'client'
    ? await listClientResources(session.activeWorkspace.orgId)
    : [];
  return <>
    <PageHeader title="Resources for your organisation" description="Guides and links assigned to your active workspace." crumbs={[{ label: 'Client dashboard', href: '/portal/client' }, { label: 'Resources' }]} />
    <PortalContainer className="py-8 md:py-10">
      {resources.length === 0
        ? <Card><p className="text-sm text-az-text-muted">No resources are currently assigned to this organisation.</p></Card>
        : <ul className="grid gap-5 md:grid-cols-2">{resources.map((item) => <li key={String(item.id)}><Card className="h-full"><p className="text-xs font-semibold uppercase tracking-wide text-az-text-muted">{String(item.category)}{item.offering_id ? ` · ${String(item.offering_id)}` : ''}</p><h2 className="mt-3 text-lg font-semibold text-az-navy">{String(item.title)}</h2><p className="mt-2 text-sm leading-relaxed text-az-text">{String(item.description || 'Resource for your organisation.')}</p><a href={String(item.resource_url)} target="_blank" rel="noopener noreferrer" className="mt-5 inline-flex rounded-full border border-az-navy px-4 py-2 text-sm font-semibold text-az-navy underline-offset-4 hover:underline">Open resource<span className="sr-only"> {String(item.title)}</span></a></Card></li>)}</ul>}
    </PortalContainer>
  </>;
}
