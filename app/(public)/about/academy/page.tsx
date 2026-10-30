import type { Metadata } from 'next';
import LinkPage from '@/app/(ui)/components/pages/company/LinkPage';

export const metadata: Metadata = { title: 'Azentio academy | Azentio', description: 'Azentio academy and the talent transformation journey.' };

export default function AcademyPage() {
  return (
    <LinkPage
      eyebrow="About Azentio"
      title="Azentio academy"
      intro="The academy is where Azentio develops its people. Follow the talent transformation journey, or see what it is like to work here."
      crumbs={[{ label: 'About', href: '/about' }, { label: 'Academy' }]}
      photo={{ src: '/images/academy.jpg', alt: 'Trainer presenting to a group of learners' }}
      variant={3}
      cards={[
        { title: 'Talent transformation journey', text: 'The programme the academy runs to build skills across the company.', href: '/about/academy/talent-transformation-journey' },
        { title: 'Careers', text: 'Roles, teams and what working at Azentio looks like.', href: '/about/careers' },
        { title: 'Talk to us', text: 'Questions about the academy or about working with Azentio.', href: '/connect' },
      ]}
    />
  );
}
