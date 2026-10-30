import Link from 'next/link';
import { OBSERVATIONS, orgById } from '@/app/(config)/mock/portal';
import { ObsStatus, Pill } from '@/app/(ui)/components/portal/kit/Status';
import { PageHeader, PillLink, PortalContainer, Table, Td, Th, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { isFlagged, isQueued, isReviewable } from '@/app/(ui)/components/portal/staff/rules';

export default function ModeratorQueuePage() {
  const rows = OBSERVATIONS.filter((o) => isReviewable(o) && isQueued(o));

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
                <Td>{orgById(o.orgId)?.name}</Td>
                <Td>{o.author}</Td>
                <Td>
                  <div className="flex flex-wrap gap-2">
                    <ObsStatus state={o.state} />
                    {isFlagged(o) && <Pill tone="red">Sensitive flag</Pill>}
                  </div>
                </Td>
                <Td className="whitespace-nowrap">{o.updated}</Td>
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
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
