import 'server-only';

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listModerationAudit } from '@/app/api/(services)/moderation/service';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'audit:list' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });

  const globalModerator = session.grants.some((grant) => grant.role === 'learning_moderator'
    && grant.org_id === null && !grant.revoked_at
    && (!grant.expires_at || new Date(grant.expires_at).getTime() > Date.now()));
  const entries = await listModerationAudit(globalModerator ? undefined : session.activeWorkspace?.orgId);
  return Response.json({ data: entries });
}
