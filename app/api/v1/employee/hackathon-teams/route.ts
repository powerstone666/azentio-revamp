import 'server-only';

import { randomUUID } from 'node:crypto';
import { hackathonTeamCreateSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createHackathonTeam, listHackathonTeams } from '@/app/api/(services)/employee/teams';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'portal:employee:read' });
  if (!permission.allowed || !session.activeWorkspace) return Response.json({ error: 'Employee access required' }, { status: 403 });
  try {
    return Response.json({ data: await listHackathonTeams(session.user.id, session.activeWorkspace.orgId) });
  } catch {
    return Response.json({ error: 'Unable to load employee hackathon teams' }, { status: 403 });
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'portal:employee:read' });
  if (!permission.allowed || !session.activeWorkspace) return Response.json({ error: 'Employee access required' }, { status: 403 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = hackathonTeamCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await createHackathonTeam(
      session.user.id, session.activeWorkspace.orgId, parsed.data,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data }, { status: 201 });
  } catch {
    return Response.json({ error: 'Unable to create team; verify active employee access' }, { status: 403 });
  }
}
