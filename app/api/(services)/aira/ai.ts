import 'server-only';

import OpenAI from 'openai';
import { lexicalSearch } from './search';
import { detectPotentialSensitiveContent } from '@/app/api/(services)/moderation/service';
import { getActiveApprovedCopiesByIds } from '@/app/api/(services)/learning/shared-learning';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface AiraSource {
  title: string;
  category: string;
  url: string;
}

export interface AiraResponse {
  answer: string;
  sources: AiraSource[];
  suggestedQueries: string[];
  provider?: string;
}

export interface SharedAiraEvidence {
  id: string;
  title: string;
  category: string;
  content: string;
}

const AIRA_TIMEOUT_MS = 30_000;
const AIRA_MAX_TOKENS = 1500;

function sourceUrl(url?: string): string {
  return url && url.startsWith('/') ? url : '/products';
}

interface ExtractiveResult extends AiraResponse {
  isRagMatch: boolean;
}

/**
 * Intelligent domain knowledge matcher & RAG extractor.
 * Returns isRagMatch: true whenever the query can be answered directly from RAG documentation.
 */
function extractiveAnswer(
  message: string,
  publicResults: ReturnType<typeof lexicalSearch>,
  sharedEvidence: SharedAiraEvidence[]
): ExtractiveResult {
  const sources: AiraSource[] = [
    ...publicResults.map(({ chunk }) => ({ title: chunk.title, category: chunk.category, url: sourceUrl(chunk.url) })),
    ...sharedEvidence.map(({ id, title, category }) => ({ title, category, url: `/portal/client/shared-learning/${encodeURIComponent(id)}` })),
  ].slice(0, 6);

  const q = message.toLowerCase().trim();

  // 0. Natural Human-like Greetings and Introductions
  if (
    /^(hi|hello|hey|greetings|good (morning|afternoon|evening)|howdy|hola|yo)\b/i.test(q) ||
    /^(who are you|what is aira|what can you do|help me|can you help)\b/i.test(q)
  ) {
    return {
      answer:
        "Hello! I’m **AIRA**, Azentio's AI guide.\n\n" +
        "I'm here to help you explore and understand Azentio's enterprise BFSI solutions and collaboration platforms. You can ask me about:\n\n" +
        "• **Core & Islamic Banking:** iMAL (AAOIFI-certified) and digital lending\n" +
        "• **Risk & Financial Crime:** AMLOCK real-time sanctions screening & AML monitoring\n" +
        "• **Insurance & Capital Markets:** Premia Astra and Kastle Treasury management\n" +
        "• **Collaboration Portals:** Client Portal, Employee Portal, and the Collective Learning Hub\n\n" +
        "How can I help you explore Azentio today?",
      sources: [
        { title: 'Azentio Products & Capabilities', category: 'Overview', url: '/products' },
        { title: 'Azentio Solutions', category: 'Solutions', url: '/solutions' },
      ],
      suggestedQueries: ['Tell me about AMLOCK', 'How does iMAL banking work?', 'What is Collective Learning?', 'Explore client portal'],
      provider: 'AIRA RAG Engine',
      isRagMatch: true,
    };
  }

  if (/^(how are you|how's it going|how are things)\b/i.test(q)) {
    return {
      answer:
        "I'm doing well, thank you for asking! Ready to help you discover Azentio's enterprise BFSI software solutions and collaboration features. What would you like to explore today?",
      sources: [
        { title: 'Azentio Products & Capabilities', category: 'Overview', url: '/products' },
      ],
      suggestedQueries: ['Products overview', 'AMLOCK sanctions', 'iMAL banking', 'Client portal overview'],
      provider: 'AIRA RAG Engine',
      isRagMatch: true,
    };
  }

  if (/^(thanks|thank you|thx|appreciate it|cool|awesome|great)\b/i.test(q)) {
    return {
      answer:
        "You’re very welcome! If you have any more questions about Azentio's products, collaboration portals, or want to schedule a walkthrough, I’m right here to help.",
      sources,
      suggestedQueries: ['Products overview', 'Request a demo', 'Client portal overview'],
      provider: 'AIRA RAG Engine',
      isRagMatch: true,
    };
  }

  // 1. Sanctions / AMLOCK / Compliance
  if (q.includes('amlock') || q.includes('sanction') || q.includes('compliance') || q.includes('aml') || q.includes('anti-money') || q.includes('pep')) {
    return {
      answer:
        "**Azentio AMLOCK** is our enterprise financial crime and compliance suite engineered for tier-1 and regional financial institutions:\n\n" +
        "• **Real-Time Sanctions Screening:** High-throughput screening against global watchlists (OFAC, UN, EU, FATF) with ultra-low false-positive rates via phonetic and fuzzy matching algorithms.\n" +
        "• **Anti-Money Laundering (AML):** Real-time transaction monitoring, behavioral profiling, and automated suspicious activity reporting (SAR).\n" +
        "• **Collective Typology Learning:** Participates in Azentio's collective learning hub, where cross-institutional fraud and sanctions evasion patterns are shared and ingested without exposing client-specific transaction details.\n\n" +
        "For full compliance specifications, visit our [Solutions](/solutions) page or explore [https://www.azentio.com/](https://www.azentio.com/).",
      sources,
      suggestedQueries: ['How does AMLOCK reduce false positives?', 'Tell me about iMAL Islamic Banking', 'How does collective learning work?'],
      provider: 'Azentio RAG Engine',
      isRagMatch: true,
    };
  }

  // 2. Products / Solutions
  if (q.includes('product') || q.includes('solution') || q.includes('offering') || q.includes('what do you offer') || q.includes('capabilities')) {
    return {
      answer:
        "Azentio powers mission-critical financial operations across five specialized BFSI verticals:\n\n" +
        "1. **Core Banking (iMAL & Digital):** Globally recognized Islamic and conventional core banking with AAOIFI-compliant financing, digital lending, and automated deposit engines.\n" +
        "2. **Risk & Compliance (AMLOCK):** End-to-end AML, real-time sanctions screening, fraud prevention, and regulatory reporting.\n" +
        "3. **Insurance Solutions:** End-to-end policy lifecycle, underwriting, automated claims adjudication, and reinsurance accounting.\n" +
        "4. **Capital Markets & Treasury (Kastle):** High-speed FX, debt, derivatives trading, risk valuation, and treasury management.\n" +
        "5. **Orion ERP:** Purpose-built financial accounting and operational ERP tailored for financial services.\n\n" +
        "Visit our [Products Catalog](/products) or official site [https://www.azentio.com/](https://www.azentio.com/).",
      sources,
      suggestedQueries: ['Tell me about iMAL banking', 'AMLOCK sanctions', 'Technology architecture'],
      provider: 'Azentio RAG Engine',
      isRagMatch: true,
    };
  }

  // 3. Technology / Architecture / Live streaming / SLAs
  if (q.includes('technology') || q.includes('tech') || q.includes('architecture') || q.includes('live streaming') || q.includes('cloud') || q.includes('sla')) {
    return {
      answer:
        "Azentio's technology platform is built on modern, cloud-native enterprise standards:\n\n" +
        "• **High-Availability Architecture:** Microservices-based deployment supporting hybrid and multi-cloud environments (AWS, GCP, Azure, on-premise).\n" +
        "• **Multi-Tenant Isolation:** Complete cryptographic separation between tenant data and strict Zero-Trust role-based access controls (RBAC).\n" +
        "• **60-Second SLA:** Instant data withdrawal and strict SLA enforcement for real-time transactions and high-frequency settlement.\n" +
        "• **Real-Time Streaming:** Event-driven Kafka / WebSocket pipelines powering live compliance checks and interactive audit streams.\n\n" +
        "Check out our [Solutions](/solutions) page to see our technology stacks in action.",
      sources,
      suggestedQueries: ['Products overview', 'How does collective learning work?', 'Client portal overview'],
      provider: 'Azentio RAG Engine',
      isRagMatch: true,
    };
  }

  // 4. Islamic Banking / iMAL / Lending
  if (q.includes('imal') || q.includes('islamic') || q.includes('banking') || q.includes('lending') || q.includes('sharia')) {
    return {
      answer:
        "**iMAL** is the world's leading, fully certified AAOIFI-compliant Islamic core banking platform:\n\n" +
        "• **Sharia-Compliant Financing:** Out-of-the-box support for Murabaha, Ijara, Mudaraba, Musharaka, Istisna'a, and Sukuk structures.\n" +
        "• **Automated Sharia Governance:** Embedded contract verification ensuring transactions adhere strictly to institutional fatwa guidelines.\n" +
        "• **Digital Lending:** End-to-end loan origination, straight-through credit assessment, and automated disbursements.\n\n" +
        "Learn more on our [Solutions](/solutions) page or arrange an executive presentation via [Request a Demo](/request-demo).",
      sources,
      suggestedQueries: ['AMLOCK sanctions', 'Products overview', 'Collective learning'],
      provider: 'Azentio RAG Engine',
      isRagMatch: true,
    };
  }

  // 5. Collective Learning / Shared Learning
  if (q.includes('collective') || q.includes('shared learning') || q.includes('learning hub') || q.includes('anonym')) {
    return {
      answer:
        "The **Collective Learning Hub** is Azentio's innovative privacy-preserving intelligence network:\n\n" +
        "• **Pattern Recognition:** Financial institutions contribute anonymized observations on novel fraud vectors, seasonal trends, and compliance bottlenecks.\n" +
        "• **Human-in-the-Loop Moderation:** Dedicated Azentio compliance moderators review, sanitize, and redact all submissions before approval.\n" +
        "• **Cross-Tenant Insights:** Approved patterns are published as aggregated community themes, allowing member banks to defend against emerging typologies without exposing proprietary customer data.\n\n" +
        "You can explore active community themes directly in the [Client Portal](/portal/client/themes).",
      sources,
      suggestedQueries: ['What is the difference between client and employee portals?', 'AMLOCK sanctions', 'Products overview'],
      provider: 'Azentio RAG Engine',
      isRagMatch: true,
    };
  }

  // 6. Portals & Access Control / Sign In
  if (q.includes('portal') || q.includes('login') || q.includes('sign in') || q.includes('employee') || q.includes('client')) {
    return {
      answer:
        "Azentio provides dedicated secure portals based on user persona:\n\n" +
        "• **Client Portal:** For financial institution teams to submit operational observations, track shared learning themes, and review solution demos.\n" +
        "• **Employee Portal:** For internal Azentio engineers and solution architects to access testing playgrounds, live environments, and product knowledge.\n" +
        "• **Moderator & Admin Consoles:** For compliance officers to review and redact shared learning contributions and manage organizational tenants.\n\n" +
        "Visit our [Sign In](/login) page to select a demo persona or authenticate with your work email.",
      sources,
      suggestedQueries: ['Products overview', 'How does collective learning work?', 'AMLOCK sanctions'],
      provider: 'Azentio RAG Engine',
      isRagMatch: true,
    };
  }

  // 7. General RAG match from indexed documents or shared tenant evidence
  const hasMatchedTerms = (publicResults[0]?.matchedTerms?.length ?? 0) >= 2;
  const isStrongRagMatch = (hasMatchedTerms && (publicResults[0]?.score ?? 0) >= 2.5) || sharedEvidence.length > 0;
  const excerpts = [
    ...publicResults.slice(0, 2).map(({ chunk }) => chunk.content.split('\n').filter(Boolean).slice(0, 3).join(' ')),
    ...sharedEvidence.slice(0, 2).map((evidence) => evidence.content.slice(0, 500)),
  ];

  if (isStrongRagMatch && excerpts.length > 0) {
    const topChunk = publicResults[0]?.chunk;
    const title = topChunk?.title ? `### ${topChunk.title}\n\n` : '';
    return {
      answer:
        `${title}${excerpts.join('\n\n')}\n\n` +
        `Feel free to ask me more, or explore our [Solutions](/solutions) and [Products Catalog](/products).`,
      sources,
      suggestedQueries: publicResults.slice(1, 4).map(({ chunk }) => chunk.title),
      provider: 'Azentio RAG Engine',
      isRagMatch: true,
    };
  }

  return {
    answer:
      "I'm here to help you navigate Azentio and our enterprise BFSI software solutions. Could you tell me a bit more about what you're looking for, or ask about our Banking, AMLOCK Compliance, Insurance, or Portals?",
    sources,
    suggestedQueries: ['Products overview', 'AMLOCK sanctions', 'Technology architecture'],
    provider: 'Azentio RAG Engine',
    isRagMatch: false,
  };
}

/**
 * Main query function for AIRA.
 * 1. Checks RAG knowledge base first. If a match is found on RAG, skips the external AI call.
 * 2. If no RAG match is found, invokes the external AI LLM only when the user opts in for this request.
 */
export async function queryAira(
  message: string,
  history: ChatMessage[] = [],
  sharedEvidence: SharedAiraEvidence[] = [],
  allowExternalProcessing = false,
  sandboxOrgId?: string,
): Promise<AiraResponse> {
  if (detectPotentialSensitiveContent({ message, history: history.map((item) => item.content) }).length > 0) {
    return {
      answer: 'Please remove personal identifiers, account numbers, credentials, and customer-level details, then ask again using a general or synthetic example. AIRA will not send this message to the configured AI provider.',
      sources: [],
      suggestedQueries: ['Products overview', 'How does shared learning work?', 'Request a demo'],
      provider: 'Azentio privacy guard',
    };
  }

  const refreshEvidence = async (items: SharedAiraEvidence[]) => {
    const ids = items.map((item) => item.id);
    const current = sandboxOrgId
      ? await getActiveApprovedCopiesByIds(ids, sandboxOrgId)
      : await getActiveApprovedCopiesByIds(ids);
    return current.map((item) => ({
      id: item.id,
      title: String(item.reviewed_payload.title ?? 'Approved shared contribution'),
      category: String(item.reviewed_payload.observation_type ?? 'Shared learning'),
      content: String(item.reviewed_payload.body ?? ''),
    }));
  };

  const publicResults = lexicalSearch(message, 4);
  let currentSharedEvidence = await refreshEvidence(sharedEvidence);
  let ragResult = extractiveAnswer(message, publicResults, currentSharedEvidence);

  // If anything is found on RAG, skip external AI call
  if (ragResult.isRagMatch) {
    currentSharedEvidence = await refreshEvidence(currentSharedEvidence);
    ragResult = extractiveAnswer(message, publicResults, currentSharedEvidence);
    return {
      answer: ragResult.answer,
      sources: ragResult.sources,
      suggestedQueries: ragResult.suggestedQueries,
      provider: ragResult.provider || 'Azentio RAG Engine',
    };
  }

  // External processing is opt-in per request. Without consent, use the local knowledge engine.
  const apiKey = process.env.AI_API_KEY;
  if (!apiKey || !allowExternalProcessing) {
    return {
      answer: ragResult.answer,
      sources: ragResult.sources,
      suggestedQueries: ragResult.suggestedQueries,
      provider: !apiKey ? 'Azentio Knowledge Engine' : 'Azentio privacy choice',
    };
  }

  const baseURL = process.env.AI_BASE_URL;
  const model = process.env.AI_MODEL;
  if (!baseURL || !model) {
    return {
      answer: ragResult.answer,
      sources: ragResult.sources,
      suggestedQueries: ragResult.suggestedQueries,
      provider: 'Azentio Knowledge Engine',
    };
  }

  const client = new OpenAI({
    apiKey,
    baseURL,
    timeout: AIRA_TIMEOUT_MS,
    maxRetries: 0,
  });

  // Re-check shared-copy status immediately before constructing provider context.
  currentSharedEvidence = await refreshEvidence(currentSharedEvidence);
  const retrievedChunks = [
    ...publicResults.map(({ chunk }, index) => ({
      id: `S${index + 1}`,
      title: chunk.title,
      url: sourceUrl(chunk.url),
      content: chunk.content,
    })),
    ...currentSharedEvidence.map((evidence, index) => ({
      id: `S${publicResults.length + index + 1}`,
      title: evidence.title,
      url: `/portal/client/shared-learning/${encodeURIComponent(evidence.id)}`,
      content: evidence.content,
    })),
  ].slice(0, 6);

  const contextSnippets = retrievedChunks
    .map((chunk) => `[${chunk.id}] ${chunk.title}\nURL: ${chunk.url}\n${chunk.content}`)
    .join('\n\n');

  const safeHistory = history.slice(-4).map(({ role, content }) => ({
    role,
    content: content.slice(0, 1500),
  }));

  const systemPrompt = `You are AIRA, a friendly, intelligent, and articulate conversational AI guide for Azentio (azentio.ai and https://www.azentio.com/).

CONVERSATIONAL PERSONA & TONE:
- Be warm, helpful, natural, and professional — like an expert colleague chatting in real-time.
- For conversational remarks (e.g. "hi", "how are you", "who are you", "thanks"), respond naturally and warmly without stiff document citation preambles.
- Answer user questions clearly and concisely, explaining how Azentio's BFSI solutions (iMAL Core Banking, AMLOCK Sanctions & Compliance, Insurance, Capital Markets, Orion ERP) and portals work.
- If asked about Azentio, use the retrieved context chunks below.
- If the user asks general or out-of-source questions, answer politely and naturally from a general business/BFSI context while gently steering back to how Azentio can help (https://www.azentio.com/). Only refuse if the question is completely irrelevant or inappropriate.
- Include helpful markdown links (such as [Solutions](/solutions), [Products](/products), [Request a Demo](/request-demo)) where useful.

KNOWLEDGE SOURCE:
Retrieved context chunks (lexical search over the scraped azentio.com content and approved shared evidence):
"""
${contextSnippets}
"""`;

  try {
    const params = {
      model,
      temperature: 0.35,
      max_tokens: AIRA_MAX_TOKENS,
      chat_template_kwargs: { enable_thinking: false },
      messages: [
        { role: 'system', content: systemPrompt },
        ...safeHistory,
        { role: 'user', content: message },
      ],
    } as OpenAI.Chat.Completions.ChatCompletionCreateParamsNonStreaming;
    const completion = await client.chat.completions.create(params);

    const answer = completion.choices?.[0]?.message?.content;
    if (typeof answer === 'string' && answer.trim()) {
      if (currentSharedEvidence.length > 0) {
        const afterCompletion = await refreshEvidence(currentSharedEvidence);
        if (afterCompletion.length !== currentSharedEvidence.length) {
          const safeFallback = extractiveAnswer(message, publicResults, []);
          return {
            answer: safeFallback.answer,
            sources: safeFallback.sources,
            suggestedQueries: safeFallback.suggestedQueries,
            provider: 'Azentio Knowledge Engine',
          };
        }
      }
      return {
        answer: answer.trim(),
        sources: ragResult.sources,
        suggestedQueries: ragResult.suggestedQueries,
        provider: `Real AI (${model})`,
      };
    }
    return {
      answer: ragResult.answer,
      sources: ragResult.sources,
      suggestedQueries: ragResult.suggestedQueries,
      provider: 'Azentio Knowledge Engine',
    };
  } catch (err) {
    console.error('[AIRA] OpenAI completion error:', err);
    return {
      answer: ragResult.answer,
      sources: ragResult.sources,
      suggestedQueries: ragResult.suggestedQueries,
      provider: 'Azentio Knowledge Engine',
    };
  }
}
