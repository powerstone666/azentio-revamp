import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { updateAdminOrganization } from '@/app/api/(services)/admin/service';

const idSchema = z.string().uuid();
const schema = z.object({ status: z.enum(['active', 'suspended', 'disabled']) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'organizations:manage' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: 'Organization not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await updateAdminOrganization({ actorId: session.user.id, requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(), orgId: id.data, status: parsed.data.status });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) return Response.json({ error: 'Organization not found' }, { status: 404 });
    console.error('Organization status change failed:', error);
    return Response.json({ error: 'Unable to update organisation' }, { status: 500 });
  }
}
