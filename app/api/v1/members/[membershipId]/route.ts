import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { revokeWorkspaceMember } from '@/app/api/(services)/invitations/service';

const idSchema = z.string().uuid();

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ membershipId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || session.activeWorkspace.orgType !== 'client' || session.activeWorkspace.isSandbox) {
    return Response.json({ error: 'Select a client workspace first' }, { status: 409 });
  }
  const permission = await authorize({ action: 'members:revoke' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const { membershipId: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Member not found' }, { status: 404 });
  try {
    const result = await revokeWorkspaceMember(
      id.data,
      session.user.id,
      session.activeWorkspace.orgId,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('last client administrator') || message.includes('own active')) {
      return Response.json({ error: message }, { status: 409 });
    }
    return Response.json({ error: 'Member not found' }, { status: 404 });
  }
}
