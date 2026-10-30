import { PageHeader, PortalContainer, Card, PillButton, Table, Th, Td, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { EXPERIMENTS } from '@/app/(config)/mock/portal';

export default function EmployeeExperimentsPage() {
  return (
    <>
      <PageHeader
        title="Experiments"
        description="Internal prototypes and hackathon ideas. Employees only."
        crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Experiments' }]}
        actions={<PillButton tone="outline-light" disabled>Submit an experiment</PillButton>}
      />
      <PortalContainer className="py-8 md:py-10">
        <Card className="mb-6 border-l-4 border-az-navy">
          <div className="flex flex-wrap items-center gap-3">
            <Pill tone="navy">Employees only</Pill>
            <p className="text-sm text-az-text">These notes are internal. They are never shown to clients, in public or client search, or in the AIRA assistant.</p>
          </div>
        </Card>
        <p className="mb-6 text-sm text-az-text-muted">Preview build: submissions are not stored, so the submit button is disabled.</p>

        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Owner</Th>
              <Th>Status</Th>
              <Th>Note</Th>
            </tr>
          </thead>
          <tbody>
            {EXPERIMENTS.map((x) => (
              <tr key={x.id}>
                <Td className="font-semibold text-az-navy">{x.name}</Td>
                <Td>{x.owner}</Td>
                <Td><Pill tone="mint">{x.status}</Pill></Td>
                <Td>{x.note}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
