import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listWorkspaceContributions } from '@/app/api/(services)/contributions/service';
import Link from 'next/link';
import { PageHeader, PillLink, PortalContainer, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { ObsStatus } from '@/app/(ui)/components/portal/kit/Status';
import { FilterChips } from '@/app/(ui)/components/portal/client/FilterChips';
import { currentOrg } from '@/app/(ui)/components/portal/client/shared';
import { SCOPE_LABEL, observationsOf } from '@/app/(config)/mock/portal';

export const instant = false;

export default async function ClientObservationsPage() {
  const session = await requirePortalPage('portal:client:read');
  const rows = session?.activeWorkspace
    ? (await listWorkspaceContributions(session.user.id, session.activeWorkspace.orgId)).map((item) => {
        const payload = item.current_payload as Record<string, unknown> | null;
        const start = typeof payload?.observation_period_start === 'string' ? payload.observation_period_start : null;
        const end = typeof payload?.observation_period_end === 'string' ? payload.observation_period_end : null;
        return {
          id: String(item.id),
          title: String(payload?.title ?? 'Untitled contribution'),
          type: String(payload?.observation_type ?? 'Observation'),
          state: String(item.state) as Parameters<typeof ObsStatus>[0]['state'],
          scope: (item.visibility === 'author' ? 'private' : item.visibility === 'community_proposed' ? 'community' : 'org') as keyof typeof SCOPE_LABEL,
          period: start || end ? `${start ?? '—'} – ${end ?? '—'}` : 'Not provided',
          updated: new Date(String(item.updated_at)).toLocaleDateString(),
        };
      })
    : observationsOf(currentOrg().id);

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
        {!session && <p className="mt-6 text-xs text-az-text-muted">Demo preview uses synthetic observations.</p>}
      </PortalContainer>
    </>
  );
}
