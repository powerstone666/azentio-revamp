import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getIdea, getIdeaEvidence, getIdeaHistory, getIdeaScope } from '@/app/api/(services)/ideas/service';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { IdeaStatusBadge, Pill } from '@/app/(ui)/components/portal/kit/Status';
import { Card, PageHeader, PortalContainer, SectionTitle, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { AuditTimeline } from '@/app/(ui)/components/portal/staff/AuditTimeline';
import IdeaStatusEditor from '@/app/(ui)/components/portal/staff/IdeaStatusEditor';
import { getIdea as getMockIdea, IDEAS } from '@/app/(config)/mock/portal';
import type { IdeaStatus } from '@/app/(common-lib)/types';

export const instant = false;
interface Props { params: Promise<{ ideaId: string }> }
export function generateStaticParams() { return IDEAS.map((idea) => ({ ideaId: idea.id })); }

export default async function ProductOwnerIdeaDetailPage({ params }: Props) {
  const session = await requirePortalPage('portal:product-owner:read');
  const { ideaId } = await params;
  let idea: Record<string, unknown>;
  let evidence: { id: string; title: string; observation_type: string }[];
  let history: { action: string; actor: string; at: Date | string }[];

  if (!session) {
    const preview = getMockIdea(ideaId);
    if (!preview) notFound();
    idea = { ...preview, owner_team: preview.owner, offering: preview.offering, status: preview.status };
    evidence = preview.evidence.map((title) => ({ id: title, title, observation_type: 'Approved theme' }));
    history = preview.audit.map((entry) => ({ action: entry.action, actor: entry.actor, at: entry.at }));
  } else {
    const scope = await getIdeaScope(ideaId, session.activeWorkspace!.orgId);
    if (!scope?.offering) notFound();
    const permission = await authorize({ action: 'ideas:owner-read', resource: { type: 'idea', id: ideaId, offeringId: scope.offering } });
    if (!permission.allowed) notFound();
    const ownerIdea = await getIdea(ideaId, 'internal', [scope.offering], session.activeWorkspace!.orgId);
    if (!ownerIdea) notFound();
    const [evidenceRows, historyRows] = await Promise.all([getIdeaEvidence(ideaId, session.activeWorkspace!.orgId), getIdeaHistory(ideaId)]);
    idea = ownerIdea;
    evidence = evidenceRows.map((item) => ({ id: item.id, title: String(item.title ?? 'Approved contribution'), observation_type: String(item.observation_type ?? 'Observation') }));
    history = historyRows;
  }

  const id = String(idea.id);
  const status = String(idea.status);
  return <>
    <PageHeader title={String(idea.title)} crumbs={[{ label: 'Product owner', href: '/portal/product-owner' }, { label: 'Ideas' }, { label: id }]} actions={<IdeaStatusBadge status={status as IdeaStatus} />} />
    <PortalContainer className="py-8 md:py-10">
      <div className="grid gap-6 lg:grid-cols-[2fr_1fr]">
        <div className="space-y-6">
          <Card><dl className="grid gap-x-8 gap-y-4 text-sm sm:grid-cols-2"><div><dt className="text-az-text-muted">Offering</dt><dd className="font-semibold text-az-navy">{String(idea.offering ?? '—')}</dd></div><div><dt className="text-az-text-muted">Owner team</dt><dd className="font-semibold text-az-navy">{String(idea.owner_team || 'Unassigned')}</dd></div><div><dt className="text-az-text-muted">Priority</dt><dd className="font-semibold capitalize text-az-navy">{String(idea.priority)}</dd></div><div><dt className="text-az-text-muted">Audience</dt><dd className="font-semibold capitalize text-az-navy">{String(idea.audience)}</dd></div></dl><div className="mt-6"><p className="text-sm font-semibold text-az-navy">Problem statement</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-az-text">{String(idea.problem_statement ?? '')}</p></div><div className="mt-5"><p className="text-sm font-semibold text-az-navy">Proposed outcome</p><p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-az-text">{String(idea.proposed_outcome ?? idea.clientText ?? '')}</p></div></Card>
          <Card><SectionTitle>Supporting approved evidence</SectionTitle>{evidence.length ? <ul className="divide-y divide-az-grey-bg">{evidence.map((item) => <li key={item.id} className="py-3"><p className="font-semibold text-az-navy">{item.title}</p><p className="mt-1 text-xs text-az-text-muted">{item.observation_type} · Approved shared evidence</p></li>)}</ul> : <p className="text-sm text-az-text-muted">No evidence remains available for this idea.</p>}</Card>
          <Card><div className="flex items-center gap-2"><p className="text-sm font-semibold text-az-navy">Client visibility</p><Pill>{String(idea.audience) === 'clients' ? 'Client visible' : 'Internal only'}</Pill></div><p className="mt-2 text-sm leading-relaxed text-az-text">{String(idea.client_update || 'No client-facing update has been added.')}</p><p className="mt-2 text-xs text-az-text-muted">Clients see the approved update, status, owner team and evidence references. Internal problem and outcome details remain limited to product owners.</p></Card>
        </div>
        <div className="space-y-6">
          {session ? <Card><IdeaStatusEditor key={`${status}:${String(idea.client_update ?? '')}`} ideaId={id} status={status} clientUpdate={String(idea.client_update ?? '')} clientVisible={String(idea.audience) === 'clients'} /></Card> : <Card><p className="text-sm text-az-text-muted">Demo mode. Status changes are not saved.</p></Card>}
          <Card><SectionTitle>Status history</SectionTitle><AuditTimeline entries={history} /></Card>
          <Link href="/portal/product-owner/themes" className="inline-flex rounded-full border border-az-grey-bg px-5 py-2.5 text-sm font-semibold text-az-navy">Review themes</Link>
        </div>
      </div>
      {!session && <SyntheticNote />}
    </PortalContainer>
  </>;
}
