import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getContributionOwner, revokeContributionConsent } from '@/app/api/(services)/contributions/service';

const idSchema = z.string().uuid();
const bodySchema = z.object({
  purpose: z.enum(['store_process', 'publish_reviewed', 'attribute', 'model_training', 'semantic_analysis']),
});

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const id = idSchema.safeParse((await params).id);
  if (!id.success) return Response.json({ error: 'Contribution not found' }, { status: 404 });
  const subject = await getContributionOwner(id.data);
  if (!subject || subject.author_user_id !== session.user.id) return Response.json({ error: 'Contribution not found' }, { status: 404 });
  const permission = await authorize({
    action: 'contribution:withdraw',
    resource: { type: 'contribution', id: id.data, orgId: subject.org_id },
  });
  if (!permission.allowed) return Response.json({ error: 'Contribution not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = bodySchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Invalid consent purpose' }, { status: 422 });

  try {
    await revokeContributionConsent(
      id.data, session.user.id, subject.org_id, parsed.data.purpose,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data: { contribution_id: id.data, revoked: parsed.data.purpose } }, {
      headers: { 'Cache-Control': 'private, no-store, max-age=0' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('not found') || message.includes('membership')) return Response.json({ error: 'Contribution not found' }, { status: 404 });
    if (message.includes('No active consent')) return Response.json({ error: message }, { status: 409 });
    console.error('Consent revocation failed:', error);
    return Response.json({ error: 'Unable to revoke consent' }, { status: 500 });
  }
}
