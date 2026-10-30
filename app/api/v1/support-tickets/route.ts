import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createClientSupportTicket, listClientSupportTickets } from '@/app/api/(services)/support/service';
import { deliverSupportTicketOutboxForTicket } from '@/app/api/(services)/support/outbox';

const createSchema = z.object({
  subject: z.string().trim().min(5).max(200),
  details: z.string().trim().min(10).max(5000),
  category: z.enum(['product_question', 'access', 'technical_issue', 'other']),
}).strict();

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'portal:client:read' });
  if (!permission.allowed || session.activeWorkspace?.orgType !== 'client') {
    return Response.json({ error: 'Client workspace access required' }, { status: 403 });
  }
  try {
    const data = await listClientSupportTickets(session.user.id, session.activeWorkspace.orgId);
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Unable to load support tickets' }, { status: 403 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'portal:client:read' });
  if (!permission.allowed || session.activeWorkspace?.orgType !== 'client') {
    return Response.json({ error: 'Client workspace access required' }, { status: 403 });
  }
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await createClientSupportTicket({
      userId: session.user.id,
      orgId: session.activeWorkspace.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      ...parsed.data,
    });
    await deliverSupportTicketOutboxForTicket(data.id).catch(() => undefined);
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Unable to create support ticket' }, { status: 403 });
  }
}
