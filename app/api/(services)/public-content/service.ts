import 'server-only';

import { query, queryOne, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];
export type PublicContentKind = 'announcement' | 'page';
export type PublicContentStatus = 'draft' | 'published' | 'archived';

export interface PublicContentInput {
  kind: PublicContentKind;
  slug: string | null;
  title: string;
  body: string;
  link_label: string | null;
  link_href: string | null;
  status: PublicContentStatus;
  starts_at: string | null;
  ends_at: string | null;
}

async function requirePublisher(tx: TxQuery, userId: string, orgId: string) {
  const member = await tx<{ id: string }>(
    `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active' AND o.status = 'active'
       AND ((m.role = 'employee' AND o.type = 'azentio') OR o.is_sandbox = true)
     FOR SHARE OF m`, [userId, orgId],
  );
  if (!member[0]) throw new Error('Active employee membership required');
  const grant = await tx<{ id: string }>(
    `SELECT id FROM role_grants WHERE user_id = $1 AND role = 'content_publisher'
       AND (org_id = $2 OR org_id IS NULL) AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now())
     ORDER BY (org_id IS NULL), id LIMIT 1 FOR SHARE`, [userId, orgId],
  );
  if (!grant[0]) throw new Error('Active content publisher grant required');
}

export async function listPublisherContent(userId: string, orgId: string) {
  await transaction((tx) => requirePublisher(tx, userId, orgId));
  return query(
    `SELECT item.id, item.kind, item.slug, item.title, item.body, item.link_label, item.link_href, item.status,
            starts_at, ends_at, published_at, updated_at
     FROM public_content_items item
     JOIN organizations workspace ON workspace.id = $1 AND workspace.status = 'active'
     WHERE item.org_id = $1 OR (item.org_id IS NULL AND workspace.is_sandbox = false)
     ORDER BY CASE item.status WHEN 'draft' THEN 0 WHEN 'published' THEN 1 ELSE 2 END,
              item.updated_at DESC, item.id DESC LIMIT 250`,
    [orgId],
  );
}

export async function createPublisherContent(input: {
  userId: string; orgId: string; requestId: string; content: PublicContentInput;
}) {
  return transaction(async (tx) => {
    await requirePublisher(tx, input.userId, input.orgId);
    const rows = await tx<{ id: string }>(
      `INSERT INTO public_content_items
         (org_id, kind, slug, title, body, link_label, link_href, status, starts_at, ends_at,
          created_by, updated_by, published_at)
       VALUES (CASE WHEN (SELECT is_sandbox FROM organizations WHERE id = $1) THEN $1 ELSE NULL END,
               $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $11,
               CASE WHEN $8 = 'published' THEN now() ELSE NULL END)
       RETURNING id`,
      [input.orgId, input.content.kind, input.content.slug, input.content.title, input.content.body,
       input.content.link_label, input.content.link_href, input.content.status,
       input.content.starts_at, input.content.ends_at, input.userId],
    );
    await auditContentChange(tx, input.userId, input.orgId, input.requestId, rows[0].id, 'public_content.create', input.content);
    return { id: rows[0].id };
  });
}

export async function updatePublisherContent(input: {
  id: string; userId: string; orgId: string; requestId: string; content: PublicContentInput;
}) {
  return transaction(async (tx) => {
    await requirePublisher(tx, input.userId, input.orgId);
    const rows = await tx<{ id: string }>(
      `UPDATE public_content_items SET kind = $1, slug = $2, title = $3, body = $4,
         link_label = $5, link_href = $6, status = $7, starts_at = $8, ends_at = $9,
         updated_by = $10, updated_at = now(),
         published_at = CASE WHEN $7 = 'published' THEN COALESCE(published_at, now()) ELSE NULL END
       WHERE id = $11 AND org_id IS NOT DISTINCT FROM
         CASE WHEN (SELECT is_sandbox FROM organizations WHERE id = $12) THEN $12::uuid ELSE NULL END RETURNING id`,
      [input.content.kind, input.content.slug, input.content.title, input.content.body,
       input.content.link_label, input.content.link_href, input.content.status,
       input.content.starts_at, input.content.ends_at, input.userId, input.id, input.orgId],
    );
    if (!rows[0]) throw new Error('Content item not found');
    await auditContentChange(tx, input.userId, input.orgId, input.requestId, rows[0].id, 'public_content.update', input.content);
    return rows[0];
  });
}

async function auditContentChange(
  tx: TxQuery, actorId: string, orgId: string, requestId: string, contentId: string,
  action: string, content: PublicContentInput,
) {
  await tx(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
     VALUES ($1, $2, 'public_content_item', $3, $4, $5, 'allowed', $6::jsonb)`,
    [actorId, action, contentId, orgId, requestId,
     JSON.stringify({ kind: content.kind, slug: content.slug, status: content.status })],
  );
}

export async function getLivePublicAnnouncement() {
  return queryOne<{ id: string; title: string; body: string; link_label: string | null; link_href: string | null }>(
    `SELECT id, title, body, link_label, link_href
     FROM public_content_items
     WHERE org_id IS NULL AND kind = 'announcement' AND status = 'published'
       AND (starts_at IS NULL OR starts_at <= now())
       AND (ends_at IS NULL OR ends_at > now())
     ORDER BY published_at DESC NULLS LAST, updated_at DESC, id DESC LIMIT 1`,
  );
}

export async function getPublishedPublicPage(slug: string) {
  return queryOne<{ slug: string; title: string; body: string; link_label: string | null; link_href: string | null }>(
    `SELECT slug, title, body, link_label, link_href
     FROM public_content_items WHERE org_id IS NULL AND kind = 'page' AND status = 'published' AND slug = $1`, [slug],
  );
}
