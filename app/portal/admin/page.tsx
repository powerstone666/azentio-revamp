import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { getAdminOverview, listAdminEligibleEmployees, listAdminOrganizations, listAdminRoleGrants } from '@/app/api/(services)/admin/service';
import { ORGS } from '@/app/(config)/mock/portal';
import { PERSONAS } from '@/app/(config)/personas';
import { GrantsNoteCard } from '@/app/(ui)/components/portal/admin/AdminNotes';
import { PageHeader, PillLink, PortalContainer, SectionTitle, StatTile, SyntheticNote, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import RoleGrantManager, { type AdminOrgOption, type EligibleEmployee, type GrantRow } from '@/app/(ui)/components/portal/admin/RoleGrantManager';

export const instant = false;

const DEMO_GRANTS = [
  { person: 'Marcus Oyelaran', grant: 'Content publisher', scope: 'Public content and video audiences' },
  { person: 'Ines Calderon', grant: 'Learning moderator', scope: 'Learning moderation queue' },
  { person: 'Tomas Reiniger', grant: 'Product owner (FAI)', scope: 'FAI improvement ideas' },
  { person: 'Sunita Varghese', grant: 'Portal admin', scope: 'Organisations and role grants' },
];

export default async function AdminDashboardPage() {
  const session = await requirePortalPage('portal:admin:read');
  if (!session) return <><PageHeader title="Administration" /><PortalContainer className="py-8 md:py-10"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatTile label="Organisations" value={ORGS.length} /><StatTile label="Users" value={PERSONAS.length} /><StatTile label="Role grants" value={4} /><StatTile label="Pending invitations" value={2} /></div><section className="mt-10"><SectionTitle>Role grants</SectionTitle><Table><thead><tr><Th>Person</Th><Th>Grant</Th><Th>Scope</Th><Th>Granted by</Th><Th>Status</Th></tr></thead><tbody>{DEMO_GRANTS.map((grant) => <tr key={grant.person}><Td className="font-semibold text-az-navy">{grant.person}</Td><Td>{grant.grant}</Td><Td>{grant.scope}</Td><Td>Sunita Varghese</Td><Td><Pill tone="mint">Active</Pill></Td></tr>)}</tbody></Table></section><div className="mt-10 space-y-4"><GrantsNoteCard /><p className="px-1 text-sm text-az-text-muted">An admin cannot open private client content without an explicit, time-limited support authorisation.</p></div><SyntheticNote /></PortalContainer></>;

  const [overview, grants, employees, orgs] = await Promise.all([
    getAdminOverview(), listAdminRoleGrants(), listAdminEligibleEmployees(), listAdminOrganizations(),
  ]);
  const grantRows: GrantRow[] = grants.map((grant) => ({
    id: String(grant.id), role: String(grant.role), offering_id: grant.offering_id == null ? null : String(grant.offering_id),
    org_id: grant.org_id == null ? null : String(grant.org_id), org_name: grant.org_name == null ? null : String(grant.org_name),
    display_name: String(grant.display_name), email: String(grant.email), granted_by_name: String(grant.granted_by_name),
    status: String(grant.status), expires_at: grant.expires_at == null ? null : String(grant.expires_at),
  }));
  const employeeRows: EligibleEmployee[] = employees.map((employee) => ({
    id: String(employee.id), display_name: String(employee.display_name), email: String(employee.email),
    org_id: String(employee.org_id), org_name: String(employee.org_name),
  }));
  const orgOptions: AdminOrgOption[] = orgs.map((org) => ({ id: String(org.id), name: String(org.name), type: String(org.type) }));
  return <><PageHeader title="Administration" description="Platform-wide organization, entitlement and role-grant operations." actions={<div className="flex flex-wrap gap-2"><PillLink href="/portal/admin/public-submissions" tone="outline-light">Public enquiries</PillLink><PillLink href="/portal/admin/support-tickets" tone="outline-light">Support tickets</PillLink></div>} /><PortalContainer className="py-8 md:py-10"><div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4"><StatTile label="Organisations" value={overview?.organizations ?? 0} /><StatTile label="Active users" value={overview?.users ?? 0} /><StatTile label="Active role grants" value={overview?.grants ?? 0} /><StatTile label="Pending invitations" value={overview?.pending_invitations ?? 0} /></div><section className="mt-10"><SectionTitle>Manage role grants</SectionTitle><RoleGrantManager grants={grantRows} employees={employeeRows} organizations={orgOptions} /></section><div className="mt-10 space-y-4"><GrantsNoteCard /><p className="px-1 text-sm text-az-text-muted">Private client content requires a separate, explicit support authorization.</p></div></PortalContainer></>;
}
