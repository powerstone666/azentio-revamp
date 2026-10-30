import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createAdminEntitlement } from '@/app/api/(services)/admin/service';

const idSchema = z.string().uuid();
const schema = z.object({ offering_id: z.enum(['FAI', 'Lending', 'AMLOCK', 'Insurance']), feature: z.literal('sandbox').default('sandbox') });

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'organizations:manage' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const orgId = idSchema.safeParse((await params).id);
  if (!orgId.success) return Response.json({ error: 'Organisation not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await createAdminEntitlement({ actorId: session.user.id, requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(), orgId: orgId.data, offeringId: parsed.data.offering_id, feature: parsed.data.feature });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('already exists')) return Response.json({ error: message }, { status: 409 });
    if (message.includes('not found')) return Response.json({ error: message }, { status: 404 });
    console.error('Entitlement creation failed:', error);
    return Response.json({ error: 'Unable to grant entitlement' }, { status: 500 });
  }
}
