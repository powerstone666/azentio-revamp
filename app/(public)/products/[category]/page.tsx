import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import PageHero from '@/app/(ui)/components/pages/PageHero';
import ContentSections from '@/app/(ui)/components/pages/ContentSections';
import CtaBand from '@/app/(ui)/components/pages/CtaBand';
import ProductCard from '@/app/(ui)/components/pages/products/ProductCard';
import ProductGrid from '@/app/(ui)/components/pages/products/ProductGrid';
import { CATEGORY_SLUGS, categoryName, firstSentence, isCategory, leadIntro, normalizeSections, productHref, productsOf, shortName, tagline } from '@/app/(ui)/components/pages/products/lib';
import { CATEGORY_PATHS, getContentPage } from '@/app/(config)/content';

export const instant = false;

// Scraped blocks that only repeat the product grid below (product names as cards or carousel tiles).
const EXCLUDE = ['the industries where we make an impact', 'uncomplicating capital markets', 'an armor against financial crime'];

type Props = { params: Promise<{ category: string }> };

export function generateStaticParams() {
  return CATEGORY_SLUGS.map((category) => ({ category }));
}

function load(category: string) {
  if (!isCategory(category)) return undefined;
  const page = getContentPage(CATEGORY_PATHS[category].path);
  return page ? { cat: category, page } : undefined;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { category } = await params;
  const found = load(category);
  if (!found) return {};
  return { title: found.page.metaTitle, description: found.page.description };
}

export default async function CategoryPage({ params }: Props) {
  const { category } = await params;
  const found = load(category);
  if (!found) notFound();
  const { cat, page } = found;
  const products = productsOf(cat);

  return (
    <>
      <PageHero
        eyebrow={categoryName(cat)}
        title={page.title}
        intro={leadIntro(page)}
        crumbs={[{ label: 'Products', href: '/products' }, { label: categoryName(cat) }]}
        primary={{ label: 'Request a demo', href: '/connect' }}
        variant={CATEGORY_SLUGS.indexOf(cat)}
      />

      <ContentSections sections={normalizeSections(page.sections)} keep={['products', 'our products']} exclude={EXCLUDE} />

      {products.length > 0 && (
        <ProductGrid title={`Products in ${categoryName(cat)}`}>
          {products.map((p, i) => (
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
