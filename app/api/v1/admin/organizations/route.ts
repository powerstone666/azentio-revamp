import 'server-only';

import { randomBytes, randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { deliverEmailOutboxItem } from '@/app/api/(services)/email/outbox';
import { createAdminOrganization, listAdminOrganizations } from '@/app/api/(services)/admin/service';

const createSchema = z.discriminatedUnion('type', [
  z.object({ name: z.string().trim().min(2).max(160), type: z.literal('azentio') }),
  z.object({ name: z.string().trim().min(2).max(160), type: z.literal('client'), initial_admin_email: z.string().trim().email().max(254) }),
]);

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'organizations:list' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  return Response.json({ data: await listAdminOrganizations() }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'organizations:manage' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  const invitationToken = parsed.data.type === 'client' ? randomBytes(32).toString('base64url') : undefined;
  const invitationId = parsed.data.type === 'client' ? randomUUID() : undefined;
  try {
    const data = await createAdminOrganization({
      actorId: session.user.id,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      name: parsed.data.name,
      type: parsed.data.type,
      initialAdminEmail: parsed.data.type === 'client' ? parsed.data.initial_admin_email : undefined,
      invitationId,
      invitationToken,
      origin: new URL(request.url).origin,
    });
    const emailStatus = data.email_outbox_id ? await deliverEmailOutboxItem(data.email_outbox_id, new URL(request.url).origin) : null;
    return Response.json({ data: { id: data.id, name: data.name, type: data.type, status: data.status }, email_status: emailStatus === 'sent' ? 'sent' : data.email_outbox_id ? 'queued' : null }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('platform administrator')) return Response.json({ error: 'Platform administrator grant is no longer active' }, { status: 403 });
    if (message.includes('organizations_name_ci') || message.includes('duplicate key')) return Response.json({ error: 'An organisation with that name already exists' }, { status: 409 });
    console.error('Organization creation failed:', error);
    return Response.json({ error: 'Unable to create the organisation' }, { status: 500 });
  }
}
