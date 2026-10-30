import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { runEmployeePlayground } from '@/app/api/(services)/employee/service';

const schema = z.object({ offering_id: z.enum(['fai', 'lending', 'amlock']) });

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) return Response.json({ error: 'Employee access required' }, { status: 403 });
  const permission = await authorize({ action: 'portal:employee:read' });
  if (!permission.allowed) return Response.json({ error: 'Employee access required' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Unknown employee scenario' }, { status: 422 });
  try {
    const data = await runEmployeePlayground({
      userId: session.user.id, orgId: session.activeWorkspace.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      offeringId: parsed.data.offering_id,
    });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('membership')) return Response.json({ error: 'Employee access is no longer active' }, { status: 403 });
    console.error('Employee Playground run failed:', error);
    return Response.json({ error: 'Playground run could not be saved' }, { status: 500 });
  }
}
