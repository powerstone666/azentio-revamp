import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getClientBroadcastTarget, getEmployeeBroadcastTarget } from '@/app/api/(services)/broadcasts/service';

const idSchema = z.string().uuid();

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session?.activeWorkspace || (!['azentio', 'client'].includes(session.activeWorkspace.orgType) && !session.activeWorkspace.isSandbox)) return new Response(null, { status: 404 });
  const isEmployee = session.activeWorkspace.orgType === 'azentio'
    || (session.activeWorkspace.isSandbox && session.grants.some((grant) =>
      grant.role === 'employee'
      && grant.org_id === session.activeWorkspace?.orgId && !grant.revoked_at));
  const publisherOnly = session.activeWorkspace.isSandbox && !isEmployee && session.grants.some((grant) =>
    grant.role === 'content_publisher' && grant.org_id === session.activeWorkspace?.orgId && !grant.revoked_at);
  const permission = await authorize({ action: isEmployee ? 'portal:employee:read' : publisherOnly ? 'broadcast:manage' : 'portal:client:read' });
  if (!permission.allowed) return new Response(null, { status: 404 });
  const id = idSchema.safeParse((await params).id);
  const kind = new URL(request.url).searchParams.get('kind');
  if (!id.success || (kind !== 'join' && kind !== 'recording')) return new Response(null, { status: 404 });
  const target = isEmployee
    ? await getEmployeeBroadcastTarget(session.activeWorkspace.orgId, id.data, kind)
    : await getClientBroadcastTarget(session.activeWorkspace.orgId, id.data, kind)
      ?? (publisherOnly ? await getEmployeeBroadcastTarget(session.activeWorkspace.orgId, id.data, kind) : null);
  if (!target) return new Response(null, { status: 404 });
  const url = new URL(target);
  if (url.protocol !== 'https:') return new Response(null, { status: 404 });
  return new Response(null, {
    status: 302,
    headers: {
      Location: url.toString(),
      'Cache-Control': 'private, no-store',
      'Referrer-Policy': 'no-referrer',
    },
  });
}
