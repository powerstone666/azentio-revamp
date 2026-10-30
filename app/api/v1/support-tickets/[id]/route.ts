import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getClientSupportTicket } from '@/app/api/(services)/support/service';

const idSchema = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'portal:client:read' });
  const workspace = session.activeWorkspace;
  if (!permission.allowed || workspace?.orgType !== 'client') {
    return Response.json({ error: 'Client workspace access required' }, { status: 403 });
  }
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Support ticket not found' }, { status: 404 });
  try {
    const data = await getClientSupportTicket(id.data, session.user.id, workspace.orgId);
    if (!data) return Response.json({ error: 'Support ticket not found' }, { status: 404 });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Unable to load support ticket' }, { status: 403 });
  }
}
