import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getCommunityCommentScope, setCommunityCommentVisibility } from '@/app/api/(services)/learning/comments';

const idSchema = z.string().uuid();
const bodySchema = z.object({ status: z.enum(['visible', 'hidden']) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Comment not found' }, { status: 404 });
  const scope = await getCommunityCommentScope(id.data);
  if (!scope) return Response.json({ error: 'Comment not found' }, { status: 404 });
  const permission = await authorize({ action: 'contribution:moderate', resource: { type: 'contribution', id: scope.contribution_id, orgId: scope.org_id } });
  if (!permission.allowed) return Response.json({ error: 'Comment not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await setCommunityCommentVisibility(
      id.data, session.user.id, scope.org_id, parsed.data.status,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return Response.json({ error: message || 'Unable to update comment' }, { status: message.includes('Comment not found') ? 404 : 403 });
  }
}
