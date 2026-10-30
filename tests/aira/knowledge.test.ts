import { CONTENT_PAGES } from '@/app/(config)/content';
import { lexicalSearch } from '@/app/api/(services)/aira/search';

// The AIRA knowledge base is the scraped azentio.com content in CONTENT_PAGES (there is no knowledge.ts).
describe('AIRA knowledge base integrity (CONTENT_PAGES)', () => {
  it('has at least one page to search', () => {
    expect(CONTENT_PAGES.length).toBeGreaterThan(0);
  });

  it('gives every page a unique path, used as its id and url', () => {
    const paths = CONTENT_PAGES.map((page) => page.path);
    expect(new Set(paths).size).toBe(paths.length);
  });

  it('gives every page a URL path that starts with "/" and has no trailing slash except the root', () => {
    for (const page of CONTENT_PAGES) {
      expect(page.path.startsWith('/')).toBe(true);
      if (page.path !== '/') expect(page.path.endsWith('/')).toBe(false);
    }
  });

  it('gives every page a non-empty title, metaTitle and description', () => {
    for (const page of CONTENT_PAGES) {
      expect(page.title.trim()).not.toBe('');
      expect(page.metaTitle.trim()).not.toBe('');
      expect(page.description.trim()).not.toBe('');
    }
  });

  it('gives every page some body content from intro or sections', () => {
    for (const page of CONTENT_PAGES) {
      const hasIntro = page.intro.some((line) => line.trim() !== '');
      const hasSectionText = page.sections.some(
        (section) => section.text.some((line) => line.trim() !== '') || section.cards.length > 0,
      );
      expect(hasIntro || hasSectionText).toBe(true);
    }
  });

  it('keeps every card title non-empty (card text may be blank in the scraped copy)', () => {
    for (const page of CONTENT_PAGES) {
      for (const section of page.sections) {
        for (const card of section.cards) {
          expect(card.title.trim()).not.toBe('');
        }
      }
    }
  });

  it('lets a page with a unique title be found by searching its own title', () => {
    const titleCounts = new Map<string, number>();
    for (const page of CONTENT_PAGES) {
      titleCounts.set(page.title, (titleCounts.get(page.title) ?? 0) + 1);
    }
    const uniquePages = CONTENT_PAGES.filter((page) => titleCounts.get(page.title) === 1);
    expect(uniquePages.length).toBeGreaterThan(0);
    for (const page of uniquePages) {
      const urls = lexicalSearch(page.title, 4).map((result) => result.chunk.url);
      expect(urls).toContain(page.path);
    }
  });

  it('gives every page a unique title', () => {
    const titles = CONTENT_PAGES.map((page) => page.title);
    expect(new Set(titles).size).toBe(titles.length);
  });
});
