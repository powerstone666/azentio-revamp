import ContentPage, { contentMetadata } from '@/app/(ui)/components/pages/company/ContentPage';

export const metadata = contentMetadata('/partner-with-us/reach-partner-program');

export default function ReachPartnerProgramPage() {
  return (
    <ContentPage
      path="/partner-with-us/reach-partner-program"
      eyebrow="Partners"
      crumbs={[{ label: 'Support', href: '/support' }, { label: 'Partners' }, { label: 'Reach partner program' }]}
      variant={0}
    />
  );
}
