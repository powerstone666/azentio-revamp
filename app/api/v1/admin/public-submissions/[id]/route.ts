import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { updatePublicSubmissionStatus } from '@/app/api/(services)/public-submissions/service';

const idSchema = z.string().uuid();
const statusSchema = z.object({ status: z.enum(['triaged', 'closed']) }).strict();

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const permission = await authorize({ action: 'public-submissions:manage' });
  if (!permission.allowed) return Response.json({ error: 'Public submission management access required' }, { status: 403 });

  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: 'Public submission not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = statusSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json({ error: 'Status must be triaged or closed', details: parsed.error.flatten() }, { status: 422 });
  }

  try {
    const data = await updatePublicSubmissionStatus({
      id: id.data,
      actorId: session.user.id,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      status: parsed.data.status,
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) return Response.json({ error: 'Public submission not found' }, { status: 404 });
    if (message.includes('transition')) return Response.json({ error: message }, { status: 409 });
    console.error('Public submission status update failed:', error);
    return Response.json({ error: 'Unable to update public submission' }, { status: 500 });
  }
}
