import 'server-only';

import { lexicalSearch, type SearchResult } from './search';

export interface ChatMessage {
  role: 'user' | 'assistant' | 'system';
  content: string;
}

export interface AiraResponse {
  answer: string;
  sources: {
    title: string;
    category: string;
    url?: string;
  }[];
  suggestedQueries: string[];
}

/**
 * Deterministic answer generator when OpenAI API key is unavailable or offline.
 * Synthesizes top BM25 lexical search chunks from source.md into a structured, executive answer.
 */
function generateDeterministicAnswer(query: string, searchResults: SearchResult[]): string {
  const topResult = searchResults[0]?.chunk;
  const secondaryResult = searchResults[1]?.chunk;

  if (!topResult) {
    return "I couldn't locate specific documentation on that topic. Azentio provides purpose-built BFSI software across Banking, Capital Markets, Insurance, Risk & Compliance, and ERP. Feel free to explore our [Solutions](/solutions) or [Request a Demo](/request-demo).";
  }

  const queryLower = query.toLowerCase();

  // Custom greeting handler
  if (queryLower.match(/^(hi|hello|hey|greetings|who are you|what is aira)/i)) {
    return "Hello! I am **AIRA**, the intelligent website guide for azentio.ai.\n\nI can help you explore our enterprise BFSI products, explain the secure collaboration portal, detail our collective learning hub, or direct you to any section of our website. What would you like to know?";
  }

  // Build answer from top chunks
  let summary = `### ${topResult.title}\n\n`;

  // Extract key bullet points or sentences
  const lines = topResult.content
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const mainPoints = lines.slice(0, 5).join('\n\n');
  summary += `${mainPoints}\n\n`;

  if (secondaryResult && secondaryResult.id !== topResult.id) {
    summary += `**Related capability:**\n*${secondaryResult.title}*: ${secondaryResult.content.split('\n')[0]}\n\n`;
  }

  if (topResult.url) {
    summary += `Explore further: [${topResult.title}](${topResult.url})`;
  }

  return summary;
}

/**
 * Main query function for AIRA.
 * 1. Runs BM25 lexical search to extract relevant chunks from source.md.
 * 2. If OpenAI key is present, queries OpenAI-compatible model with retrieved context.
 * 3. Falls back gracefully to deterministic synthesized answer.
 */
export async function queryAira(
  message: string,
  history: ChatMessage[] = []
): Promise<AiraResponse> {
  const trimmedQuery = message.trim();
  const searchResults = lexicalSearch(trimmedQuery, 4);

  const sources = searchResults.map((r) => ({
    title: r.chunk.title,
    category: r.chunk.category,
    url: r.chunk.url,
  }));

  // Context assembled from top lexical matches
  const contextText = searchResults
    .map((r, i) => `[Source Document ${i + 1}: ${r.chunk.title} (${r.chunk.category})]\n${r.chunk.content}`)
    .join('\n\n---\n\n');

  const apiKey = process.env.OPENAI_API_KEY;
  const baseUrl = process.env.OPENAI_BASE_URL || process.env.OPENAI_API_BASE || 'https://api.openai.com/v1';
  const model = process.env.OPENAI_MODEL || 'gpt-4o-mini';

  // Dynamic suggested queries based on top categories
  const suggestedQueries = [
    'What products does Azentio offer?',
    'How does collective learning work?',
    'What is the difference between client and employee portals?',
  ];

  if (searchResults[0]?.chunk.keywords.includes('banking')) {
    suggestedQueries[0] = 'Tell me about iMAL Islamic Banking and Digital Lending';
  } else if (searchResults[0]?.chunk.keywords.includes('compliance')) {
    suggestedQueries[0] = 'How does AMLOCK sanctions screening work?';
  }

  // Attempt OpenAI-compatible endpoint if key is present
  if (apiKey) {
    try {
      const systemPrompt = `You are AIRA, the intelligent website guide chatbot for azentio.ai.
Your role is to guide visitors, clients, and employees through Azentio's BFSI offerings (Banking, Risk & Compliance, Insurance, Capital Markets, ERP) and explain the secure collaboration portal and collective learning hub.

Answer user questions accurately and concisely using ONLY the provided verified documentation from azentio.ai and source.md below.

=== RETRIEVED KNOWLEDGE CONTEXT ===
${contextText}
===================================

Guidelines:
1. Always be executive, accurate, friendly, and concise (2-4 paragraphs or formatted bullet points).
2. Cite the offering or section when describing features.
3. If relevant, mention pages the user can navigate to (e.g. /solutions, /products/banking, /products/risk-compliance, /portal/client, /login).
4. If the question cannot be answered from the context, state so politely and recommend contacting sales via /request-demo.`;

      const messagesPayload: ChatMessage[] = [
        { role: 'system', content: systemPrompt },
        ...history.slice(-4), // last 4 turns for context
        { role: 'user', content: trimmedQuery },
      ];

      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 12000); // 12s timeout

      const response = await fetch(`${baseUrl.replace(/\/+$/, '')}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model,
          messages: messagesPayload,
          temperature: 0.2,
          max_tokens: 600,
        }),
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        const answer = data.choices?.[0]?.message?.content;
        if (answer) {
          return {
            answer,
            sources,
            suggestedQueries,
          };
        }
      }
    } catch (err) {
      console.warn('AIRA OpenAI-compatible call failed, falling back to lexical synthesis:', err);
    }
  }

  // Graceful fallback: synthesize answer directly from lexical search results
  const fallbackAnswer = generateDeterministicAnswer(trimmedQuery, searchResults);

  return {
    answer: fallbackAnswer,
    sources,
    suggestedQueries,
  };
}

