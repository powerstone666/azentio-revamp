import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { getVisibleTheme, listVisibleThemes } from '@/app/api/(services)/learning/shared-learning';
import { PageHeader, PortalContainer, Card, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import IdeaForm, { type EvidenceOption } from '@/app/(ui)/components/portal/staff/IdeaForm';

export const instant = false;

export default async function ProductOwnerNewIdeaPage() {
  const session = await requirePortalPage('portal:product-owner:read');
  if (!session) return <><PageHeader title="New idea" description="Demo mode uses synthetic themes and does not save." crumbs={[{ label: 'Product owner', href: '/portal/product-owner' }, { label: 'New idea' }]} /><PortalContainer className="py-8 md:py-10"><Card className="mx-auto max-w-3xl"><p className="text-sm text-az-text-muted">Demo idea submission is a preview. Sign in with a real assigned product-owner account to create a database-backed idea.</p></Card><SyntheticNote /></PortalContainer></>;

  const offerings = [...new Set(session.grants.filter((grant) => grant.role === 'product_owner'
    && (grant.org_id === session.activeWorkspace?.orgId || grant.org_id === null)
    && !grant.revoked_at
    && grant.offering_id).map((grant) => grant.offering_id!))];
  const sandboxOrgId = session.activeWorkspace?.isSandbox ? session.activeWorkspace.orgId : undefined;
  const themes = (await listVisibleThemes(sandboxOrgId)).filter((theme) => offerings.includes(String(theme.offering)));
  const detail = await Promise.all(themes.map((theme) => getVisibleTheme(String(theme.id), sandboxOrgId)));
  const evidence: EvidenceOption[] = detail.flatMap((theme) => theme?.evidence.map((item) => ({
    id: String(item.contribution_id),
    title: String(item.title ?? 'Approved contribution'),
    offering: String(theme.offering ?? ''),
    theme: String(theme.title),
  })) ?? []);
  const uniqueEvidence = [...new Map(evidence.map((item) => [item.id, item])).values()];
  return <><PageHeader title="New idea" description="Create an improvement proposal linked to approved evidence in your assigned offering." crumbs={[{ label: 'Product owner', href: '/portal/product-owner' }, { label: 'New idea' }]} /><PortalContainer className="py-8 md:py-10"><Card className="mx-auto max-w-3xl"><IdeaForm offerings={offerings} evidence={uniqueEvidence} /></Card></PortalContainer></>;
}
