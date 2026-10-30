import 'server-only';

import type { SavedSearchCreateInput } from '@/app/(common-lib)/types/schemas';
import { query, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

async function requireClientMembership(tx: TxQuery, userId: string, orgId: string) {
  const membership = await tx<{ id: string }>(
    `SELECT m.id FROM memberships m
     JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active'
       AND o.type = 'client' AND o.status = 'active'
       AND (m.role IN ('client_member', 'client_admin') OR (o.is_sandbox = true AND EXISTS (
         SELECT 1 FROM role_grants g WHERE g.user_id = $1 AND g.org_id = $2
           AND g.role IN ('client_member', 'client_admin') AND g.revoked_at IS NULL
           AND (g.expires_at IS NULL OR g.expires_at > now())
       )))
     FOR SHARE OF m`,
    [userId, orgId],
  );
  if (!membership[0]) throw new Error('Active client workspace membership required');
}

export async function listSavedSearches(userId: string, orgId: string) {
  return query<{ id: string; name: string; filters: Record<string, unknown>; digest_enabled: boolean; created_at: Date; updated_at: Date }>(
    `SELECT id, name, filters, digest_enabled, created_at, updated_at
     FROM client_saved_searches WHERE user_id = $1 AND org_id = $2
     ORDER BY updated_at DESC, id DESC LIMIT 100`,
    [userId, orgId],
  );
}

export async function createSavedSearch(userId: string, orgId: string, input: SavedSearchCreateInput) {
  return transaction(async (tx) => {
    await requireClientMembership(tx, userId, orgId);
    const rows = await tx<{ id: string; name: string; filters: Record<string, unknown>; digest_enabled: boolean; created_at: Date; updated_at: Date }>(
      `INSERT INTO client_saved_searches (user_id, org_id, name, filters, digest_enabled)
       VALUES ($1, $2, $3, $4::jsonb, $5)
       ON CONFLICT (user_id, org_id, name) DO UPDATE
         SET filters = EXCLUDED.filters, digest_enabled = EXCLUDED.digest_enabled,
             last_digest_at = CASE WHEN EXCLUDED.digest_enabled THEN client_saved_searches.last_digest_at ELSE NULL END,
             updated_at = now()
       RETURNING id, name, filters, digest_enabled, created_at, updated_at`,
      [userId, orgId, input.name, JSON.stringify(input.filters), input.digest_enabled],
    );
    return rows[0];
  });
}

export async function deleteSavedSearch(id: string, userId: string, orgId: string) {
  return transaction(async (tx) => {
    await requireClientMembership(tx, userId, orgId);
    const rows = await tx<{ id: string }>(
      'DELETE FROM client_saved_searches WHERE id = $1 AND user_id = $2 AND org_id = $3 RETURNING id',
      [id, userId, orgId],
    );
    return Boolean(rows[0]);
  });
}

export async function listBookmarkedCopies(userId: string, orgId: string) {
  return query<{ id: string; reviewed_payload: Record<string, unknown>; published_at: Date }>(
    `SELECT s.id, s.reviewed_payload, s.published_at
     FROM shared_copy_bookmarks b
     JOIN shared_copies s ON s.id = b.shared_copy_id AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     JOIN organizations source_org ON source_org.id = c.org_id
     JOIN organizations workspace ON workspace.id = $2
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE b.user_id = $1 AND b.org_id = $2 AND c.visibility = 'community_proposed'
       AND ((workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $2)
         OR (workspace.is_sandbox = false AND source_org.is_sandbox = false))
     ORDER BY b.created_at DESC, b.shared_copy_id DESC LIMIT 100`,
    [userId, orgId],
  );
}

export async function isBookmarked(sharedCopyId: string, userId: string, orgId: string) {
  const rows = await query<{ exists: boolean }>(
    `SELECT EXISTS (
       SELECT 1 FROM shared_copy_bookmarks b
       JOIN shared_copies s ON s.id = b.shared_copy_id AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
       JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
       JOIN organizations source_org ON source_org.id = c.org_id
       JOIN organizations workspace ON workspace.id = $2
       WHERE b.user_id = $1 AND b.org_id = $2 AND b.shared_copy_id = $3
         AND ((workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $2)
           OR (workspace.is_sandbox = false AND source_org.is_sandbox = false))
     ) AS exists`,
    [userId, orgId, sharedCopyId],
  );
  return rows[0]?.exists === true;
}

export async function setBookmark(sharedCopyId: string, userId: string, orgId: string, bookmarked: boolean) {
  return transaction(async (tx) => {
    await requireClientMembership(tx, userId, orgId);
    if (bookmarked) {
      const copy = await tx<{ id: string }>(
        `SELECT s.id FROM shared_copies s
         JOIN contributions c ON c.id = s.contribution_id
         JOIN organizations source_org ON source_org.id = c.org_id
         JOIN organizations workspace ON workspace.id = $2
         JOIN contribution_versions v ON v.id = s.source_version_id
         JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
           AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
         WHERE s.id = $1 AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
           AND c.state = 'published' AND c.withdrawn_at IS NULL AND c.visibility = 'community_proposed'
           AND ((workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $2)
             OR (workspace.is_sandbox = false AND source_org.is_sandbox = false))
         FOR SHARE OF s, c`,
        [sharedCopyId, orgId],
      );
      if (!copy[0]) throw new Error('Shared contribution not found');
      await tx(
        `INSERT INTO shared_copy_bookmarks (user_id, org_id, shared_copy_id)
         VALUES ($1, $2, $3) ON CONFLICT DO NOTHING`,
        [userId, orgId, sharedCopyId],
      );
    } else {
      await tx('DELETE FROM shared_copy_bookmarks WHERE user_id = $1 AND org_id = $2 AND shared_copy_id = $3', [userId, orgId, sharedCopyId]);
    }
    return { shared_copy_id: sharedCopyId, bookmarked };
  });
}
