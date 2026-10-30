import { lexicalSearch } from '@/app/api/(services)/aira/search';

describe('lexicalSearch ranking', () => {
  it.each([
    ['AMLOCK sanctions screening', '/risk-compliance/sanctions-screening'],
    ['iMAL islamic banking', '/banking/imal-islamic-banking'],
    ['fraud detection', '/risk-compliance/fraud-detection'],
    ['Orion distribution ERP', '/erp/orion-distribution-cloud'],
  ])('ranks the most specific page first for the query "%s"', (query, expectedUrl) => {
    const [top] = lexicalSearch(query, 4);
    expect(top.chunk.url).toBe(expectedUrl);
  });

  it('is case-insensitive so "AMLOCK" and "amlock" rank the same top page', () => {
    expect(lexicalSearch('AMLOCK', 4).map((r) => r.chunk.url))
      .toEqual(lexicalSearch('amlock', 4).map((r) => r.chunk.url));
  });

  it('returns results sorted by score in descending order', () => {
    const scores = lexicalSearch('risk compliance AML sanctions', 4).map((r) => r.score);
    expect(scores.length).toBeGreaterThan(1);
    for (let i = 1; i < scores.length; i++) {
      expect(scores[i - 1]).toBeGreaterThanOrEqual(scores[i]);
    }
  });

  it('lists only query terms that actually matched in matchedTerms', () => {
    const [top] = lexicalSearch('imal zebrafish', 4);
    expect(top.matchedTerms).toContain('imal');
    expect(top.matchedTerms).not.toContain('zebrafish');
  });

  it('matches a longer query term by prefix (e.g. "sanction" finds "sanctions")', () => {
    const results = lexicalSearch('sanction', 4);
    expect(results.some((r) => r.chunk.url === '/risk-compliance/sanctions-screening')).toBe(true);
    expect(results[0].matchedTerms).toContain('sanction');
  });

  it('does not treat very short terms (under 4 characters) as prefixes', () => {
    // "fra" is 3 characters, so it must not prefix-match "fraud" or "framework".
    const results = lexicalSearch('fra', 4);
    for (const result of results) {
      expect(result.matchedTerms).not.toContain('fra');
    }
  });
});

describe('lexicalSearch topK', () => {
  it.each([1, 2, 4])('returns at most %i results when topK is %i', (k) => {
    expect(lexicalSearch('azentio banking software', k).length).toBeLessThanOrEqual(k);
  });

  it('defaults to 4 results when topK is omitted', () => {
    expect(lexicalSearch('azentio software platform').length).toBeLessThanOrEqual(4);
  });
});

describe('lexicalSearch empty and fallback queries', () => {
  it.each([
    ['empty string', ''],
    ['whitespace only', '   '],
    ['only stop words', 'what is this and the'],
    ['greeting words only', 'hi hello thanks'],
    ['punctuation only', '!!! ???'],
    ['single letters only', 'a b c'],
  ])('returns the top overview chunks with score 1.0 for a query with no usable terms (%s)', (_label, query) => {
    const results = lexicalSearch(query, 3);
    expect(results).toHaveLength(3);
    for (const result of results) {
      expect(result.score).toBe(1.0);
      expect(result.matchedTerms).toEqual([]);
    }
  });

  it('returns the top overview chunks with score 0.5 when no document matches the terms', () => {
    const results = lexicalSearch('zxqvbnm plorfgh', 2);
    expect(results).toHaveLength(2);
    for (const result of results) {
      expect(result.score).toBe(0.5);
      expect(result.matchedTerms).toEqual([]);
    }
  });

  it('returns results whose chunk has the expected shape', () => {
    const [top] = lexicalSearch('AMLOCK', 1);
    expect(top.chunk).toEqual(expect.objectContaining({
      id: expect.any(String),
      title: expect.any(String),
      category: expect.any(String),
      content: expect.any(String),
      keywords: expect.any(Array),
      url: expect.stringMatching(/^\//),
    }));
  });

  it('derives the category from the first URL segment and uses "Home" for the root page', () => {
    const results = lexicalSearch('AMLOCK sanctions screening', 4);
    const sanctions = results.find((r) => r.chunk.url === '/risk-compliance/sanctions-screening');
    expect(sanctions?.chunk.category).toBe('risk-compliance');
    const home = lexicalSearch('azentio', 50).find((r) => r.chunk.url === '/');
    if (home) expect(home.chunk.category).toBe('Home');
  });
});
