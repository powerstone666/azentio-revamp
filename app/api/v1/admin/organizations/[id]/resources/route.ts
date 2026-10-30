import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createClientResource, listAdminClientResources } from '@/app/api/(services)/resources/service';

const idSchema = z.string().uuid();
const httpsUrl = z.string().url().max(2048).refine((value) => new URL(value).protocol === 'https:', 'Use an HTTPS resource link');
const schema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(3000).default(''),
  category: z.string().trim().min(1).max(80),
  resource_url: httpsUrl,
  offering_id: z.string().trim().min(1).max(100).nullable().optional(),
});

async function adminSession() {
  const session = await getSession();
  if (!session) return { session: null, denied: Response.json({ error: 'Authentication required' }, { status: 401 }) };
  const permission = await authorize({ action: 'organizations:manage' });
  if (!permission.allowed) return { session: null, denied: Response.json({ error: permission.reason }, { status: 403 }) };
  return { session, denied: null };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { session, denied } = await adminSession();
  if (denied || !session) return denied!;
  const orgId = idSchema.safeParse((await params).id);
  if (!orgId.success) return Response.json({ error: 'Organisation not found' }, { status: 404 });
  return Response.json({ data: await listAdminClientResources(orgId.data) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const { session, denied } = await adminSession();
  if (denied || !session) return denied!;
  const orgId = idSchema.safeParse((await params).id);
  if (!orgId.success) return Response.json({ error: 'Organisation not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await createClientResource({
      actorId: session.user.id, orgId: orgId.data, title: parsed.data.title,
      description: parsed.data.description, category: parsed.data.category,
      resourceUrl: parsed.data.resource_url, offeringId: parsed.data.offering_id ?? null,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('administrator')) return Response.json({ error: 'Platform administrator grant is no longer active' }, { status: 403 });
    if (message.includes('entitlement')) return Response.json({ error: message }, { status: 409 });
    if (message.includes('organization')) return Response.json({ error: message }, { status: 404 });
    console.error('Client resource creation failed:', error);
    return Response.json({ error: 'Unable to create the client resource' }, { status: 500 });
  }
}
