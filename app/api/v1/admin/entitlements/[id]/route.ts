import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { revokeAdminEntitlement } from '@/app/api/(services)/admin/service';

const idSchema = z.string().uuid();

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'organizations:manage' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: 'Entitlement not found' }, { status: 404 });
  try {
    const data = await revokeAdminEntitlement({ actorId: session.user.id, requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(), entitlementId: id.data });
    return Response.json({ data });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) return Response.json({ error: 'Entitlement not found' }, { status: 404 });
    console.error('Entitlement revoke failed:', error);
    return Response.json({ error: 'Unable to revoke entitlement' }, { status: 500 });
  }
}
