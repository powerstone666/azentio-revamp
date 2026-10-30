import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { revokeAdminRoleGrant } from '@/app/api/(services)/admin/service';

const idSchema = z.string().uuid();

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'organizations:manage' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: 'Grant not found' }, { status: 404 });
  try {
    const data = await revokeAdminRoleGrant({ actorId: session.user.id, requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(), grantId: id.data });
    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('last platform administrator')) return Response.json({ error: message }, { status: 409 });
    if (message.includes('not found')) return Response.json({ error: 'Grant not found' }, { status: 404 });
    console.error('Role grant revoke failed:', error);
    return Response.json({ error: 'Unable to revoke role grant' }, { status: 500 });
  }
}
