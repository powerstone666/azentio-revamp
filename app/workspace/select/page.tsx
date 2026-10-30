import { PageHeader, PortalContainer, Card } from '@/app/(ui)/components/portal/kit/ui';
import { orgById, type Org } from '@/app/(config)/mock/portal';
import { OrgContinueButton } from '@/app/(ui)/components/portal/signin/OrgContinueButton';

// Priya Natarajan belongs to two client organisations.
const PRIYA_ORG_IDS = ['harborline', 'sandune'] as const;

export default function WorkspaceSelectPage() {
  const orgs = PRIYA_ORG_IDS.map((id) => orgById(id)).filter((o): o is Org => Boolean(o));

  return (
    <main className="min-h-screen bg-white pb-16">
      <PageHeader
        title="Select a workspace"
        description="You belong to more than one organisation. Choose the workspace you want to work in. Everything you see and create belongs to that workspace."
        crumbs={[{ label: 'Sign in', href: '/login' }, { label: 'Select a workspace' }]}
      />
      <PortalContainer className="mt-10">
        <div className="grid gap-6 md:grid-cols-2">
          {orgs.map((org) => (
            <Card key={org.id} className="flex flex-col">
              <h2 className="text-[22px] font-semibold text-az-navy">{org.name}</h2>
              <p className="mt-1 text-sm font-medium text-az-text-muted">Client member</p>
              <p className="mt-6 text-sm font-semibold text-az-navy">Entitlements</p>
              <ul className="mt-2 flex flex-wrap gap-2">
                {org.offerings.map((item) => (
                  <li
                    key={item}
                    className="rounded-[50px] border border-az-green bg-az-mint-tint px-3 py-1 text-xs font-medium text-az-navy"
                  >
                    {item}
                  </li>
                ))}
              </ul>
              <div className="mt-auto pt-8">
                <OrgContinueButton orgId={org.id} />
              </div>
            </Card>
          ))}
        </div>
        <p className="mt-8 text-sm text-az-text-muted">
          The active workspace is always shown in the portal header, so you can see which organisation you are working in.
        </p>
      </PortalContainer>
    </main>
  );
}
