import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { revokeInvitation } from '@/app/api/(services)/invitations/service';

const idSchema = z.string().uuid();

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || session.activeWorkspace.orgType !== 'client') {
    return Response.json({ error: 'Select a client workspace first' }, { status: 409 });
  }
  const permission = await authorize({ action: 'members:revoke' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Invitation not found' }, { status: 404 });
  try {
    const result = await revokeInvitation(
      id.data,
      session.user.id,
      session.activeWorkspace.orgId,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data: result });
  } catch {
    return Response.json({ error: 'Invitation not found' }, { status: 404 });
  }
}
