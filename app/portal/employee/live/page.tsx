import { notFound } from 'next/navigation';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listClientOrganizationsForPublisher, listEmployeeBroadcasts, listManagedBroadcasts } from '@/app/api/(services)/broadcasts/service';
import { PageHeader, PortalContainer, Card, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { Pill } from '@/app/(ui)/components/portal/kit/Status';
import { SESSIONS } from '@/app/(config)/mock/portal';
import BroadcastManager from '@/app/(ui)/components/portal/employee/BroadcastManager';

export const instant = false;

const tones: Record<string, 'navy' | 'mint' | 'grey'> = { live: 'navy', scheduled: 'mint', recorded: 'grey' };

export default async function EmployeeLivePage() {
  const session = await getSession();
  if (!session) return <><PageHeader title="Live sessions" description="Demo sessions are synthetic and links are disabled." crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Live sessions' }]} /><PortalContainer className="py-8 md:py-10"><div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{SESSIONS.map((item) => <Card key={item.id}><div className="flex flex-wrap gap-2"><Pill tone={item.status === 'Live' ? 'navy' : item.status === 'Upcoming' ? 'mint' : 'grey'}>{item.status}</Pill><Pill>{item.audience}</Pill></div><h2 className="mt-4 text-lg font-semibold text-az-navy">{item.title}</h2><p className="mt-2 text-sm text-az-text">{item.when}</p><p className="mt-1 text-sm text-az-text-muted">Host: {item.host}</p><p className="mt-4 text-xs text-az-text-muted">Synthetic demo entry. No real stream or recording is connected.</p></Card>)}</div><SyntheticNote /></PortalContainer></>;
  const employeeRead = await authorize({ action: 'portal:employee:read' });
  const manage = await authorize({ action: 'broadcast:manage' });
  if (!employeeRead.allowed && !manage.allowed) notFound();

  const orgId = session.activeWorkspace!.orgId;
  const sessions = employeeRead.allowed ? await listEmployeeBroadcasts(orgId) : [];
  const [managedSessions, clientOrganizations] = manage.allowed
    ? await Promise.all([listManagedBroadcasts(orgId), session.activeWorkspace?.isSandbox ? [] : listClientOrganizationsForPublisher(session.user.id, orgId)])
    : [[], []];
  return <><PageHeader title="Live sessions" description="Employee sessions, client briefings and invitation-only webinars." crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Live sessions' }]} /><PortalContainer className="py-8 md:py-10"><Card className="mb-8 border-l-4 border-az-mint"><p className="text-sm text-az-text">Employee session links are available only to active employees. Client webinars are visible only to active members of invited client workspaces.</p></Card>{manage.allowed && <div className="mb-10"><BroadcastManager sessions={managedSessions.map((item) => ({ id: String(item.id), title: String(item.title), status: item.status, audience: item.audience, invited_org_ids: item.invited_org_ids }))} clientOrganizations={clientOrganizations} /></div>}{sessions.length === 0 ? <Card><p className="text-sm text-az-text-muted">No employee sessions are scheduled or available yet.</p></Card> : <div className="grid gap-5 md:grid-cols-2 lg:grid-cols-3">{sessions.map((item) => {
    const status = String(item.status);
    const id = String(item.id);
    const mediaKind = status === 'live' ? 'join' : status === 'recorded' ? 'recording' : null;
    return <Card key={id} className="flex flex-col"><div className="flex flex-wrap gap-2"><Pill tone={tones[status] ?? 'grey'}>{status}</Pill><Pill>Employees</Pill></div><h2 className="mt-4 text-lg font-semibold text-az-navy">{String(item.title)}</h2><p className="mt-2 text-sm text-az-text">{String(item.description || 'Employee session')}</p><p className="mt-3 text-xs text-az-text-muted">{new Date(String(item.starts_at)).toLocaleString()} · Host: {String(item.host)}</p>{mediaKind && <a href={`/api/v1/broadcasts/${id}/media?kind=${mediaKind}`} className="mt-5 inline-flex w-fit rounded-full bg-az-green px-5 py-2.5 text-sm font-semibold text-az-navy">{mediaKind === 'join' ? 'Join session' : 'Watch recording'}</a>}</Card>;
  })}</div>}</PortalContainer></>;
}
