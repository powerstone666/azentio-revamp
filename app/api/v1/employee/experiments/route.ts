import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createEmployeeExperiment, listEmployeeExperiments } from '@/app/api/(services)/employee/service';

const schema = z.object({
  title: z.string().trim().min(3).max(160),
  problem_statement: z.string().trim().min(10).max(2000),
  offering: z.string().trim().min(1).max(100),
  proposed_approach: z.string().trim().max(3000).default(''),
});

async function employeeSession() {
  const session = await getSession();
  if (!session) return { response: Response.json({ error: 'Authentication required' }, { status: 401 }) };
  if (!session.activeWorkspace) return { response: Response.json({ error: 'Active employee workspace required' }, { status: 403 }) };
  const result = await authorize({ action: 'portal:employee:read' });
  if (!result.allowed || (session.activeWorkspace.orgType !== 'azentio' && !session.activeWorkspace.isSandbox)) {
    return { response: Response.json({ error: 'Employee access required' }, { status: 403 }) };
  }
  return { session };
}

export async function GET(): Promise<Response> {
  const auth = await employeeSession();
  if (auth.response) return auth.response;
  return Response.json({ data: await listEmployeeExperiments(auth.session.activeWorkspace!.orgId) }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request): Promise<Response> {
  const auth = await employeeSession();
  if (auth.response) return auth.response;
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = schema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  const { session } = auth;
  try {
    const data = await createEmployeeExperiment({
      userId: session.user.id,
      orgId: session.activeWorkspace!.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      title: parsed.data.title,
      problemStatement: parsed.data.problem_statement,
      offering: parsed.data.offering,
      proposedApproach: parsed.data.proposed_approach,
    });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('membership')) return Response.json({ error: 'Employee access is no longer active' }, { status: 403 });
    console.error('Employee experiment submission failed:', error);
    return Response.json({ error: 'Unable to save the experiment' }, { status: 500 });
  }
}
