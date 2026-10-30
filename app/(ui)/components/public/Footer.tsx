import Link from 'next/link';
import Image from 'next/image';
import { Container } from './ui';
import { PRODUCT_CATEGORIES } from '@/app/(config)/nav';

const COLUMNS = [
  { title: 'Products', links: PRODUCT_CATEGORIES.map((c) => ({ label: c.label, href: c.href })) },
  {
    title: 'Innovation',
    links: [
      { label: 'AI Lab', href: '/lab' },
      { label: 'Technology', href: '/technology' },
      { label: 'Hackathons', href: '/hackathon/register' },
      { label: 'Solutions', href: '/solutions' },
    ],
  },
  {
    title: 'Resources',
    links: [
      { label: 'Insights', href: '/insights' },
      { label: 'Media & videos', href: '/media' },
      { label: 'Support', href: '/support' },
      { label: 'About Azentio', href: '/about' },
    ],
  },
  {
    title: 'Connect',
    links: [
      { label: 'Request a demo', href: '/connect' },
      { label: 'Contact us', href: '/connect' },
      { label: 'Sign in', href: '/login' },
    ],
  },
];

export default function Footer() {
  return (
    <footer className="border-t border-line bg-surface-2/60">
      <Container className="py-16">
        <div className="grid gap-12 md:grid-cols-[1.3fr_repeat(4,1fr)]">
          <div>
            <Image src="/brand/azentio-logo.svg" alt="Azentio" width={132} height={36} className="h-8 w-auto" />
            <p className="mt-5 max-w-xs text-sm leading-relaxed text-muted">
              Intelligence-driven technology for banking, insurance, capital markets and ERP, and a secure place to learn from each other.
            </p>
          </div>
          {COLUMNS.map((col) => (
            <nav key={col.title} aria-label={col.title}>
              <h2 className="font-medium text-xs uppercase tracking-[0.18em] text-faint">{col.title}</h2>
              <ul className="mt-4 space-y-2.5">
                {col.links.map((l) => (
                  <li key={l.label}>
                    <Link href={l.href} className="focus-ring text-[15px] text-muted transition hover:text-ink">
                      {l.label}
                    </Link>
                  </li>
                ))}
              </ul>
            </nav>
          ))}
        </div>
        <div className="mt-10 flex flex-col gap-4 border-t border-line pt-6 text-sm text-faint md:flex-row md:items-start md:justify-between">
          <p>© 2026 Azentio. Product information is indicative and subject to validation.</p>
          <div className="md:text-right">
            <p className="font-medium text-muted">Built by Tech Wizards for the Azentio Hackathon, 31 Oct 2026</p>
            <p className="mt-1">
              <a href="https://github.com/powerstone666" target="_blank" rel="noopener noreferrer" className="focus-ring underline-offset-4 hover:text-ink hover:underline">
                Imran Pasha
              </a>
              {' · '}Koora Sai Sujith{' · '}Sai Surya Teja Gontumukkala
            </p>
          </div>
        </div>
      </Container>
    </footer>
  );
}
