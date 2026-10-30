import { CONTENT_PAGES, getContentPage, childrenOf, slugOf } from '@/app/(config)/content';
import { routeExists } from './support/routes';

describe('route lookup helper', () => {
  it('matches static, route-group and dynamic routes, and rejects unknown paths', () => {
    expect(routeExists('/')).toBe(true);
    expect(routeExists('/products/banking')).toBe(true);
    expect(routeExists('/products/banking/imal?ref=nav#top')).toBe(true);
    expect(routeExists('/portal/client/observations/obs_01')).toBe(true);
    expect(routeExists('/portal/client/observations/obs_01/edit')).toBe(true);
    expect(routeExists('/portal/client/does-not-exist')).toBe(false);
    expect(routeExists('/products/banking/imal/extra/segment')).toBe(false);
  });
});

describe('pages.json integrity', () => {
  it('has at least one page', () => {
    expect(CONTENT_PAGES.length).toBeGreaterThan(0);
  });

  it('gives every page an absolute path, and each path appears only once', () => {
    const paths = CONTENT_PAGES.map((p) => p.path);
    for (const path of paths) {
      expect(path.startsWith('/')).toBe(true);
      if (path !== '/') expect(path.endsWith('/')).toBe(false);
    }
    expect(new Set(paths).size).toBe(paths.length);
  });

  it.each(CONTENT_PAGES.map((p) => [p.path, p] as const))('%s has a title, metadata and intro copy', (_path, page) => {
    expect(page.title.trim()).not.toBe('');
    expect(page.metaTitle.trim()).not.toBe('');
    expect(page.description.trim()).not.toBe('');
    expect(page.intro.length).toBeGreaterThan(0);
    for (const line of page.intro) expect(line.trim()).not.toBe('');
  });

  it.each(CONTENT_PAGES.map((p) => [p.path, p] as const))('%s has no blank section text lines or card titles', (_path, page) => {
    for (const section of page.sections) {
      for (const line of section.text) expect(line.trim()).not.toBe('');
      for (const card of section.cards) expect(card.title.trim()).not.toBe('');
    }
  });

  it.each(CONTENT_PAGES.map((p) => [p.path, p] as const))(
    '%s has no section without a heading',
    (_path, page) => {
      for (const section of page.sections) expect(section.heading.trim()).not.toBe('');
    },
  );

  it.each(CONTENT_PAGES.map((p) => [p.path, p] as const))('%s has breadcrumbs that are non-empty strings', (_path, page) => {
    for (const crumb of page.breadcrumbs) expect(crumb.trim()).not.toBe('');
  });

  it('has no duplicate section headings within one page', () => {
    for (const page of CONTENT_PAGES) {
      const headings = page.sections.map((s) => s.heading.trim().toLowerCase());
      expect(new Set(headings).size).toBe(headings.length);
    }
  });
});

describe('content lookups', () => {
  it('finds a page by its exact path and returns undefined otherwise', () => {
    expect(getContentPage('/banking')?.path).toBe('/banking');
    expect(getContentPage('/banking/')).toBeUndefined();
    expect(getContentPage('/no-such-page')).toBeUndefined();
  });

  it('returns only direct children for childrenOf', () => {
    const kids = childrenOf('/banking').map((p) => p.path);
    expect(kids).toEqual(expect.arrayContaining([
      '/banking/imal-islamic-banking', '/banking/lending', '/banking/digital', '/banking/factoring-supply-chain-finance',
    ]));
    for (const kid of kids) expect(kid.split('/').length).toBe(3);
  });

  it('returns the last URL segment as the slug, without a trailing slash', () => {
    expect(slugOf('/banking/imal-islamic-banking')).toBe('imal-islamic-banking');
    expect(slugOf('/banking/')).toBe('banking');
    expect(slugOf('/')).toBe('');
  });

  it('keeps the four product category paths aligned with the content tree', () => {
    for (const path of ['/banking', '/capital-markets', '/risk-compliance', '/insurance', '/erp']) {
      expect(getContentPage(path)).toBeDefined();
    }
  });
});
