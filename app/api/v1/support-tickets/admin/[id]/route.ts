import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { updateSupportTicketStatus } from '@/app/api/(services)/support/service';

const idSchema = z.string().uuid();
const statusSchema = z.object({ status: z.enum(['open', 'in_progress', 'resolved', 'closed']) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'portal:admin:read' });
  if (!permission.allowed) return Response.json({ error: 'Portal administrator access required' }, { status: 403 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Support ticket not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await updateSupportTicketStatus(
      id.data, session.user.id, parsed.data.status,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('transition')) return Response.json({ error: message }, { status: 409 });
    if (message.includes('not found')) return Response.json({ error: 'Support ticket not found' }, { status: 404 });
    if (message.includes('support access')) return Response.json({ error: 'Active support access is required for this ticket organisation' }, { status: 403 });
    return Response.json({ error: 'Unable to update support ticket' }, { status: 500 });
  }
}
