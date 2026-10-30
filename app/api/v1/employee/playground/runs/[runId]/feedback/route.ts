import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { saveEmployeePlaygroundFeedback } from '@/app/api/(services)/employee/service';

const idSchema = z.string().uuid();
const schema = z.object({
  rating: z.enum(['Useful', 'Needs more evidence', 'Not clear']),
  comment: z.string().trim().max(2000).default(''),
});

export async function PUT(request: Request, { params }: { params: Promise<{ runId: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session?.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) return Response.json({ error: 'Employee access required' }, { status: 403 });
  const permission = await authorize({ action: 'portal:employee:read' });
  if (!permission.allowed) return Response.json({ error: 'Employee access required' }, { status: 403 });
  const runId = idSchema.safeParse((await params).runId);
  if (!runId.success) return Response.json({ error: 'Playground run not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await saveEmployeePlaygroundFeedback({
      userId: session.user.id, orgId: session.activeWorkspace.orgId,
      runId: runId.data, rating: parsed.data.rating, comment: parsed.data.comment,
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) return Response.json({ error: 'Playground run not found' }, { status: 404 });
    if (error instanceof Error && error.message.includes('membership')) return Response.json({ error: 'Employee access is no longer active' }, { status: 403 });
    console.error('Employee Playground feedback failed:', error);
    return Response.json({ error: 'Feedback could not be saved' }, { status: 500 });
  }
}
