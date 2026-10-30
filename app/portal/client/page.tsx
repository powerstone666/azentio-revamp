import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { listWorkspaceContributions } from '@/app/api/(services)/contributions/service';
import { listIdeas } from '@/app/api/(services)/ideas/service';
import { listEntitledSandboxDemos } from '@/app/api/(services)/sandbox/service';
import { listClientBroadcasts } from '@/app/api/(services)/broadcasts/service';
import { SANDBOX_DEMOS } from '@/app/(config)/sandbox';
import Link from 'next/link';
import { Card, PageHeader, PortalContainer, PillLink, SectionTitle, StatTile, Table, Td, Th } from '@/app/(ui)/components/portal/kit/ui';
import { IdeaStatusBadge, ObsStatus } from '@/app/(ui)/components/portal/kit/Status';
import { clientAuditTime, clientIdeas, currentOrg } from '@/app/(ui)/components/portal/client/shared';
import { SCOPE_LABEL, demosFor, observationsOf, type ObsState } from '@/app/(config)/mock/portal';

export const instant = false;

export default async function ClientDashboardPage() {
  const session = await requirePortalPage('portal:client:read');
  if (session?.activeWorkspace) {
    const [workspaceContributions, workspaceIdeas, entitledOfferingIds, briefings] = await Promise.all([
      listWorkspaceContributions(session.user.id, session.activeWorkspace.orgId),
      listIdeas('client', [], session.activeWorkspace.orgId),
      listEntitledSandboxDemos(session.activeWorkspace.orgId),
      listClientBroadcasts(session.activeWorkspace.orgId),
    ]);
    const mine = workspaceContributions.filter((item) => item.author_user_id === session.user.id).map((item) => {
      const payload = item.current_payload as Record<string, unknown> | null;
      return {
        id: String(item.id),
        title: String(payload?.title ?? 'Untitled contribution'),
        state: String(item.state) as ObsState,
        scope: (item.visibility === 'author' ? 'private' : item.visibility === 'community_proposed' ? 'community' : 'org') as keyof typeof SCOPE_LABEL,
        updated: new Date(String(item.updated_at)).toLocaleDateString(),
      };
    });
    const demos = entitledOfferingIds.flatMap((id) => {
      const demo = SANDBOX_DEMOS.find((item) => item.id === id);
      return demo ? [demo] : [];
    });
    const ideas = workspaceIdeas.map((idea) => ({
      id: String(idea.id),
      title: String(idea.title),
      status: String(idea.status) as Parameters<typeof IdeaStatusBadge>[0]['status'],
      update: new Date(String(idea.updated_at)).toLocaleDateString(),
    }));

    return (
      <>
        <PageHeader title={`Welcome back, ${session.user.display_name}`} description={session.activeWorkspace.orgName} actions={<div className="flex flex-wrap gap-2"><PillLink href="/portal/client/resources" tone="outline">Resources</PillLink><PillLink href="/portal/client/observations/new">New observation</PillLink></div>} />
        <PortalContainer className="py-8 md:py-10">
          <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
            <StatTile label="My observations" value={mine.length} />
            <StatTile label="Published" value={mine.filter((item) => item.state === 'published').length} />
            <StatTile label="Needs your attention" value={mine.filter((item) => item.state === 'needs_clarification').length} hint="Clarification requested" />
            <StatTile label="Ideas visible to us" value={ideas.length} />
          </div>
          <section className="mt-10" aria-labelledby="recent-heading">
            <SectionTitle action={<Link href="/portal/client/observations" className="text-sm font-semibold text-az-navy underline-offset-4 hover:underline">All observations</Link>}><span id="recent-heading">Your recent observations</span></SectionTitle>
            {mine.length === 0 ? <p className="text-sm text-az-text-muted">No observations yet. Your drafts will be visible only to you.</p> : <Table><thead><tr><Th>Title</Th><Th>Status</Th><Th>Scope</Th><Th>Updated</Th></tr></thead><tbody>{mine.slice(0, 5).map((item) => <tr key={item.id}><Td><Link href={`/portal/client/observations/${item.id}`} className="font-semibold text-az-navy underline-offset-4 hover:underline">{item.title}</Link></Td><Td><ObsStatus state={item.state} /></Td><Td>{SCOPE_LABEL[item.scope]}</Td><Td>{item.updated}</Td></tr>)}</tbody></Table>}
          </section>
          <section className="mt-10" aria-labelledby="demos-heading"><SectionTitle><span id="demos-heading">Entitled demos</span></SectionTitle>{demos.length === 0 ? <p className="text-sm text-az-text-muted">No demos are currently entitled to this organisation.</p> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{demos.map((demo) => <Card key={demo.id} className="flex flex-col"><p className="text-xs font-semibold uppercase tracking-wider text-az-text-muted">{demo.id}</p><h3 className="mt-2 text-lg font-semibold text-az-navy">{demo.name}</h3><p className="mt-2 flex-1 text-sm text-az-text">{demo.blurb}</p><div className="mt-5"><PillLink href={`/portal/client/demos/${encodeURIComponent(demo.id)}`} tone="outline">Open demo</PillLink></div></Card>)}</div>}</section>
          <section className="mt-10" aria-labelledby="ideas-heading"><SectionTitle><span id="ideas-heading">Improvement ideas</span></SectionTitle>{ideas.length === 0 ? <p className="text-sm text-az-text-muted">No client-visible improvement ideas have been published.</p> : <div className="space-y-4">{ideas.slice(0, 5).map((idea) => <Card key={idea.id} className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between"><h3 className="text-base font-semibold text-az-navy">{idea.title}</h3><div className="flex shrink-0 flex-col items-start gap-2 md:items-end"><IdeaStatusBadge status={idea.status} /><span className="text-xs text-az-text-muted">Last update: {idea.update}</span></div></Card>)}</div>}</section>
          <section className="mt-10" aria-labelledby="briefings-heading"><SectionTitle><span id="briefings-heading">Client briefings & webinars</span></SectionTitle>{briefings.length === 0 ? <p className="text-sm text-az-text-muted">No briefings or webinars are assigned to this organisation.</p> : <div className="grid gap-4 md:grid-cols-2">{briefings.map((item) => { const id = String(item.id); const status = String(item.status); const mediaKind = status === 'live' ? 'join' : status === 'recorded' ? 'recording' : null; return <Card key={id}><div className="flex items-center gap-2"><span className="rounded-full bg-az-grey-bg px-3 py-1 text-xs font-semibold capitalize text-az-navy">{status}</span><span className="text-xs text-az-text-muted">{new Date(String(item.starts_at)).toLocaleString()}</span></div><h3 className="mt-3 text-base font-semibold text-az-navy">{String(item.title)}</h3><p className="mt-2 text-sm text-az-text">{String(item.description || 'Client briefing')}</p>{mediaKind && <a href={`/api/v1/broadcasts/${id}/media?kind=${mediaKind}`} className="mt-4 inline-flex rounded-full bg-az-green px-4 py-2 text-sm font-semibold text-az-navy">{mediaKind === 'join' ? 'Join briefing' : 'Watch recording'}</a>}</Card>; })}</div>}</section>
        </PortalContainer>
      </>
    );
  }

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
