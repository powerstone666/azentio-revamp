import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { markNotificationRead } from '@/app/api/(services)/notifications/service';

const idSchema = z.string().uuid();

export async function PATCH(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Notification not found' }, { status: 404 });
  const notification = await markNotificationRead(session.user.id, id.data);
  if (!notification) return Response.json({ error: 'Notification not found' }, { status: 404 });
  return Response.json({ data: notification });
}
