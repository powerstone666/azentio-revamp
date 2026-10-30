import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { safeErrorResponse } from '@/app/api/(services)/http/safe-error';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { joinHackathonTeam, leaveHackathonTeam } from '@/app/api/(services)/employee/teams';

const idSchema = z.string().uuid();

async function employeeContext() {
  const session = await getSession();
  if (!session) return { ok: false as const, response: Response.json({ error: 'Authentication required' }, { status: 401 }) };
  const permission = await authorize({ action: 'portal:employee:read' });
  if (!permission.allowed || !session.activeWorkspace) return { ok: false as const, response: Response.json({ error: 'Employee access required' }, { status: 403 }) };
  return { ok: true as const, session, orgId: session.activeWorkspace.orgId };
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const context = await employeeContext();
  if (!context.ok) return context.response;
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Open team not found' }, { status: 404 });
  try {
    const data = await joinHackathonTeam(id.data, context.session.user.id, context.orgId,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID());
    return Response.json({ data });
  } catch {
    return Response.json({ error: 'Open team not found or employee access is no longer active' }, { status: 404 });
  }
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const context = await employeeContext();
  if (!context.ok) return context.response;
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Team membership not found' }, { status: 404 });
  try {
    const data = await leaveHackathonTeam(id.data, context.session.user.id, context.orgId,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID());
    return Response.json({ data });
  } catch (error) {
    return safeErrorResponse(error, [
      { match: 'Promote another', status: 409 },
      { match: 'not found', status: 404 },
    ], 'Unable to leave team');
  }
}
