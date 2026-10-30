import { notFound } from 'next/navigation';
import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listPublisherContent } from '@/app/api/(services)/public-content/service';
import PublicContentManager, { type PublicContentRow } from '@/app/(ui)/components/portal/employee/PublicContentManager';
import { PageHeader, PortalContainer, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';

export const instant = false;

export default async function EmployeePublicContentPage() {
  const session = await requirePortalPage('portal:employee:read');
  if (!session) return <><PageHeader title="Public content" description="Demo preview — publishing changes requires a real content-publisher grant." /><PortalContainer className="py-8 md:py-10"><SyntheticNote /></PortalContainer></>;
  if (session.activeWorkspace?.orgType !== 'azentio' && !session.activeWorkspace?.isSandbox) notFound();
  const permission = await authorize({ action: 'content:manage' });
  if (!permission.allowed) notFound();
  const items = await listPublisherContent(session.user.id, session.activeWorkspace.orgId);
  return <><PageHeader title="Public content" description="Manage public announcement banners and publisher-owned pages." crumbs={[{ label: 'Employee dashboard', href: '/portal/employee' }, { label: 'Public content' }]} /><PortalContainer className="py-8 md:py-10"><PublicContentManager initialItems={items.map((item) => ({
    ...item,
    id: String(item.id), kind: item.kind as PublicContentRow['kind'], slug: item.slug == null ? null : String(item.slug),
    title: String(item.title), body: String(item.body), link_label: item.link_label == null ? null : String(item.link_label),
    link_href: item.link_href == null ? null : String(item.link_href), status: item.status as PublicContentRow['status'],
    starts_at: item.starts_at ? new Date(String(item.starts_at)).toISOString() : null,
    ends_at: item.ends_at ? new Date(String(item.ends_at)).toISOString() : null,
    published_at: item.published_at ? new Date(String(item.published_at)).toISOString() : null,
    updated_at: new Date(String(item.updated_at)).toISOString(),
  })) as PublicContentRow[]} /></PortalContainer></>;
}
