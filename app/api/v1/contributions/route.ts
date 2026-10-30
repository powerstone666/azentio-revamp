import 'server-only';

import { randomUUID } from 'node:crypto';
import { contributionCreateSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { createDraft, listWorkspaceContributions } from '@/app/api/(services)/contributions/service';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });

  const permission = await authorize({ action: 'contribution:list' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });

  const contributions = await listWorkspaceContributions(session.user.id, session.activeWorkspace.orgId);
  return Response.json({ data: contributions });
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });

  const permission = await authorize({ action: 'contribution:create' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = contributionCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });

  try {
    const requestId = request.headers.get('x-request-id')?.slice(0, 100) || randomUUID();
    const contribution = await createDraft(
      parsed.data,
      session.user.id,
      session.activeWorkspace.orgId,
      requestId,
    );
    return Response.json({ data: contribution }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Unable to save the contribution';
    if (message.includes('consent')) return Response.json({ error: message }, { status: 422 });
    if (message.includes('membership')) return Response.json({ error: 'Workspace membership is no longer active' }, { status: 403 });
    console.error('Contribution draft creation failed:', error);
    return Response.json({ error: 'Unable to save the contribution' }, { status: 500 });
  }
}
