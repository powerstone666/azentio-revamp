import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createBroadcast, listClientBroadcasts, listClientOrganizationsForPublisher, listEmployeeBroadcasts, listManagedBroadcasts } from '@/app/api/(services)/broadcasts/service';

const httpsUrl = z.string().url().max(2048).refine((value) => {
  try {
    const url = new URL(value);
    return url.protocol === 'https:' && !url.username && !url.password;
  } catch {
    return false;
  }
}, 'Use a secure HTTPS link without URL credentials');
const createSchema = z.object({
  title: z.string().trim().min(3).max(180),
  description: z.string().trim().max(3000).default(''),
  starts_at: z.iso.datetime(),
  ends_at: z.iso.datetime().nullable().optional(),
  join_url: httpsUrl.nullable().optional(),
  recording_url: httpsUrl.nullable().optional(),
  audience: z.enum(['employees', 'clients']).default('employees'),
  invited_org_ids: z.array(z.uuid()).max(100).default([]),
}).refine((value) => !value.ends_at || Date.parse(value.ends_at) > Date.parse(value.starts_at), {
  path: ['ends_at'], message: 'End time must be after the start time',
}).strict();

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session?.activeWorkspace) return Response.json({ error: 'Authentication and an active workspace are required' }, { status: 401 });
  const isClient = session.activeWorkspace.orgType === 'client'
    && !session.grants.some((grant) => grant.role === 'content_publisher' && grant.org_id === session.activeWorkspace?.orgId && !grant.revoked_at);
  const permission = isClient
    ? await authorize({ action: 'portal:client:read' })
    : await authorize({ action: 'portal:employee:read' });
  const manage = !isClient ? await authorize({ action: 'broadcast:manage' }) : { allowed: false };
  if (!permission.allowed && !manage.allowed) return Response.json({ error: 'Broadcast access required' }, { status: 403 });
  const data = isClient
    ? await listClientBroadcasts(session.activeWorkspace.orgId)
    : await listEmployeeBroadcasts(session.activeWorkspace.orgId);
  if (isClient) return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  const management = manage.allowed ? {
    sessions: await listManagedBroadcasts(session.activeWorkspace!.orgId),
    clientOrganizations: session.activeWorkspace!.isSandbox ? [] : await listClientOrganizationsForPublisher(session.user.id, session.activeWorkspace!.orgId),
  } : null;
  return Response.json({ data, management }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) {
    return Response.json({ error: 'Employee access required' }, { status: 403 });
  }
  const permission = await authorize({ action: 'broadcast:manage' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    if (parsed.data.audience === 'clients' && parsed.data.invited_org_ids.length === 0 && !session.activeWorkspace?.isSandbox) {
      return Response.json({ error: 'Invite at least one client workspace to schedule a client webinar' }, { status: 422 });
    }
    const data = await createBroadcast({
      userId: session.user.id, orgId: session.activeWorkspace!.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      title: parsed.data.title, description: parsed.data.description,
      startsAt: parsed.data.starts_at, endsAt: parsed.data.ends_at ?? null,
      joinUrl: parsed.data.join_url ?? null, recordingUrl: parsed.data.recording_url ?? null,
      audience: parsed.data.audience, invitedOrgIds: parsed.data.invited_org_ids,
    });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('grant') || error.message.includes('membership'))) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    if (error instanceof Error && error.message.includes('client workspace')) {
      return Response.json({ error: error.message }, { status: 422 });
    }
    if (error instanceof Error && error.message.includes('external workspaces')) {
      return Response.json({ error: error.message }, { status: 403 });
    }
    console.error('Broadcast creation failed:', error);
    return Response.json({ error: 'Unable to create the session' }, { status: 500 });
  }
}

export async function OPTIONS(): Promise<Response> {
  return new Response(null, { status: 204, headers: { Allow: 'GET, POST, OPTIONS' } });
}
