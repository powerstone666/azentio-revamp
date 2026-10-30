import Link from 'next/link';
import { Card, PageHeader, PortalContainer, PillLink, SectionTitle, StatTile, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { IdeaStatusBadge, ObsStatus } from '@/app/(ui)/components/portal/kit/Status';
import { clientAuditTime, clientIdeas, currentOrg } from '@/app/(ui)/components/portal/client/shared';
import { SCOPE_LABEL, demosFor, observationsOf } from '@/app/(config)/mock/portal';

export default function ClientDashboardPage() {
  const org = currentOrg();
  const mine = observationsOf(org.id);
  const ideas = clientIdeas();
  const demos = demosFor(org);

  return (
    <>
      <PageHeader
        title="Welcome back, Amira"
        description={org.name}
        actions={<PillLink href="/portal/client/observations/new">New observation</PillLink>}
      />
      <PortalContainer className="py-8 md:py-10">
        <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
          <StatTile label="My observations" value={mine.length} />
          <StatTile label="Published" value={mine.filter((o) => o.state === 'published').length} />
          <StatTile label="Needs your attention" value={mine.filter((o) => o.state === 'needs_clarification').length} hint="Clarification requested" />
          <StatTile label="Ideas visible to us" value={ideas.length} />
        </div>

        <section className="mt-10" aria-labelledby="recent-heading">
          <SectionTitle action={<Link href="/portal/client/observations" className="text-sm font-semibold text-az-navy underline-offset-4 hover:underline">All observations</Link>}>
            <span id="recent-heading">Your recent observations</span>
          </SectionTitle>
          <Table>
            <thead>
              <tr>
                <Th>Title</Th>
                <Th>Status</Th>
                <Th>Scope</Th>
                <Th>Updated</Th>
              </tr>
            </thead>
            <tbody>
              {mine.slice(0, 5).map((o) => (
                <tr key={o.id}>
                  <Td>
                    <Link href={`/portal/client/observations/${o.id}`} className="font-semibold text-az-navy underline-offset-4 hover:underline">{o.title}</Link>
                  </Td>
                  <Td><ObsStatus state={o.state} /></Td>
                  <Td>{SCOPE_LABEL[o.scope]}</Td>
                  <Td>{o.updated}</Td>
                </tr>
              ))}
            </tbody>
          </Table>
        </section>

        <section className="mt-10" aria-labelledby="demos-heading">
          <SectionTitle>
            <span id="demos-heading">Entitled demos</span>
          </SectionTitle>
          {demos.length === 0 ? (
            <p className="text-sm text-az-text-muted">No demos are entitled to your organisation.</p>
          ) : (
            <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">
              {demos.map((d) => (
                <Card key={d.id} className="flex flex-col">
                  <p className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">{d.offering}</p>
                  <h3 className="mt-2 text-lg font-semibold text-az-navy">{d.name}</h3>
                  <p className="mt-2 flex-1 text-sm text-az-text">{d.blurb}</p>
                  <div className="mt-5">
                    <PillLink href={`/portal/client/demos/${d.id}`} tone="outline">Open demo</PillLink>
                  </div>
                </Card>
              ))}
            </div>
          )}
        </section>

        <section className="mt-10" aria-labelledby="ideas-heading">
          <SectionTitle>
            <span id="ideas-heading">Improvement ideas</span>
          </SectionTitle>
          <div className="space-y-4">
            {ideas.map((i) => (
              <Card key={i.id} className="flex flex-col gap-3 md:flex-row md:items-start md:justify-between">
                <div>
                  <h3 className="text-base font-semibold text-az-navy">{i.title}</h3>
                  <p className="mt-1 text-sm text-az-text">{i.clientText}</p>
                </div>
                <div className="flex shrink-0 flex-col items-start gap-2 md:items-end">
                  <IdeaStatusBadge status={i.status} />
                  <span className="text-xs text-az-text-muted">Last update: {clientAuditTime(i)}</span>
                </div>
              </Card>
            ))}
          </div>
        </section>
      </PortalContainer>
    </>
  );
}
