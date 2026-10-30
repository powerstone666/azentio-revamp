import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { detectReviewRisks, getModerationQueue } from '@/app/api/(services)/moderation/service';
import Link from 'next/link';
import { OBSERVATIONS, orgById, type ObsState } from '@/app/(config)/mock/portal';
import { ObsStatus, Pill } from '@/app/(ui)/components/portal/kit/Status';
import { PageHeader, PillLink, PortalContainer, Table, Td, Th, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { isFlagged, isQueued, isReviewable } from '@/app/(ui)/components/portal/staff/rules';

export const instant = false;

export default async function ModeratorQueuePage() {
  const session = await requirePortalPage('portal:moderator:read');
  const globalModerator = session?.grants.some((grant) => grant.role === 'learning_moderator'
    && grant.org_id === null && !grant.revoked_at);
  const rows = session
    ? (await getModerationQueue(globalModerator ? undefined : session.activeWorkspace?.orgId)).map((row) => ({
        id: row.id,
        title: String(row.source_payload.title ?? 'Untitled contribution'),
        orgName: row.org_name,
        author: row.author_name,
        state: row.state as ObsState,
        updated: row.updated_at,
        flagged: detectReviewRisks(row.source_payload).length > 0,
      }))
    : OBSERVATIONS.filter((o) => isReviewable(o) && isQueued(o)).map((o) => ({
        id: o.id, title: o.title, orgName: orgById(o.orgId)?.name ?? 'Demo organisation',
        author: o.author, state: o.state, updated: o.updated, flagged: isFlagged(o),
      }));

  return (
    <>
      <PageHeader
        title="Review queue"
        description="Submitted contributions and ones waiting for clarification."
        crumbs={[{ label: 'Learning moderation', href: '/portal/moderator' }, { label: 'Review queue' }]}
      />
      <PortalContainer className="py-8 md:py-10">
        <Table>
          <thead>
            <tr>
              <Th>Title</Th>
              <Th>Organisation</Th>
              <Th>Author</Th>
              <Th>Status</Th>
              <Th>Updated</Th>
              <Th><span className="sr-only">Action</span></Th>
            </tr>
          </thead>
          <tbody>
            {rows.map((o) => (
              <tr key={o.id}>
                <Td className="font-semibold text-az-navy">{o.title}</Td>
                <Td>{o.orgName}</Td>
                <Td>{o.author}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <ObsStatus state={o.state} />
                    {o.flagged && <Pill tone="red">Sensitive flag</Pill>}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{Number.isNaN(Date.parse(String(o.updated))) ? String(o.updated) : new Date(o.updated).toLocaleDateString()}</Td>
                <Td>
                  <PillLink href={`/portal/moderator/review/${o.id}`} tone="mint" className="px-4 py-1.5 text-sm">
                    Review<span className="sr-only"> {o.title}</span>
                  </PillLink>
                </Td>
              </tr>
            ))}
          </tbody>
        </Table>
        {rows.length === 0 && <p className="mt-6 text-sm text-az-text-muted">Nothing is waiting for review. <Link href="/portal/moderator" className="font-semibold text-az-navy underline">Back to overview</Link></p>}
        {!session && <SyntheticNote />}
      </PortalContainer>
    </>
  );
}
