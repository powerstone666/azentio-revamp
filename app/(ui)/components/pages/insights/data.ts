import { getContentPage, type ContentCard, type ContentSection } from '@/app/(config)/content';
import { CASES, AWARDS, INSIGHTS, CATEGORIES } from '@/app/(config)/home';

// Insights taxonomy, item cards and cleaned scraped sections.
// All text comes from the scraped azentio.com copy (home, /insights hub, category pages, buyer's guide).

export type InsightSlug =
  | 'thought-leadership'
  | 'events-and-webinars'
  | 'news-and-announcements'
  | 'awards-and-analyst-reports'
  | 'case-studies-and-testimonials'
  | 'brochures'
  | 'whitepaper';

export interface InsightCategory {
  slug: InsightSlug;
  label: string;
}

export const INSIGHT_CATEGORIES: InsightCategory[] = [
  { slug: 'thought-leadership', label: 'Thought leadership' },
  { slug: 'events-and-webinars', label: 'Events & webinars' },
  { slug: 'news-and-announcements', label: 'News & announcements' },
  { slug: 'awards-and-analyst-reports', label: 'Awards & analyst reports' },
  { slug: 'case-studies-and-testimonials', label: 'Case studies & testimonials' },
  { slug: 'brochures', label: 'Brochures' },
  { slug: 'whitepaper', label: 'Whitepapers' },
];

export const ARTICLE_SLUG = 'aml-software-buyers-guide';
export const ARTICLE_PATH = '/thought-leadership/aml-software-buyers-guide';

/** Every dynamic insights route and the scraped page it renders. */
export const INSIGHT_PATHS: Record<InsightSlug | typeof ARTICLE_SLUG, string> = {
  'thought-leadership': '/insights/thought-leadership',
  'events-and-webinars': '/insights/events-and-webinars',
  'news-and-announcements': '/insights/news-and-announcements',
  'awards-and-analyst-reports': '/insights/awards-and-analyst-reports',
  'case-studies-and-testimonials': '/insights/case-studies-and-testimonials',
  brochures: '/insights/brochures',
  whitepaper: '/insights/whitepaper',
  [ARTICLE_SLUG]: ARTICLE_PATH,
};

export const isInsightPage = (s: string): s is keyof typeof INSIGHT_PATHS =>
  Object.prototype.hasOwnProperty.call(INSIGHT_PATHS, s);

export interface InsightItem {
  tag: string;
  title: string;
  text: string;
  /** Where the card links to. */
  href: string;
}

const cat = (slug: InsightSlug) => `/insights/${slug}`;

const guide = getContentPage(ARTICLE_PATH);
const relatedCards = guide?.sections.find((s) => s.heading === 'Related posts')?.cards ?? [];
const pick = (needle: string, tag: string, href: string): InsightItem[] => {
  const c = relatedCards.find((r) => r.title.toLowerCase().includes(needle.toLowerCase()));
  return c ? [{ tag, title: c.title, text: c.text, href }] : [];
};

export const CASE_ITEMS: InsightItem[] = CASES.map((c) => ({
  tag: c.tag,
  title: c.title,
  text: c.text,
  href: cat('case-studies-and-testimonials'),
}));

export const AWARD_ITEMS: InsightItem[] = AWARDS.map((a) => ({
  tag: 'Awards & analyst reports',
  title: a,
  text: '',
  href: cat('awards-and-analyst-reports'),
}));

export const THOUGHT_ITEMS: InsightItem[] = [
  { tag: 'Blog', title: INSIGHTS[1].title, text: guide?.intro[0] ?? '', href: `/insights/${ARTICLE_SLUG}` },
  { tag: INSIGHTS[0].tag, title: INSIGHTS[0].title, text: '', href: cat('thought-leadership') },
  ...pick('CBUAE', 'Thought leadership', cat('thought-leadership')),
  ...pick('West Africa', 'Thought leadership', cat('thought-leadership')),
  ...pick('Kazakhstan', 'Thought leadership', cat('thought-leadership')),
  ...pick('AI Blueprint', 'Thought leadership', cat('thought-leadership')),
  ...pick('Saudi real estate', 'Thought leadership', cat('thought-leadership')),
];

export const NEWS_ITEMS: InsightItem[] = [
  { tag: INSIGHTS[2].tag, title: INSIGHTS[2].title, text: '', href: cat('news-and-announcements') },
  ...pick('E-Invoicing', 'News & announcements', cat('news-and-announcements')),
];

export const BROCHURE_ITEMS: InsightItem[] = CATEGORIES.map((c) => ({
  tag: 'Brochure',
  title: c.name,
  text: c.line,
  href: `/products/${c.slug}`,
}));

export const WHITEPAPER_ITEMS: InsightItem[] = [
  { tag: 'Buyer’s guide', title: INSIGHTS[1].title, text: guide?.intro[1] ?? '', href: `/insights/${ARTICLE_SLUG}` },
];

export const ITEMS_BY_SLUG: Record<InsightSlug, InsightItem[]> = {
  'thought-leadership': THOUGHT_ITEMS,
  'events-and-webinars': [],
  'news-and-announcements': NEWS_ITEMS,
  'awards-and-analyst-reports': AWARD_ITEMS,
  'case-studies-and-testimonials': CASE_ITEMS,
  brochures: BROCHURE_ITEMS,
  whitepaper: WHITEPAPER_ITEMS,
};

// Scraped sections that only hold navigation, duplicated home-page blocks or product tiles.
const DROP_HEADINGS = ['our products', 'case studies', 'what our customers say', 'committed to innovation', 'explore our insights', 'related posts'];
// Scraped UI strings that show up as paragraphs or bullets.
const NOISE_LINE =
  /^(View (all|more)|Read more|Learn more|Find out more|Book a ?demo|Request a demo|Table of contents|Case Studies|Swipe to see|\d{2}\.\d{2}\.\d{4}|• Introduction|Banking|Capital markets|ERP|Azentio ERP|Risk & compliance|Insurance|Blog|Insights|Awards|Products|All products|Learn about us|Connect with Azentio)$/i;
// Comparison tables are flattened into one long string by the scrape; they cannot be rendered faithfully.
const FLATTENED_TABLE = /^(Capability|Market \/ framework|Considerations)/;

const isQuestion = (t: string) => !t.startsWith('•') && t.endsWith('?') && t.length < 140;

/** Scraped sections for an insights page, with UI noise and flattened tables removed and FAQ pairs turned into accordion cards. */
export function cleanedSections(path: string): ContentSection[] {
  const page = getContentPage(path);
  if (!page) return [];
  const out: ContentSection[] = [];

  for (const s of page.sections) {
    if (DROP_HEADINGS.some((d) => s.heading.toLowerCase().startsWith(d))) continue;

    const prose: string[] = [];
    const faq: ContentCard[] = [];
    const texts = s.text.filter((t) => !NOISE_LINE.test(t.trim()) && !(t.length > 300 && FLATTENED_TABLE.test(t)));
    for (let i = 0; i < texts.length; i++) {
      const t = texts[i];
      if (isQuestion(t) && texts[i + 1] && !isQuestion(texts[i + 1])) {
        faq.push({ title: t, text: texts[i + 1] });
        i++;
      } else {
        prose.push(t);
      }
    }

    const cards = s.cards.filter((c) => c.title && c.text && !NOISE_LINE.test(c.title));
    if (prose.length || cards.length) out.push({ heading: s.heading, text: prose, cards });
    if (faq.length) out.push({ heading: 'Frequently asked questions', text: [], cards: faq });
  }
  return out;
}

/**
 * Sections for a page body. When the scrape has no usable body copy (most hub-style pages),
 * the scraped page description is used as the lead paragraph so the page never looks empty.
 */
export function insightSections(path: string): ContentSection[] {
  const body = cleanedSections(path);
  if (body.length > 0) return body;
  const page = getContentPage(path);
  return page?.description ? [{ heading: '', text: [page.description], cards: [] }] : [];
}

/** Short scraped intro line for a hero: the first scraped intro sentence of a sensible length. */
export function heroIntro(path: string): string {
  const page = getContentPage(path);
  return page?.intro.find((t) => t.length > 40 && t.length < 220) ?? page?.description ?? '';
}
