import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listProductOwnerThemePriorities, listVisibleThemes } from '@/app/api/(services)/learning/shared-learning';
import { THEMES } from '@/app/(config)/mock/portal';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { Card, PageHeader, PortalContainer, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

export default async function ProductOwnerThemesPage() {
  const session = await requirePortalPage('portal:product-owner:read');
  if (!session) return <><PageHeader title="Themes" description="Synthetic demo themes." /><PortalContainer className="py-8 md:py-10"><div className="grid gap-6 md:grid-cols-2">{THEMES.map((theme) => <Card key={theme.id}><div className="flex flex-wrap items-center gap-2"><Pill tone="mint">{theme.offering}</Pill><Pill>{theme.orgs} organisations</Pill><Pill>{theme.periods}</Pill></div><h2 className="mt-4 text-[22px] font-semibold text-az-navy">{theme.title}</h2><p className="mt-3 text-[15px] leading-relaxed text-az-text">{theme.summary}</p><p className="mt-2 text-sm text-az-text-muted">Confidence: {theme.confidence}</p></Card>)}</div><SyntheticNote /></PortalContainer></>;

  const assignedOfferings = new Set(session.grants.filter((grant) => grant.role === 'product_owner'
    && (grant.org_id === session.activeWorkspace?.orgId || grant.org_id === null)
    && !grant.revoked_at
    && grant.offering_id).map((grant) => grant.offering_id));
  const sandboxOrgId = session.activeWorkspace?.isSandbox ? session.activeWorkspace.orgId : undefined;
  const allThemes = await listVisibleThemes(sandboxOrgId);
  const priorities = await listProductOwnerThemePriorities(allThemes.map((theme) => String(theme.id)), sandboxOrgId);
  const priorityById = new Map(priorities.map((item) => [String(item.id), item.review_priority]));
  const themes = allThemes.filter((theme) => !theme.offering || assignedOfferings.has(String(theme.offering)));
  const priorityLabel = (value: string) => value === 'evidence_review' ? 'Review evidence' : value === 'candidate_review' ? 'Assess product fit' : 'Monitor';
  return <><PageHeader title="Themes" description={sandboxOrgId ? 'Synthetic examples from the shared demo workspace; they do not represent cross-organisation evidence.' : 'Threshold-qualified themes based on approved, de-identified contributions. Review suggestions are evidence-based prompts, not automatic roadmap decisions.'} crumbs={[{ label: 'Product owner', href: '/portal/product-owner' }, { label: 'Themes' }]} /><PortalContainer className="py-8 md:py-10"><p className="mb-5 text-sm text-az-text-muted">{sandboxOrgId ? 'Demo evidence is synthetic and scoped to this shared workspace.' : '“Review evidence” means enough distinct organisations asked for stronger evidence. “Assess product fit” means enough organisations have reviewer-rated strong evidence. These signals support human review and do not imply market prevalence.'}</p><div className="grid gap-6 md:grid-cols-2">{themes.length ? themes.map((theme) => <Card key={String(theme.id)}><div className="flex flex-wrap items-center gap-2">{theme.offering != null && <Pill tone="mint">{String(theme.offering)}</Pill>}<Pill>{Number(theme.distinct_org_count)} {Number(theme.distinct_org_count) === 1 ? 'organisation' : 'organisations'}</Pill><Pill>{new Date(String(theme.period_start)).toLocaleDateString()} – {new Date(String(theme.period_end)).toLocaleDateString()}</Pill><Pill tone="navy">{priorityLabel(priorityById.get(String(theme.id)) ?? 'monitor')}</Pill></div><h2 className="mt-4 text-[22px] font-semibold text-az-navy">{String(theme.title)}</h2><p className="mt-3 text-[15px] leading-relaxed text-az-text">{String(theme.safe_summary)}</p><p className="mt-2 text-sm text-az-text-muted">{sandboxOrgId ? 'Synthetic shared demo evidence.' : 'Evidence is approved and de-identified; the sample may not represent the wider market.'}</p></Card>) : <Card><p className="text-sm text-az-text-muted">{sandboxOrgId ? 'No synthetic demo themes are available yet.' : 'No themes meet the cross-organisation threshold for your assigned offerings yet.'}</p></Card>}</div></PortalContainer></>;
}
