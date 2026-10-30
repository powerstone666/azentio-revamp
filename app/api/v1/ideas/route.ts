import 'server-only';

import { randomUUID } from 'node:crypto';
import { ideaCreateSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createIdea, listIdeas } from '@/app/api/(services)/ideas/service';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  const permission = await authorize({ action: 'ideas:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const audience = session.activeWorkspace.orgType === 'client' ? 'client' : 'internal';
  return Response.json({ data: await listIdeas(audience) });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = ideaCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });

  const permission = await authorize({
    action: 'ideas:create',
    resource: { offeringId: parsed.data.offering },
  });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });

  try {
    const idea = await createIdea(
      parsed.data,
      session.user.id,
      session.activeWorkspace.orgId,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data: idea }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('Evidence')) return Response.json({ error: message }, { status: 422 });
    if (message.includes('membership') || message.includes('assignment')) return Response.json({ error: message }, { status: 403 });
    console.error('Idea creation failed:', error);
    return Response.json({ error: 'Unable to create idea' }, { status: 500 });
  }
}
