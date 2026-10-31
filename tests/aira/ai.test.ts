import { queryAira, type ChatMessage, type SharedAiraEvidence } from '@/app/api/(services)/aira/ai';
import { lexicalSearch } from '@/app/api/(services)/aira/search';

// Captures OpenAI constructor options and chat.completions.create params without any network call.
const mockCreate = jest.fn();
const mockOpenAIConstructor = jest.fn();
jest.mock('openai', () => ({
  __esModule: true,
  default: class MockOpenAI {
    chat = { completions: { create: (...args: unknown[]) => mockCreate(...args) } };
    constructor(options: unknown) {
      mockOpenAIConstructor(options);
    }
  },
}));

jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(),
  queryOne: jest.fn(),
  transaction: jest.fn(),
  default: {},
}));

const mockGetActiveApprovedCopiesByIds = jest.fn();
jest.mock('@/app/api/(services)/learning/shared-learning', () => ({
  getActiveApprovedCopiesByIds: (...args: unknown[]) => mockGetActiveApprovedCopiesByIds(...args),
}));

// A question the local knowledge base cannot answer (no keyword branch, no lexical overlap with any page).
const OUT_OF_SCOPE = 'Quantum entanglement physics';
const PROVIDER_ENV = { AI_API_KEY: 'test-api-key', AI_BASE_URL: 'https://ai.example.test/v1', AI_MODEL: 'test-model-1' };
const ORIGINAL_ENV = process.env;

function setEnv(overrides: Record<string, string | undefined> = {}) {
  const env: Record<string, string | undefined> = { ...PROVIDER_ENV, ...overrides };
  for (const [key, value] of Object.entries(env)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function completion(content: unknown) {
  return { choices: [{ message: { content } }] };
}

function systemPromptFromCall(): string {
  const params = mockCreate.mock.calls[0][0] as { messages: { role: string; content: string }[] };
  return params.messages[0].content;
}

beforeEach(() => {
  process.env = { ...ORIGINAL_ENV };
  setEnv();
  mockGetActiveApprovedCopiesByIds.mockReset();
  mockGetActiveApprovedCopiesByIds.mockResolvedValue([]);
  mockCreate.mockReset();
  mockCreate.mockResolvedValue(completion('Provider answer'));
});

afterEach(() => {
  process.env = ORIGINAL_ENV;
  jest.restoreAllMocks();
});

describe('queryAira privacy guard (runs first)', () => {
  it.each([
    ['an email address', 'My email is jane.doe@example.com, can you check my account?'],
    ['a card number', 'My card 4111 1111 1111 1111 was declined'],
    ['an IBAN', 'Transfer to IBAN GB29 NWBK 6016 1331 9268 19 please'],
    ['a password', 'password: hunter2 and why does login fail'],
    ['a phone number', 'phone: +44 20 7946 0958 call me back'],
    ['a customer account number', 'customer number: 0012345678 what is the status?'],
    ['a sensitive detail mixed into a product question', 'What is AMLOCK for jane@example.com?'],
  ])('returns the privacy guard answer and never calls the provider when the message has %s', async (_label, message) => {
    for (const allow of [true, false]) {
      mockOpenAIConstructor.mockClear();
      const result = await queryAira(message, [], [], allow);
      expect(result.provider).toBe('Azentio privacy guard');
      expect(result.answer).toContain('AIRA will not send this message');
      expect(result.sources).toEqual([]);
      expect(mockOpenAIConstructor).not.toHaveBeenCalled();
      expect(mockCreate).not.toHaveBeenCalled();
    }
  });

  // Known gap: history is passed as an array, and detectPotentialSensitiveContent only scans string values,
  // so sensitive text in a prior turn is not checked before it is sent to the provider.
  it('returns the privacy guard answer when a prior history turn contains a card number', async () => {
    const history: ChatMessage[] = [{ role: 'user', content: 'My card is 4111 1111 1111 1111' }];
    const result = await queryAira(OUT_OF_SCOPE, history, [], true);
    expect(result.provider).toBe('Azentio privacy guard');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('queryAira answers from local RAG before any external call', () => {
  it.each([
    ['What is AMLOCK?', 'Azentio RAG Engine'],
    ['Tell me about iMAL islamic banking', 'Azentio RAG Engine'],
    ['How does collective learning work?', 'Azentio RAG Engine'],
  ])('answers "%s" locally even with consent and a configured provider', async (message, provider) => {
    const result = await queryAira(message, [], [], true);
    expect(result.provider).toBe(provider);
    expect(result.answer.length).toBeGreaterThan(0);
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockOpenAIConstructor).not.toHaveBeenCalled();
  });

  it('answers a strong lexical match locally without calling the provider', async () => {
    const result = await queryAira('Orion contracting ERP', [], [], true);
    expect(result.provider).toBe('Azentio RAG Engine');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('queryAira strong-match threshold', () => {
  it('sends an out-of-scope question with only generic word overlap to the external provider', async () => {
    const result = await queryAira('Who won the football world cup in 1998', [], [], true);
    expect(result.provider).toBe('Real AI (test-model-1)');
    expect(mockCreate).toHaveBeenCalledTimes(1);
  });
});

describe('queryAira external AI gating', () => {
  it('uses the privacy choice provider when the user has not consented to external processing', async () => {
    const result = await queryAira(OUT_OF_SCOPE, [], [], false);
    expect(result.provider).toBe('Azentio privacy choice');
    expect(mockOpenAIConstructor).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('uses the local knowledge engine when AI_API_KEY is not set, even with consent', async () => {
    setEnv({ AI_API_KEY: undefined });
    const result = await queryAira(OUT_OF_SCOPE, [], [], true);
    expect(result.provider).toBe('Azentio Knowledge Engine');
    expect(mockOpenAIConstructor).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['AI_BASE_URL is missing', { AI_BASE_URL: undefined }],
    ['AI_MODEL is missing', { AI_MODEL: undefined }],
    ['AI_API_KEY is empty', { AI_API_KEY: '' }],
    ['AI_BASE_URL is empty', { AI_BASE_URL: '' }],
  ])('uses the local knowledge engine when %s, with no hardcoded provider fallback', async (_label, overrides) => {
    setEnv(overrides);
    const result = await queryAira(OUT_OF_SCOPE, [], [], true);
    expect(result.provider).toBe('Azentio Knowledge Engine');
    expect(mockOpenAIConstructor).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('queryAira provider call', () => {
  it('constructs the client with baseURL and key from env, a 30 second timeout and no retries', async () => {
    await queryAira(OUT_OF_SCOPE, [], [], true);
    expect(mockOpenAIConstructor).toHaveBeenCalledTimes(1);
    expect(mockOpenAIConstructor).toHaveBeenCalledWith({
      apiKey: PROVIDER_ENV.AI_API_KEY,
      baseURL: PROVIDER_ENV.AI_BASE_URL,
      timeout: 30000,
      maxRetries: 0,
    });
  });

  it('uses the model from AI_MODEL with max_tokens 1500 and thinking disabled', async () => {
    await queryAira(OUT_OF_SCOPE, [], [], true);
    expect(mockCreate).toHaveBeenCalledTimes(1);
    expect(mockCreate.mock.calls[0][0]).toEqual(expect.objectContaining({
      model: 'test-model-1',
      max_tokens: 1500,
      chat_template_kwargs: { enable_thinking: false },
    }));
  });

  it('sends the user message as the final user turn', async () => {
    await queryAira(OUT_OF_SCOPE, [], [], true);
    const { messages } = mockCreate.mock.calls[0][0] as { messages: { role: string; content: string }[] };
    expect(messages[0].role).toBe('system');
    expect(messages[messages.length - 1]).toEqual({ role: 'user', content: OUT_OF_SCOPE });
  });

  it('includes the retrieved context chunks in the system prompt', async () => {
    await queryAira(OUT_OF_SCOPE, [], [], true);
    const systemPrompt = systemPromptFromCall();
    const topTitle = lexicalSearch(OUT_OF_SCOPE, 4)[0].chunk.title;
    expect(systemPrompt).toContain('[S1]');
    expect(systemPrompt).toContain(topTitle);

  });

  it('keeps the user message and conversation history out of the system prompt', async () => {
    const privateToken = 'qzv-private-7731';
    const history: ChatMessage[] = [{ role: 'user', content: 'earlier note about internal ledger' }];
    await queryAira(`${OUT_OF_SCOPE} ${privateToken}`, history, [], true);
    const systemPrompt = systemPromptFromCall();
    expect(systemPrompt).not.toContain(privateToken);
    expect(systemPrompt).not.toContain('earlier note about internal ledger');
  });

  it('sends only the last 4 history turns, each truncated to 1500 characters', async () => {
    const history: ChatMessage[] = Array.from({ length: 6 }, (_, i) => ({
      role: i % 2 === 0 ? 'user' : 'assistant',
      content: `turn-${i}-` + 'x'.repeat(2000),
    }));
    await queryAira(OUT_OF_SCOPE, history, [], true);
    const { messages } = mockCreate.mock.calls[0][0] as { messages: { role: string; content: string }[] };
    // system + 4 history turns + current user message
    expect(messages).toHaveLength(6);
    expect(messages[1].content.startsWith('turn-2-')).toBe(true);
    expect(messages[4].content.startsWith('turn-5-')).toBe(true);
    for (const turn of messages.slice(1, 5)) {
      expect(turn.content.length).toBeLessThanOrEqual(1500);
    }
  });

  it('returns the trimmed provider answer labelled with the model name', async () => {
    mockCreate.mockResolvedValueOnce(completion('  Quantum entanglement links particle states.  '));
    const result = await queryAira(OUT_OF_SCOPE, [], [], true);
    expect(result.answer).toBe('Quantum entanglement links particle states.');
    expect(result.provider).toBe('Real AI (test-model-1)');
  });

  it.each([
    ['an empty string', ''],
    ['whitespace only', '   \n  '],
    ['a missing content field', undefined],
    ['a non-string content', 42],
  ])('falls back to the local knowledge engine when the provider returns %s', async (_label, content) => {
    mockCreate.mockResolvedValueOnce(completion(content));
    const result = await queryAira(OUT_OF_SCOPE, [], [], true);
    expect(result.provider).toBe('Azentio Knowledge Engine');
  });

  it('falls back to the local knowledge engine when the provider returns no choices', async () => {
    mockCreate.mockResolvedValueOnce({ choices: [] });
    const result = await queryAira(OUT_OF_SCOPE, [], [], true);
    expect(result.provider).toBe('Azentio Knowledge Engine');
  });

  it('falls back to the local knowledge engine instead of throwing when the provider call fails', async () => {
    jest.spyOn(console, 'error').mockImplementation(() => undefined);
    mockCreate.mockRejectedValueOnce(new Error('upstream 503'));
    const result = await queryAira(OUT_OF_SCOPE, [], [], true);
    expect(result.provider).toBe('Azentio Knowledge Engine');
    expect(result.answer).toEqual(expect.any(String));
    expect(result.sources).toEqual(expect.any(Array));
  });
});

describe('queryAira shared evidence re-check', () => {
  const copyA: SharedAiraEvidence = { id: 'copy-a', title: 'Mule pattern A', category: 'Typology', content: 'Layered transfers through dormant accounts were observed.' };
  const copyB: SharedAiraEvidence = { id: 'copy-b', title: 'Mule pattern B', category: 'Typology', content: 'Withdrawn observation about a specific bank branch.' };
  const row = (copy: SharedAiraEvidence) => ({
    id: copy.id,
    published_at: new Date(0),
    reviewed_payload: { title: copy.title, observation_type: copy.category, body: copy.content },
  });

  it('looks up the shared evidence ids through getActiveApprovedCopiesByIds', async () => {
    mockGetActiveApprovedCopiesByIds.mockResolvedValue([row(copyA)]);
    await queryAira('mule accounts pattern', [], [copyA, copyB], true);
    expect(mockGetActiveApprovedCopiesByIds).toHaveBeenCalledWith(['copy-a', 'copy-b']);
  });

  it('drops a copy that was withdrawn between the first check and the final answer', async () => {
    mockGetActiveApprovedCopiesByIds
      .mockResolvedValueOnce([row(copyA), row(copyB)])
      .mockResolvedValueOnce([row(copyA)]);
    const result = await queryAira('mule accounts pattern', [], [copyA, copyB], true);
    expect(result.answer).toContain(copyA.content);
    expect(result.answer).not.toContain(copyB.content);
    expect(result.sources.map((s) => s.url)).not.toContain('/portal/client/shared-learning/copy-b');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('never returns the body of a copy that is withdrawn before the answer is built', async () => {
    mockGetActiveApprovedCopiesByIds
      .mockResolvedValueOnce([row(copyA)])
      .mockResolvedValueOnce([]);
    const result = await queryAira('mule accounts pattern', [], [copyA], true);
    expect(result.answer).not.toContain(copyA.content);
    expect(result.sources.map((s) => s.url)).not.toContain('/portal/client/shared-learning/copy-a');
    expect(mockCreate).not.toHaveBeenCalled();
  });
});

describe('queryAira greetings and small talk', () => {
  it.each([
    'hi',
    'Hello there',
    'Good morning, team',
    'who are you?',
    'What can you do?',
    'Help me',
  ])('answers the greeting "%s" with the AIRA introduction and no provider call', async (message) => {
    const result = await queryAira(message, [], [], true);
    expect(result.answer).toContain('**AIRA**');
    expect(result.provider).toBe('AIRA RAG Engine');
    expect(result.suggestedQueries).toContain('Tell me about AMLOCK');
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it.each([
    ['how are you', 'AIRA RAG Engine'],
    ['thanks a lot', 'AIRA RAG Engine'],
  ])('answers the small talk "%s" locally', async (message, provider) => {
    const result = await queryAira(message, [], [], true);
    expect(result.provider).toBe(provider);
    expect(mockCreate).not.toHaveBeenCalled();
  });

  it('does not treat a word that merely starts with "hi" as a greeting', async () => {
    const result = await queryAira('hiking trails in Kenya', [], [], false);
    expect(result.answer).not.toContain('**AIRA**');
    expect(result.provider).not.toBe('AIRA RAG Engine');
  });
});
