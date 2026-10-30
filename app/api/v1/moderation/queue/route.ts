import 'server-only';

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { detectReviewRisks, getModerationQueue } from '@/app/api/(services)/moderation/service';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'contribution:moderate' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });

  const globalModerator = session.grants.some((grant) => grant.role === 'learning_moderator'
    && grant.org_id === null && !grant.revoked_at
    && (!grant.expires_at || new Date(grant.expires_at).getTime() > Date.now()));
  const queue = (await getModerationQueue(globalModerator ? undefined : session.activeWorkspace?.orgId))
    .map((item) => ({ ...item, sensitive_flags: detectReviewRisks(item.source_payload) }));
  return Response.json({ data: queue });
}
