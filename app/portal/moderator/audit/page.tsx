import { AUDIT } from '@/app/(config)/mock/portal';
import { PageHeader, PortalContainer, SyntheticNote, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';

export default function ModeratorAuditPage() {
  return (
    <>
      <PageHeader
        title="Audit log"
        description="Append-only history of moderation actions and access changes."
        crumbs={[{ label: 'Learning moderation', href: '/portal/moderator' }, { label: 'Audit' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <Table>
          <thead>
            <tr>
              <Th>When</Th>
              <Th>Actor</Th>
              <Th>Organisation</Th>
              <Th>Action</Th>
              <Th>Target</Th>
              <Th>Request id</Th>
            </tr>
          </thead>
          <tbody>
            {AUDIT.map((e) => (
              <tr key={e.request}>
                <Td className="whitespace-nowrap">{e.at}</Td>
                <Td>{e.actor}</Td>
                <Td>{e.org}</Td>
                <Td className="font-semibold text-az-navy">{e.action}</Td>
                <Td>{e.target}</Td>
                <Td className="font-mono text-xs">{e.request}</Td>
              </tr>
            ))}
          </tbody>
        </Table>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
