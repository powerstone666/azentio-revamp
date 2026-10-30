import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { revokeOrganizationSupportAccess } from '@/app/api/(services)/support/access';

const idSchema = z.string().uuid();

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'portal:admin:read' });
  if (!permission.allowed) return Response.json({ error: 'Global portal administrator access required' }, { status: 403 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Support access not found' }, { status: 404 });
  try {
    const data = await revokeOrganizationSupportAccess({
      actorId: session.user.id,
      accessId: id.data,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) return Response.json({ error: 'Support access not found' }, { status: 404 });
    if (message.includes('administrator')) return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: 'Unable to revoke support access' }, { status: 500 });
  }
}
