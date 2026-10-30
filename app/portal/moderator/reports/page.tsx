import { REPORTS } from '@/app/(config)/mock/portal';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { Card, PageHeader, PortalContainer, SyntheticNote, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';

const REPORT_TONE = { Open: 'red', Dismissed: 'grey', Resolved: 'mint' } as const;

export default function ModeratorReportsPage() {
  return (
    <>
      <PageHeader
        title="Content reports"
        description="Reports from members about shared content."
        crumbs={[{ label: 'Learning moderation', href: '/portal/moderator' }, { label: 'Reports' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <Card className="mb-6 text-sm text-az-text">
          The reporter is never shown to the reported organisation. Reports are handled against the content, not the person who raised them.
        </Card>
        <Table>
          <thead>
            <tr>
              <Th>Target</Th>
              <Th>Category</Th>
              <Th>Status</Th>
              <Th>Note</Th>
              <Th>When</Th>
            </tr>
          </thead>
          <tbody>
            {REPORTS.map((r) => (
              <tr key={r.id}>
                <Td className="font-semibold text-az-navy">{r.target}</Td>
                <Td>{r.category}</Td>
                <Td><Pill tone={REPORT_TONE[r.status]}>{r.status}</Pill></Td>
                <Td>{r.note}</Td>
                <Td className="whitespace-nowrap">{r.when}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
