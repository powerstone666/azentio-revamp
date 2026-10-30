import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { enqueueEmail } from '@/app/api/(services)/email/outbox';
import { drainNotificationOutbox } from '@/app/api/(services)/notifications/outbox';
import { mockDb } from '../support/db';
import { routeSql, type SqlRoute } from './sql-router';

jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));
jest.mock('@/app/api/(services)/email/outbox', () => ({ enqueueEmail: jest.fn() }));

const ORIGIN = 'https://portal.example.test';

type OutboxRow = {
  id: string; notification_id: string; event: string; email: string; disabled_at: Date | null;
};

const activeRow = (overrides: Partial<OutboxRow> = {}): OutboxRow => ({
  id: 'o1', notification_id: 'n1', event: 'contribution.published', email: 'ana@example.test', disabled_at: null, ...overrides,
});

const db = mockDb({ query, queryOne, transaction });
const enqueue = enqueueEmail as unknown as jest.Mock;

/** Routes one drain run. `rows` maps an outbox id to the row the handoff SELECT returns. */
function installRoutes(ids: string[], rows: Record<string, OutboxRow>, extra: SqlRoute[] = []) {
  const routes: SqlRoute[] = [
    ['ORDER BY created_at, id LIMIT', () => ids.map((id) => ({ id }))],
    ['FOR UPDATE OF o SKIP LOCKED', ([id]) => (rows[id as string] ? [rows[id as string]] : [])],
    ["'recipient_disabled'", () => []],
    ['SET attempts = attempts + 1, delivered_at = now()', () => []],
    ["'email_queue_handoff_failed'", () => []],
    ...extra,
  ];
  const { impl, unmatched } = routeSql(routes);
  db.query.mockImplementation(impl);
  return unmatched;
}

const callsContaining = (fragment: string) =>
  db.query.mock.calls.filter(([sql]) => String(sql).includes(fragment));

beforeEach(() => {
  db.query.mockReset();
  db.queryOne.mockReset();
  db.transaction.mockReset();
  mockDb({ query, queryOne, transaction });
  enqueue.mockReset().mockResolvedValue('email-1');
});

describe('drainNotificationOutbox', () => {
  it('queues an email for an active recipient with the event subject and an absolute portal link', async () => {
    installRoutes(['o1'], { o1: activeRow() });
    await expect(drainNotificationOutbox(50, ORIGIN)).resolves.toEqual({ attempted: 1, queued: 1, failed: 0 });

    expect(enqueue).toHaveBeenCalledTimes(1);
    const [, email] = enqueue.mock.calls[0];
    expect(email).toMatchObject({
      idempotencyKey: 'notification:n1:email',
      recipient: 'ana@example.test',
      subject: 'Your contribution was published to shared learning',
    });
    expect(email.html).toContain(`href="${ORIGIN}/portal"`);
    expect(email.text).toContain(`Review in Portal: ${ORIGIN}/portal`);
    expect(callsContaining('SET attempts = attempts + 1, delivered_at = now()')[0][1]).toEqual(['o1']);
  });

  it.each([
    ['contribution.published', 'Your contribution was published to shared learning'],
    ['contribution.needs_clarification', 'A moderator requested an update to your contribution'],
    ['contribution.rejected', 'There is an update on your contribution'],
    ['contribution.withdrawn', 'Your contribution was withdrawn'],
    ['idea.status_updated', 'An improvement idea has an update'],
    ['support_ticket.status_updated', 'Your support request has an update'],
    ['workspace.joined', 'You joined an Azentio workspace'],
    ['demo_workspace_ready', 'Your demo workspace is ready'],
    ['some.unknown_event', 'There is an update in your Azentio portal'],
  ])('uses the subject for event %s', async (event, subject) => {
    installRoutes(['o1'], { o1: activeRow({ event }) });
    await drainNotificationOutbox(50, ORIGIN);
    expect(enqueue.mock.calls[0][1].subject).toBe(subject);
  });

  it('skips a disabled recipient: nothing is queued and the outbox row is closed', async () => {
    installRoutes(['o1'], { o1: activeRow({ disabled_at: new Date('2026-01-01') }) });
    await drainNotificationOutbox(50, ORIGIN);
    expect(enqueue).not.toHaveBeenCalled();
    expect(callsContaining("'recipient_disabled'")[0][1]).toEqual(['o1']);
  });

  it('does not count a skipped disabled recipient as queued', async () => {
    installRoutes(['o1'], { o1: activeRow({ disabled_at: new Date('2026-01-01') }) });
    await expect(drainNotificationOutbox(50, ORIGIN)).resolves.toMatchObject({ queued: 0 });
  });

  it('counts a failed handoff and schedules a retry without closing the row', async () => {
    enqueue.mockRejectedValue(new Error('db unavailable'));
    installRoutes(['o1'], { o1: activeRow() });
    await expect(drainNotificationOutbox(50, ORIGIN)).resolves.toEqual({ attempted: 1, queued: 0, failed: 1 });
    const retry = callsContaining("'email_queue_handoff_failed'");
    expect(retry).toHaveLength(1);
    expect(retry[0][0]).toContain('next_attempt_at = now()');
    expect(retry[0][1]).toEqual(['o1']);
    expect(callsContaining('SET attempts = attempts + 1, delivered_at = now()')).toHaveLength(0);
  });

  it('skips a row that is already delivered or locked by another worker', async () => {
    installRoutes(['gone'], {});
    await expect(drainNotificationOutbox(50, ORIGIN)).resolves.toEqual({ attempted: 1, queued: 0, failed: 0 });
    expect(enqueue).not.toHaveBeenCalled();
  });

  it('keeps going after one row fails', async () => {
    enqueue.mockRejectedValueOnce(new Error('boom')).mockResolvedValueOnce('email-2');
    installRoutes(['o1', 'o2'], {
      o1: activeRow({ id: 'o1', notification_id: 'n1' }),
      o2: activeRow({ id: 'o2', notification_id: 'n2' }),
    });
    await expect(drainNotificationOutbox(50, ORIGIN)).resolves.toEqual({ attempted: 2, queued: 1, failed: 1 });
  });

  it.each([
    [0, 1], [-1, 1], [75, 75], [1000, 100],
  ])('clamps a requested batch of %i to %i', async (requested, applied) => {
    installRoutes([], {});
    await drainNotificationOutbox(requested, ORIGIN);
    const select = callsContaining('ORDER BY created_at, id LIMIT');
    expect(select[0][1]).toEqual([applied]);
  });
});
