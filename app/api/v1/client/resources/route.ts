import 'server-only';

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listClientResources } from '@/app/api/(services)/resources/service';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (session.activeWorkspace?.orgType !== 'client' && !session.activeWorkspace?.isSandbox) return Response.json({ error: 'Client workspace required' }, { status: 403 });
  const permission = await authorize({ action: 'portal:client:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const data = await listClientResources(session.activeWorkspace.orgId);
  return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
