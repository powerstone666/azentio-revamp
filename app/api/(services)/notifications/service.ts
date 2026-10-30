import 'server-only';

import { query, queryOne } from '@/app/api/(db)/client';

export interface InboxNotification {
  id: string;
  event: string;
  safe_payload: Record<string, unknown>;
  read_at: string | null;
  created_at: string;
}

const SAFE_PAYLOAD_KEYS = new Set([
  'org_id', 'role', 'status', 'contribution_id', 'idea_id', 'support_ticket_id', 'broadcast_session_id', 'state', 'reason_code',
]);

function safePayload(payload: Record<string, unknown>) {
  return Object.fromEntries(Object.entries(payload).filter(([key]) => SAFE_PAYLOAD_KEYS.has(key)));
}

export async function listNotifications(userId: string, limit: number, before?: { createdAt: string; id: string }) {
  const rows = await query<InboxNotification>(
    `SELECT id, event, safe_payload, read_at, created_at
     FROM notifications
     WHERE recipient_user_id = $1
       AND ($2::timestamptz IS NULL OR (created_at, id) < ($2::timestamptz, $3::uuid))
     ORDER BY created_at DESC, id DESC
     LIMIT $4`,
    [userId, before?.createdAt ?? null, before?.id ?? null, limit + 1],
  );
  const hasMore = rows.length > limit;
  const data = rows.slice(0, limit).map((row) => ({ ...row, safe_payload: safePayload(row.safe_payload ?? {}) }));
  const last = data.at(-1);
  const unread = await queryOne<{ count: string }>(
    'SELECT count(*)::text AS count FROM notifications WHERE recipient_user_id = $1 AND read_at IS NULL',
    [userId],
  );
  return {
    data,
    unread_count: Number(unread?.count ?? 0),
    next_cursor: hasMore && last ? { created_at: last.created_at, id: last.id } : null,
  };
}

export async function markNotificationRead(userId: string, notificationId: string) {
  return queryOne<{ id: string; read_at: string }>(
    `UPDATE notifications SET read_at = COALESCE(read_at, now())
     WHERE id = $1 AND recipient_user_id = $2
     RETURNING id, read_at`,
    [notificationId, userId],
  );
}
