import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listClientReleaseNotes } from '@/app/api/(services)/releases/service';
import { ClientReleaseNoteList } from '@/app/(ui)/components/portal/client/ClientReleaseNoteList';
import { PageHeader, PortalContainer } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

export default async function ClientReleaseNotesPage() {
  const session = await requirePortalPage('portal:client:read');
  const notes = session?.activeWorkspace
    ? await listClientReleaseNotes(session.user.id, session.activeWorkspace.orgId)
    : [];
  return <>
    <PageHeader title="Release notes" description="Published updates for products available to your active workspace." crumbs={[{ label: 'Client dashboard', href: '/portal/client' }, { label: 'Release notes' }]} />
    <PortalContainer className="py-8 md:py-10"><ClientReleaseNoteList notes={notes} demo={!session} /></PortalContainer>
  </>;
}
