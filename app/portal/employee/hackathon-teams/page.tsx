import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listHackathonTeams } from '@/app/api/(services)/employee/teams';
import { Card, PageHeader, PortalContainer, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { HackathonTeams } from '@/app/(ui)/components/portal/employee/HackathonTeams';

export const instant = false;

export default async function EmployeeHackathonTeamsPage() {
  const session = await requirePortalPage('portal:employee:read');
  if (!session) return <>
    <PageHeader title="Hackathon teams" description="Employee-only spaces for internal hackathon collaboration." crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Hackathon teams' }]} />
    <PortalContainer className="py-8 md:py-10"><Card><p className="text-sm text-az-text-muted">Demo preview. Team spaces and updates are available to verified employees only.</p></Card><SyntheticNote /></PortalContainer>
  </>;
  const teams = await listHackathonTeams(session.user.id, session.activeWorkspace!.orgId);
  return <>
    <PageHeader title="Hackathon teams" description="Create a team space, join open employee teams, and share progress updates." crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Hackathon teams' }]} />
    <PortalContainer className="py-8 md:py-10"><HackathonTeams initialTeams={teams.map((team) => ({ ...team, id: String(team.id), name: String(team.name), description: String(team.description), status: String(team.status), creator: String(team.creator), member_count: Number(team.member_count), is_member: Boolean(team.is_member), my_role: team.my_role ? String(team.my_role) : null }))} /></PortalContainer>
  </>;
}
