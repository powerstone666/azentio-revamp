import type { Metadata } from 'next';
import LinkPage from '@/app/(ui)/components/pages/company/LinkPage';

export const metadata: Metadata = { title: 'Become a partner | Azentio', description: 'Partner with Azentio: partner portal, the REACH partner programme and how to get in touch.' };

export default function BecomePartnerPage() {
  return (
    <LinkPage
      eyebrow="Partners"
      title="Become a partner"
      intro="Azentio works with partners across its product lines. Existing partners can sign in to the partner portal, and new partners can start with the REACH programme or a conversation with our team."
      crumbs={[{ label: 'Support', href: '/support' }, { label: 'Partners' }, { label: 'Become a partner' }]}
      photo={{ src: '/images/partners.jpg', alt: 'Business partners shaking hands' }}
      variant={1}
      cards={[
        { title: 'Partner portal', text: 'Existing partners sign in to the Azentio partner portal.', href: 'https://partnerportal.azentio.com/partnerportal/', external: true },
        { title: 'REACH partner programme', text: 'See how the REACH programme helps partners grow with Azentio ERP.', href: '/support/partners/reach-partner-program' },
        { title: 'Start a conversation', text: 'Tell us about your business and what you would like to build together.', href: '/connect' },
      ]}
    />
  );
}
