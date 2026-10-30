import type { Metadata } from 'next';
import PageHero from '@/app/(ui)/components/pages/PageHero';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import ProductCard from '@/app/(ui)/components/pages/products/ProductCard';
import ProductGrid from '@/app/(ui)/components/pages/products/ProductGrid';
import { categoryName, firstSentence, productHref, productPage, tagline } from '@/app/(ui)/components/pages/products/lib';
import type { CategorySlug } from '@/app/(config)/content';

export const metadata: Metadata = {
  title: 'Solutions',
  description: 'Azentio solutions by business need, linking to the products that address them.',
};

const SOLUTIONS: { title: string; cat: CategorySlug; slug: string }[] = [
  { title: 'AML and sanctions compliance', cat: 'risk-compliance', slug: 'sanctions-screening' },
  { title: 'Islamic banking modernisation', cat: 'banking', slug: 'imal-islamic-banking' },
  { title: 'Digital lending', cat: 'banking', slug: 'lending' },
  { title: 'Claims automation', cat: 'insurance', slug: 'claim-automation' },
  { title: 'Wealth and capital markets', cat: 'capital-markets', slug: 'azentio-mfund-plus-wms-wealth-mgmt' },
  { title: 'ERP cloud', cat: 'erp', slug: 'orion-financial-cloud' },
];

export default function SolutionsPage() {
  return (
    <>
      <PageHero
        eyebrow="Solutions"
        title="Solutions by business need"
        intro="Start from the outcome you need and go to the Azentio product built for it."
      />

      <ProductGrid title="Find your solution">
        {SOLUTIONS.map((s, i) => {
          const page = productPage(s.cat, s.slug);
          if (!page) return null;
          return (
            <ProductCard
              key={s.title}
              href={productHref(s.cat, page)}
              eyebrow={categoryName(s.cat)}
              title={s.title}
              text={firstSentence(tagline(page))}
              variant={i % 4}
            />
          );
        })}
      </ProductGrid>

      <CtaBand />
    </>
  );
}
