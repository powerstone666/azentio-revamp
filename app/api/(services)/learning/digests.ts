import 'server-only';

import { enqueueEmail } from '@/app/api/(services)/email/outbox';
import { renderNotificationEmail } from '@/app/api/(services)/email/renderer';
import { absoluteUrl } from '@/app/api/(services)/email/brand';
import { transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];
type Filters = Partial<Record<'q' | 'offering' | 'industry' | 'region' | 'topic' | 'period_start' | 'period_end', string>>;

function makeFilterSql(filters: Filters, values: unknown[]) {
  const clauses: string[] = [];
  const add = (clause: (parameter: string) => string, value: string | undefined) => {
    if (!value) return;
    values.push(value);
    clauses.push(clause(`$${values.length}`));
  };
  add((p) => `to_tsvector('english', s.reviewed_payload::text) @@ plainto_tsquery('english', ${p})`, filters.q);
  add((p) => `s.reviewed_payload->>'offering' = ${p}`, filters.offering);
  add((p) => `s.reviewed_payload->>'industry' = ${p}`, filters.industry);
  add((p) => `s.reviewed_payload->>'region' = ${p}`, filters.region);
  add((p) => `s.reviewed_payload->>'observation_type' = ${p}`, filters.topic);
  add((p) => `s.reviewed_payload->>'observation_period_end' >= ${p}`, filters.period_start);
  add((p) => `s.reviewed_payload->>'observation_period_start' <= ${p}`, filters.period_end);
  return clauses;
}

async function deliverOne(tx: TxQuery, savedSearchId: string, origin: string) {
  const rows = await tx<{
    id: string; name: string; filters: Filters; email: string; user_id: string; org_id: string;
    since: Date; is_sandbox: boolean;
  }>(
    `SELECT ss.id, ss.name, ss.filters, ss.user_id, ss.org_id, u.email, o.is_sandbox,
            COALESCE(ss.last_digest_at, now() - interval '7 days') AS since
     FROM client_saved_searches ss
     JOIN users u ON u.id = ss.user_id AND u.disabled_at IS NULL
     JOIN memberships m ON m.user_id = ss.user_id AND m.org_id = ss.org_id
       AND m.status = 'active'
     JOIN organizations o ON o.id = ss.org_id AND o.type = 'client' AND o.status = 'active'
     WHERE ss.id = $1 AND ss.digest_enabled = true
       AND (m.role IN ('client_member', 'client_admin') OR (o.is_sandbox = true AND EXISTS (
         SELECT 1 FROM role_grants g WHERE g.user_id = ss.user_id AND g.org_id = ss.org_id
           AND g.role IN ('client_member', 'client_admin') AND g.revoked_at IS NULL
           AND (g.expires_at IS NULL OR g.expires_at > now())
       )))
       AND (ss.last_digest_at IS NULL OR ss.last_digest_at <= now() - interval '7 days')
     FOR UPDATE OF ss SKIP LOCKED`,
    [savedSearchId],
  );
  const item = rows[0];
  if (!item) return { processed: false, queued: false };
  const values: unknown[] = [item.since, item.is_sandbox, item.org_id];
  const filters = makeFilterSql(item.filters ?? {}, values);
  const copies = await tx<{ id: string; title: string; offering: string | null; observation_type: string | null; published_at: Date }>(
    `SELECT s.id, s.reviewed_payload->>'title' AS title,
            NULLIF(s.reviewed_payload->>'offering', '') AS offering,
            NULLIF(s.reviewed_payload->>'observation_type', '') AS observation_type,
            s.published_at
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id
     JOIN organizations source_org ON source_org.id = c.org_id
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
       AND c.state = 'published' AND c.withdrawn_at IS NULL AND c.visibility = 'community_proposed'
       AND (($2::boolean = true AND source_org.is_sandbox = true AND c.org_id = $3::uuid)
         OR ($2::boolean = false AND source_org.is_sandbox = false))
       AND s.published_at > $1
       ${filters.length ? `AND ${filters.join('\n       AND ')}` : ''}
     ORDER BY s.published_at DESC, s.id DESC LIMIT 5`,
    values,
  );
  let queued = false;
  if (copies.length > 0) {
    const subject = `Weekly shared learning digest: ${item.name}`;
    const details = copies.map((copy) => `• ${copy.title}${copy.offering ? ` — ${copy.offering}` : ''}\n  ${absoluteUrl(`/portal/client/shared-learning/${copy.id}`, origin)}`).join('\n\n');
    const rendered = renderNotificationEmail({
      subject,
      heading: item.name,
      message: `New approved shared learning matched your saved search from the past week:\n\n${details}\n\nThis digest contains only reviewed community copies. It does not include private organisation observations.`,
      badge: 'Weekly Learning Digest',
      actionUrl: '/portal/client/shared-learning',
      actionLabel: 'Open shared learning →',
      origin,
    });
    const week = await tx<{ week_start: string }>(`SELECT date_trunc('week', now())::date::text AS week_start`);
    await enqueueEmail(tx, {
      idempotencyKey: `saved-search-digest:${item.id}:${week[0].week_start}`,
      recipient: item.email,
      subject: rendered.subject,
      text: rendered.text,
      html: rendered.html,
    });
    queued = true;
  }
  await tx('UPDATE client_saved_searches SET last_digest_at = now() WHERE id = $1', [item.id]);
  return { processed: true, queued };
}

export async function deliverSavedSearchDigests(limit = 100, origin: string) {
  const ids = await transaction(async (tx) => tx<{ id: string }>(
    `SELECT id FROM client_saved_searches WHERE digest_enabled = true
       AND (last_digest_at IS NULL OR last_digest_at <= now() - interval '7 days')
     ORDER BY COALESCE(last_digest_at, '-infinity'::timestamptz), id
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 200)],
  ));
  let processed = 0;
  let queued = 0;
  for (const { id } of ids) {
    try {
      const result = await transaction((tx) => deliverOne(tx, id, origin));
      if (result.processed) processed += 1;
      if (result.queued) queued += 1;
    } catch {
      // Keep the search due so the next scheduled run can retry it.
    }
  }
  return { due: ids.length, processed, queued };
}
