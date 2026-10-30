import pages from '@/app/(config)/content/pages.json';

// Home-page copy comes from the scraped azentio.com home page (docs/azentio-site-content.md).
// Parsed by scripts/build-content.py.

interface Section {
  heading: string;
  text: string[];
  cards: { title: string; text: string }[];
}
const home = pages.find((p) => p.path === '/')!;
const section = (heading: string) =>
  (home.sections as Section[]).find((s) => s.heading.toLowerCase().startsWith(heading.toLowerCase()))!;

export const HOME_INTRO = home.intro[0];

export const AWARDS = section('We’re proud').cards.map((c) => c.title);

export const QUOTES = (() => {
  const t = section('What our customers').text;
  const out: { quote: string; name: string; role: string }[] = [];
  for (let i = 0; i + 2 < t.length && out.length < 5; i += 3) {
    out.push({ quote: t[i], name: t[i + 1], role: t[i + 2] });
  }
  return out;
})();

const CASE_TAGS = ['Insurance', 'Banking', 'Banking', 'ERP', 'Banking', 'ERP'];
export const CASES = section('Case studies').cards.map((c, i) => ({
  title: c.title,
  text: c.text,
  tag: CASE_TAGS[i] ?? 'Case study',
}));

export const STATS = [
  { value: 650, suffix: '+', label: 'Clients' },
  { value: 30, suffix: '+', label: 'Years of expertise' },
  { value: 1900, suffix: '+', label: 'Technology professionals' },
  { value: 60, suffix: '+', label: 'Countries served' },
  { value: 19, suffix: '', label: 'Locations' },
];

export const CATEGORIES = [
  { slug: 'banking', name: 'Banking', line: 'Enables financial institutions to continually redefine themselves.', products: ['iMAL Islamic banking', 'Lending', 'Digital', 'Factoring & supply chain finance'] },
  { slug: 'capital-markets', name: 'Capital markets', line: 'Helping capital market firms embrace technologies.', products: ['MFund plus', 'MFund ISS', 'MFund plus WMS'] },
  { slug: 'risk-compliance', name: 'Risk & compliance', line: 'Ensuring compliance and mitigating risks seamlessly worldwide.', products: ['Transaction monitoring', 'Sanctions screening', 'KYC & onboarding', 'Fraud detection'] },
  { slug: 'insurance', name: 'Insurance', line: 'Allowing insurance companies to significantly reduce costs.', products: ['General', 'Health', 'Claim automation', 'Digital solutions'] },
  { slug: 'erp', name: 'Azentio ERP', line: 'Providing exceptional industry cloud solutions.', products: ['Distribution cloud', 'Contracting cloud', 'Financial cloud', 'Manufacturing cloud'] },
];

export const INSIGHTS = [
  { tag: 'Thought leadership', title: 'Islamic banking modernization: Building the core foundation for trusted growth', href: '/insights/thought-leadership' },
  { tag: 'Blog', title: 'AML software: the 2026 buyer’s guide for banks and fintechs', href: '/insights/aml-software-buyers-guide' },
  { tag: 'News & announcements', title: 'Azentio launches UAE E-Invoicing solution with pre-approved ASP status and AI-powered ERP capabilities', href: '/insights/news-and-announcements' },
];
