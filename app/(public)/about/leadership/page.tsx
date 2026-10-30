import ContentPage, { contentMetadata } from '@/app/(ui)/components/pages/company/ContentPage';

export const metadata = contentMetadata('/our-leadership');

export default function LeadershipPage() {
  return (
    <ContentPage
      path="/our-leadership"
      eyebrow="Leadership"
      crumbs={[{ label: 'About', href: '/about' }, { label: 'Leadership' }]}
      photo={{ src: '/images/about-leadership.jpg', alt: 'Senior leadership in a boardroom' }}
      variant={1}
    />
  );
}
