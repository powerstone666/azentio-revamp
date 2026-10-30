import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getMySharedCopyFeedback, saveSharedCopyFeedback } from '@/app/api/(services)/learning/feedback';

const idSchema = z.uuid();
const bodySchema = z.object({ feedback: z.enum(['useful', 'needs_evidence']) }).strict();

async function clientContext(idValue: string) {
  const session = await getSession();
  if (!session?.activeWorkspace || (session.activeWorkspace.orgType !== 'client' && !session.activeWorkspace.isSandbox)) return null;
  const id = idSchema.safeParse(idValue);
  if (!id.success) return null;
  const permission = await authorize({ action: 'portal:client:read' });
  if (!permission.allowed) return null;
  return { session, id: id.data };
}

export async function GET(_request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const context = await clientContext((await params).id);
  if (!context) return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
  const result = await getMySharedCopyFeedback(context.id, context.session.user.id, context.session.activeWorkspace!.orgId);
  return Response.json({ data: result }, { headers: { 'Cache-Control': 'private, no-store' } });
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const context = await clientContext((await params).id);
  if (!context) return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
  const body = await request.json().catch(() => null);
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Choose useful or needs evidence' }, { status: 422 });
  try {
    const data = await saveSharedCopyFeedback({
      sharedCopyId: context.id,
      userId: context.session.user.id,
      orgId: context.session.activeWorkspace!.orgId,
      feedback: parsed.data.feedback,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    if (error instanceof Error && error.message.includes('membership')) return Response.json({ error: 'Active client workspace required' }, { status: 403 });
    if (error instanceof Error && error.message.includes('not found')) return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
    console.error('Shared contribution feedback failed:', error);
    return Response.json({ error: 'Unable to save feedback' }, { status: 500 });
  }
}
