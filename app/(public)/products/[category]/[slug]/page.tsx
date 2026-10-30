import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PageHero from '@/app/(ui)/components/pages/PageHero';
import ContentSections from '@/app/(ui)/components/pages/ContentSections';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import ProductCard from '@/app/(ui)/components/pages/products/ProductCard';
import ProductGrid from '@/app/(ui)/components/pages/products/ProductGrid';
import { CATEGORY_SLUGS, categoryName, firstSentence, isCategory, normalizeSections, productHref, productPage, productsOf, shortName, tagline } from '@/app/(ui)/components/pages/products/lib';
import { slugOf } from '@/app/(config)/content';

export const instant = false;

type Props = { params: Promise<{ category: string; slug: string }> };

export function generateStaticParams() {
  return CATEGORY_SLUGS.flatMap((category) => productsOf(category).map((p) => ({ category, slug: slugOf(p.path) })));
}

function load(category: string, slug: string) {
  if (!isCategory(category)) return undefined;
  const page = productPage(category, slug);
  if (!page) return undefined;
  const siblings = productsOf(category);
  return { cat: category, page, index: siblings.findIndex((p) => p.path === page.path), siblings };
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category, slug } = await params;
  const found = load(category, slug);
  if (!found) return {};
  return { title: found.page.metaTitle, description: found.page.description };
}

export default async function ProductPage({ params }: Props) {
  const { category, slug } = await params;
  const found = load(category, slug);
  if (!found) notFound();
  const { cat, page, index, siblings } = found;
  const related = siblings.filter((p) => p.path !== page.path);

  return (
    <>
      <PageHero
        eyebrow={categoryName(cat)}
        title={page.title}
        intro={tagline(page)}
        crumbs={[
          { label: 'Products', href: '/products' },
          { label: categoryName(cat), href: `/products/${cat}` },
          { label: shortName(page) },
        ]}
        primary={{ label: 'Request a demo', href: '/connect' }}
        variant={index % 4}
      />

      <ContentSections sections={normalizeSections(page.sections)} />

      {related.length > 0 && (
        <ProductGrid title="Related products" tint>
          {related.map((p, i) => (
            <ProductCard
              key={p.path}
              href={productHref(cat, p)}
              eyebrow={categoryName(cat)}
              title={shortName(p)}
              text={firstSentence(tagline(p))}
              variant={i % 4}
            />
          ))}
        </ProductGrid>
      )}

      <CtaBand />
    </>
  );
}
