import 'server-only';

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { validReviewDate } from '@/app/(common-lib)/review-date';
import { createEmployeeKnowledge, listEmployeeKnowledge } from '@/app/api/(services)/employee/service';

const createSchema = z.object({
  title: z.string().trim().min(3).max(160),
  body: z.string().trim().min(10).max(10000),
  review_at: z.string().refine(validReviewDate, 'Review date must be today or later, within two years'),
  status: z.enum(['draft', 'published']).default('draft'),
});

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

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) {
    return Response.json({ error: 'Employee access required' }, { status: 403 });
  }
  const permission = await authorize({ action: 'portal:employee:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await createEmployeeKnowledge({
      userId: session.user.id,
      orgId: session.activeWorkspace.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      title: parsed.data.title,
      body: parsed.data.body,
      reviewAt: parsed.data.review_at,
      status: parsed.data.status,
    });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('membership')) return Response.json({ error: 'Employee access is no longer active' }, { status: 403 });
    console.error('Employee knowledge create failed:', error);
    return Response.json({ error: 'Unable to save the guide' }, { status: 500 });
  }
}
