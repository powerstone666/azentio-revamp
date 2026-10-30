import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { contributionCreateSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import {
  getContributionOwner,
  getWorkspaceContribution,
  updateDraft,
  withdrawContribution,
} from '@/app/api/(services)/contributions/service';

const idSchema = z.string().uuid();

async function loadContribution(idValue: string, userId: string): Promise<{ contribution?: unknown; status?: number; error?: string }> {
  const parsedId = idSchema.safeParse(idValue);
  if (!parsedId.success) return { status: 404, error: 'Contribution not found' };

  const subject = await getContributionOwner(parsedId.data);
  if (!subject) return { status: 404, error: 'Contribution not found' };
  const permission = await authorize({
    action: 'contribution:read',
    resource: { type: 'contribution', id: parsedId.data, orgId: subject.org_id },
  });
  if (!permission.allowed) return { status: 404, error: 'Contribution not found' };

  const contribution = await getWorkspaceContribution(parsedId.data, userId, subject.org_id);
  if (!contribution) return { status: 404, error: 'Contribution not found' };
  return { contribution };
}

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { id } = await params;
  const result = await loadContribution(id, session.user.id);
  if (result.status) return Response.json({ error: result.error }, { status: result.status });
  return Response.json({ data: result.contribution });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Contribution not found' }, { status: 404 });
  const subject = await getContributionOwner(id.data);
  if (!subject || subject.author_user_id !== session.user.id) return Response.json({ error: 'Contribution not found' }, { status: 404 });
  const permission = await authorize({ action: 'contribution:update', resource: { type: 'contribution', id: id.data, orgId: subject.org_id } });
  if (!permission.allowed) return Response.json({ error: 'Contribution not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = contributionCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });

  try {
    const contribution = await updateDraft(id.data, parsed.data, session.user.id, subject.org_id, request.headers.get('x-request-id')?.slice(0, 100) || randomUUID());
    return Response.json({ data: contribution });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('consent')) return Response.json({ error: message }, { status: 422 });
    if (message.includes('membership')) return Response.json({ error: 'Workspace membership is no longer active' }, { status: 403 });
    return Response.json({ error: 'Contribution cannot be edited in its current state' }, { status: 409 });
  }
}

export async function DELETE(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Contribution not found' }, { status: 404 });
  const subject = await getContributionOwner(id.data);
  if (!subject) return Response.json({ error: 'Contribution not found' }, { status: 404 });

  const isAuthor = subject.author_user_id === session.user.id;
  const action = isAuthor ? 'contribution:withdraw' : 'contribution:moderate';
  const permission = await authorize({ action, resource: { type: 'contribution', id: id.data, orgId: subject.org_id } });
  if (!permission.allowed) return Response.json({ error: 'Contribution not found' }, { status: 404 });

  try {
    await withdrawContribution(
      id.data,
      session.user.id,
      subject.org_id,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      !isAuthor,
    );
    return new Response(null, { status: 204 });
  } catch {
    return Response.json({ error: 'Unable to withdraw this contribution' }, { status: 409 });
  }
}
