import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listIdeas } from '@/app/api/(services)/ideas/service';
import { listVisibleThemes } from '@/app/api/(services)/learning/shared-learning';
import Link from 'next/link';
import { IdeaStatusBadge } from '@/app/(ui)/components/portal/kit/Status';
import { PageHeader, PillLink, PortalContainer, StatTile, Table, Td, Th, Card } from '@/app/(ui)/components/portal/kit/ui';
import type { IdeaStatus } from '@/app/(common-lib)/types';
import { IDEAS, THEMES } from '@/app/(config)/mock/portal';
import { SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

export default async function ProductOwnerOverviewPage() {
  const session = await requirePortalPage('portal:product-owner:read');
  if (!session) {
    const visible = THEMES.filter((theme) => theme.shown);
    return <><PageHeader title="Product owner: FAI" description="Demo workspace with synthetic themes and improvement ideas." actions={<PillLink href="/portal/product-owner/ideas/new" tone="mint">New idea</PillLink>} /><PortalContainer className="py-8 md:py-10"><div className="grid gap-5 md:grid-cols-3"><StatTile label="Themes visible" value={visible.length} /><StatTile label="Ideas" value={IDEAS.length} /><StatTile label="Under review" value={IDEAS.filter((idea) => idea.status === 'Under review').length} /></div><div className="mt-8"><Table><thead><tr><Th>Title</Th><Th>Offering</Th><Th>Status</Th><Th>Owner</Th><Th><span className="sr-only">Open</span></Th></tr></thead><tbody>{IDEAS.map((idea) => <tr key={idea.id}><Td className="font-semibold text-az-navy">{idea.title}</Td><Td>{idea.offering}</Td><Td><IdeaStatusBadge status={idea.status} /></Td><Td>{idea.owner}</Td><Td><Link href={`/portal/product-owner/ideas/${idea.id}`} className="font-semibold text-az-navy underline decoration-az-mint decoration-2 underline-offset-4">Open</Link></Td></tr>)}</tbody></Table></div><SyntheticNote /></PortalContainer></>;
  }
  const offerings = [...new Set(session?.grants
    .filter((grant) => grant.role === 'product_owner'
      && (grant.org_id === session.activeWorkspace?.orgId || grant.org_id === null)
      && !grant.revoked_at
      && grant.offering_id)
    .map((grant) => grant.offering_id!) ?? [])];
  const sandboxOrgId = session.activeWorkspace?.isSandbox ? session.activeWorkspace.orgId : undefined;
  const [ideas, allThemes] = await Promise.all([listIdeas('internal', offerings, session.activeWorkspace?.orgId), listVisibleThemes(sandboxOrgId)]);
  const themes = allThemes.filter((theme) => !theme.offering || offerings.includes(String(theme.offering)));
  const underReview = ideas.filter((idea) => idea.status === 'Under review').length;

  return (
    <>
      <PageHeader
        title="Product owner workspace"
        description={`Assigned offerings: ${offerings.length ? offerings.join(', ') : 'None'}. Evidence and ideas are limited to your active assignments.`}
        actions={<PillLink href="/portal/product-owner/ideas/new" tone="mint">New idea</PillLink>}
      />
      <PortalContainer className="py-8 md:py-10">
        <div className="grid gap-5 md:grid-cols-3">
          <StatTile label="Visible themes" value={themes.length} hint="Threshold-qualified approved evidence" />
          <StatTile label="Assigned ideas" value={ideas.length} />
          <StatTile label="Under review" value={underReview} />
        </div>
        <div className="mt-8">
          {ideas.length === 0 ? (
            <Card><p className="text-sm text-az-text-muted">No improvement ideas are assigned to your workspace yet.</p></Card>
          ) : (
            <Table>
              <thead><tr><Th>Title</Th><Th>Offering</Th><Th>Status</Th><Th>Owner team</Th><Th><span className="sr-only">Open</span></Th></tr></thead>
              <tbody>{ideas.map((idea) => (
                <tr key={String(idea.id)}>
                  <Td className="font-semibold text-az-navy">{String(idea.title)}</Td>
                  <Td>{String(idea.offering ?? '—')}</Td>
                  <Td><IdeaStatusBadge status={String(idea.status) as IdeaStatus} /></Td>
                  <Td>{String(idea.owner_team || 'Unassigned')}</Td>
                  <Td><Link href={`/portal/product-owner/ideas/${idea.id}`} className="font-semibold text-az-navy underline decoration-az-mint decoration-2 underline-offset-4">Open<span className="sr-only"> {String(idea.title)}</span></Link></Td>
                </tr>
              ))}</tbody>
            </Table>
          )}
        </div>
      </PortalContainer>
    </>
  );
}
