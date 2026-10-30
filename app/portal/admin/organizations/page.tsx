import { ORGS } from '@/app/(config)/mock/portal';
import { SupportAccessCard } from '@/app/(ui)/components/portal/admin/AdminNotes';
import { PageHeader, PillButton, PortalContainer, SectionTitle, SyntheticNote, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';

export default function AdminOrganizationsPage() {
  return (
    <>
      <PageHeader
        title="Organisations"
        crumbs={[{ label: 'Administration', href: '/portal/admin' }, { label: 'Organisations' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <section>
          <SectionTitle>Directory</SectionTitle>
          <Table>
            <thead>
              <tr>
                <Th>Organisation</Th>
                <Th>Type</Th>
                <Th>Entitled offerings</Th>
                <Th>Status</Th>
                <Th>Note</Th>
              </tr>
            </thead>
            <tbody>
              {ORGS.map((org) => (
                <tr key={org.id}>
                  <Td className="font-semibold text-az-navy">{org.name}</Td>
                  <Td>{org.kind === 'client' ? 'Client' : 'Azentio'}</Td>
                  <Td>
                    {org.offerings.length > 0 ? (
                      <div className="flex flex-wrap gap-2">
                        {org.offerings.map((o) => (
                          <Pill key={o} tone="grey">{o}</Pill>
                        ))}
                      </div>
                    ) : null}
                  </Td>
                  <Td><Pill tone="mint">Active</Pill></Td>
                  <Td>{org.note}</Td>
                </tr>
              ))}
            </tbody>
          </Table>

          <div className="mt-6 flex flex-wrap items-center gap-4">
            <PillButton tone="navy" disabled>Add organisation</PillButton>
            <p className="text-sm text-az-text-muted">Preview build: nothing is saved</p>
          </div>
        </section>

        <section className="mt-10">
          <SupportAccessCard />
        </section>

        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
