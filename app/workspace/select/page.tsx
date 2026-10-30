import { getSession } from '@/app/api/(services)/authz/session';
import { redirectToLoginOrOnboarding } from '@/app/api/(services)/authz/onboarding-redirect';
import { query } from '@/app/api/(db)/client';
import { Card, PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';
import { OrgContinueButton } from '@/app/(ui)/components/portal/signin/OrgContinueButton';
import { CreateWorkspaceForm } from '@/app/(ui)/components/portal/signin/CreateWorkspaceForm';

export const instant = false;

interface WorkspaceOption {
  membership_id: string;
  org_id: string;
  org_name: string;
  org_type: 'azentio' | 'client';
  role: string;
  offerings: string[];
}

export default async function WorkspaceSelectPage() {
  const session = await getSession();
  if (!session) return redirectToLoginOrOnboarding();
  const workspaces = await query<WorkspaceOption>(
    `SELECT m.id AS membership_id, o.id AS org_id, o.name AS org_name, o.type AS org_type,
            m.role, COALESCE(array_agg(DISTINCT e.offering_id) FILTER (WHERE e.id IS NOT NULL), ARRAY[]::text[]) AS offerings
     FROM memberships m
     JOIN organizations o ON o.id = m.org_id
     LEFT JOIN entitlements e ON e.org_id = o.id AND e.status = 'active'
       AND e.valid_from <= now() AND (e.valid_to IS NULL OR e.valid_to > now())
     WHERE m.user_id = $1 AND m.status = 'active' AND o.status = 'active'
     GROUP BY m.id, o.id, o.name, o.type, m.role
     ORDER BY o.name, m.id`,
    [session.user.id],
  );
  if (workspaces.length === 0) return redirectToLoginOrOnboarding();

  return (
    <main className="min-h-screen bg-white pb-16">
      <PageHeader
        title="Select a workspace"
        description="Choose one of your approved organisation memberships. Access and entitlements are checked again by the server for every request."
        crumbs={[{ label: 'Sign in', href: '/login' }, { label: 'Select a workspace' }]}
      />
      <PortalContainer className="mt-10">
        <div className="grid gap-6 md:grid-cols-2">
          {workspaces.map((workspace) => (
            <Card key={workspace.membership_id} className="flex flex-col">
              <h2 className="text-[22px] font-semibold text-az-navy">{workspace.org_name}</h2>
              <p className="mt-1 text-sm font-medium capitalize text-az-text-muted">{workspace.role.replaceAll('_', ' ')}</p>
              {workspace.offerings.length > 0 && <>
                <p className="mt-6 text-sm font-semibold text-az-navy">Entitled offerings</p>
                <ul className="mt-2 flex flex-wrap gap-2">
                  {workspace.offerings.map((item) => <li key={item} className="rounded-[50px] border border-az-green bg-az-mint-tint px-3 py-1 text-xs font-medium text-az-navy">{item}</li>)}
                </ul>
              </>}
              <div className="mt-auto pt-8">
                <OrgContinueButton membershipId={workspace.membership_id} active={session.activeWorkspace?.orgId === workspace.org_id} />
              </div>
            </Card>
          ))}
        </div>
        {session.activeWorkspace?.isSandbox && session.activeWorkspace.role === 'client_admin' && (
          <Card className="mt-8">
            <h2 className="text-[22px] font-semibold text-az-navy">Create a workspace</h2>
            <p className="mb-5 mt-1 text-sm text-az-text-muted">Start another demo workspace that you administer, then invite people from its Team page. Demo workspaces hold synthetic data only.</p>
            <CreateWorkspaceForm />
          </Card>
        )}
        <p className="mt-8 text-sm text-az-text-muted">Your active organisation appears in the workspace header. Switching workspaces does not grant access to other organisations.</p>
      </PortalContainer>
    </main>
  );
}
