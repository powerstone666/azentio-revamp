import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listPendingInvitations, listWorkspaceMembers } from '@/app/api/(services)/invitations/service';
import { Card, PageHeader, PortalContainer, SectionTitle, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { InviteMemberForm } from '@/app/(ui)/components/portal/client/InviteMemberForm';
import { RevokeAccessButton } from '@/app/(ui)/components/portal/client/RevokeAccessButton';
import { displayRole } from '@/app/(ui)/components/portal/client/shared';
import { TEAM } from '@/app/(config)/mock/portal';

export const instant = false;

export default async function ClientAdminTeamPage() {
  const session = await requirePortalPage('portal:client-admin:read');
  const [members, invitations] = session?.activeWorkspace
    ? await Promise.all([
        listWorkspaceMembers(session.activeWorkspace.orgId),
        listPendingInvitations(session.activeWorkspace.orgId),
      ])
    : [TEAM.map((member) => ({
        membership_id: '', user_id: '', display_name: member.name, email: member.email,
        role: member.role, status: member.status.toLowerCase(), joined_at: new Date(),
      })), []];
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
              <Th>Access</Th>
            </tr>
          </thead>
          <tbody>
            {members.map((m) => (
              <tr key={m.membership_id || m.email}>
                <Td className="font-semibold text-az-navy">{m.display_name}</Td>
                <Td>{m.email}</Td>
                <Td>{displayRole(m.role)}</Td>
                <Td>
                  {m.status === 'active' ? <Pill tone="mint">Active</Pill> : <Pill tone="red">{m.status}</Pill>}
                </Td>
                <Td>{session && m.status === 'active' && <RevokeAccessButton id={m.membership_id} kind="member" disabled={m.user_id === session.user.id} />}</Td>
              </tr>
            ))}
          </tbody>
        </Table>

        <section className="mt-10" aria-labelledby="invite-heading">
          <SectionTitle>
            <span id="invite-heading">Invite a member</span>
          </SectionTitle>
          <div className="max-w-3xl">
            <InviteMemberForm disabled={!session} />
          </div>
        </section>
        {invitations.length > 0 && <section className="mt-10" aria-labelledby="pending-invitations-heading">
          <SectionTitle><span id="pending-invitations-heading">Pending invitations</span></SectionTitle>
          <Table><thead><tr><Th>Email</Th><Th>Role</Th><Th>Expires</Th><Th>Access</Th></tr></thead><tbody>
            {invitations.map((invitation) => <tr key={invitation.id}><Td className="font-semibold text-az-navy">{invitation.email}</Td><Td>{displayRole(invitation.proposed_role)}</Td><Td>{new Date(invitation.expires_at).toLocaleDateString()}</Td><Td><RevokeAccessButton id={invitation.id} kind="invitation" /></Td></tr>)}
          </tbody></Table>
        </section>}
        {!session && <Card className="mt-8 max-w-3xl"><p className="text-sm text-az-text-muted">Demo preview uses synthetic team records.</p></Card>}
      </PortalContainer>
    </>
  );
}
