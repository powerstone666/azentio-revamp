import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getCommunityCommentReportScope, updateCommunityCommentReport } from '@/app/api/(services)/learning/comments';

const idSchema = z.string().uuid();
const statusSchema = z.object({ status: z.enum(['investigating', 'resolved']) });

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Report not found' }, { status: 404 });
  const report = await getCommunityCommentReportScope(id.data);
  if (!report) return Response.json({ error: 'Report not found' }, { status: 404 });
  const permission = await authorize({ action: 'contribution:moderate', resource: { type: 'contribution', id: report.contribution_id, orgId: report.org_id } });
  if (!permission.allowed) return Response.json({ error: 'Report not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await updateCommunityCommentReport(
      id.data, session.user.id, report.org_id, parsed.data.status,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    return Response.json({ error: message || 'Unable to update report' }, { status: message.includes('transition') ? 409 : 404 });
  }
}
