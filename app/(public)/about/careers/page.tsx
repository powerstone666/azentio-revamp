import ContentPage, { contentMetadata } from '@/app/(ui)/components/pages/company/ContentPage';

export const metadata = contentMetadata('/careers');

export default function CareersPage() {
  return (
    <ContentPage
      path="/careers"
      eyebrow="Careers"
      crumbs={[{ label: 'About', href: '/about' }, { label: 'Careers' }]}
      photo={{ src: '/images/careers.jpg', alt: 'Colleagues collaborating in a sunny office' }}
      variant={3}
    />
  );
}
