import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { updateEmployeeKnowledge } from '@/app/api/(services)/employee/service';
import { validReviewDate } from '@/app/(common-lib)/review-date';

const idSchema = z.string().uuid();
const patchSchema = z.object({
  title: z.string().trim().min(3).max(160).optional(),
  body: z.string().trim().min(10).max(10000).optional(),
  review_at: z.string().refine(validReviewDate, 'Review date must be today or later, within two years').optional(),
  status: z.enum(['draft', 'published', 'archived']).optional(),
}).refine((value) => Object.keys(value).length > 0, 'Nothing to update');

/** Owner-only edits: publish, archive, or mark a guide as reviewed by pushing its review date forward. */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) {
    return Response.json({ error: 'Employee access required' }, { status: 403 });
  }
  const permission = await authorize({ action: 'portal:employee:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: 'Knowledge item not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = patchSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await updateEmployeeKnowledge({
      userId: session.user.id,
      orgId: session.activeWorkspace.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      itemId: id.data,
      title: parsed.data.title,
      body: parsed.data.body,
      reviewAt: parsed.data.review_at,
      status: parsed.data.status,
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('membership') || error.message.includes('not found'))) {
      return Response.json({ error: 'Knowledge item not found' }, { status: 404 });
    }
    console.error('Employee knowledge update failed:', error);
    return Response.json({ error: 'Unable to update the guide' }, { status: 500 });
  }
}
