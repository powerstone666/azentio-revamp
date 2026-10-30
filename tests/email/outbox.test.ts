import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { getSmtpTransport } from '@/app/api/(services)/email/smtp';
import { deliverEmailOutboxItem, drainEmailOutbox, enqueueEmail } from '@/app/api/(services)/email/outbox';
import { BRAND } from '@/app/api/(services)/email/brand';
import { mockDb } from '../support/db';
import { routeSql, type SqlRoute } from './sql-router';

jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));
jest.mock('@/app/api/(services)/email/smtp', () => ({ getSmtpTransport: jest.fn() }));

const ORIGIN = 'https://portal.example.test';
const RECIPIENT = 'ana@example.test';
const LOGO_CID = `cid:${BRAND.logoCid}`;

type ClaimRow = {
  id: string; recipient_email: string; subject: string; text_body: string; html_body: string | null; attempts: number;
};

const baseClaim = (overrides: Partial<ClaimRow> = {}): ClaimRow => ({
  id: 'e1', recipient_email: RECIPIENT, subject: 'Hello', text_body: 'First line\n\nSecond line',
  html_body: null, attempts: 1, ...overrides,
});

const db = mockDb({ query, queryOne, transaction });
const txHandle = query as unknown as Parameters<typeof enqueueEmail>[0];
let sendMail: jest.Mock;

/** Routes SQL for one delivery. `claims` maps an outbox id to the row the claim UPDATE returns. */
function installRoutes(claims: Record<string, ClaimRow>, extra: SqlRoute[] = []) {
  const routes: SqlRoute[] = [
    ['ALTER TABLE email_outbox', () => []],
    ["SET status = 'processing'", ([id]) => (claims[id as string] ? [claims[id as string]] : [])],
    ["SET status = 'sent'", () => []],
    ["SET status = 'failed'", () => []],
    ...extra,
  ];
  const { impl, unmatched } = routeSql(routes);
  db.query.mockImplementation(impl);
  return unmatched;
}

const updateCall = (status: 'sent' | 'failed') =>
  db.query.mock.calls.find(([sql]) => String(sql).includes(`SET status = '${status}'`));

beforeEach(() => {
  process.env.SMTP_FROM = 'Azentio <noreply@example.test>';
  db.query.mockReset();
  db.queryOne.mockReset();
  db.transaction.mockReset();
  mockDb({ query, queryOne, transaction });
  sendMail = jest.fn().mockResolvedValue({ accepted: [RECIPIENT], rejected: [] });
  (getSmtpTransport as jest.Mock).mockReset().mockReturnValue({ sendMail });
});

describe('enqueueEmail', () => {
  it('stores the recipient in lower case with the queued status and the html body', async () => {
    installRoutes({}, [['INSERT INTO email_outbox', () => [{ id: 'e9' }]]]);
    const id = await enqueueEmail(txHandle, {
      idempotencyKey: 'k1', recipient: 'Ana@Example.TEST', subject: 'S', text: 'T', html: '<p>H</p>',
    });
    expect(id).toBe('e9');
    const insert = db.query.mock.calls.find(([sql]) => String(sql).includes('INSERT INTO email_outbox'));
    expect(insert?.[0]).toContain("'queued'");
    expect(insert?.[0]).toContain('ON CONFLICT (idempotency_key) DO NOTHING');
    expect(insert?.[1]).toEqual(['k1', 'ana@example.test', 'S', 'T', '<p>H</p>']);
  });

  it('returns the existing delivery id when the idempotency key was already enqueued', async () => {
    installRoutes({}, [
      ['INSERT INTO email_outbox', () => []],
      ['SELECT id FROM email_outbox WHERE idempotency_key', () => [{ id: 'existing-1' }]],
    ]);
    const id = await enqueueEmail(txHandle, { idempotencyKey: 'dup', recipient: RECIPIENT, subject: 'S', text: 'T', html: '<p/>' });
    expect(id).toBe('existing-1');
  });

  it('throws when the insert is skipped and no existing row can be found', async () => {
    installRoutes({}, [
      ['INSERT INTO email_outbox', () => []],
      ['SELECT id FROM email_outbox WHERE idempotency_key', () => []],
    ]);
    await expect(enqueueEmail(txHandle, { idempotencyKey: 'x', recipient: RECIPIENT, subject: 'S', text: 'T', html: '' }))
      .rejects.toThrow('Unable to persist email delivery');
  });
});

describe('deliverEmailOutboxItem', () => {
  it('sends the text and html to the recipient and marks the row sent', async () => {
    installRoutes({ e1: baseClaim({ html_body: '<p>Stored</p>' }) });
    await expect(deliverEmailOutboxItem('e1', ORIGIN)).resolves.toBe('sent');
    expect(sendMail).toHaveBeenCalledTimes(1);
    expect(sendMail.mock.calls[0][0]).toMatchObject({
      from: 'Azentio <noreply@example.test>', to: RECIPIENT, subject: 'Hello', text: 'First line\n\nSecond line', html: '<p>Stored</p>',
    });
    expect(updateCall('sent')?.[1]).toEqual(['e1']);
  });

  it('sends a stored html_body without re-rendering it', async () => {
    installRoutes({ e1: baseClaim({ html_body: '<p>Exact markup</p>' }) });
    await deliverEmailOutboxItem('e1', ORIGIN);
    expect(sendMail.mock.calls[0][0].html).toBe('<p>Exact markup</p>');
  });

  it.each([
    ['null', null],
    ['an empty string', ''],
    ['whitespace only', '   \n  '],
  ])('renders the branded template on the origin when html_body is %s', async (_label, htmlBody) => {
    installRoutes({ e1: baseClaim({ html_body: htmlBody }) });
    await deliverEmailOutboxItem('e1', ORIGIN);
    const { html } = sendMail.mock.calls[0][0];
    expect(html).toContain(`href="${ORIGIN}/"`);
    expect(html).toContain('<p style="margin: 0 0 18px 0;');
    expect(html).toContain('Second line');
    expect(html).not.toContain('localhost');
  });

  it.each([
    ['the html references the logo cid', `<img src="${LOGO_CID}">`, true],
    ['the html has no cid reference', '<p>No images</p>', false],
  ])('attaches the logo only when %s', async (_label, html, attached) => {
    installRoutes({ e1: baseClaim({ html_body: html }) });
    await deliverEmailOutboxItem('e1', ORIGIN);
    const { attachments } = sendMail.mock.calls[0][0];
    if (attached) {
      expect(attachments).toHaveLength(1);
      expect(attachments[0]).toMatchObject({ cid: BRAND.logoCid, contentDisposition: 'inline' });
    } else {
      expect(attachments).toBeUndefined();
    }
  });

  it('skips a row that another worker already claimed or that was already sent', async () => {
    installRoutes({});
    await expect(deliverEmailOutboxItem('already-sent', ORIGIN)).resolves.toBe('skipped');
    expect(sendMail).not.toHaveBeenCalled();
    expect(updateCall('sent')).toBeUndefined();
  });

  it.each([
    ['nothing accepted', { accepted: [], rejected: [] }],
    ['only a different address accepted', { accepted: ['someone-else@example.test'], rejected: [] }],
    ['the recipient rejected', { accepted: [RECIPIENT], rejected: [RECIPIENT] }],
  ])('treats delivery as failed when %s', async (_label, smtpResult) => {
    sendMail.mockResolvedValue(smtpResult);
    installRoutes({ e1: baseClaim() });
    await expect(deliverEmailOutboxItem('e1', ORIGIN)).resolves.toBe('queued');
    expect(updateCall('sent')).toBeUndefined();
    expect(updateCall('failed')?.[0]).toContain("'smtp_delivery_failed'");
  });

  it('accepts a recipient reported in a different letter case', async () => {
    sendMail.mockResolvedValue({ accepted: ['ANA@Example.test'], rejected: [] });
    installRoutes({ e1: baseClaim() });
    await expect(deliverEmailOutboxItem('e1', ORIGIN)).resolves.toBe('sent');
  });

  it.each([
    [1, 2], [2, 4], [3, 8], [4, 16], [5, 32], [6, 60], [7, 60], [8, 60],
  ])('schedules a retry after %i attempt(s) in %i minutes, capped at 60', async (attempts, minutes) => {
    sendMail.mockRejectedValue(new Error('421 try again later'));
    installRoutes({ e1: baseClaim({ attempts }) });
    await expect(deliverEmailOutboxItem('e1', ORIGIN)).resolves.toBe('queued');
    expect(updateCall('failed')?.[1]).toEqual(['e1', minutes]);
  });

  it('releases the lock and records the error code when SMTP throws', async () => {
    sendMail.mockRejectedValue(new Error('connection reset'));
    installRoutes({ e1: baseClaim() });
    await deliverEmailOutboxItem('e1', ORIGIN);
    const failed = updateCall('failed')?.[0] as string;
    expect(failed).toContain('locked_at = NULL');
    expect(failed).toContain("last_error_code = 'smtp_delivery_failed'");
  });

  it('queues for later without sending when SMTP is not configured', async () => {
    (getSmtpTransport as jest.Mock).mockReturnValue(null);
    installRoutes({ e1: baseClaim() });
    await expect(deliverEmailOutboxItem('e1', ORIGIN)).resolves.toBe('queued');
    expect(sendMail).not.toHaveBeenCalled();
    expect(updateCall('failed')?.[0]).toContain("'smtp_not_configured'");
  });
});

describe('drainEmailOutbox', () => {
  it.each([
    [0, 1], [-5, 1], [10, 10], [500, 100],
  ])('clamps a requested limit of %i to %i', async (requested, applied) => {
    installRoutes({}, [['ORDER BY next_attempt_at, created_at', () => []]]);
    await drainEmailOutbox(requested, ORIGIN);
    const select = db.query.mock.calls.find(([sql]) => String(sql).includes('ORDER BY next_attempt_at, created_at'));
    expect(select?.[1]).toEqual([applied]);
  });

  it('reports attempted, sent and queued counts, ignoring rows that were skipped', async () => {
    const claims = {
      ok: baseClaim({ id: 'ok' }),
      bad: baseClaim({ id: 'bad', recipient_email: 'bob@example.test' }),
    };
    installRoutes(claims, [
      ['ORDER BY next_attempt_at, created_at', () => [{ id: 'ok' }, { id: 'bad' }, { id: 'gone' }]],
    ]);
    sendMail.mockImplementation(async ({ to }: { to: string }) =>
      to === RECIPIENT ? { accepted: [RECIPIENT], rejected: [] } : { accepted: [], rejected: [to] });
    await expect(drainEmailOutbox(25, ORIGIN)).resolves.toEqual({ attempted: 2, sent: 1, queued: 1 });
  });
});
