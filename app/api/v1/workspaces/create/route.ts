import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getSession } from '@/app/api/(services)/authz/session';
import { WorkspaceError, createSandboxWorkspace } from '@/app/api/(services)/workspaces/service';

const bodySchema = z.object({ name: z.string().trim().min(3).max(80) });

function sameOrigin(request: Request): boolean {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  try {
    return new URL(origin).host === (request.headers.get('x-forwarded-host') ?? request.headers.get('host'));
  } catch {
    return false;
  }
}

export async function POST(request: Request): Promise<Response> {
  if (!sameOrigin(request)) return Response.json({ error: 'Forbidden' }, { status: 403 });
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'workspace:create' });
  if (!permission.allowed || !session.activeWorkspace) {
    return Response.json({ error: permission.reason ?? 'Select a workspace first' }, { status: 403 });
  }
  const parsed = bodySchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return Response.json({ error: 'Workspace name must be 3 to 80 characters.' }, { status: 422 });

  try {
    const data = await createSandboxWorkspace({
      actorId: session.user.id,
      sourceOrgId: session.activeWorkspace.orgId,
      name: parsed.data.name,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof WorkspaceError) return Response.json({ error: error.message }, { status: error.status });
    console.error('[workspaces] create failed:', error);
    return Response.json({ error: 'Could not create the workspace.' }, { status: 500 });
  }
}
