import type { Metadata } from 'next';
import LinkPage from '@/app/(ui)/components/pages/company/LinkPage';

export const metadata: Metadata = { title: 'Talent transformation journey | Azentio', description: 'Azentio academy: the talent transformation journey.' };

export default function TalentJourneyPage() {
  return (
    <LinkPage
      eyebrow="Azentio academy"
      title="Talent transformation journey"
      intro="This is part of the Azentio academy. The public azentio.com site lists it under Our academy; a detailed write-up is not included in this demo build."
      crumbs={[{ label: 'About', href: '/about' }, { label: 'Academy', href: '/about/academy' }, { label: 'Talent transformation journey' }]}
      variant={0}
      cards={[
        { title: 'Back to the academy', text: 'See the academy overview.', href: '/about/academy' },
        { title: 'Careers', text: 'Roles and teams at Azentio.', href: '/about/careers' },
      ]}
    />
  );
}
