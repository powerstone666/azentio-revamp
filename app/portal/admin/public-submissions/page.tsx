import { requirePortalPage } from '@/app/api/(services)/authz/page-guard';
import { Card, PageHeader, PortalContainer, SyntheticNote } from '@/app/(ui)/components/portal/kit/ui';
import { PublicSubmissionInbox } from '@/app/(ui)/components/portal/admin/PublicSubmissionInbox';

export const instant = false;

export default async function AdminPublicSubmissionsPage() {
  const session = await requirePortalPage('public-submissions:manage');

  if (!session) {
    return <>
      <PageHeader title="Public enquiries" description="Private demo enquiry and hackathon registration inbox." crumbs={[{ label: 'Administration', href: '/portal/admin' }, { label: 'Public enquiries' }]} />
      <PortalContainer className="py-8 md:py-10">
        <Card><p className="text-sm text-az-text-muted">Demo preview. Real public submissions and contact details are available only to an authorized platform administrator.</p></Card>
        <SyntheticNote />
      </PortalContainer>
    </>;
  }

  return <>
    <PageHeader title="Public enquiries" description="Triage demo enquiries and hackathon registrations. Contact details are restricted to platform administrators." crumbs={[{ label: 'Administration', href: '/portal/admin' }, { label: 'Public enquiries' }]} />
    <PortalContainer className="py-8 md:py-10">
      <PublicSubmissionInbox />
    </PortalContainer>
  </>;
}
