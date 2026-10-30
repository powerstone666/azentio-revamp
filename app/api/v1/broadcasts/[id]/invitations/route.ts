import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { updateBroadcastInvitations } from '@/app/api/(services)/broadcasts/service';

const idSchema = z.uuid();
const bodySchema = z.object({ invited_org_ids: z.array(z.uuid()).min(1).max(100) }).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session?.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) {
    return Response.json({ error: 'Webinar not found' }, { status: 404 });
  }
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: 'Webinar not found' }, { status: 404 });
  const permission = await authorize({ action: 'broadcast:manage' });
  if (!permission.allowed) return Response.json({ error: 'Webinar not found' }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Invite at least one valid client workspace', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await updateBroadcastInvitations({
      userId: session.user.id,
      publisherOrgId: session.activeWorkspace.orgId,
      broadcastId: id.data,
      invitedOrgIds: parsed.data.invited_org_ids,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found') || message.includes('grant') || message.includes('membership')) {
      return Response.json({ error: 'Webinar not found' }, { status: 404 });
    }
    if (message.includes('client workspaces')) return Response.json({ error: message }, { status: 422 });
    console.error('Broadcast invitation update failed:', error);
    return Response.json({ error: 'Unable to update webinar invitations' }, { status: 500 });
  }
}
