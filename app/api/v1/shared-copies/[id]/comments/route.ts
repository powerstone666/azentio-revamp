import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { communityCommentCreateSchema } from '@/app/(common-lib)/types/schemas';
import { createCommunityComment, listCommunityComments } from '@/app/api/(services)/learning/comments';

const idSchema = z.string().uuid();

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const workspace = session.activeWorkspace;
  if (!workspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
  const permission = await authorize({ action: 'community-comment:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  try {
    return Response.json({ data: await listCommunityComments(id.data, session.user.id, workspace.orgId) });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
    return Response.json({ error: 'Unable to load comments' }, { status: 500 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const workspace = session.activeWorkspace;
  if (!workspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
  const permission = await authorize({ action: 'community-comment:create' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = communityCommentCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const comment = await createCommunityComment(
      id.data, session.user.id, workspace.orgId, parsed.data,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data: comment }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
    if (error instanceof Error && error.message.includes('membership')) return Response.json({ error: 'Active workspace membership required' }, { status: 403 });
    return Response.json({ error: 'Unable to add comment' }, { status: 500 });
  }
}
