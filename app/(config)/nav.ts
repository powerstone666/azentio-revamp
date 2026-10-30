export interface NavChild {
  label: string;
  href: string;
  desc?: string;
}
export interface NavItem {
  label: string;
  href?: string;
  children?: NavChild[];
}

export const PRODUCT_CATEGORIES: NavChild[] = [
  { label: 'Banking', href: '/products/banking', desc: 'iMAL, Lending, Digital, Factoring' },
  { label: 'Capital markets', href: '/products/capital-markets', desc: 'MFund plus, ISS, Wealth management' },
  { label: 'Risk & compliance', href: '/products/risk-compliance', desc: 'AMLOCK financial crime suite' },
  { label: 'Insurance', href: '/products/insurance', desc: 'General, Health, Claims, Digital' },
  { label: 'Azentio ERP', href: '/products/erp', desc: 'Orion industry clouds' },
];

export const NAV: NavItem[] = [
  { label: 'Products', href: '/products', children: PRODUCT_CATEGORIES },
  { label: 'Solutions', href: '/solutions' },
  {
    label: 'Innovation',
    children: [
      { label: 'AI Lab', href: '/lab', desc: 'Sandbox workflows and the Playground' },
      { label: 'Technology', href: '/technology', desc: 'Trust, security and AIRA' },
      { label: 'Hackathons', href: '/hackathon/register', desc: 'Register your interest' },
    ],
  },
  {
    label: 'Resources',
    children: [
      { label: 'Media & videos', href: '/media', desc: 'Sessions, webinars, recordings' },
      { label: 'Insights', href: '/insights', desc: 'Case studies, reports, whitepapers' },
      { label: 'Support', href: '/support', desc: 'Services and partner programmes' },
    ],
  },
  { label: 'About', href: '/about' },
];
