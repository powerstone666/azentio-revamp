import pages from './pages.json';

// Typed access to the scraped azentio.com copy (docs/azentio-site-content.md → pages.json via scripts/build-content.py).

export interface ContentCard {
  title: string;
  text: string;
}
export interface ContentSection {
  heading: string;
  text: string[];
  cards: ContentCard[];
}
export interface ContentPage {
  path: string; // original azentio.com path, e.g. /banking/imal-islamic-banking
  metaTitle: string;
  description: string;
  title: string;
  intro: string[];
  breadcrumbs: string[];
  sections: ContentSection[];
}

export const CONTENT_PAGES = pages as ContentPage[];

export const getContentPage = (path: string): ContentPage | undefined => CONTENT_PAGES.find((p) => p.path === path);

/** Direct children of a path, e.g. childrenOf('/banking') → iMAL, Lending, Digital, Factoring. */
export const childrenOf = (path: string): ContentPage[] =>
  CONTENT_PAGES.filter((p) => p.path.startsWith(`${path}/`) && p.path.split('/').length === path.split('/').length + 1);

/** The last URL segment of an original path. */
export const slugOf = (path: string): string => path.split('/').filter(Boolean).pop() ?? '';

// Product category slug → original azentio.com path and display name.
export const CATEGORY_PATHS = {
  banking: { path: '/banking', name: 'Banking' },
  'capital-markets': { path: '/capital-markets', name: 'Capital markets' },
  'risk-compliance': { path: '/risk-compliance', name: 'Risk & compliance' },
  insurance: { path: '/insurance', name: 'Insurance' },
  erp: { path: '/erp', name: 'Azentio ERP' },
} as const;
export type CategorySlug = keyof typeof CATEGORY_PATHS;
