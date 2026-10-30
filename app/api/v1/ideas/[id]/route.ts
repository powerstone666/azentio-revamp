import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { ideaStatusUpdateSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getIdea, getIdeaEvidence, getIdeaHistory, getIdeaScope, updateIdeaStatus } from '@/app/api/(services)/ideas/service';

const idSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Idea not found' }, { status: 404 });
  const scope = await getIdeaScope(id.data, session.activeWorkspace.orgId);
  if (!scope) return Response.json({ error: 'Idea not found' }, { status: 404 });
  const audience = session.activeWorkspace.isSandbox
    ? (scope.audience === 'internal' ? 'internal' : 'client')
    : session.activeWorkspace.orgType === 'client' ? 'client' : 'internal';
  const permission = await authorize(audience === 'client'
    ? { action: 'ideas:read' }
    : { action: 'ideas:owner-read', resource: { type: 'idea', id: id.data, offeringId: scope.offering ?? undefined } });
  if (!permission.allowed) return Response.json({ error: audience === 'client' ? permission.reason : 'Idea not found' }, { status: audience === 'client' ? 403 : 404 });
  const ownerOfferings = audience === 'internal' && scope.offering ? [scope.offering] : [];
  const idea = await getIdea(id.data, audience, ownerOfferings, session.activeWorkspace.orgId);
  if (!idea) return Response.json({ error: 'Idea not found' }, { status: 404 });
  const [evidence, history] = await Promise.all([getIdeaEvidence(id.data, session.activeWorkspace.orgId), getIdeaHistory(id.data)]);
  return Response.json({ data: { ...idea, evidence, history } }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Idea not found' }, { status: 404 });
  const scope = await getIdeaScope(id.data, session.activeWorkspace.orgId);
  if (!scope?.offering) return Response.json({ error: 'Idea not found' }, { status: 404 });
  const permission = await authorize({ action: 'ideas:update', resource: { type: 'idea', id: id.data, offeringId: scope.offering } });
  if (!permission.allowed) return Response.json({ error: 'Idea not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = ideaStatusUpdateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });

  try {
    const result = await updateIdeaStatus(
      id.data,
      session.user.id,
      session.activeWorkspace.orgId,
      scope.offering,
      parsed.data,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('assignment') || message.includes('membership')) return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: 'Idea status could not be updated' }, { status: 409 });
  }
}
