import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { hackathonTeamPostSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createHackathonTeamPost, listHackathonTeamPosts } from '@/app/api/(services)/employee/teams';

const idSchema = z.string().uuid();

async function employeeContext() {
  const session = await getSession();
  if (!session) return { ok: false as const, response: Response.json({ error: 'Authentication required' }, { status: 401 }) };
  const permission = await authorize({ action: 'portal:employee:read' });
  if (!permission.allowed || !session.activeWorkspace) return { ok: false as const, response: Response.json({ error: 'Employee access required' }, { status: 403 }) };
  return { ok: true as const, session, orgId: session.activeWorkspace.orgId };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const context = await employeeContext();
  if (!context.ok) return context.response;
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Team space not found' }, { status: 404 });
  try {
    return Response.json({ data: await listHackathonTeamPosts(id.data, context.session.user.id, context.orgId) });
  } catch {
    return Response.json({ error: 'Team space not found' }, { status: 404 });
  }
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const context = await employeeContext();
  if (!context.ok) return context.response;
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Team space not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = hackathonTeamPostSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await createHackathonTeamPost(
      id.data, context.session.user.id, context.orgId, parsed.data,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data }, { status: 201 });
  } catch {
    return Response.json({ error: 'Team membership required' }, { status: 404 });
  }
}
