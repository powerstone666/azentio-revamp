import type { Metadata } from 'next';
import LinkPage from '@/app/(ui)/components/pages/company/LinkPage';

export const metadata: Metadata = { title: 'Support and services | Azentio', description: 'Reach Azentio support, read the software support policy, or talk to us about services.' };

export default function SupportPage() {
  return (
    <LinkPage
      eyebrow="Support"
      title="Support and services"
      intro="Customers reach Azentio support through the service desk. The software support policy explains what is covered, and our team can talk you through services for your products."
      crumbs={[{ label: 'Support' }]}
      photo={{ src: '/images/support.jpg', alt: 'Support specialist with a headset' }}
      variant={2}
      cards={[
        { title: 'Support portal', text: 'Customers sign in to the Azentio service desk to raise and follow requests.', href: 'https://one.az.azentio.com/servicedesk/customer/user/login?destination=portals', external: true },
        { title: 'Software support policy', text: 'Read the published policy that sets out how Azentio supports its software.', href: 'https://www.azentio.com/services/azentio-software-support-policy', external: true },
        { title: 'Talk to us about services', text: 'Tell us what you run today and what you need, and we will point you to the right team.', href: '/connect' },
      ]}
    />
  );
}
