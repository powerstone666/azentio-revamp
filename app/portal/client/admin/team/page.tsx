import { Card, PageHeader, PortalContainer, SectionTitle, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { InviteMemberForm } from '@/app/(ui)/components/portal/client/InviteMemberForm';
import { displayRole } from '@/app/(ui)/components/portal/client/shared';
import { TEAM } from '@/app/(config)/mock/portal';

export default function ClientAdminTeamPage() {
  return (
    <>
      <PageHeader
        title="Team"
        description="Members of your organisation's workspace and their roles."
      />
      <PortalContainer className="py-8 md:py-10">
        <Table>
          <thead>
            <tr>
              <Th>Name</Th>
              <Th>Email</Th>
              <Th>Role</Th>
              <Th>Status</Th>
            </tr>
          </thead>
          <tbody>
            {TEAM.map((m) => (
              <tr key={m.email}>
                <Td className="font-semibold text-az-navy">{m.name}</Td>
                <Td>{m.email}</Td>
                <Td>{displayRole(m.role)}</Td>
                <Td>
                  {m.status === 'Active' ? <Pill tone="mint">Active</Pill> : <Pill tone="red">{m.status}</Pill>}
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <section className="mt-10" aria-labelledby="invite-heading">
          <SectionTitle>
            <span id="invite-heading">Invite a member</span>
          </SectionTitle>
          <div className="max-w-3xl">
            <InviteMemberForm />
          </div>
        </section>
        <Card className="mt-8 max-w-3xl">
          <p className="text-sm text-az-text-muted">Invitations and role changes are not sent or saved in this preview.</p>
        </Card>
      </PortalContainer>
    </>
  );
}
