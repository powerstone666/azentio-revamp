import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { getContentPage } from '@/app/(config)/content';
import { Container } from '@/app/(ui)/components/public/ui';
import SectionHead from '@/app/(ui)/components/public/SectionHead';
import PageHero from '@/app/(ui)/components/pages/PageHero';
import ContentSections from '@/app/(ui)/components/pages/ContentSections';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import ItemGrid from '@/app/(ui)/components/pages/insights/ItemGrid';
import {
  INSIGHT_CATEGORIES,
  INSIGHT_PATHS,
  ITEMS_BY_SLUG,
  heroIntro,
  insightSections,
  isInsightPage,
  type InsightSlug,
} from '@/app/(ui)/components/pages/insights/data';

export const instant = false;

type Props = { params: Promise<{ slug: string }> };

const LABELS: Record<string, string> = Object.fromEntries(INSIGHT_CATEGORIES.map((c) => [c.slug, c.label]));

// Eyebrows and list headings for the item grids that follow the scraped copy.
const ITEM_HEADINGS: Partial<Record<InsightSlug, { eyebrow: string; title: string }>> = {
  'thought-leadership': { eyebrow: 'Related reading', title: 'More thought leadership' },
  'news-and-announcements': { eyebrow: 'Updates', title: 'Recent announcements' },
  'awards-and-analyst-reports': { eyebrow: 'Recognition', title: 'Awards and analyst recognition' },
  'case-studies-and-testimonials': { eyebrow: 'Customers', title: 'Customer stories' },
  brochures: { eyebrow: 'Brochures', title: 'Product brochures by industry' },
  whitepaper: { eyebrow: 'Guides', title: 'Guides and resources' },
};

export function generateStaticParams() {
  return Object.keys(INSIGHT_PATHS).map((slug) => ({ slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  if (!isInsightPage(slug)) return {};
  const page = getContentPage(INSIGHT_PATHS[slug]);
  if (!page) return {};
  if (slug === 'whitepaper') return { title: 'The Connected Core: Modernize without compromise | Azentio', description: 'Whitepaper on core banking modernization in Islamic banking, produced with IBS Intelligence.' };
  return { title: page.metaTitle, description: page.description };
}

export default async function InsightPage({ params }: Props) {
  const { slug } = await params;
  if (!isInsightPage(slug)) notFound();
  const path = INSIGHT_PATHS[slug];
  const page = getContentPage(path);
  if (!page) notFound();

  const isArticle = slug === 'aml-software-buyers-guide';
  // The live site has no copy for this page (it redirects to its homepage), so it gets an explicit title and real link.
  const isWhitepaper = slug === 'whitepaper';
  const whitepaper = isWhitepaper ? getContentPage('/whitepaper/digital-transformation-islamic-banking-whitepaper') : undefined;
  const eyebrow = isArticle ? 'Buyer’s guide' : (LABELS[slug] ?? 'Insights');
  const items = isArticle ? [] : ITEMS_BY_SLUG[slug as InsightSlug];
  const heading = isArticle ? undefined : ITEM_HEADINGS[slug as InsightSlug];

  return (
    <>
      <PageHero
        eyebrow={eyebrow}
        title={isWhitepaper && whitepaper ? whitepaper.title : page.title}
        intro={isWhitepaper && whitepaper ? whitepaper.intro[0].replace(/\s*Download the whitepaper\s*$/i, '') : heroIntro(path)}
        crumbs={[{ label: 'Insights', href: '/insights' }, { label: isWhitepaper ? 'Whitepaper' : page.title }]}
        variant={isArticle ? 1 : 0}
      />
      {isWhitepaper ? (
        <>
          {whitepaper && (
            <section className="py-12 md:py-16">
              <Container>
                <div className="max-w-3xl space-y-4">
                  {whitepaper.intro.slice(1).map((t) => (
                    <p key={t} className="text-lg leading-relaxed text-muted">{t}</p>
                  ))}
                </div>
              </Container>
            </section>
          )}
          {whitepaper && <ContentSections sections={whitepaper.sections} />}
          <section className="pb-12 md:pb-16">
            <Container>
              <a
                href="https://www.azentio.com/whitepaper/digital-transformation-islamic-banking-whitepaper"
                target="_blank"
                rel="noopener noreferrer"
                className="focus-ring inline-flex rounded-full bg-accent px-7 py-3.5 font-semibold text-on-accent transition hover:brightness-105"
              >
                Read the full whitepaper on azentio.com (new tab)
              </a>
            </Container>
          </section>
        </>
      ) : (
        <ContentSections sections={insightSections(path)} />
      )}
      {heading && items.length > 0 && (
        <section className="py-12 md:py-16">
          <Container>
            <SectionHead eyebrow={heading.eyebrow} title={heading.title} />
            <div className="mt-10">
              <ItemGrid items={items} />
            </div>
          </Container>
        </section>
      )}
      <CtaBand />
    </>
  );
}
