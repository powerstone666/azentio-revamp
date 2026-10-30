/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/email/outbox', () => ({ drainEmailOutbox: jest.fn() }));
jest.mock('@/app/api/(services)/notifications/outbox', () => ({ drainNotificationOutbox: jest.fn() }));
jest.mock('@/app/api/(services)/learning/digests', () => ({ deliverSavedSearchDigests: jest.fn() }));
jest.mock('@/app/api/(services)/learning/semantic-index', () => ({ drainSharedCopyEmbeddingJobs: jest.fn() }));
jest.mock('@/app/api/(services)/support/outbox', () => ({ drainSupportTicketOutbox: jest.fn() }));
jest.mock('@/app/api/(services)/auth/better-auth-config', () => ({ auth: { __instance: 'better-auth' } }));
jest.mock('better-auth/next-js', () => ({
  toNextJsHandler: jest.fn(() => ({ GET: jest.fn(), POST: jest.fn() })),
}));

import { toNextJsHandler } from 'better-auth/next-js';
import { auth } from '@/app/api/(services)/auth/better-auth-config';
import { drainEmailOutbox } from '@/app/api/(services)/email/outbox';
import { drainNotificationOutbox } from '@/app/api/(services)/notifications/outbox';
import { deliverSavedSearchDigests } from '@/app/api/(services)/learning/digests';
import { drainSharedCopyEmbeddingJobs } from '@/app/api/(services)/learning/semantic-index';
import { drainSupportTicketOutbox } from '@/app/api/(services)/support/outbox';
import * as emailOutboxRoute from '@/app/api/v1/internal/email-outbox/route';
import * as supportOutboxRoute from '@/app/api/v1/internal/support-ticket-outbox/route';
import * as authRoute from '@/app/api/v1/auth/[...all]/route';
import { makeRequest, readJson, expectNoInternals } from './fixtures';

const digestsMock = jest.mocked(deliverSavedSearchDigests);
const notificationsMock = jest.mocked(drainNotificationOutbox);
const emailMock = jest.mocked(drainEmailOutbox);
const semanticMock = jest.mocked(drainSharedCopyEmbeddingJobs);
const supportDrainMock = jest.mocked(drainSupportTicketOutbox);

// Captured at module load: clearMocks wipes call history before every test.
const authHandlerCall = jest.mocked(toNextJsHandler).mock.calls[0];

const TOKEN = 'job-token-for-tests-0001';
const OTHER_TOKEN = 'job-token-for-tests-0002';
const CRON = 'cron-secret-for-tests-0003';
const ENV_KEYS = ['OUTBOX_JOB_TOKEN', 'CRON_SECRET', 'EMAIL_OUTBOX_JOB_ENABLED'] as const;

const savedEnv: Record<string, string | undefined> = {};
beforeEach(() => {
  for (const key of ENV_KEYS) savedEnv[key] = process.env[key];
  for (const key of ENV_KEYS) delete process.env[key];
  process.env.OUTBOX_JOB_TOKEN = TOKEN;
  process.env.EMAIL_OUTBOX_JOB_ENABLED = 'true';
  digestsMock.mockResolvedValue({ sent: 0 } as never);
  notificationsMock.mockResolvedValue({ handed_off: 0 } as never);
  emailMock.mockResolvedValue({ sent: 0, queued: 0 } as never);
  semanticMock.mockResolvedValue({ processed: 0 } as never);
  supportDrainMock.mockResolvedValue({ sent: 0 } as never);
});
afterEach(() => {
  for (const key of ENV_KEYS) {
    if (savedEnv[key] === undefined) delete process.env[key];
    else process.env[key] = savedEnv[key];
  }
});

const EMAIL_PATH = '/api/v1/internal/email-outbox';
const SUPPORT_PATH = '/api/v1/internal/support-ticket-outbox';
const EMAIL_URL = EMAIL_PATH;
const SUPPORT_URL = SUPPORT_PATH;
const LOCAL_ORIGIN = 'http://localhost';

const authHeaders = (value: string | undefined) => (value === undefined ? {} : { authorization: value });

describe('GET and POST /api/v1/internal/email-outbox (scheduled job)', () => {
  const runners = [
    ['GET', () => emailOutboxRoute.GET],
    ['POST', () => emailOutboxRoute.POST],
  ] as const;

  it.each(runners)('%s rejects a request with no Authorization header with 401 and drains nothing', async (_m, handler) => {
    const response = await handler()(makeRequest(EMAIL_URL, { method: _m }));
    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: 'Unauthorized' });
    expect(digestsMock).not.toHaveBeenCalled();
    expect(emailMock).not.toHaveBeenCalled();
  });

  it.each(runners)('%s rejects wrong, prefixed, shorter, empty and non-Bearer credentials with 401', async (_m, handler) => {
    const bad = [
      `Bearer ${OTHER_TOKEN}`,
      `Bearer ${TOKEN.slice(0, -1)}`,
      `Bearer ${TOKEN}x`,
      'Bearer ',
      `Basic ${TOKEN}`,
      TOKEN.slice(0, 5),
    ];
    for (const value of bad) {
      const response = await handler()(makeRequest(EMAIL_URL, { method: _m, headers: authHeaders(value) }));
      expect(response.status).toBe(401);
    }
    expect(digestsMock).not.toHaveBeenCalled();
    expect(emailMock).not.toHaveBeenCalled();
  });

  it.each(runners)('%s returns 401 for every credential when no token is configured at all', async (_m, handler) => {
    delete process.env.OUTBOX_JOB_TOKEN;
    const response = await handler()(makeRequest(EMAIL_URL, { method: _m, headers: authHeaders('Bearer ') }));
    expect(response.status).toBe(401);
    const response2 = await handler()(makeRequest(EMAIL_URL, { method: _m, headers: authHeaders(`Bearer ${TOKEN}`) }));
    expect(response2.status).toBe(401);
    expect(digestsMock).not.toHaveBeenCalled();
  });

  it.each(runners)('%s skips every drain, even when authorised, unless EMAIL_OUTBOX_JOB_ENABLED is true', async (_m, handler) => {
    for (const value of [undefined, 'false', 'TRUE', '1', '']) {
      if (value === undefined) delete process.env.EMAIL_OUTBOX_JOB_ENABLED;
      else process.env.EMAIL_OUTBOX_JOB_ENABLED = value;
      const response = await handler()(makeRequest(EMAIL_URL, { method: _m, headers: authHeaders(`Bearer ${TOKEN}`) }));
      expect(response.status).toBe(200);
      expect(await readJson(response)).toMatchObject({ data: { skipped: true } });
    }
    expect(digestsMock).not.toHaveBeenCalled();
    expect(notificationsMock).not.toHaveBeenCalled();
    expect(emailMock).not.toHaveBeenCalled();
    expect(semanticMock).not.toHaveBeenCalled();
  });

  it.each(runners)('%s accepts the CRON_SECRET as an alternative credential', async (_m, handler) => {
    process.env.CRON_SECRET = CRON;
    const response = await handler()(makeRequest(EMAIL_URL, { method: _m, headers: authHeaders(`Bearer ${CRON}`) }));
    expect(response.status).toBe(200);
  });

  it.each(runners)('%s accepts the Bearer scheme case-insensitively', async (_m, handler) => {
    const response = await handler()(makeRequest(EMAIL_URL, { method: _m, headers: authHeaders(`bearer ${TOKEN}`) }));
    expect(response.status).toBe(200);
  });

  it.each(runners)('%s runs every drain in order with the request origin and returns a no-store summary', async (_m, handler) => {
    digestsMock.mockResolvedValue({ sent: 2 } as never);
    notificationsMock.mockResolvedValue({ handed_off: 5 } as never);
    emailMock.mockResolvedValue({ sent: 4, queued: 1 } as never);
    semanticMock.mockResolvedValue({ processed: 3 } as never);

    const response = await handler()(makeRequest(EMAIL_URL, { method: _m, headers: authHeaders(`Bearer ${TOKEN}`) }));

    expect(response.status).toBe(200);
    expect(response.headers.get('Cache-Control')).toBe('no-store');
    expect(await readJson(response)).toEqual({
      data: {
        savedSearchDigests: { sent: 2 },
        notificationHandoff: { handed_off: 5 },
        emailDelivery: { sent: 4, queued: 1 },
        semanticIndex: { processed: 3 },
      },
    });
    expect(digestsMock).toHaveBeenCalledWith(100, LOCAL_ORIGIN);
    expect(notificationsMock).toHaveBeenCalledWith(50, LOCAL_ORIGIN);
    expect(emailMock).toHaveBeenCalledWith(25, LOCAL_ORIGIN);
    expect(semanticMock).toHaveBeenCalledWith(25);
  });

  it('derives the origin from the incoming request URL rather than any header', async () => {
    const request = new Request('https://portal.azentio.ai/api/v1/internal/email-outbox?x=1', {
      headers: { authorization: `Bearer ${TOKEN}`, 'x-forwarded-host': 'evil.example' },
    });
    await emailOutboxRoute.POST(request);
    expect(emailMock).toHaveBeenCalledWith(25, 'https://portal.azentio.ai');
    expect(digestsMock).toHaveBeenCalledWith(100, 'https://portal.azentio.ai');
  });
});

describe('POST /api/v1/internal/support-ticket-outbox (scheduled job)', () => {
  const post = (value: string | undefined) =>
    supportOutboxRoute.POST(makeRequest(SUPPORT_URL, { method: 'POST', headers: authHeaders(value) }));

  it('exports only POST so other methods are not routed to the drain', () => {
    expect(supportOutboxRoute).toHaveProperty('POST');
    expect(supportOutboxRoute).not.toHaveProperty('GET');
  });

  it.each([
    ['no header', undefined],
    ['a wrong token of equal length', `Bearer ${OTHER_TOKEN}`],
    ['a truncated token', `Bearer ${TOKEN.slice(0, -2)}`],
    ['an empty bearer value', 'Bearer '],
  ])('returns 401 for %s and does not drain', async (_label, value) => {
    const response = await post(value);
    expect(response.status).toBe(401);
    expect(await readJson(response)).toEqual({ error: 'Unauthorized' });
    expect(supportDrainMock).not.toHaveBeenCalled();
  });

  it('returns 401 when OUTBOX_JOB_TOKEN is unset, even for an empty credential', async () => {
    delete process.env.OUTBOX_JOB_TOKEN;
    expect((await post('Bearer ')).status).toBe(401);
    expect(supportDrainMock).not.toHaveBeenCalled();
  });

  it('does not accept CRON_SECRET, matching the documented OUTBOX_JOB_TOKEN-only contract', async () => {
    process.env.CRON_SECRET = CRON;
    expect((await post(`Bearer ${CRON}`)).status).toBe(401);
    expect(supportDrainMock).not.toHaveBeenCalled();
  });

  it('drains the support outbox for an authorized job and returns the summary with a private no-store header', async () => {
    supportDrainMock.mockResolvedValue({ sent: 7, queued: 2 } as never);
    const response = await post(`Bearer ${TOKEN}`);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: { sent: 7, queued: 2 } });
    expect(response.headers.get('Cache-Control')).toBe('private, no-store');
  });

  it('returns a generic 500 without internals when the drain throws', async () => {
    const consoleSpy = jest.spyOn(console, 'error').mockImplementation(() => undefined);
    supportDrainMock.mockRejectedValue(new Error('SMTP 535 auth failed for user ops@azentio.ai'));
    const response = await post(`Bearer ${TOKEN}`);
    expect(response.status).toBe(500);
    const serialized = JSON.stringify(await readJson(response));
    expect(serialized).toBe(JSON.stringify({ error: 'Unable to drain support ticket outbox' }));
    expectNoInternals(serialized);
    consoleSpy.mockRestore();
  });
});

describe('/api/v1/auth/[...all] (Better Auth catch-all)', () => {
  it('builds its GET and POST handlers from the server Better Auth instance', () => {
    expect(authHandlerCall?.[0]).toBe(auth);
    expect(typeof authRoute.GET).toBe('function');
    expect(typeof authRoute.POST).toBe('function');
  });

  it('exposes only GET and POST', () => {
    expect(Object.keys(authRoute).sort()).toEqual(['GET', 'POST']);
  });
});
