import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSandboxDemo } from '@/app/(config)/sandbox';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { runSandboxDemo } from '@/app/api/(services)/sandbox/service';

const bodySchema = z.object({ scenario_key: z.string().min(1).max(100) });

export async function POST(
  request: Request,
  { params }: { params: Promise<{ offeringId: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace || (session.activeWorkspace.orgType !== 'client' && !session.activeWorkspace.isSandbox)) {
    return Response.json({ error: 'Select an active client workspace first' }, { status: 409 });
  }
  const { offeringId } = await params;
  const demo = getSandboxDemo(offeringId);
  if (!demo) return Response.json({ error: 'Sandbox not found' }, { status: 404 });
  const permission = await authorize({
    action: 'demo:run',
    resource: { type: 'sandbox', offeringId: demo.id, feature: 'sandbox', requireEntitlement: true },
  });
  if (!permission.allowed) return Response.json({ error: 'Sandbox not found' }, { status: 404 });

  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success || parsed.data.scenario_key !== demo.scenarioKey) {
    return Response.json({ error: 'Unknown sandbox scenario' }, { status: 422 });
  }

  try {
    const result = await runSandboxDemo(
      demo,
      session.activeWorkspace.orgId,
      session.user.id,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data: result }, { status: 201, headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('entitled')) return Response.json({ error: 'Sandbox not found' }, { status: 404 });
    if (message.includes('membership')) return Response.json({ error: message }, { status: 403 });
    console.error('Sandbox run failed:', error);
    return Response.json({ error: 'Sandbox run could not be saved' }, { status: 500 });
  }
}
