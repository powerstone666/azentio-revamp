import 'server-only';

import { randomBytes, randomUUID } from 'node:crypto';
import { inviteCreateSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createInvitation, listPendingInvitations, listWorkspaceMembers } from '@/app/api/(services)/invitations/service';
import { deliverEmailOutboxItem } from '@/app/api/(services)/email/outbox';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || session.activeWorkspace.orgType !== 'client') {
    return Response.json({ error: 'Select a client workspace first' }, { status: 409 });
  }
  const permission = await authorize({ action: 'members:list' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const [members, invitations] = await Promise.all([
    listWorkspaceMembers(session.activeWorkspace.orgId),
    listPendingInvitations(session.activeWorkspace.orgId),
  ]);
  return Response.json({ data: { members, invitations } });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || session.activeWorkspace.orgType !== 'client') {
    return Response.json({ error: 'Select a client workspace first' }, { status: 409 });
  }
  const permission = await authorize({ action: 'members:invite' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = inviteCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });

  const token = randomBytes(32).toString('base64url');
  const invitationId = randomUUID();
  try {
    const invitation = await createInvitation({
      id: invitationId,
      token,
      email: parsed.data.email,
      role: parsed.data.role,
      orgId: session.activeWorkspace.orgId,
      inviterId: session.user.id,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      origin: new URL(request.url).origin,
    });
    const delivery = await deliverEmailOutboxItem(invitation.email_outbox_id, new URL(request.url).origin);
    return Response.json({
      data: { id: invitation.id, email: parsed.data.email, role: parsed.data.role, expires_at: invitation.expires_at },
      email_status: delivery === 'sent' ? 'sent' : 'queued',
    }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('already a member') || message.includes('active invitation')) {
      return Response.json({ error: message }, { status: 409 });
    }
    if (message.includes('membership')) return Response.json({ error: 'Workspace membership is no longer active' }, { status: 403 });
    console.error('Invitation creation failed:', error);
    return Response.json({ error: 'Unable to create invitation' }, { status: 500 });
  }
}
