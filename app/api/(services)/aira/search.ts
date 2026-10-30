import 'server-only';

import { CONTENT_PAGES } from '@/app/(config)/content';

export interface SearchResult {
  chunk: { id: string; title: string; category: string; content: string; keywords: string[]; url: string };
  score: number;
  matchedTerms: string[];
}

const STOP_WORDS = new Set([
  'a', 'about', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
  'how', 'i', 'in', 'is', 'it', 'me', 'my', 'of', 'on', 'or', 'our', 'that',
  'the', 'this', 'to', 'us', 'was', 'what', 'when', 'where', 'which', 'who',
  'will', 'with', 'you', 'your', 'can', 'do', 'does', 'tell', 'show', 'please',
  'hi', 'hello', 'hey', 'greetings', 'thanks', 'thank'
]);

function tokenize(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\w\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.trim())
    .filter((w) => w.length > 1 && !STOP_WORDS.has(w));
}

// Pre-calculate document lengths and inverted index for BM25
interface IndexedDoc {
  chunk: SearchResult['chunk'];
  contentTokens: string[];
  titleTokens: string[];
  keywordTokens: string[];
  totalLength: number;
}

const PUBLIC_CONTENT = CONTENT_PAGES.map((page) => {
  const category = page.path.split('/').filter(Boolean)[0] ?? 'Home';
  const sections = page.sections.flatMap((section) => [
    section.heading,
    ...section.text,
    ...section.cards.flatMap((card) => [card.title, card.text]),
  ]);
  const keywords = [page.metaTitle, page.description, page.path, ...page.breadcrumbs, ...page.sections.map((section) => section.heading)];
  return {
    id: page.path || '/',
    title: page.title || page.metaTitle,
    category,
    content: [page.description, ...page.intro, ...sections].filter(Boolean).join('\n'),
    keywords,
    url: page.path || '/',
  };
});

const INDEXED_DOCS: IndexedDoc[] = PUBLIC_CONTENT.map((chunk) => {
  const contentTokens = tokenize(chunk.content);
  const titleTokens = tokenize(chunk.title);
  const keywordTokens = chunk.keywords.flatMap(tokenize);
  return {
    chunk,
    contentTokens,
    titleTokens,
    keywordTokens,
    totalLength: contentTokens.length + titleTokens.length * 2 + keywordTokens.length * 2,
  };
});

const TOTAL_DOCS = INDEXED_DOCS.length;
const AVG_DOC_LENGTH =
  INDEXED_DOCS.reduce((acc, doc) => acc + doc.totalLength, 0) / (TOTAL_DOCS || 1);

// Document Frequency: count how many docs contain term t
const DOC_FREQUENCY = new Map<string, number>();
for (const doc of INDEXED_DOCS) {
  const uniqueTerms = new Set([
    ...doc.contentTokens,
    ...doc.titleTokens,
    ...doc.keywordTokens,
  ]);
  for (const term of uniqueTerms) {
    DOC_FREQUENCY.set(term, (DOC_FREQUENCY.get(term) ?? 0) + 1);
  }
}

function calculateIdf(term: string): number {
  const df = DOC_FREQUENCY.get(term) ?? 0;
  // Standard Robertson-Sparck Jones BM25 IDF with smoothing
  return Math.log(1 + (TOTAL_DOCS - df + 0.5) / (df + 0.5));
}

/**
 * Performs BM25 lexical search over the azentio.ai knowledge base.
 */
export function lexicalSearch(query: string, topK = 4): SearchResult[] {
  const documents = INDEXED_DOCS;
  const queryTokens = tokenize(query);
  if (queryTokens.length === 0) {
    // If no specific keywords, return top overview chunks
    return documents.slice(0, topK).map((doc) => ({
      chunk: doc.chunk,
      score: 1.0,
      matchedTerms: [],
    }));
  }

  const k1 = 1.5;
  const b = 0.75;

  const results: SearchResult[] = [];

  for (const doc of documents) {
    let docScore = 0;
    const matchedTerms: string[] = [];

    for (const term of queryTokens) {
      // Match exact token, or for longer terms (>=4 chars) prefix match
      const isMatch = (t: string) => t === term || (term.length >= 4 && t.startsWith(term));
      const contentTf = doc.contentTokens.filter(isMatch).length;
      const titleTf = doc.titleTokens.filter(isMatch).length * 2.5;
      const keywordTf = doc.keywordTokens.filter(isMatch).length * 2.0;

      const rawTf = contentTf + titleTf + keywordTf;

      if (rawTf > 0) {
        matchedTerms.push(term);
        const idf = calculateIdf(term);
        const normFactor = 1 - b + b * (doc.totalLength / AVG_DOC_LENGTH);
        const tfComponent = (rawTf * (k1 + 1)) / (rawTf + k1 * normFactor);
        docScore += idf * tfComponent;
      }
    }

    // Boost exact phrase matches in title or content
    const lowerQuery = query.toLowerCase().trim();
    if (doc.chunk.title.toLowerCase().includes(lowerQuery)) {
      docScore += 5.0;
    }
    if (doc.chunk.keywords.some((k) => k.includes(lowerQuery))) {
      docScore += 3.0;
    }

    if (docScore > 0) {
      results.push({
        chunk: doc.chunk,
        score: docScore,
        matchedTerms,
      });
    }
  }

  results.sort((a, b) => b.score - a.score);

  // Fallback to top overview items if no direct term match
  if (results.length === 0) {
    return documents.slice(0, topK).map((doc) => ({
      chunk: doc.chunk,
      score: 0.5,
      matchedTerms: [],
    }));
  }

  return results.slice(0, topK);
}

