import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listAdminOrganizations } from '@/app/api/(services)/admin/service';
import { ORGS } from '@/app/(config)/mock/portal';
import { SupportAccessCard } from '@/app/(ui)/components/portal/admin/AdminNotes';
import OrganizationManager, { type OrganizationRow } from '@/app/(ui)/components/portal/admin/OrganizationManager';
import { PageHeader, PillButton, PortalContainer, SectionTitle, SyntheticNote, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';

export const instant = false;

export default async function AdminOrganizationsPage() {
  const session = await requirePortalPage('portal:admin:read');
  if (!session) return <><PageHeader title="Organisations" crumbs={[{ label: 'Administration', href: '/portal/admin' }, { label: 'Organisations' }]} /><PortalContainer className="py-8 md:py-10"><section><SectionTitle>Directory</SectionTitle><Table><thead><tr><Th>Organisation</Th><Th>Type</Th><Th>Entitled offerings</Th><Th>Status</Th><Th>Note</Th></tr></thead><tbody>{ORGS.map((org) => <tr key={org.id}><Td className="font-semibold text-az-navy">{org.name}</Td><Td>{org.kind === 'client' ? 'Client' : 'Azentio'}</Td><Td><div className="flex flex-wrap gap-2">{org.offerings.map((offering) => <Pill key={offering} tone="grey">{offering}</Pill>)}</div></Td><Td><Pill tone="mint">Active</Pill></Td><Td>{org.note}</Td></tr>)}</tbody></Table><div className="mt-6 flex flex-wrap items-center gap-4"><PillButton tone="navy" disabled>Add organisation</PillButton><p className="text-sm text-az-text-muted">Demo preview: nothing is saved.</p></div></section><section className="mt-10"><SupportAccessCard /></section><SyntheticNote /></PortalContainer></>;

  const rows = await listAdminOrganizations();
  const organizations: OrganizationRow[] = rows.map((row) => ({
    id: String(row.id), name: String(row.name), type: row.type as 'azentio' | 'client',
    status: row.status as OrganizationRow['status'], active_members: Number(row.active_members),
    entitlements: Array.isArray(row.entitlements) ? row.entitlements as OrganizationRow['entitlements'] : [],
  }));
  return <><PageHeader title="Organisations" description="Manage client workspaces and their sandbox access." crumbs={[{ label: 'Administration', href: '/portal/admin' }, { label: 'Organisations' }]} /><PortalContainer className="py-8 md:py-10"><section><SectionTitle>Directory</SectionTitle><OrganizationManager organizations={organizations} /><p className="mt-5 text-xs text-az-text-muted">Changes are stored and audited. Organization administrators cannot access another tenant through this directory.</p></section><section className="mt-10"><SupportAccessCard /></section></PortalContainer></>;
}
