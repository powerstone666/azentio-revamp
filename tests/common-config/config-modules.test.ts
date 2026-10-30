import { PRODUCT_CATEGORIES, NAV } from '@/app/(config)/nav';
import { HOME_INTRO, AWARDS, QUOTES, CASES, STATS, CATEGORIES, INSIGHTS } from '@/app/(config)/home';
import { SANDBOX_DEMOS, getSandboxDemo } from '@/app/(config)/sandbox';
import { SELF_SERVICE_ONBOARDING_ROLES, SELF_SERVICE_ONBOARDING_ROLE_IDS } from '@/app/(config)/onboarding';
import { portalRoleSchema } from '@/app/(common-lib)/types/schemas';
import { CATEGORY_PATHS } from '@/app/(config)/content';
import { DEMOS } from '@/app/(config)/mock/portal';
import { routeExists } from './support/routes';

describe('nav.ts', () => {
  const allHrefs = [
    ...NAV.map((item) => item.href),
    ...NAV.flatMap((item) => (item.children ?? []).map((child) => child.href)),
  ].filter((href): href is string => typeof href === 'string');

  it('gives every top-level item a label and either an href or children', () => {
    for (const item of NAV) {
      expect(item.label.trim()).not.toBe('');
      expect(item.href !== undefined || (item.children?.length ?? 0) > 0).toBe(true);
    }
  });

  it('has unique labels within the top-level menu', () => {
    const labels = NAV.map((item) => item.label);
    expect(new Set(labels).size).toBe(labels.length);
  });

  it.each(allHrefs.map((href) => [href]))('internal link %s resolves to an app route', (href) => {
    expect(href.startsWith('/')).toBe(true);
    expect(routeExists(href)).toBe(true);
  });

  it('keeps each product category href on the category route with a matching slug', () => {
    expect(PRODUCT_CATEGORIES.map((c) => c.href)).toEqual(
      Object.keys(CATEGORY_PATHS).map((slug) => `/products/${slug}`),
    );
  });

  it('gives every child link a unique href', () => {
    const children = NAV.flatMap((item) => item.children ?? []).map((c) => c.href);
    expect(new Set(children).size).toBe(children.length);
  });
});

describe('home.ts', () => {
  it('derives non-empty intro, awards, quotes and case studies from the scraped content', () => {
    expect(HOME_INTRO.trim()).not.toBe('');
    expect(AWARDS.length).toBeGreaterThan(0);
    expect(QUOTES.length).toBeGreaterThan(0);
    expect(QUOTES.length).toBeLessThanOrEqual(5);
    for (const quote of QUOTES) {
      expect(quote.quote.trim()).not.toBe('');
      expect(quote.name.trim()).not.toBe('');
      expect(quote.role.trim()).not.toBe('');
    }
    expect(CASES.length).toBeGreaterThan(0);
    for (const item of CASES) {
      expect(item.title.trim()).not.toBe('');
      expect(item.tag.trim()).not.toBe('');
    }
  });

  it('has positive, labelled statistics', () => {
    for (const stat of STATS) {
      expect(stat.value).toBeGreaterThan(0);
      expect(stat.label.trim()).not.toBe('');
    }
  });

  it('gives each category slug the same path as the content category map', () => {
    expect(CATEGORIES.map((c) => c.slug).sort()).toEqual(Object.keys(CATEGORY_PATHS).sort());
    for (const category of CATEGORIES) {
      expect(category.products.length).toBeGreaterThan(0);
      expect(category.name).toBe(CATEGORY_PATHS[category.slug as keyof typeof CATEGORY_PATHS].name);
    }
  });

  it.each(INSIGHTS.map((i) => [i.href]))('insight link %s resolves to an app route', (href) => {
    expect(routeExists(href)).toBe(true);
  });
});

describe('sandbox.ts', () => {
  it('has unique demo ids and names', () => {
    expect(new Set(SANDBOX_DEMOS.map((d) => d.id)).size).toBe(SANDBOX_DEMOS.length);
    expect(new Set(SANDBOX_DEMOS.map((d) => d.scenarioKey)).size).toBe(SANDBOX_DEMOS.length);
  });

  it.each(SANDBOX_DEMOS.map((d) => [d.id, d] as const))('%s has every scenario field filled in', (_id, demo) => {
    for (const text of [demo.name, demo.blurb, demo.scenarioKey, demo.scenarioTitle, demo.scenarioOutput.summary, demo.scenarioOutput.limitation]) {
      expect(text.trim()).not.toBe('');
    }
    expect(Object.keys(demo.scenarioInput).length).toBeGreaterThan(0);
    expect(demo.scenarioOutput.evidence.length).toBeGreaterThan(0);
  });

  it('keeps every scenario synthetic and labels its output as not a decision', () => {
    for (const demo of SANDBOX_DEMOS) {
      expect(demo.scenarioKey).toMatch(/^synthetic-/);
      expect(demo.scenarioInput.dataset).toBe('synthetic');
      expect(demo.scenarioOutput.limitation).toMatch(/not (a|an) /);
    }
  });

  it('uses only scenario keys that the run route can accept (non-empty, at most 100 characters)', () => {
    for (const demo of SANDBOX_DEMOS) {
      expect(demo.scenarioKey.length).toBeGreaterThanOrEqual(1);
      expect(demo.scenarioKey.length).toBeLessThanOrEqual(100);
    }
  });

  it('resolves a known demo by id and returns null for an unknown one', () => {
    expect(getSandboxDemo('FAI')?.scenarioKey).toBe('synthetic-seasonality');
    expect(getSandboxDemo('Nope')).toBeNull();
  });

  it('every sandbox demo id matches an offering in the portal demo list', () => {
    const portalOfferings = new Set(DEMOS.map((d) => d.offering));
    for (const demo of SANDBOX_DEMOS) expect(portalOfferings.has(demo.id)).toBe(true);
  });
});

describe('onboarding.ts', () => {
  it('excludes the portal admin role from self-service onboarding', () => {
    expect(SELF_SERVICE_ONBOARDING_ROLE_IDS).not.toContain('portal_admin');
    expect(SELF_SERVICE_ONBOARDING_ROLES.map((r) => r.id)).not.toContain('portal_admin');
  });

  it('lists only valid portal roles, each once', () => {
    const ids = SELF_SERVICE_ONBOARDING_ROLES.map((r) => r.id);
    expect(new Set(ids).size).toBe(ids.length);
    for (const id of ids) expect(portalRoleSchema.safeParse(id).success).toBe(true);
  });

  it.each(SELF_SERVICE_ONBOARDING_ROLES.map((r) => [r.id, r] as const))('%s has copy, starter items and a group that matches its org type', (_id, role) => {
    expect(role.label.trim()).not.toBe('');
    expect(role.pitch.trim()).not.toBe('');
    expect(role.starter.length).toBeGreaterThan(0);
    if (role.group === 'Client side') expect(role.orgType).toBe('client');
    else expect(role.orgType).toBe('azentio');
  });
});
