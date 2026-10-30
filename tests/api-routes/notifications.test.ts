/**
 * @jest-environment node
 */
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/notifications/service', () => ({
  listNotifications: jest.fn(),
  markNotificationRead: jest.fn(),
}));

import { getSession } from '@/app/api/(services)/authz/session';
import { listNotifications, markNotificationRead } from '@/app/api/(services)/notifications/service';
import { GET } from '@/app/api/v1/notifications/route';
import { PATCH } from '@/app/api/v1/notifications/[id]/route';
import { IDS, makeRequest, makeSession, readJson, routeParams } from './fixtures';

const getSessionMock = jest.mocked(getSession);
const listMock = jest.mocked(listNotifications);
const markReadMock = jest.mocked(markNotificationRead);

const encodeCursor = (value: unknown) => Buffer.from(JSON.stringify(value)).toString('base64url');
const list = (query = '') => GET(makeRequest(`/api/v1/notifications${query}`));

beforeEach(() => {
  getSessionMock.mockResolvedValue(makeSession());
  listMock.mockResolvedValue({ data: [], unread_count: 0, next_cursor: null } as never);
});

describe('GET /api/v1/notifications', () => {
  it('rejects an unauthenticated request with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await list();
    expect(response.status).toBe(401);
    expect(listMock).not.toHaveBeenCalled();
  });

  it.each(['0', '51', 'abc', '1.5', '-3'])('rejects limit=%s with 400', async (limit) => {
    const response = await list(`?limit=${limit}`);
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: 'limit must be between 1 and 50' });
    expect(listMock).not.toHaveBeenCalled();
  });

  it.each(['1', '50'])('accepts the boundary limit=%s', async (limit) => {
    const response = await list(`?limit=${limit}`);
    expect(response.status).toBe(200);
    expect(listMock.mock.calls[0][1]).toBe(Number(limit));
  });

  it('defaults the page size to 20 when no limit is given', async () => {
    await list();
    expect(listMock.mock.calls[0][1]).toBe(20);
  });

  it.each([
    ['text that is not base64url JSON', 'not-json!!'],
    ['a cursor whose created_at is not a datetime', encodeCursor({ created_at: 'yesterday', id: IDS.record })],
    ['a cursor whose id is not a UUID', encodeCursor({ created_at: '2026-01-01T00:00:00.000Z', id: 'abc' })],
    ['a cursor with a missing id', encodeCursor({ created_at: '2026-01-01T00:00:00.000Z' })],
  ])('rejects a cursor that is %s with 400', async (_label, cursor) => {
    const response = await list(`?cursor=${cursor}`);
    expect(response.status).toBe(400);
    expect(await readJson(response)).toEqual({ error: 'Invalid cursor' });
    expect(listMock).not.toHaveBeenCalled();
  });

  it('decodes a valid cursor into the keyset position passed to the service', async () => {
    const createdAt = '2026-03-04T05:06:07.000Z';
    await list(`?cursor=${encodeCursor({ created_at: createdAt, id: IDS.record })}`);
    expect(listMock).toHaveBeenCalledWith(IDS.user, 20, { createdAt, id: IDS.record });
  });

  it('encodes the next cursor as base64url JSON and returns the envelope shape', async () => {
    const next = { created_at: '2026-03-04T05:06:07.000Z', id: IDS.record };
    listMock.mockResolvedValue({ data: [{ id: 'n1' }], unread_count: 3, next_cursor: next } as never);
    const response = await list();
    const body = await readJson(response);
    expect(response.status).toBe(200);
    expect(body).toEqual({ data: [{ id: 'n1' }], unread_count: 3, next_cursor: encodeCursor(next) });
    expect(JSON.parse(Buffer.from(body.next_cursor, 'base64url').toString('utf8'))).toEqual(next);
  });

  it('returns next_cursor null on the last page', async () => {
    const body = await readJson(await list());
    expect(body.next_cursor).toBeNull();
  });

  it('lists only the signed-in user\'s notifications and ignores a user id in the query', async () => {
    await list(`?user_id=${IDS.otherUser}`);
    expect(listMock.mock.calls[0][0]).toBe(IDS.user);
  });
});

describe('PATCH /api/v1/notifications/[id]', () => {
  const patch = (id: string) => PATCH(makeRequest(`/api/v1/notifications/${id}`, { method: 'PATCH' }), routeParams({ id }));

  it('rejects an unauthenticated request with 401', async () => {
    getSessionMock.mockResolvedValue(null);
    const response = await patch(IDS.record);
    expect(response.status).toBe(401);
    expect(markReadMock).not.toHaveBeenCalled();
  });

  it.each(['not-a-uuid', '123'])('returns 404 for the malformed id %s without touching the service', async (id) => {
    const response = await patch(id);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Notification not found' });
    expect(markReadMock).not.toHaveBeenCalled();
  });

  it('returns 404 when the notification is missing or owned by someone else', async () => {
    markReadMock.mockResolvedValue(null as never);
    const response = await patch(IDS.record);
    expect(response.status).toBe(404);
    expect(await readJson(response)).toEqual({ error: 'Notification not found' });
  });

  it('marks the notification read for the session user and returns it under data', async () => {
    markReadMock.mockResolvedValue({ id: IDS.record, read_at: '2026-01-02T00:00:00.000Z' } as never);
    const response = await patch(IDS.record);
    expect(response.status).toBe(200);
    expect(await readJson(response)).toEqual({ data: { id: IDS.record, read_at: '2026-01-02T00:00:00.000Z' } });
    expect(markReadMock).toHaveBeenCalledWith(IDS.user, IDS.record);
  });
});
