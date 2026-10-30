import { ORGS } from '@/app/(config)/mock/portal';
import { PERSONAS } from '@/app/(config)/personas';
import { GrantsNoteCard } from '@/app/(ui)/components/portal/admin/AdminNotes';
import { PageHeader, PortalContainer, SectionTitle, StatTile, SyntheticNote, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';

const GRANTS = [
  { person: 'Marcus Oyelaran', grant: 'Content publisher', scope: 'Public content and video audiences' },
  { person: 'Ines Calderon', grant: 'Learning moderator', scope: 'Learning moderation queue' },
  { person: 'Tomas Reiniger', grant: 'Product owner (FAI)', scope: 'FAI improvement ideas' },
  { person: 'Sunita Varghese', grant: 'Portal admin', scope: 'Organisations and role grants' },
];

export default function AdminDashboardPage() {
  return (
    <>
      <PageHeader title="Administration" />
      <PortalContainer className="py-8 md:py-10">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatTile label="Organisations" value={ORGS.length} />
          <StatTile label="Users" value={PERSONAS.length} />
          <StatTile label="Role grants" value={4} />
          <StatTile label="Pending invitations" value={2} />
        </div>

        <section className="mt-10">
          <SectionTitle>Role grants</SectionTitle>
          <Table>
            <thead>
              <tr>
                <Th>Person</Th>
                <Th>Grant</Th>
                <Th>Scope</Th>
                <Th>Granted by</Th>
                <Th>Status</Th>
              </tr>
            </thead>
            <tbody>
              {GRANTS.map((g) => (
                <tr key={g.person}>
                  <Td className="font-semibold text-az-navy">{g.person}</Td>
                  <Td>{g.grant}</Td>
                  <Td>{g.scope}</Td>
                  <Td>Sunita Varghese</Td>
                  <Td><Pill tone="mint">Active</Pill></Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>

        <div className="mt-10 space-y-4">
          <GrantsNoteCard />
          <p className="px-1 text-sm text-az-text-muted">
            An admin cannot open private client content without an explicit, time-limited support authorisation.
          </p>
        </div>

        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
