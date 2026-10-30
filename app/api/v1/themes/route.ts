import 'server-only';

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listVisibleThemes } from '@/app/api/(services)/learning/shared-learning';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'themes:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  return Response.json({ data: await listVisibleThemes() });
}
