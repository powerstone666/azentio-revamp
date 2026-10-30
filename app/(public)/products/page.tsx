import type { Metadata } from 'next';
import PageHero from '@/app/(ui)/components/pages/PageHero';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import ProductCard from '@/app/(ui)/components/pages/products/ProductCard';
import ProductGrid from '@/app/(ui)/components/pages/products/ProductGrid';
import { CATEGORY_SLUGS, categoryBlurb, categoryName, firstSentence, productHref, productsOf, shortName, tagline } from '@/app/(ui)/components/pages/products/lib';

export const metadata: Metadata = {
  title: 'Products',
  description: 'Azentio banking, capital markets, risk and compliance, insurance and ERP products.',
};

export default function ProductsPage() {
  return (
    <>
      <PageHero eyebrow="Products" title="World class technology. Regional passion." />

      <ProductGrid title="Browse by category">
        {CATEGORY_SLUGS.map((cat, i) => {
          const products = productsOf(cat);
          return (
            <ProductCard
              key={cat}
              href={`/products/${cat}`}
              eyebrow={`${products.length} products`}
              title={categoryName(cat)}
              text={categoryBlurb(cat)}
              variant={i % 4}
              chips={products.map(shortName)}
            />
          );
        })}
      </ProductGrid>

      <ProductGrid title="All products" tint>
        {CATEGORY_SLUGS.flatMap((cat) =>
          productsOf(cat).map((p, i) => (
            <ProductCard
              key={p.path}
              href={productHref(cat, p)}
              eyebrow={categoryName(cat)}
              title={shortName(p)}
              text={firstSentence(tagline(p))}
              variant={i % 4}
            />
          )),
        )}
      </ProductGrid>

      <CtaBand />
    </>
  );
}
