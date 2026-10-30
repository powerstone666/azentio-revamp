import { CATEGORY_PATHS, childrenOf, getContentPage, slugOf, type CategorySlug, type ContentPage, type ContentSection } from '@/app/(config)/content';

export const CATEGORY_SLUGS = Object.keys(CATEGORY_PATHS) as CategorySlug[];

export const isCategory = (s: string): s is CategorySlug => s in CATEGORY_PATHS;

export const categoryName = (cat: CategorySlug): string => CATEGORY_PATHS[cat].name;

/** Products (direct children) of a category, in scraped order. */
export const productsOf = (cat: CategorySlug): ContentPage[] => childrenOf(CATEGORY_PATHS[cat].path);

/** A product page by category and URL slug, or undefined when the scrape has no such child page. */
export const productPage = (cat: CategorySlug, slug: string): ContentPage | undefined =>
  getContentPage(`${CATEGORY_PATHS[cat].path}/${slug}`);

export const productHref = (cat: CategorySlug, page: ContentPage): string => `/products/${cat}/${slugOf(page.path)}`;

const UI_LINE = /^(request a demo|view case study|view brochure|download|free scan|explore|industry categories|find out|learn more|book a demo|start your|read )/i;

/** First meaningful intro line (the scrape mixes taglines with button labels). */
export function tagline(page: ContentPage): string {
  const best = page.intro.find((l) => l.length >= 28 && !UI_LINE.test(l));
  return best ?? page.intro.find((l) => !UI_LINE.test(l)) ?? page.description;
}

/** Tagline of a category landing page, for the hub cards. */
export const categoryBlurb = (cat: CategorySlug): string => {
  const page = getContentPage(CATEGORY_PATHS[cat].path);
  return page ? tagline(page) : '';
};

/** First intro line longer than 60 characters, used as the hero intro on category pages. */
export const leadIntro = (page: ContentPage): string | undefined => page.intro.find((l) => l.length > 60 && !UI_LINE.test(l));

/** Short display name, from the breadcrumb where there is one (e.g. "Sanctions screening"). */
export function shortName(page: ContentPage): string {
  const raw = page.breadcrumbs[page.breadcrumbs.length - 1] ?? page.title;
  return raw.charAt(0).toUpperCase() + raw.slice(1);
}

export function firstSentence(text: string): string {
  const m = text.match(/^.+?[.!?](\s|$)/);
  return (m ? m[0] : text).trim();
}

const SKIP_HEADINGS = /customers say|neighbours|winning with us/i;
const isShort = (t: string) => t.length < 60 && !/[.!?]$/.test(t);
const isLong = (t: string) => t.length >= 50;

// Trailing link labels the scrape glues onto card and paragraph text.
const TRAILING_LINK = /\s*(learn more|find out more|read more|view brochure|view case study|view pcs brochure|download brochure)\s*$/i;
const cleanText = (t: string) => t.replace(TRAILING_LINK, '').trim();
// Scraped card titles often carry a list number glued to the word ("01General finance").
const cleanTitle = (t: string) => t.replace(/^\d{1,2}\s*(?=[A-Za-z])/, '').trim();

/**
 * The scrape often flattens "title / description" pairs into one text list. Rebuild them as cards,
 * keep a leading paragraph as prose and loose short phrases as bullets, and drop testimonial blocks.
 */
export function normalizeSections(sections: ContentSection[]): ContentSection[] {
  return sections
    .filter((s) => !SKIP_HEADINGS.test(s.heading))
    .map((s) => {
      const cards = s.cards
        .map((c) => ({ title: cleanTitle(c.title), text: cleanText(c.text) }))
        .filter((c) => c.title && c.text);
      if (cards.length > 0 || s.text.length < 3) return { ...s, cards };
      const lead: string[] = [];
      const bullets: string[] = [];
      const t = s.text.map(cleanText).filter(Boolean);
      let i = 0;
      while (i < t.length && isLong(t[i]) && !isShort(t[i])) lead.push(t[i++]);
      for (; i < t.length; i++) {
        const line = t[i];
        if (line.startsWith('• ')) {
          bullets.push(line);
        } else if (isShort(line) && i + 1 < t.length && isLong(t[i + 1])) {
          cards.push({ title: cleanTitle(line), text: t[i + 1] });
          i++;
        } else if (isShort(line)) {
          bullets.push(`• ${line}`);
        } else {
          lead.push(line);
        }
      }
      if (cards.length === 0) return { ...s, text: [...lead, ...bullets] };
      return { ...s, text: lead, cards };
    });
}
