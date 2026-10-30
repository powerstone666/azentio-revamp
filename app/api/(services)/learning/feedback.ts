import 'server-only';

import { queryOne, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];
export type SharedCopyFeedback = 'useful' | 'needs_evidence';

async function requireVisibleCopy(tx: TxQuery, sharedCopyId: string, orgId: string) {
  const rows = await tx<{ id: string }>(
    `SELECT s.id
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id
     JOIN organizations source_org ON source_org.id = c.org_id
     JOIN organizations workspace ON workspace.id = $2
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE s.id = $1 AND s.status = 'active'
       AND (s.deidentified = true OR s.attribution_consent = true)
       AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND ((workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $2)
         OR (workspace.is_sandbox = false AND source_org.is_sandbox = false))
       AND c.visibility = 'community_proposed'`,
    [sharedCopyId, orgId],
  );
  if (!rows[0]) throw new Error('Shared contribution not found');
}

export async function getMySharedCopyFeedback(sharedCopyId: string, userId: string, orgId: string) {
  return queryOne<{ feedback: SharedCopyFeedback }>(
    `SELECT f.feedback FROM shared_copy_feedback f
     JOIN shared_copies s ON s.id = f.shared_copy_id AND s.status = 'active'
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     JOIN organizations source_org ON source_org.id = c.org_id
     JOIN memberships m ON m.user_id = f.user_id AND m.org_id = f.org_id AND m.status = 'active'
     JOIN organizations o ON o.id = m.org_id AND o.type = 'client' AND o.status = 'active'
     WHERE f.shared_copy_id = $1 AND f.user_id = $2 AND f.org_id = $3
       AND ((o.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $3)
         OR (o.is_sandbox = false AND source_org.is_sandbox = false))`,
    [sharedCopyId, userId, orgId],
  );
}

export async function saveSharedCopyFeedback(input: {
  sharedCopyId: string; userId: string; orgId: string; feedback: SharedCopyFeedback; requestId: string;
}) {
  return transaction(async (tx) => {
    const member = await tx<{ id: string }>(
      `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active'
         AND o.type = 'client' AND o.status = 'active'
         AND (m.role IN ('client_member', 'client_admin') OR (o.is_sandbox = true AND EXISTS (
           SELECT 1 FROM role_grants g WHERE g.user_id = $1 AND g.org_id = $2
             AND g.role IN ('client_member', 'client_admin') AND g.revoked_at IS NULL
             AND (g.expires_at IS NULL OR g.expires_at > now())
         )))
       FOR SHARE OF m`,
      [input.userId, input.orgId],
    );
    if (!member[0]) throw new Error('Active client membership required');
    await requireVisibleCopy(tx, input.sharedCopyId, input.orgId);
    const saved = await tx<{ feedback: SharedCopyFeedback }>(
      `INSERT INTO shared_copy_feedback (user_id, org_id, shared_copy_id, feedback)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (user_id, org_id, shared_copy_id) DO UPDATE
         SET feedback = EXCLUDED.feedback, updated_at = now()
       RETURNING feedback`,
      [input.userId, input.orgId, input.sharedCopyId, input.feedback],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'shared_copy.feedback', 'shared_copy', $2, $3, $4, 'allowed', $5::jsonb)`,
      [input.userId, input.sharedCopyId, input.orgId, input.requestId, JSON.stringify({ feedback: input.feedback })],
    );
    return saved[0];
  });
}
