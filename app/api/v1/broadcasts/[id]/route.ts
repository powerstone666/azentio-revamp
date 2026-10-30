import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { updateBroadcast } from '@/app/api/(services)/broadcasts/service';

const idSchema = z.string().uuid();
const httpsUrl = z.string().url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Use a secure HTTPS link without URL credentials');
const schema = z.object({
  status: z.enum(['scheduled', 'live', 'recorded', 'cancelled']),
  join_url: httpsUrl.nullable().optional(),
  recording_url: httpsUrl.nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) return Response.json({ error: 'Session not found' }, { status: 404 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: 'Session not found' }, { status: 404 });
  const permission = await authorize({ action: 'broadcast:manage' });
  if (!permission.allowed) return Response.json({ error: 'Session not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await updateBroadcast({
      userId: session.user.id, orgId: session.activeWorkspace.orgId, id: id.data,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      status: parsed.data.status, joinUrl: parsed.data.join_url ?? null,
      recordingUrl: parsed.data.recording_url ?? null,
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('grant') || message.includes('membership') || message.includes('not found')) return Response.json({ error: 'Session not found' }, { status: 404 });
    if (message.includes('transition') || message.includes('required')) return Response.json({ error: message }, { status: 409 });
    console.error('Broadcast update failed:', error);
    return Response.json({ error: 'Unable to update the session' }, { status: 500 });
  }
}
