import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { grantOrganizationSupportAccess, listSupportAccessGrants } from '@/app/api/(services)/support/access';

const grantSchema = z.object({
  portal_admin_id: z.string().uuid(),
  org_id: z.string().uuid(),
  reason: z.string().trim().min(10).max(1000),
  duration_hours: z.number().int().min(1).max(72),
}).strict();

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'portal:admin:read' });
  if (!permission.allowed) return Response.json({ error: 'Global portal administrator access required' }, { status: 403 });
  const data = await listSupportAccessGrants();
  return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'portal:admin:read' });
  if (!permission.allowed) return Response.json({ error: 'Global portal administrator access required' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = grantSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await grantOrganizationSupportAccess({
      actorId: session.user.id,
      portalAdminId: parsed.data.portal_admin_id,
      orgId: parsed.data.org_id,
      reason: parsed.data.reason,
      durationHours: parsed.data.duration_hours,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('already exists')) return Response.json({ error: message }, { status: 409 });
    if (message.includes('organisation')) return Response.json({ error: message }, { status: 404 });
    if (message.includes('administrator')) return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: 'Unable to grant support access' }, { status: 500 });
  }
}
