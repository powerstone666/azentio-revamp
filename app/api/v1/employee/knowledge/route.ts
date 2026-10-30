import 'server-only';

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listEmployeeKnowledge } from '@/app/api/(services)/employee/service';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) {
    return Response.json({ error: 'Employee access required' }, { status: 403 });
  }
  const permission = await authorize({ action: 'portal:employee:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const data = await listEmployeeKnowledge(session.user.id, session.activeWorkspace.orgId);
  return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
}
