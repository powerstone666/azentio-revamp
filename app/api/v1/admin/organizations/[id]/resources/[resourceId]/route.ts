import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { archiveClientResource } from '@/app/api/(services)/resources/service';

const idSchema = z.string().uuid();

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string; resourceId: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'organizations:manage' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const { id: rawOrgId, resourceId: rawResourceId } = await params;
  const orgId = idSchema.safeParse(rawOrgId);
  const resourceId = idSchema.safeParse(rawResourceId);
  if (!orgId.success || !resourceId.success) return Response.json({ error: 'Client resource not found' }, { status: 404 });
  try {
    await archiveClientResource({
      actorId: session.user.id,
      orgId: orgId.data,
      resourceId: resourceId.data,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    });
    return new Response(null, { status: 204, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('administrator')) return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: 'Client resource not found' }, { status: 404 });
  }
}
