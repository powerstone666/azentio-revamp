import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listSupportAccessibleOrganizations, listSupportTicketsForOrganization } from '@/app/api/(services)/support/service';
import { listActiveClientOrganizations, listEligiblePortalAdmins, listSupportAccessGrants } from '@/app/api/(services)/support/access';
import { Card, PageHeader, PortalContainer, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { SupportTicketQueue } from '@/app/(ui)/components/portal/admin/SupportTicketQueue';
import { SupportAccessManager } from '@/app/(ui)/components/portal/admin/SupportAccessManager';

export const instant = false;

export default async function AdminSupportTicketsPage() {
  const session = await requirePortalPage('portal:admin:read');
  if (!session) return <>
    <PageHeader title="Support tickets" description="Private client support requests." crumbs={[{ label: 'Administration', href: '/portal/admin' }, { label: 'Support tickets' }]} />
    <PortalContainer className="py-8 md:py-10"><Card><p className="text-sm text-az-text-muted">Demo preview. Client support records require real administrator authorization and explicit support access.</p></Card><SyntheticNote /></PortalContainer>
  </>;
  const [organizations, clientOrganizations, admins, grants] = await Promise.all([
    listSupportAccessibleOrganizations(session.user.id),
    listActiveClientOrganizations(),
    listEligiblePortalAdmins(),
    listSupportAccessGrants(),
  ]);
  const initialOrgId = organizations[0]?.id ?? null;
  const initialTickets = initialOrgId
    ? await listSupportTicketsForOrganization(session.user.id, initialOrgId)
    : [];
  return <>
    <PageHeader title="Support tickets" description="Review client support requests only for organisations with active support authorisation." crumbs={[{ label: 'Administration', href: '/portal/admin' }, { label: 'Support tickets' }]} />
    <PortalContainer className="py-8 md:py-10"><SupportAccessManager organizations={clientOrganizations.map((org) => ({ id: String(org.id), name: String(org.name) }))} admins={admins.map((admin) => ({ id: String(admin.id), display_name: String(admin.display_name), email: String(admin.email) }))} initialGrants={grants.map((grant) => ({ ...grant, id: String(grant.id), org_id: String(grant.org_id), org_name: String(grant.org_name), portal_admin_id: String(grant.portal_admin_id), portal_admin_name: String(grant.portal_admin_name), portal_admin_email: String(grant.portal_admin_email), reason: String(grant.reason), is_active: Boolean(grant.is_active) }))} /><SupportTicketQueue organizations={organizations.map((org) => ({ id: String(org.id), name: String(org.name), expires_at: org.expires_at }))} initialOrgId={initialOrgId} initialTickets={initialTickets.map((ticket) => ({ ...ticket, id: String(ticket.id), requester: String(ticket.requester), subject: String(ticket.subject), details: String(ticket.details), category: String(ticket.category), status: String(ticket.status), priority: String(ticket.priority), created_at: new Date(String(ticket.created_at)), updated_at: new Date(String(ticket.updated_at)) }))} /></PortalContainer>
  </>;
}
