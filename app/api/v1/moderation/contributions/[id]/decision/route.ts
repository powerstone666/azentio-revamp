import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { moderationDecisionSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getContributionOwner } from '@/app/api/(services)/contributions/service';
import { applyModerationDecision } from '@/app/api/(services)/moderation/service';

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
  if (!subject) return Response.json({ error: 'Contribution not found' }, { status: 404 });
  const permission = await authorize({
    action: 'contribution:moderate',
    resource: { type: 'contribution', id: parsedId.data, orgId: subject.org_id },
  });
  if (!permission.allowed) return Response.json({ error: 'Contribution not found' }, { status: 404 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = moderationDecisionSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });

  try {
    const decision = await applyModerationDecision(
      parsedId.data,
      session.user.id,
      subject.org_id,
      parsed.data,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data: decision });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found')) return Response.json({ error: 'Contribution not found' }, { status: 404 });
    if (message.includes('consent') || message.includes('Attribution') || message.includes('redacted copy') || message.includes('community-proposed')) {
      return Response.json({ error: message }, { status: 422 });
    }
    return Response.json({ error: 'Decision is not allowed for this contribution' }, { status: 409 });
  }
}
