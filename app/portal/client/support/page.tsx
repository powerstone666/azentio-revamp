import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listClientSupportTickets } from '@/app/api/(services)/support/service';
import { PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';
import { SupportTickets } from '@/app/(ui)/components/portal/client/SupportTickets';

export const instant = false;

export default async function ClientSupportPage() {
  const session = await requirePortalPage('portal:client:read');
  const header = <PageHeader title="Support" description="Raise a request with Azentio and follow its status." crumbs={[{ label: 'Client dashboard', href: '/portal/client' }, { label: 'Support' }]} />;

  if (!session?.activeWorkspace) {
    return <>
      {header}
      <PortalContainer className="py-8 md:py-10">
        <section className="rounded-2xl border border-az-grey-bg bg-white p-5" aria-label="Support tickets demo preview">
          <h2 className="font-semibold text-az-navy">Support requests</h2>
          <p className="mt-2 text-sm text-az-text-muted">Demo preview: ticket submission and status tracking are available for signed-in client workspaces.</p>
        </section>
      </PortalContainer>
    </>;
  }

  const supportTickets = await listClientSupportTickets(session.user.id, session.activeWorkspace.orgId);
  return <>
    {header}
    <PortalContainer className="py-8 md:py-10">
      <SupportTickets
        initialTickets={supportTickets.map((ticket) => ({ ...ticket, id: String(ticket.id), subject: String(ticket.subject), details: String(ticket.details), category: String(ticket.category), status: String(ticket.status), priority: String(ticket.priority), requester: String(ticket.requester) }))}
        canSeeOrgTickets={session.activeWorkspace.role === 'client_admin'}
        providerConnected={Boolean(process.env.SUPPORT_TICKETS_WEBHOOK_URL && process.env.SUPPORT_TICKETS_WEBHOOK_TOKEN)}
      />
    </PortalContainer>
  </>;
}
