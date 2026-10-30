import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getContributionOwner, submitForReview } from '@/app/api/(services)/contributions/service';

const idSchema = z.string().uuid();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const { id: rawId } = await params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) return Response.json({ error: 'Contribution not found' }, { status: 404 });
  const subject = await getContributionOwner(parsedId.data);
  if (!subject || subject.author_user_id !== session.user.id) {
    return Response.json({ error: 'Contribution not found' }, { status: 404 });
  }
  const permission = await authorize({
    action: 'contribution:submit',
    resource: { type: 'contribution', id: parsedId.data, orgId: subject.org_id },
  });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });

  try {
    const data = await submitForReview(
      parsedId.data,
      session.user.id,
      subject.org_id,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('consent')) return Response.json({ error: message }, { status: 422 });
    if (message.includes('membership')) return Response.json({ error: 'Workspace membership is no longer active' }, { status: 403 });
    return Response.json({ error: 'Contribution cannot be submitted in its current state' }, { status: 409 });
  }
}
