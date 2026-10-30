import Link from 'next/link';
import { PageHeader, PillLink, PortalContainer, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { ObsStatus } from '@/app/(ui)/components/portal/kit/Status';
import { FilterChips } from '@/app/(ui)/components/portal/client/FilterChips';
import { currentOrg } from '@/app/(ui)/components/portal/client/shared';
import { SCOPE_LABEL, observationsOf } from '@/app/(config)/mock/portal';

export default function ClientObservationsPage() {
  const rows = observationsOf(currentOrg().id);

  return (
    <>
      <PageHeader
        title="Observations"
        description="Your contributions and their status. Drafts are visible only to you."
        actions={<PillLink href="/portal/client/observations/new">New observation</PillLink>}
      />
      <PortalContainer className="py-8 md:py-10">
        <FilterChips items={['All', 'Drafts', 'Needs attention', 'Published', 'Withdrawn']} active="All" />

        <div className="mt-6">
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Type</Th>
                <Th>Status</Th>
                <Th>Scope</Th>
                <Th>Period</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {rows.map((o) => (
                <tr key={o.id}>
                  <Td>
                    <Link href={`/portal/client/observations/${o.id}`} className="font-semibold text-az-navy underline-offset-4 hover:underline">{o.title}</Link>
                  </Td>
                  <Td>{o.type}</Td>
                  <Td><ObsStatus state={o.state} /></Td>
                  <Td>{SCOPE_LABEL[o.scope]}</Td>
                  <Td>{o.period}</Td>
                  <Td>{o.updated}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <p className="mt-6 text-xs text-az-text-muted">Filters are shown for layout only in this preview.</p>
      </PortalContainer>
    </>
  );
}
