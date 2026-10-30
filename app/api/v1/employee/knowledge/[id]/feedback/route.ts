import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { saveEmployeeKnowledgeFeedback } from '@/app/api/(services)/employee/service';

const schema = z.object({ helpful: z.boolean(), note: z.string().trim().max(1000).default('') });
const idSchema = z.string().uuid();

export async function PUT(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session?.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) {
    return Response.json({ error: 'Employee access required' }, { status: 403 });
  }
  const permission = await authorize({ action: 'portal:employee:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: 'Knowledge item not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await saveEmployeeKnowledgeFeedback({
      userId: session.user.id, orgId: session.activeWorkspace.orgId,
      itemId: id.data, helpful: parsed.data.helpful, note: parsed.data.note,
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && (error.message.includes('membership') || error.message.includes('not found'))) {
      return Response.json({ error: 'Knowledge item not found' }, { status: 404 });
    }
    console.error('Employee knowledge feedback failed:', error);
    return Response.json({ error: 'Unable to save feedback' }, { status: 500 });
  }
}
