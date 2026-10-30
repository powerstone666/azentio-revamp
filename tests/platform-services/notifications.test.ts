jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import { listNotifications, markNotificationRead } from '@/app/api/(services)/notifications/service';

const USER = 'user-1';

type SqlCall = [string, unknown[]?];
const sqlCalls = () => query.mock.calls as SqlCall[];

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

function row(id: string, createdAt: string, payload: Record<string, unknown> = {}) {
  return { id, event: 'support_ticket.status_updated', safe_payload: payload, read_at: null, created_at: createdAt };
}

describe('listNotifications pagination', () => {
  it('queries the recipient inbox newest-first with one extra row to detect another page', async () => {
    query.mockResolvedValueOnce([]);
    queryOne.mockResolvedValueOnce({ count: '0' });
    await listNotifications(USER, 20);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE recipient_user_id = \$1/);
    expect(sql).toMatch(/ORDER BY created_at DESC, id DESC/);
    expect(params).toEqual([USER, null, null, 21]);
  });

  it('applies the keyset cursor (created_at, id) when a previous page is supplied', async () => {
    query.mockResolvedValueOnce([]);
    queryOne.mockResolvedValueOnce({ count: '0' });
    await listNotifications(USER, 5, { createdAt: '2026-10-30T10:00:00.000Z', id: 'n-9' });
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/\(created_at, id\) < \(\$2::timestamptz, \$3::uuid\)/);
    expect(params).toEqual([USER, '2026-10-30T10:00:00.000Z', 'n-9', 6]);
  });

  it('returns a next cursor from the last returned row only when there is another page', async () => {
    query.mockResolvedValueOnce([
      row('n-3', '2026-10-31T03:00:00Z'), row('n-2', '2026-10-31T02:00:00Z'), row('n-1', '2026-10-31T01:00:00Z'),
    ]);
    queryOne.mockResolvedValueOnce({ count: '7' });
    const page = await listNotifications(USER, 2);
    expect(page.data.map((item) => item.id)).toEqual(['n-3', 'n-2']);
    expect(page.next_cursor).toEqual({ created_at: '2026-10-31T02:00:00Z', id: 'n-2' });
    expect(page.unread_count).toBe(7);
  });

  it('returns no next cursor on the final page', async () => {
    query.mockResolvedValueOnce([row('n-1', '2026-10-31T01:00:00Z')]);
    queryOne.mockResolvedValueOnce({ count: '0' });
    const page = await listNotifications(USER, 2);
    expect(page.next_cursor).toBeNull();
    expect(page.unread_count).toBe(0);
  });

  it.each([
    [{ count: '4' }, 4],
    [null, 0],
  ])('reads the unread count %j as %i and scopes it to the recipient', async (countRow, expected) => {
    query.mockResolvedValueOnce([]);
    queryOne.mockResolvedValueOnce(countRow);
    const page = await listNotifications(USER, 10);
    expect(page.unread_count).toBe(expected);
    const [unreadSql, unreadParams] = queryOne.mock.calls[0] as SqlCall;
    expect(unreadSql).toMatch(/WHERE recipient_user_id = \$1 AND read_at IS NULL/);
    expect(unreadParams).toEqual([USER]);
  });
});

describe('listNotifications safe payloads', () => {
  it.each([
    [
      'keeps only allow-listed identifiers and status fields',
      { org_id: 'o1', role: 'client_admin', status: 'open', support_ticket_id: 't1', broadcast_session_id: 'b1' },
      { org_id: 'o1', role: 'client_admin', status: 'open', support_ticket_id: 't1', broadcast_session_id: 'b1' },
    ],
    [
      'drops personal data such as names, emails and free text',
      { email: 'a@b.co', display_name: 'Asha', body: 'secret', title: 'Renewal', state: 'published' },
      { state: 'published' },
    ],
    [
      'returns an empty object when nothing in the payload is allow-listed',
      { title: 'Only a title', reason_code: undefined },
      {},
    ],
  ])('%s', async (_label, payload, expected) => {
    query.mockResolvedValueOnce([row('n-1', '2026-10-31T01:00:00Z', payload as Record<string, unknown>)]);
    queryOne.mockResolvedValueOnce({ count: '0' });
    const page = await listNotifications(USER, 10);
    expect(page.data[0].safe_payload).toEqual(expected);
  });

  it('tolerates a null safe_payload by returning an empty object', async () => {
    query.mockResolvedValueOnce([{ ...row('n-1', '2026-10-31T01:00:00Z'), safe_payload: null }]);
    queryOne.mockResolvedValueOnce({ count: '0' });
    const page = await listNotifications(USER, 10);
    expect(page.data[0].safe_payload).toEqual({});
  });
});

describe('markNotificationRead', () => {
  it('marks only the caller\'s own notification read and keeps the first read timestamp', async () => {
    queryOne.mockResolvedValueOnce({ id: 'n-1', read_at: '2026-10-31T01:00:00Z' });
    await expect(markNotificationRead(USER, 'n-1')).resolves.toEqual({ id: 'n-1', read_at: '2026-10-31T01:00:00Z' });
    const [sql, params] = queryOne.mock.calls[0] as SqlCall;
    expect(sql).toMatch(/SET read_at = COALESCE\(read_at, now\(\)\)/);
    expect(sql).toMatch(/WHERE id = \$1 AND recipient_user_id = \$2/);
    expect(params).toEqual(['n-1', USER]);
  });

  it('returns null, without revealing ownership, when the notification belongs to someone else', async () => {
    queryOne.mockResolvedValueOnce(null);
    await expect(markNotificationRead(USER, 'not-mine')).resolves.toBeNull();
  });
});
