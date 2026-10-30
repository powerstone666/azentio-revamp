import Link from 'next/link';
import { Container } from '@/app/(ui)/components/public/ui';
import { INSIGHT_CATEGORIES, type InsightSlug } from './data';

export default function CategoryNav({ current }: { current?: InsightSlug | 'article' }) {
  return (
    <div className="border-b border-line bg-surface">
      <Container className="py-4">
        <nav aria-label="Insight categories">
          <ul className="flex flex-wrap gap-2">
            <li>
              <Link
                href="/insights"
                aria-current={current === undefined ? 'page' : undefined}
                className={`focus-ring inline-flex rounded-full border px-4 py-2 text-sm font-medium transition ${
                  current === undefined ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-accent-strong hover:text-ink'
                }`}
              >
                All insights
              </Link>
            </li>
            {INSIGHT_CATEGORIES.map((c) => (
              <li key={c.slug}>
                <Link
                  href={`/insights/${c.slug}`}
                  aria-current={current === c.slug ? 'page' : undefined}
                  className={`focus-ring inline-flex rounded-full border px-4 py-2 text-sm font-medium transition ${
                    current === c.slug ? 'border-accent bg-accent text-on-accent' : 'border-line text-muted hover:border-accent-strong hover:text-ink'
                  }`}
                >
                  {c.label}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </Container>
    </div>
  );
}
