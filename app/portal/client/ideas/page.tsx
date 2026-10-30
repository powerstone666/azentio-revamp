import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listIdeas } from '@/app/api/(services)/ideas/service';
import { Card, PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';
import { IdeaStatusBadge } from '@/app/(ui)/components/portal/kit/Status';
import { clientAuditTime, clientIdeas } from '@/app/(ui)/components/portal/client/shared';

export const instant = false;

export default async function ClientIdeasPage() {
  const session = await requirePortalPage('portal:client:read');
  const ideas = session
    ? (await listIdeas('client', [], session.activeWorkspace!.orgId)).map((idea) => ({
        id: String(idea.id),
        offering: String(idea.offering ?? 'Product'),
        title: String(idea.title),
        clientText: String(idea.client_update || 'The product team is evaluating this idea.'),
        status: String(idea.status) as Parameters<typeof IdeaStatusBadge>[0]['status'],
        ownerTeam: String(idea.owner_team ?? ''),
        updated: new Date(String(idea.updated_at)).toLocaleDateString(),
      }))
    : clientIdeas();

  return (
    <>
      <PageHeader
        title="Improvement ideas"
        description="Ideas that draw on shared learning, with their current status and a short client-facing update. Status is not a delivery commitment."
      />
      <PortalContainer className="py-8 md:py-10">
        <ul className="space-y-5">
          {ideas.map((i) => (
            <li key={i.id}>
              <Card className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
                <div className="max-w-2xl">
                  <p className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">{i.offering}</p>
                  <h2 className="mt-1 text-lg font-semibold text-az-navy">{i.title}</h2>
                  <p className="mt-2 text-sm text-az-text">{i.clientText}</p>
                  {'ownerTeam' in i && i.ownerTeam && <p className="mt-2 text-xs text-az-text-muted">Owner: {i.ownerTeam}</p>}
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                  <IdeaStatusBadge status={i.status} />
                  <span className="text-xs text-az-text-muted">Last update: {'updated' in i ? i.updated : clientAuditTime(i)}</span>
                </div>
              </Card>
            </li>
          ))}
        </ul>
      </PortalContainer>
    </>
  );
}
