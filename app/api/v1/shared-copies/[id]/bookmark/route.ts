import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { setBookmark } from '@/app/api/(services)/learning/personalization';

async function updateBookmark(sharedCopyId: string, bookmarked: boolean): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  const permission = await authorize({ action: 'search:personalize' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const parsed = z.string().uuid().safeParse(sharedCopyId);
  if (!parsed.success) return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
  try {
    const data = await setBookmark(parsed.data, session.user.id, session.activeWorkspace.orgId, bookmarked);
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
  }
}

export async function PUT(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return updateBookmark((await params).id, true);
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  return updateBookmark((await params).id, false);
}
