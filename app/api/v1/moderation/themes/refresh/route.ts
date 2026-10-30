import 'server-only';

import { randomUUID } from 'node:crypto';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { refreshGeneratedThemes } from '@/app/api/(services)/learning/shared-learning';

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (session.activeWorkspace?.orgType !== 'azentio') return Response.json({ error: 'Employee workspace required' }, { status: 403 });
  const permission = await authorize({ action: 'portal:moderator:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  try {
    const data = await refreshGeneratedThemes(
      session.user.id,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Theme refresh failed:', error);
    return Response.json({ error: 'Unable to refresh approved themes' }, { status: 500 });
  }
}
