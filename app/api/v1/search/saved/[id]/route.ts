import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { deleteSavedSearch } from '@/app/api/(services)/learning/personalization';

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  const permission = await authorize({ action: 'search:personalize' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const parsedId = z.string().uuid().safeParse((await params).id);
  if (!parsedId.success) return Response.json({ error: 'Saved search not found' }, { status: 404 });
  const deleted = await deleteSavedSearch(parsedId.data, session.user.id, session.activeWorkspace.orgId);
  return deleted ? new Response(null, { status: 204 }) : Response.json({ error: 'Saved search not found' }, { status: 404 });
}
