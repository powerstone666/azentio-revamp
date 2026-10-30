import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listEmployeeReleaseNotes } from '@/app/api/(services)/releases/service';
import { listManageableReleaseNotes } from '@/app/api/(services)/releases/service';
import { ReleaseNoteList } from '@/app/(ui)/components/portal/employee/ReleaseNoteList';
import { ReleaseNoteManager, type ManagedReleaseNote } from '@/app/(ui)/components/portal/employee/ReleaseNoteManager';
import { Card, PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

export default async function EmployeeReleaseNotesPage() {
  const session = await requirePortalPage('portal:employee:read');
  const notes = session
    ? await listEmployeeReleaseNotes(session.user.id, session.activeWorkspace!.orgId)
    : [];
  const activeGrants = session?.grants.filter((grant) => !grant.revoked_at
    && (grant.org_id === session.activeWorkspace?.orgId || grant.org_id === null)) ?? [];
  const canPublishAll = activeGrants.some((grant) => grant.role === 'content_publisher' && !grant.offering_id);
  const offerings = [...new Set(activeGrants.filter((grant) => ['content_publisher', 'product_owner'].includes(grant.role) && grant.offering_id).map((grant) => grant.offering_id!))];
  const manageableNotes = session && (canPublishAll || offerings.length > 0)
    ? await listManageableReleaseNotes(session.user.id, session.activeWorkspace!.orgId)
    : [];
  return <>
    <PageHeader title="Release notes" description="Reviewed offering updates for Azentio employees." crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Release notes' }]} />
    <PortalContainer className="py-8 md:py-10">
      {(manageableNotes.length > 0 || canPublishAll || offerings.length > 0) && <div className="mb-10"><ReleaseNoteManager offerings={offerings} canPublishAll={canPublishAll} initialNotes={manageableNotes.map((note) => ({ ...note, id: String(note.id), title: String(note.title), body: String(note.body), audience: note.audience as 'employees' | 'clients', offering_id: note.offering_id ? String(note.offering_id) : null, org_name: note.org_name ? String(note.org_name) : null, status: note.status as 'draft' | 'published' | 'archived', published_at: note.published_at ? new Date(String(note.published_at)).toISOString() : null })) as ManagedReleaseNote[]} /></div>}
      <ReleaseNoteList notes={notes} demo={!session} />
      {session && notes.length === 0 && <Card><p className="text-sm text-az-text-muted">No published employee release notes are available yet.</p></Card>}
    </PortalContainer>
  </>;
}
