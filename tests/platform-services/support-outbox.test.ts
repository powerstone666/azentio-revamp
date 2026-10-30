import { createHmac } from 'node:crypto';

jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import {
  deliverSupportTicketOutboxForTicket,
  deliverSupportTicketOutboxItem,
  drainSupportTicketOutbox,
} from '@/app/api/(services)/support/outbox';

const TOKEN = 'test-webhook-token';
const GOOD_URL = 'https://hooks.example.com/support';
const originalEnv = { ...process.env };
const originalFetch = global.fetch;
const fetchMock = jest.fn();

/** Pass null to leave a variable unset. */
function setWebhookEnv(url: string | null, token: string | null = TOKEN) {
  if (url === null) delete process.env.SUPPORT_TICKETS_WEBHOOK_URL;
  else process.env.SUPPORT_TICKETS_WEBHOOK_URL = url;
  if (token === null) delete process.env.SUPPORT_TICKETS_WEBHOOK_TOKEN;
  else process.env.SUPPORT_TICKETS_WEBHOOK_TOKEN = token;
}

function ticketRow(id: string) {
  return {
    id, org_id: 'org-1', org_name: 'Acme', subject: 'Cannot log in', details: 'Details here',
    category: 'access', status: 'open', created_at: new Date('2026-10-01T00:00:00Z'),
  };
}

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
  setWebhookEnv(GOOD_URL);
  fetchMock.mockReset();
  global.fetch = fetchMock as unknown as typeof fetch;
});

afterEach(() => {
  process.env = { ...originalEnv };
  global.fetch = originalFetch;
});

describe('support webhook URL guard', () => {
  it.each([
    ['https://hooks.example.com/support'],
    ['http://localhost:4000/hook'],
    ['http://127.0.0.1:4000/hook'],
  ])('accepts the configured webhook URL %s and proceeds to claim the outbox row', async (url) => {
    setWebhookEnv(url);
    query.mockResolvedValueOnce([]);
    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('skipped');
    expect(transaction).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['http://hooks.example.com/support', 'plain HTTP to a remote host'],
    ['ftp://hooks.example.com/support', 'a non-HTTP(S) scheme'],
    ['https://user:secret@hooks.example.com/support', 'URL-embedded credentials'],
    ['http://localhost.evil.example/hook', 'a hostname that only starts with localhost'],
    ['not a url', 'a value that is not a URL'],
  ])('rejects %s because it has %s, before touching the database', async (url) => {
    setWebhookEnv(url);
    await expect(deliverSupportTicketOutboxItem('outbox-1')).rejects.toThrow(/Support webhook|SUPPORT_TICKETS_WEBHOOK_URL/);
    expect(transaction).not.toHaveBeenCalled();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('treats an unconfigured webhook as queued and performs no database work', async () => {
    setWebhookEnv(null);
    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('queued');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('treats a webhook URL without a token as unconfigured', async () => {
    setWebhookEnv(GOOD_URL, null);
    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('queued');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('accepts the IPv6 loopback over plain HTTP because loopback is allowed for localhost', async () => {
    setWebhookEnv('http://[::1]:4000/hook');
    query.mockResolvedValueOnce([]);
    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('skipped');
  });
});

describe('deliverSupportTicketOutboxItem', () => {
  function claimAndTicket(attempts = 1) {
    query.mockResolvedValueOnce([{ id: 'outbox-1', ticket_id: 'ticket-1', attempts }]);
    queryOne.mockResolvedValueOnce(ticketRow('ticket-1'));
  }

  it('posts a signed, idempotent ticket payload to the webhook with the bearer token', async () => {
    claimAndTicket();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ticket_id: 'ext-42' }));
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('sent');

    const [url, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(url).toBe(GOOD_URL);
    expect(init.method).toBe('POST');
    expect(init.cache).toBe('no-store');
    const headers = init.headers as Record<string, string>;
    expect(headers.Authorization).toBe(`Bearer ${TOKEN}`);
    expect(headers['Idempotency-Key']).toBe('client-support-ticket:ticket-1:created');
    expect(headers['X-Azentio-Event']).toBe('support_ticket.created');

    const body = init.body as string;
    expect(headers['X-Azentio-Signature']).toBe(`sha256=${createHmac('sha256', TOKEN).update(body).digest('hex')}`);
    const payload = JSON.parse(body);
    expect(payload).toMatchObject({
      event: 'support_ticket.created',
      idempotency_key: 'client-support-ticket:ticket-1:created',
      ticket: { id: 'ticket-1', organization_id: 'org-1', organization_name: 'Acme', status: 'open' },
    });
  });

  it('marks the outbox row sent and links the external ticket id in one transaction', async () => {
    claimAndTicket();
    fetchMock.mockResolvedValueOnce(jsonResponse({ ticket_id: 'ext-42' }));
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await deliverSupportTicketOutboxItem('outbox-1');

    const sqlCalls = query.mock.calls as [string, unknown[]][];
    const sentUpdate = sqlCalls.find(([sql]) => sql.includes("status = 'sent'"));
    const ticketUpdate = sqlCalls.find(([sql]) => sql.includes('external_system'));
    expect(sentUpdate?.[0]).toMatch(/UPDATE support_ticket_outbox/);
    expect(sentUpdate?.[1]).toEqual(['outbox-1']);
    expect(ticketUpdate?.[0]).toMatch(/UPDATE client_support_tickets/);
    expect(ticketUpdate?.[1]).toEqual(['ticket-1', 'ext-42']);
    expect(transaction).toHaveBeenCalledTimes(2);
  });

  it.each([
    ['a non-JSON response body', () => new Response('ok', { status: 200, headers: { 'content-type': 'text/plain' } })],
    ['a JSON body without ticket_id', () => jsonResponse({ ok: true })],
    ['a ticket_id longer than 255 characters', () => jsonResponse({ ticket_id: 'x'.repeat(256) })],
  ])('keeps the existing external ticket id (null param) for %s', async (_label, makeResponse) => {
    claimAndTicket();
    fetchMock.mockResolvedValueOnce(makeResponse());
    query.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('sent');
    const ticketUpdate = (query.mock.calls as [string, unknown[]][]).find(([sql]) => sql.includes('external_system'));
    expect(ticketUpdate?.[1]).toEqual(['ticket-1', null]);
  });

  it.each([
    [1, 2], [2, 4], [3, 8], [6, 60], [7, 60],
  ])('after attempt %i the retry is scheduled %i minutes out with the backoff capped at 60', async (attempts, minutes) => {
    claimAndTicket(attempts);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'down' }, 500));
    query.mockResolvedValueOnce([]);

    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('queued');
    const retry = (query.mock.calls as [string, unknown[]][])[1];
    expect(retry[0]).toMatch(/status = 'queued'/);
    expect(retry[0]).toMatch(/last_error_code = 'webhook_delivery_failed'/);
    expect(retry[1]).toEqual(['outbox-1', minutes]);
  });

  it('marks the row failed (no further retries) once the eighth attempt fails', async () => {
    claimAndTicket(8);
    fetchMock.mockResolvedValueOnce(jsonResponse({ error: 'down' }, 503));
    query.mockResolvedValueOnce([]);

    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('failed');
    const failure = (query.mock.calls as [string, unknown[]][])[1];
    expect(failure[0]).toMatch(/status = 'failed'/);
    expect(failure[1]).toEqual(['outbox-1']);
  });

  it('treats a network error the same as a non-2xx response and queues a retry', async () => {
    claimAndTicket(2);
    fetchMock.mockRejectedValueOnce(new Error('socket hang up'));
    query.mockResolvedValueOnce([]);

    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('queued');
    expect((query.mock.calls as [string, unknown[]][])[1][1]).toEqual(['outbox-1', 4]);
  });

  it('skips delivery when the claim finds no due row (already processing, sent, or exhausted)', async () => {
    query.mockResolvedValueOnce([]);
    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('skipped');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('claims only due rows, respects the attempt cap, and recovers stale processing locks', async () => {
    query.mockResolvedValueOnce([]);
    await deliverSupportTicketOutboxItem('outbox-1');
    const [claimSql] = query.mock.calls[0] as [string];
    expect(claimSql).toMatch(/next_attempt_at <= now\(\)/);
    expect(claimSql).toMatch(/attempts < 8/);
    expect(claimSql).toMatch(/locked_at < now\(\) - interval '10 minutes'/);
  });

  it('does not call the webhook when the ticket row has disappeared and marks the claim as a failure', async () => {
    query.mockResolvedValueOnce([{ id: 'outbox-1', ticket_id: 'gone', attempts: 1 }]);
    queryOne.mockResolvedValueOnce(null);
    query.mockResolvedValueOnce([]);

    await expect(deliverSupportTicketOutboxItem('outbox-1')).resolves.toBe('queued');
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe('deliverSupportTicketOutboxForTicket', () => {
  it('returns skipped when the ticket has no outbox row', async () => {
    queryOne.mockResolvedValueOnce(null);
    await expect(deliverSupportTicketOutboxForTicket('ticket-9')).resolves.toBe('skipped');
    expect(transaction).not.toHaveBeenCalled();
  });

  it('selects the most recent outbox row for the ticket and delivers it', async () => {
    queryOne.mockResolvedValueOnce({ id: 'outbox-latest' });
    query.mockResolvedValueOnce([]);
    await deliverSupportTicketOutboxForTicket('ticket-9');
    const [selectSql, params] = queryOne.mock.calls[0] as [string, unknown[]];
    expect(selectSql).toMatch(/WHERE ticket_id = \$1/);
    expect(selectSql).toMatch(/ORDER BY created_at DESC, id DESC LIMIT 1/);
    expect(params).toEqual(['ticket-9']);
    expect((query.mock.calls[0] as [string, unknown[]])[1]).toEqual(['outbox-latest']);
  });
});

describe('drainSupportTicketOutbox', () => {
  it('reports the queued backlog without attempting delivery when no webhook is configured', async () => {
    setWebhookEnv(null);
    queryOne.mockResolvedValueOnce({ count: 3 });
    await expect(drainSupportTicketOutbox()).resolves.toEqual({
      attempted: 0, sent: 0, queued: 3, provider_configured: false,
    });
    expect(query).not.toHaveBeenCalled();
  });

  it.each([
    [0, 1], [-5, 1], [1, 1], [25, 25], [500, 100],
  ])('clamps a requested batch of %i to %i rows', async (requested, expected) => {
    query.mockResolvedValueOnce([]);
    await drainSupportTicketOutbox(requested);
    expect((query.mock.calls[0] as [string, unknown[]])[1]).toEqual([expected]);
  });

  it('delivers each due row and summarises sent, queued and failed outcomes', async () => {
    query.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('ORDER BY next_attempt_at')) return [{ id: 'a' }, { id: 'b' }];
      if (sql.includes("status = 'processing'")) {
        return [{ id: params?.[0], ticket_id: `ticket-${String(params?.[0])}`, attempts: 1 }];
      }
      return [];
    });
    queryOne.mockImplementation(async (sql: string, params?: unknown[]) => {
      if (sql.includes('FROM client_support_tickets')) return ticketRow(String(params?.[0]));
      return null;
    });
    fetchMock.mockImplementation(async (_url: string, init: RequestInit) => {
      const payload = JSON.parse(init.body as string);
      return payload.ticket.id === 'ticket-a' ? jsonResponse({ ticket_id: 'ext-a' }) : jsonResponse({}, 500);
    });

    await expect(drainSupportTicketOutbox()).resolves.toEqual({
      attempted: 2, sent: 1, queued: 1, failed: 0, provider_configured: true,
    });
  });
});
