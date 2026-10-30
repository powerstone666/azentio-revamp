import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { listNotifications } from '@/app/api/(services)/notifications/service';

const cursorSchema = z.object({ created_at: z.string().datetime(), id: z.string().uuid() });
const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const url = new URL(request.url);
  const limitValue = Number(url.searchParams.get('limit') ?? '20');
  if (!Number.isInteger(limitValue) || limitValue < 1 || limitValue > 50) {
    return Response.json({ error: 'limit must be between 1 and 50' }, { status: 400 });
  }

  let before: { createdAt: string; id: string } | undefined;
  const encoded = url.searchParams.get('cursor');
  if (encoded) {
    try {
      const decoded = Buffer.from(encoded, 'base64url').toString('utf8');
      const parsed = cursorSchema.safeParse(JSON.parse(decoded));
      if (!parsed.success || !uuidPattern.test(parsed.data.id)) throw new Error('invalid cursor');
      before = { createdAt: parsed.data.created_at, id: parsed.data.id };
    } catch {
      return Response.json({ error: 'Invalid cursor' }, { status: 400 });
    }
  }

  const result = await listNotifications(session.user.id, limitValue, before);
  const nextCursor = result.next_cursor
    ? Buffer.from(JSON.stringify(result.next_cursor)).toString('base64url')
    : null;
  return Response.json({ data: result.data, unread_count: result.unread_count, next_cursor: nextCursor });
}
