import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { reportCreateSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { reportCommunityComment } from '@/app/api/(services)/learning/comments';

const idSchema = z.string().uuid();

export async function POST(request: Request, { params }: { params: Promise<{ commentId: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const workspace = session.activeWorkspace;
  if (!workspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  const { commentId } = await params;
  const id = idSchema.safeParse(commentId);
  if (!id.success) return Response.json({ error: 'Comment not found' }, { status: 404 });
  const permission = await authorize({ action: 'community-comment:report' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = reportCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const report = await reportCommunityComment(
      id.data, session.user.id, workspace.orgId, parsed.data,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data: { id: report.id, status: report.status } }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) return Response.json({ error: 'Comment not found' }, { status: 404 });
    if (message.includes('membership')) return Response.json({ error: 'Active workspace membership required' }, { status: 403 });
    if (message.includes('duplicate key') || message.includes('unique constraint')) return Response.json({ error: 'An open report already exists for this comment' }, { status: 409 });
    return Response.json({ error: 'Unable to submit comment report' }, { status: 500 });
  }
}
