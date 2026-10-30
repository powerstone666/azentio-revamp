import { Container } from '@/app/(ui)/components/public/ui';
import SectionHead from '@/app/(ui)/components/public/SectionHead';
import PageHero from '@/app/(ui)/components/pages/PageHero';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import CategoryNav from '@/app/(ui)/components/pages/insights/CategoryNav';
import ItemGrid from '@/app/(ui)/components/pages/insights/ItemGrid';
import { INSIGHTS } from '@/app/(config)/home';
import { CASE_ITEMS, AWARD_ITEMS, type InsightItem } from '@/app/(ui)/components/pages/insights/data';

export const metadata = {
  title: 'Azentio resources',
  description: 'Discover the latest Azentio news, blogs and reports as well as updates on industry trends and events.',
};

const LATEST: InsightItem[] = INSIGHTS.map((i) => ({ tag: i.tag, title: i.title, text: '', href: i.href }));

function Block({ eyebrow, title, children }: { eyebrow: string; title: string; children: React.ReactNode }) {
  return (
    <section className="py-12 md:py-16">
      <Container>
        <SectionHead eyebrow={eyebrow} title={title} />
        <div className="mt-10">{children}</div>
      </Container>
    </section>
  );
}

export default function InsightsHubPage() {
  return (
    <>
      <PageHero
        eyebrow="Insights"
        title="Azentio resources"
        intro="Discover the latest Azentio news, blogs and reports as well as updates on industry trends and events."
      />
      <CategoryNav />
      <Block eyebrow="Case studies" title="Success stories, powered by Azentio">
        <ItemGrid items={CASE_ITEMS} />
      </Block>
      <Block eyebrow="Awards" title="Awards and analyst reports">
        <ItemGrid items={AWARD_ITEMS} />
      </Block>
      <Block eyebrow="Latest" title="Latest insights">
        <ItemGrid items={LATEST} />
      </Block>
      <CtaBand />
    </>
  );
}
