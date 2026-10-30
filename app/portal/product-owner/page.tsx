import Link from 'next/link';
import { IDEAS, THEMES } from '@/app/(config)/mock/portal';
import { IdeaStatusBadge } from '@/app/(ui)/components/portal/kit/Status';
import { PageHeader, PillLink, PortalContainer, StatTile, SyntheticNote, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';

export default function ProductOwnerOverviewPage() {
  const visibleThemes = THEMES.filter((t) => t.shown).length;
  const underReview = IDEAS.filter((i) => i.status === 'Under review').length;

  return (
    <>
      <PageHeader
        title="Product owner: FAI"
        description="Themes that are safe to show, and the improvement ideas linked to them."
        actions={<PillLink href="/portal/product-owner/ideas/new" tone="mint">New idea</PillLink>}
      />
      <PortalContainer className="py-8 md:py-10">
        <div className="grid gap-5 md:grid-cols-3">
          <StatTile label="Themes visible" value={visibleThemes} hint="Only themes above the threshold" />
          <StatTile label="Ideas" value={IDEAS.length} />
          <StatTile label="Under review" value={underReview} />
        </div>

        <div className="mt-8">
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Offering</Th>
                <Th>Status</Th>
                <Th>Owner</Th>
                <Th><span className="sr-only">Open</span></Th>
              </tr>
            </thead>
            <tbody>
              {IDEAS.map((i) => (
                <tr key={i.id}>
                  <Td className="font-semibold text-az-navy">{i.title}</Td>
                  <Td>{i.offering}</Td>
                  <Td><IdeaStatusBadge status={i.status} /></Td>
                  <Td>{i.owner}</Td>
                  <Td>
                    <Link href={`/portal/product-owner/ideas/${i.id}`} className="font-semibold text-az-navy underline decoration-az-mint decoration-2 underline-offset-4 transition-colors duration-150 hover:text-az-green">
                      Open<span className="sr-only"> {i.title}</span>
                    </Link>
                  </Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </div>
        <SyntheticNote />
      </PortalContainer>
    </>
  );
}
