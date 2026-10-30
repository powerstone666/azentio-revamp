import { POST } from '@/app/api/v1/aira/chat/route';
import { queryAira } from '@/app/api/(services)/aira/ai';
import { query } from '@/app/api/(db)/client';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { searchApprovedCopies } from '@/app/api/(services)/learning/shared-learning';

jest.mock('@/app/api/(services)/aira/ai', () => ({ queryAira: jest.fn() }));
jest.mock('@/app/api/(db)/client', () => ({ query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {} }));
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn() }));
jest.mock('@/app/api/(services)/learning/shared-learning', () => ({ searchApprovedCopies: jest.fn() }));

const mockQueryAira = jest.mocked(queryAira);
const mockQuery = jest.mocked(query);
const mockGetSession = jest.mocked(getSession);
const mockAuthorize = jest.mocked(authorize);
const mockSearchApprovedCopies = jest.mocked(searchApprovedCopies);

const SIGNED_IN = {
  user: { id: 'user-1' },
  activeWorkspace: { orgId: 'org-1', isSandbox: false },
};

function postJson(body: unknown, headers: Record<string, string> = {}): Request {
  return new Request('http://localhost/api/v1/aira/chat', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: typeof body === 'string' ? body : JSON.stringify(body),
  });
}

const ANSWER = { answer: 'Local answer', sources: [], suggestedQueries: ['Products overview'], provider: 'Azentio RAG Engine' };

beforeEach(() => {
  mockGetSession.mockResolvedValue(null as never);
  mockAuthorize.mockResolvedValue({ allowed: false } as never);
  mockSearchApprovedCopies.mockResolvedValue({ data: [] } as never);
  mockQuery.mockResolvedValue([] as never);
  mockQueryAira.mockResolvedValue(ANSWER);
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('AIRA chat route request validation', () => {
  it('returns 400 when the body is not valid JSON', async () => {
    const response = await POST(postJson('{not json'));
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual({ error: 'Invalid JSON body' });
    expect(mockQueryAira).not.toHaveBeenCalled();
  });

  it.each([
    ['a missing message', {}],
    ['an empty message', { message: '' }],
    ['a whitespace-only message', { message: '   ' }],
    ['a message over 1200 characters', { message: 'a'.repeat(1201) }],
    ['more than 12 history turns', { message: 'hi', history: Array.from({ length: 13 }, () => ({ role: 'user', content: 'x' })) }],
    ['a history role other than user or assistant', { message: 'hi', history: [{ role: 'system', content: 'x' }] }],
    ['a history turn over 1500 characters', { message: 'hi', history: [{ role: 'user', content: 'x'.repeat(1501) }] }],
    ['a non-boolean allow_external_processing', { message: 'hi', allow_external_processing: 'true' }],
  ])('rejects %s with a validation error and never calls AIRA', async (_label, body) => {
    const response = await POST(postJson(body));
    expect(response.status).toBe(422);
    const json = await response.json();
    expect(json.error).toBe('Invalid AIRA request');
    expect(json.details).toBeDefined();
    expect(mockQueryAira).not.toHaveBeenCalled();
  });

  it('trims the message before passing it to AIRA', async () => {
    await POST(postJson({ message: '  What is AMLOCK?  ' }));
    expect(mockQueryAira.mock.calls[0][0]).toBe('What is AMLOCK?');
  });

  it('defaults allow_external_processing to false when it is omitted', async () => {
    await POST(postJson({ message: 'What is AMLOCK?' }));
    expect(mockQueryAira.mock.calls[0][3]).toBe(false);
  });

  it('passes allow_external_processing through when the caller sets it', async () => {
    await POST(postJson({ message: 'What is AMLOCK?', allow_external_processing: true }));
    expect(mockQueryAira.mock.calls[0][3]).toBe(true);
  });

  it('passes an empty history when none is provided', async () => {
    await POST(postJson({ message: 'What is AMLOCK?' }));
    expect(mockQueryAira.mock.calls[0][1]).toEqual([]);
  });

  it('passes the provided history through unchanged', async () => {
    const history = [{ role: 'user', content: 'Hi' }, { role: 'assistant', content: 'Hello!' }];
    await POST(postJson({ message: 'What is AMLOCK?', history }));
    expect(mockQueryAira.mock.calls[0][1]).toEqual(history);
  });
});

describe('AIRA chat route consent audit', () => {
  it.each([
    ['a signed-in user who consents', SIGNED_IN, true, true],
    ['a signed-in user who does not consent', SIGNED_IN, false, false],
    ['an anonymous visitor who consents', null, true, false],
    ['an anonymous visitor who does not consent', null, false, false],
  ])('records the consent audit row for %s: %s', async (_label, actor, allow, expectAudit) => {
    mockGetSession.mockResolvedValue(actor as never);
    await POST(postJson({ message: 'What is AMLOCK?', allow_external_processing: allow }));
    const auditCalls = mockQuery.mock.calls.filter(([sql]) => String(sql).includes('audit_log'));
    if (expectAudit) {
      expect(auditCalls).toHaveLength(1);
      const [sql, params] = auditCalls[0] as unknown as [string, unknown[]];
      expect(sql).toContain("'aira.external_processing_consent'");
      expect(params[0]).toBe('user-1');
      expect(params[2]).toBe('org-1');
    } else {
      expect(auditCalls).toHaveLength(0);
    }
  });

  it('records the consent audit row before calling AIRA', async () => {
    mockGetSession.mockResolvedValue(SIGNED_IN as never);
    const order: string[] = [];
    mockQuery.mockImplementation(async () => {
      order.push('audit');
      return [] as never;
    });
    mockQueryAira.mockImplementation(async () => {
      order.push('aira');
      return ANSWER;
    });
    await POST(postJson({ message: 'What is AMLOCK?', allow_external_processing: true }));
    expect(order).toEqual(['audit', 'aira']);
  });

  it('does not call AIRA when the consent audit write fails', async () => {
    mockGetSession.mockResolvedValue(SIGNED_IN as never);
    mockQuery.mockRejectedValueOnce(new Error('db down'));
    const response = await POST(postJson({ message: 'What is AMLOCK?', allow_external_processing: true }));
    expect(response.status).toBe(500);
    expect(mockQueryAira).not.toHaveBeenCalled();
  });
});

describe('AIRA chat route shared evidence', () => {
  it('passes approved shared-learning results to AIRA for a signed-in user with read permission', async () => {
    mockGetSession.mockResolvedValue(SIGNED_IN as never);
    mockAuthorize.mockResolvedValue({ allowed: true } as never);
    mockSearchApprovedCopies.mockResolvedValue({
      data: [{ id: 'copy-1', title: 'Pattern', observation_type: 'Typology', body: 'Shared body' }],
    } as never);
    await POST(postJson({ message: 'mule pattern' }));
    expect(mockAuthorize).toHaveBeenCalledWith({ action: 'shared-learning:read' });
    expect(mockQueryAira.mock.calls[0][2]).toEqual([
      { id: 'copy-1', title: 'Pattern', category: 'Typology', content: 'Shared body' },
    ]);
  });

  it('uses fallback title and category when a shared copy has no title or observation type', async () => {
    mockGetSession.mockResolvedValue(SIGNED_IN as never);
    mockAuthorize.mockResolvedValue({ allowed: true } as never);
    mockSearchApprovedCopies.mockResolvedValue({ data: [{ id: 'copy-2' }] } as never);
    await POST(postJson({ message: 'mule pattern' }));
    expect(mockQueryAira.mock.calls[0][2]).toEqual([
      { id: 'copy-2', title: 'Approved shared contribution', category: 'Shared learning', content: '' },
    ]);
  });

  it.each([
    ['an anonymous visitor', null, { allowed: true }],
    ['a signed-in user without shared-learning read permission', SIGNED_IN, { allowed: false }],
    ['a signed-in user with no active workspace', { user: { id: 'user-1' }, activeWorkspace: null }, { allowed: true }],
  ])('sends no shared evidence to AIRA for %s', async (_label, actor, permission) => {
    mockGetSession.mockResolvedValue(actor as never);
    mockAuthorize.mockResolvedValue(permission as never);
    await POST(postJson({ message: 'mule pattern' }));
    expect(mockSearchApprovedCopies).not.toHaveBeenCalled();
    expect(mockQueryAira.mock.calls[0][2]).toEqual([]);
  });

  it('still answers with an empty evidence list when the session lookup throws', async () => {
    mockGetSession.mockRejectedValue(new Error('session store down'));
    const response = await POST(postJson({ message: 'What is AMLOCK?' }));
    expect(response.status).toBe(200);
    expect(mockQueryAira.mock.calls[0][2]).toEqual([]);
  });
});

describe('AIRA chat route response', () => {
  it('returns the AIRA result as JSON with a no-store cache header', async () => {
    const response = await POST(postJson({ message: 'What is AMLOCK?' }));
    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('private, no-store, max-age=0');
    expect(await response.json()).toEqual(ANSWER);
  });

  it('returns 500 with an AIRA failure body when the AIRA call throws', async () => {
    mockQueryAira.mockRejectedValueOnce(new Error('engine exploded'));
    const response = await POST(postJson({ message: 'What is AMLOCK?' }));
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'AIRA failure', details: 'engine exploded' });
  });
});
