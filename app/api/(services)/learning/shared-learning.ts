import 'server-only';

import { query, queryOne } from '@/app/api/(db)/client';
import type { SearchQueryInput } from '@/app/(common-lib)/types/schemas';

const configuredThreshold = Number(process.env.MIN_DISTINCT_ORGS ?? '3');
export const MIN_DISTINCT_ORGS = Number.isInteger(configuredThreshold) && configuredThreshold >= 3
  ? configuredThreshold
  : 3;

interface SearchCursor {
  publishedAt: string;
  id: string;
}

function parseCursor(value?: string): SearchCursor | null {
  if (!value) return null;
  try {
    const parsed = JSON.parse(Buffer.from(value, 'base64url').toString('utf8')) as Partial<SearchCursor>;
    if (!parsed.id || !/^[0-9a-f-]{36}$/i.test(parsed.id) || !parsed.publishedAt || Number.isNaN(Date.parse(parsed.publishedAt))) return null;
    return { id: parsed.id, publishedAt: new Date(parsed.publishedAt).toISOString() };
  } catch {
    return null;
  }
}

function makeCursor(cursor: SearchCursor) {
  return Buffer.from(JSON.stringify(cursor)).toString('base64url');
}

export async function searchApprovedCopies(input: SearchQueryInput) {
  const cursor = parseCursor(input.cursor);
  if (input.cursor && !cursor) throw new Error('Invalid search cursor');

  const values: unknown[] = [input.q, input.limit + 1];
  const filters = [
    `to_tsvector('english', s.reviewed_payload::text) @@ plainto_tsquery('english', $1)`,
  ];
  const addFilter = (sql: (parameter: string) => string, value: unknown) => {
    values.push(value);
    filters.push(sql(`$${values.length}`));
  };
  if (input.offering) addFilter((p) => `s.reviewed_payload->>'offering' = ${p}`, input.offering);
  if (input.industry) addFilter((p) => `s.reviewed_payload->>'industry' = ${p}`, input.industry);
  if (input.region) addFilter((p) => `s.reviewed_payload->>'region' = ${p}`, input.region);
  if (input.topic) addFilter((p) => `s.reviewed_payload->>'observation_type' = ${p}`, input.topic);
  if (input.period_start) addFilter((p) => `s.reviewed_payload->>'observation_period_end' >= ${p}`, input.period_start);
  if (input.period_end) addFilter((p) => `s.reviewed_payload->>'observation_period_start' <= ${p}`, input.period_end);
  if (cursor) {
    values.push(cursor.publishedAt, cursor.id);
    filters.push(`(s.published_at, s.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }

  const rows = await query<{ id: string; reviewed_payload: Record<string, unknown>; published_at: Date }>(
    `SELECT s.id, s.reviewed_payload, s.published_at
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id
     WHERE s.status = 'active' AND s.deidentified = true
       AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND c.visibility = 'community_proposed'
       AND EXISTS (
         SELECT 1 FROM consents co
         JOIN contribution_versions v ON v.contribution_id = co.contribution_id AND v.version = co.version
         WHERE v.id = s.source_version_id AND co.purpose = 'publish_reviewed'
           AND co.choice = true AND co.revoked_at IS NULL
       )
       AND ${filters.join('\n       AND ')}
     ORDER BY s.published_at DESC, s.id DESC
     LIMIT $2`,
    values,
  );

  const hasMore = rows.length > input.limit;
  const page = rows.slice(0, input.limit).map((row) => ({
    id: row.id,
    ...row.reviewed_payload,
    published_at: row.published_at,
  }));
  const last = rows[rows.length > input.limit ? input.limit - 1 : rows.length - 1];
  return {
    data: page,
    hasMore,
    nextCursor: hasMore && last ? makeCursor({ id: last.id, publishedAt: new Date(last.published_at).toISOString() }) : null,
  };
}

export async function listVisibleThemes() {
  return query(
    `SELECT t.id, t.title, t.offering, t.topic, t.period_start, t.period_end,
            t.status, t.safe_summary, count(DISTINCT c.org_id)::int AS distinct_org_count,
            max(s.published_at) AS updated_at
     FROM themes t
     JOIN theme_evidence te ON te.theme_id = t.id
     JOIN shared_copies s ON s.id = te.shared_copy_id AND s.status = 'active' AND s.deidentified = true
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     WHERE t.status IN ('emerging', 'active')
     GROUP BY t.id
     HAVING count(DISTINCT c.org_id) >= $1
     ORDER BY max(s.published_at) DESC, t.id
     LIMIT 100`,
    [MIN_DISTINCT_ORGS],
  );
}

export async function getVisibleTheme(themeId: string) {
  const theme = await queryOne<{
    id: string;
    title: string;
    offering: string | null;
    topic: string;
    period_start: Date;
    period_end: Date;
    status: string;
    safe_summary: string;
    distinct_org_count: number;
  }>(
    `SELECT t.id, t.title, t.offering, t.topic, t.period_start, t.period_end,
            t.status, t.safe_summary, count(DISTINCT c.org_id)::int AS distinct_org_count
     FROM themes t
     JOIN theme_evidence te ON te.theme_id = t.id
     JOIN shared_copies s ON s.id = te.shared_copy_id AND s.status = 'active' AND s.deidentified = true
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     WHERE t.id = $1 AND t.status IN ('emerging', 'active')
     GROUP BY t.id
     HAVING count(DISTINCT c.org_id) >= $2`,
    [themeId, MIN_DISTINCT_ORGS],
  );
  if (!theme) return null;

  const evidence = await query<{ id: string; reviewed_payload: Record<string, unknown>; published_at: Date }>(
    `SELECT s.id, s.reviewed_payload, s.published_at
     FROM theme_evidence te
     JOIN shared_copies s ON s.id = te.shared_copy_id AND s.status = 'active' AND s.deidentified = true
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     WHERE te.theme_id = $1
     ORDER BY s.published_at DESC, s.id
     LIMIT 100`,
    [themeId],
  );
  return {
    ...theme,
    sample_note: 'Evidence is based on approved shared contributions and may not represent the broader market.',
    evidence: evidence.map((item) => ({ id: item.id, ...item.reviewed_payload, published_at: item.published_at })),
  };
}
