import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createAdminRoleGrant, listAdminEligibleEmployees, listAdminRoleGrants } from '@/app/api/(services)/admin/service';

const schema = z.object({
  user_id: z.string().uuid(),
  org_id: z.string().uuid().nullable().default(null),
  role: z.enum(['learning_moderator', 'content_publisher', 'product_owner', 'portal_admin']),
  offering_id: z.enum(['FAI', 'Lending', 'Digital', 'AMLOCK', 'Factoring', 'Insurance', 'Orion']).nullable().default(null),
  expires_at: z.iso.datetime().nullable().default(null),
});

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'organizations:list' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const [grants, employees] = await Promise.all([listAdminRoleGrants(), listAdminEligibleEmployees()]);
  return Response.json({ data: { grants, employees } }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'organizations:manage' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await createAdminRoleGrant({
      actorId: session.user.id, requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      userId: parsed.data.user_id, orgId: parsed.data.org_id, role: parsed.data.role,
      offeringId: parsed.data.offering_id, expiresAt: parsed.data.expires_at,
    });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (/already exists/i.test(message)) return Response.json({ error: message }, { status: 409 });
    if (/platform administrator|verified active employee/i.test(message)) return Response.json({ error: message }, { status: 403 });
    if (/future|require|only|platform-wide|cannot|active azentio organization/i.test(message)) {
      return Response.json({ error: message }, { status: 422 });
    }
    console.error('Role grant creation failed:', error);
    return Response.json({ error: 'Unable to create role grant' }, { status: 500 });
  }
}
