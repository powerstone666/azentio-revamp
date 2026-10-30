import ContentPage, { contentMetadata } from '@/app/(ui)/components/pages/company/ContentPage';

export const metadata = contentMetadata('/our-presence');

export default function PresencePage() {
  return (
    <ContentPage
      path="/our-presence"
      eyebrow="Presence"
      crumbs={[{ label: 'About', href: '/about' }, { label: 'Presence' }]}
      variant={2}
    />
  );
}
