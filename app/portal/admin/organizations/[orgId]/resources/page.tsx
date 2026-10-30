import { notFound } from 'next/navigation';
import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listAdminOrganizations } from '@/app/api/(services)/admin/service';
import { listAdminClientResources } from '@/app/api/(services)/resources/service';
import { ClientResourceManager, type ClientResourceRow } from '@/app/(ui)/components/portal/admin/ClientResourceManager';
import { PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

export default async function ClientResourceAdminPage({ params }: { params: Promise<{ orgId: string }> }) {
  const session = await requirePortalPage('portal:admin:read');
  const { orgId } = await params;
  if (!session) notFound();
  const org = (await listAdminOrganizations()).find((row) => String(row.id) === orgId && row.type === 'client');
  if (!org) notFound();
  const resources = await listAdminClientResources(orgId);
  const offerings = Array.isArray(org.entitlements)
    ? [...new Set((org.entitlements as Array<{ offering_id: string }>).map((item) => item.offering_id))]
    : [];
  return <>
    <PageHeader title={`Resources · ${String(org.name)}`} description="Assign tenant-only links and guides. Offering-scoped resources are visible only to currently entitled members." crumbs={[{ label: 'Administration', href: '/portal/admin' }, { label: 'Organisations', href: '/portal/admin/organizations' }, { label: String(org.name) }]} />
    <PortalContainer className="py-8 md:py-10"><ClientResourceManager orgId={orgId} offerings={offerings} initialResources={resources.map((row) => ({ ...row, id: String(row.id), title: String(row.title), description: String(row.description), category: String(row.category), resource_url: String(row.resource_url), offering_id: row.offering_id ? String(row.offering_id) : null, status: row.status as 'active' | 'archived' })) as ClientResourceRow[]} /></PortalContainer>
  </>;
}
