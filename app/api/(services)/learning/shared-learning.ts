import 'server-only';

import { createHash, randomUUID } from 'node:crypto';
import { query, queryOne, transaction } from '@/app/api/(db)/client';
import type { SearchQueryInput } from '@/app/(common-lib)/types/schemas';

const configuredThreshold = Number(process.env.MIN_DISTINCT_ORGS ?? '3');
export const MIN_DISTINCT_ORGS = Number.isInteger(configuredThreshold) && configuredThreshold >= 3
  ? configuredThreshold
  : 3;

type SemanticCandidate = {
  shared_copy_id: string;
  org_id: string;
  offering: string | null;
  topic: string;
  evidence_quality: 'weak' | 'moderate' | 'strong' | null;
  needs_evidence_org_id: string | null;
  period_start: Date;
  model: string;
  dims: number;
  embedding: number[];
};

function cosineSimilarity(left: number[], right: number[]) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (let index = 0; index < left.length; index += 1) {
    dot += left[index] * right[index];
    leftNorm += left[index] ** 2;
    rightNorm += right[index] ** 2;
  }
  return leftNorm && rightNorm ? dot / Math.sqrt(leftNorm * rightNorm) : 0;
}

function clusterSemanticCandidates(candidates: SemanticCandidate[]) {
  const thresholdValue = Number(process.env.SEMANTIC_THEME_SIMILARITY ?? '0.78');
  const threshold = Number.isFinite(thresholdValue) && thresholdValue >= 0.5 && thresholdValue <= 0.99
    ? thresholdValue
    : 0.78;
  const buckets = new Map<string, SemanticCandidate[]>();
  for (const candidate of candidates) {
    const key = JSON.stringify([
      candidate.offering ?? '', candidate.period_start.toISOString(), candidate.model, candidate.dims,
    ]);
    buckets.set(key, [...(buckets.get(key) ?? []), candidate]);
  }

  const groups: Array<{
    generated_key: string; title: string; offering: string | null; topic: string;
    period_start: Date; period_end: Date; distinct_org_count: number; previous_org_count: number | null;
    strong_org_count: number; needs_evidence_org_count: number; shared_copy_ids: string[];
    semantic: true;
  }> = [];
  for (const bucket of buckets.values()) {
    const clusters: Array<{ candidates: SemanticCandidate[]; centroid: number[] }> = [];
    for (const candidate of bucket.sort((a, b) => a.shared_copy_id.localeCompare(b.shared_copy_id))) {
      const vector = candidate.embedding;
      let best: typeof clusters[number] | undefined;
      let bestScore = threshold;
      for (const cluster of clusters) {
        if (cluster.centroid.length !== vector.length) continue;
        const score = cosineSimilarity(vector, cluster.centroid);
        if (score >= bestScore) {
          best = cluster;
          bestScore = score;
        }
      }
      if (!best) {
        clusters.push({ candidates: [candidate], centroid: [...vector] });
        continue;
      }
      best.candidates.push(candidate);
      best.centroid = best.centroid.map((value, index) => value + vector[index]);
    }

    for (const cluster of clusters) {
      const orgs = new Set(cluster.candidates.map((candidate) => candidate.org_id));
      if (orgs.size < MIN_DISTINCT_ORGS) continue;
      const exemplar = cluster.candidates[0];
      const sharedCopyIds = cluster.candidates.map((candidate) => candidate.shared_copy_id).sort();
      const periodStart = new Date(exemplar.period_start);
      const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 1) - 1000);
      const keyDigest = createHash('sha256').update(sharedCopyIds.join(':')).digest('hex').slice(0, 24);
      groups.push({
        generated_key: `semantic:${keyDigest}`,
        title: `Related observations${exemplar.offering ? ` · ${exemplar.offering}` : ''}`,
        offering: exemplar.offering,
        topic: 'semantic_similarity',
        period_start: periodStart,
        period_end: periodEnd,
        distinct_org_count: orgs.size,
        previous_org_count: null,
        strong_org_count: new Set(cluster.candidates.filter((candidate) => candidate.evidence_quality === 'strong').map((candidate) => candidate.org_id)).size,
        needs_evidence_org_count: new Set(cluster.candidates.filter((candidate) => candidate.needs_evidence_org_id).map((candidate) => candidate.needs_evidence_org_id)).size,
        shared_copy_ids: sharedCopyIds,
        semantic: true,
      });
    }
  }
  return groups;
}

export async function refreshGeneratedThemes(actorId: string, requestId: string) {
  return transaction(async (tx) => {
    await tx('SELECT pg_advisory_xact_lock(hashtextextended($1, 0))', ['approved-learning-theme-refresh']);
    const groups = await tx<{
      generated_key: string; title: string; offering: string | null; topic: string;
      period_start: Date; period_end: Date; distinct_org_count: number; previous_org_count: number | null;
      strong_org_count: number; needs_evidence_org_count: number; shared_copy_ids: string[];
    }>(
      `WITH eligible AS (
         SELECT s.id AS shared_copy_id, c.org_id,
                NULLIF(s.reviewed_payload->>'offering', '') AS offering,
                NULLIF(s.reviewed_payload->>'observation_type', '') AS topic,
                s.evidence_quality,
                f.org_id AS needs_evidence_org_id,
                date_trunc('month', COALESCE(
                  NULLIF(s.reviewed_payload->>'observation_period_start', '')::date,
                  s.published_at::date
                )) AS period_start
         FROM shared_copies s
         JOIN contributions c ON c.id = s.contribution_id
         JOIN organizations o ON o.id = c.org_id AND o.is_sandbox = false
         JOIN contribution_versions v ON v.id = s.source_version_id
         LEFT JOIN shared_copy_feedback f ON f.shared_copy_id = s.id AND f.feedback = 'needs_evidence'
         WHERE s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
           AND c.state = 'published' AND c.withdrawn_at IS NULL AND c.visibility = 'community_proposed'
           AND NULLIF(s.reviewed_payload->>'observation_type', '') IS NOT NULL
           AND EXISTS (
             SELECT 1 FROM consents co WHERE co.contribution_id = c.id AND co.version = v.version
               AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
           )
       ), monthly AS (
         SELECT offering, topic, period_start,
                count(DISTINCT org_id)::int AS distinct_org_count,
                count(DISTINCT org_id) FILTER (WHERE evidence_quality = 'strong')::int AS strong_org_count,
                count(DISTINCT needs_evidence_org_id)::int AS needs_evidence_org_count,
                array_agg(DISTINCT shared_copy_id ORDER BY shared_copy_id) AS shared_copy_ids
         FROM eligible GROUP BY offering, topic, period_start
       ), grouped AS (
         SELECT current_period.*, previous_period.distinct_org_count AS previous_org_count
         FROM monthly current_period
         LEFT JOIN monthly previous_period ON previous_period.offering IS NOT DISTINCT FROM current_period.offering
           AND previous_period.topic = current_period.topic
           AND previous_period.period_start = current_period.period_start - interval '1 month'
         WHERE current_period.distinct_org_count >= $1
       )
       SELECT jsonb_build_array(coalesce(offering, ''), topic, period_start::date::text)::text AS generated_key,
              CASE WHEN offering IS NULL THEN initcap(replace(topic, '_', ' '))
                   ELSE offering || ' · ' || initcap(replace(topic, '_', ' ')) END AS title,
              offering, topic, period_start,
              (period_start + interval '1 month' - interval '1 second') AS period_end,
              distinct_org_count, previous_org_count, strong_org_count, needs_evidence_org_count, shared_copy_ids
       FROM grouped ORDER BY period_start DESC, offering, topic`,
      [MIN_DISTINCT_ORGS],
    );

    const semanticCandidates = await tx<SemanticCandidate>(
      `SELECT s.id AS shared_copy_id, c.org_id,
              NULLIF(s.reviewed_payload->>'offering', '') AS offering,
              COALESCE(NULLIF(s.reviewed_payload->>'observation_type', ''), 'observation') AS topic,
              s.evidence_quality, f.org_id AS needs_evidence_org_id,
              date_trunc('month', COALESCE(
                NULLIF(s.reviewed_payload->>'observation_period_start', '')::date,
                s.published_at::date
              )) AS period_start,
              e.model, e.dims, e.embedding
       FROM shared_copies s
       JOIN contributions c ON c.id = s.contribution_id
       JOIN organizations o ON o.id = c.org_id AND o.is_sandbox = false
       JOIN contribution_versions v ON v.id = s.source_version_id
       JOIN shared_copy_embeddings e ON e.shared_copy_id = s.id
       JOIN consents publish ON publish.contribution_id = c.id AND publish.version = v.version
         AND publish.purpose = 'publish_reviewed' AND publish.choice = true AND publish.revoked_at IS NULL
       JOIN consents semantic ON semantic.contribution_id = c.id AND semantic.version = v.version
         AND semantic.purpose = 'semantic_analysis' AND semantic.choice = true AND semantic.revoked_at IS NULL
       LEFT JOIN shared_copy_feedback f ON f.shared_copy_id = s.id AND f.feedback = 'needs_evidence'
       WHERE s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
         AND c.state = 'published' AND c.withdrawn_at IS NULL AND c.visibility = 'community_proposed'
       ORDER BY period_start DESC, s.id
       LIMIT 2000`,
    );
    const semanticGroups = clusterSemanticCandidates(semanticCandidates);
    groups.push(...semanticGroups);

    await tx('DELETE FROM theme_evidence te USING themes t WHERE te.theme_id = t.id AND t.generated_key IS NOT NULL');
    const generatedIds: string[] = [];
    for (const group of groups) {
      const semantic = 'semantic' in group && group.semantic;
      const trend = semantic
        ? 'This machine-suggested grouping is based on semantic similarity and requires human review; similarity does not establish a shared cause or market prevalence.'
        : group.previous_org_count == null || group.previous_org_count < MIN_DISTINCT_ORGS
        ? 'Month-over-month direction is withheld because the previous period does not meet the organisation threshold.'
        : group.distinct_org_count > group.previous_org_count
          ? 'More distinct organisations contributed than in the previous month.'
          : group.distinct_org_count < group.previous_org_count
            ? 'Fewer distinct organisations contributed than in the previous month.'
            : 'The number of distinct contributing organisations was level with the previous month.';
      const reviewPriority = group.needs_evidence_org_count >= MIN_DISTINCT_ORGS
        ? 'evidence_review'
        : group.strong_org_count >= MIN_DISTINCT_ORGS ? 'candidate_review' : 'monitor';
      const summary = semantic
        ? `Suggested semantic cluster of approved, shared observations. Similarity is an aid for review, not proof that the observations share a cause. ${trend} Based on ${group.distinct_org_count} distinct organisations; this sample may not represent the wider market.`
        : `Recurring ${group.topic.replaceAll('_', ' ')} in approved, shared observations. Evidence is grouped by offering and month using the reported observation start date where available, otherwise the publication date. ${trend} Based on ${group.distinct_org_count} distinct organisations; this sample may not represent the wider market.`;
      const theme = await tx<{ id: string }>(
        `INSERT INTO themes (generated_key, title, offering, topic, period_start, period_end,
                             status, safe_summary, distinct_org_count, review_priority)
         VALUES ($1, $2, $3, $4, $5, $6, 'active', $7, $8, $9)
         ON CONFLICT (generated_key) WHERE generated_key IS NOT NULL DO UPDATE
           SET title = EXCLUDED.title, offering = EXCLUDED.offering, topic = EXCLUDED.topic,
               period_start = EXCLUDED.period_start, period_end = EXCLUDED.period_end,
               status = 'active', safe_summary = EXCLUDED.safe_summary,
               distinct_org_count = EXCLUDED.distinct_org_count,
               review_priority = EXCLUDED.review_priority
         RETURNING id`,
        [group.generated_key, group.title, group.offering, group.topic, group.period_start,
          group.period_end, summary, group.distinct_org_count, reviewPriority],
      );
      generatedIds.push(theme[0].id);
      for (const sharedCopyId of group.shared_copy_ids) {
        await tx('INSERT INTO theme_evidence (theme_id, shared_copy_id) VALUES ($1, $2) ON CONFLICT DO NOTHING', [theme[0].id, sharedCopyId]);
      }
    }
    await tx(
      `UPDATE themes SET status = 'archived' WHERE generated_key IS NOT NULL
       AND status <> 'archived' AND id <> ALL($1::uuid[])`, [generatedIds],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, request_id, decision, metadata)
       VALUES ($1, 'learning.themes_refresh', 'theme_refresh', $2, $3, 'allowed', $4::jsonb)`,
      [actorId, randomUUID(), requestId, JSON.stringify({ themes: generatedIds.length, minimum_distinct_organizations: MIN_DISTINCT_ORGS })],
    );
    return { themes: generatedIds.length, minimumDistinctOrganizations: MIN_DISTINCT_ORGS };
  });
}

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

export async function searchApprovedCopies(input: SearchQueryInput, sandboxOrgId?: string) {
  const cursor = parseCursor(input.cursor);
  if (input.cursor && !cursor) throw new Error('Invalid search cursor');
  const hasBreakdownFilters = Boolean(
    input.q || input.offering || input.industry || input.region || input.topic
      || input.period_start || input.period_end,
  );

  const values: unknown[] = [];
  const filters: string[] = [];
  const addFilter = (sql: (parameter: string) => string, value: unknown) => {
    values.push(value);
    filters.push(sql(`$${values.length}`));
  };
  if (input.q) addFilter((p) => `to_tsvector('english', s.reviewed_payload::text) @@ plainto_tsquery('english', ${p})`, input.q);
  if (input.offering) addFilter((p) => `s.reviewed_payload->>'offering' = ${p}`, input.offering);
  if (input.industry) addFilter((p) => `s.reviewed_payload->>'industry' = ${p}`, input.industry);
  if (input.region) addFilter((p) => `s.reviewed_payload->>'region' = ${p}`, input.region);
  if (input.topic) addFilter((p) => `s.reviewed_payload->>'observation_type' = ${p}`, input.topic);
  if (input.period_start) addFilter((p) => `s.reviewed_payload->>'observation_period_end' >= ${p}`, input.period_start);
  if (input.period_end) addFilter((p) => `s.reviewed_payload->>'observation_period_start' <= ${p}`, input.period_end);
  const scopeClause = sandboxOrgId
    ? `o.is_sandbox = true AND c.org_id = $${values.length + 1}`
    : 'o.is_sandbox = false';
  if (sandboxOrgId) values.push(sandboxOrgId);
  const countValues = [...values];
  const countFilters = [...filters];
  if (cursor) {
    values.push(cursor.publishedAt, cursor.id);
    filters.push(`(s.published_at, s.id) < ($${values.length - 1}::timestamptz, $${values.length}::uuid)`);
  }
  values.push(input.limit + 1);
  const limitParameter = `$${values.length}`;

  const [rows, countRow] = await Promise.all([
    query<{ id: string; reviewed_payload: Record<string, unknown>; published_at: Date }>(
      `SELECT s.id, s.reviewed_payload, s.published_at
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id
     JOIN organizations o ON o.id = c.org_id
     WHERE s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
       AND ${scopeClause}
       AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND c.visibility = 'community_proposed'
       AND EXISTS (
         SELECT 1 FROM consents co
         JOIN contribution_versions v ON v.contribution_id = co.contribution_id AND v.version = co.version
         WHERE v.id = s.source_version_id AND co.purpose = 'publish_reviewed'
           AND co.choice = true AND co.revoked_at IS NULL
       )
       ${filters.length ? `AND ${filters.join('\n       AND ')}` : ''}
     ORDER BY s.published_at DESC, s.id DESC
     LIMIT ${limitParameter}`,
      values,
    ),
    queryOne<{ total_count: number; distinct_org_count: number }>(
      `SELECT count(*)::int AS total_count, count(DISTINCT c.org_id)::int AS distinct_org_count
       FROM shared_copies s
       JOIN contributions c ON c.id = s.contribution_id
       JOIN organizations o ON o.id = c.org_id
       WHERE s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
         AND ${scopeClause}
         AND c.state = 'published' AND c.withdrawn_at IS NULL
         AND c.visibility = 'community_proposed'
         AND EXISTS (
           SELECT 1 FROM consents co
           JOIN contribution_versions v ON v.contribution_id = co.contribution_id AND v.version = co.version
           WHERE v.id = s.source_version_id AND co.purpose = 'publish_reviewed'
             AND co.choice = true AND co.revoked_at IS NULL
         )
         ${countFilters.length ? `AND ${countFilters.join('\n         AND ')}` : ''}`,
      countValues,
    ),
  ]);

  const hasMore = rows.length > input.limit;
  const page: Array<Record<string, unknown> & { id: string; published_at: Date }> = rows.slice(0, input.limit).map((row) => ({
    id: row.id,
    ...row.reviewed_payload,
    published_at: row.published_at,
  }));
  const last = rows[rows.length > input.limit ? input.limit - 1 : rows.length - 1];
  return {
    data: page,
    // Exact counts below the cohort threshold enable small-cell/differencing inference.
    totalCount: countRow && !hasBreakdownFilters && countRow.distinct_org_count >= MIN_DISTINCT_ORGS
      ? countRow.total_count
      : null,
    hasMore,
    nextCursor: hasMore && last ? makeCursor({ id: last.id, publishedAt: new Date(last.published_at).toISOString() }) : null,
  };
}

export async function suggestApprovedCopyFacets(field: 'offering' | 'industry' | 'region', prefix?: string, sandboxOrgId?: string) {
  const expression = {
    offering: "s.reviewed_payload->>'offering'",
    industry: "s.reviewed_payload->>'industry'",
    region: "s.reviewed_payload->>'region'",
  }[field];
  return query<{ value: string }>(
    `SELECT ${expression} AS value
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id
     JOIN organizations o ON o.id = c.org_id
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
       AND (($3::uuid IS NULL AND o.is_sandbox = false) OR ($3::uuid IS NOT NULL AND o.is_sandbox = true AND c.org_id = $3))
       AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND c.visibility = 'community_proposed'
       AND ${expression} IS NOT NULL AND ${expression} <> ''
       AND ($1::text IS NULL OR left(lower(${expression}), length(lower($1))) = lower($1))
     GROUP BY ${expression}
     HAVING $3::uuid IS NOT NULL OR count(DISTINCT c.org_id) >= $2
     ORDER BY value LIMIT 10`,
    [prefix?.trim() || null, MIN_DISTINCT_ORGS, sandboxOrgId ?? null],
  ).then((rows) => rows.map((row) => row.value));
}

export async function listApprovedCopies() {
  return query<{ id: string; reviewed_payload: Record<string, unknown>; published_at: Date }>(
    `SELECT s.id, s.reviewed_payload, s.published_at
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id
     JOIN organizations o ON o.id = c.org_id AND o.is_sandbox = false
     JOIN contribution_versions v ON v.id = s.source_version_id
     WHERE s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
       AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND c.visibility = 'community_proposed'
       AND EXISTS (
         SELECT 1 FROM consents co
         WHERE co.contribution_id = c.id AND co.version = v.version
           AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
       )
     ORDER BY s.published_at DESC, s.id DESC
     LIMIT 100`,
  );
}

export async function getApprovedCopy(sharedCopyId: string, sandboxOrgId?: string) {
  return queryOne<{ id: string; reviewed_payload: Record<string, unknown>; evidence_quality: 'weak' | 'moderate' | 'strong' | null; published_at: Date }>(
    `SELECT s.id, s.reviewed_payload, s.evidence_quality, s.published_at
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id
     JOIN organizations o ON o.id = c.org_id
     JOIN contribution_versions v ON v.id = s.source_version_id
     WHERE s.id = $1 AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
       AND (($2::uuid IS NULL AND o.is_sandbox = false) OR ($2::uuid IS NOT NULL AND o.is_sandbox = true AND c.org_id = $2))
       AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND c.visibility = 'community_proposed'
       AND EXISTS (
         SELECT 1 FROM consents co
         WHERE co.contribution_id = c.id AND co.version = v.version
           AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
       )`,
    [sharedCopyId, sandboxOrgId ?? null],
  );
}

export async function getActiveApprovedCopiesByIds(ids: string[], sandboxOrgId?: string) {
  if (ids.length === 0) return [];
  return query<{ id: string; reviewed_payload: Record<string, unknown>; published_at: Date }>(
    `SELECT s.id, s.reviewed_payload, s.published_at
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id
     JOIN organizations o ON o.id = c.org_id
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE s.id = ANY($1::uuid[]) AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
       AND (($2::uuid IS NULL AND o.is_sandbox = false) OR ($2::uuid IS NOT NULL AND o.is_sandbox = true AND c.org_id = $2))
       AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND c.visibility = 'community_proposed'`,
    [ids, sandboxOrgId ?? null],
  );
}

export async function listVisibleThemes(sandboxOrgId?: string) {
  return query(
    `SELECT t.id, t.title, t.offering, t.topic, t.period_start, t.period_end,
            t.status, t.safe_summary, count(DISTINCT c.org_id)::int AS distinct_org_count,
            max(s.published_at) AS updated_at
     FROM themes t
     JOIN theme_evidence te ON te.theme_id = t.id
     JOIN shared_copies s ON s.id = te.shared_copy_id AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     JOIN organizations o ON o.id = c.org_id
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE t.status IN ('emerging', 'active')
       AND (($1::uuid IS NULL AND o.is_sandbox = false)
         OR ($1::uuid IS NOT NULL AND o.is_sandbox = true AND c.org_id = $1))
     GROUP BY t.id
     HAVING count(DISTINCT c.org_id) >= CASE WHEN $1::uuid IS NULL THEN $2 ELSE 1 END
     ORDER BY max(s.published_at) DESC, t.id
     LIMIT 100`,
    [sandboxOrgId ?? null, MIN_DISTINCT_ORGS],
  );
}

export async function listProductOwnerThemePriorities(themeIds: string[], sandboxOrgId?: string) {
  if (themeIds.length === 0) return [];
  return query<{ id: string; review_priority: 'monitor' | 'evidence_review' | 'candidate_review' }>(
    `SELECT t.id, t.review_priority
     FROM themes t
     JOIN theme_evidence te ON te.theme_id = t.id
     JOIN shared_copies s ON s.id = te.shared_copy_id AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     JOIN organizations o ON o.id = c.org_id
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE t.id = ANY($1::uuid[]) AND t.status IN ('emerging', 'active')
       AND (($2::uuid IS NULL AND o.is_sandbox = false)
         OR ($2::uuid IS NOT NULL AND o.is_sandbox = true AND c.org_id = $2))
     GROUP BY t.id
     HAVING count(DISTINCT c.org_id) >= CASE WHEN $2::uuid IS NULL THEN $3 ELSE 1 END`,
    [themeIds, sandboxOrgId ?? null, MIN_DISTINCT_ORGS],
  );
}

export async function getVisibleTheme(themeId: string, sandboxOrgId?: string) {
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
     JOIN shared_copies s ON s.id = te.shared_copy_id AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     JOIN organizations o ON o.id = c.org_id
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE t.id = $1 AND t.status IN ('emerging', 'active')
       AND (($2::uuid IS NULL AND o.is_sandbox = false)
         OR ($2::uuid IS NOT NULL AND o.is_sandbox = true AND c.org_id = $2))
     GROUP BY t.id
     HAVING count(DISTINCT c.org_id) >= CASE WHEN $2::uuid IS NULL THEN $3 ELSE 1 END`,
    [themeId, sandboxOrgId ?? null, MIN_DISTINCT_ORGS],
  );
  if (!theme) return null;

  const evidence = await query<{ id: string; contribution_id: string; reviewed_payload: Record<string, unknown>; published_at: Date }>(
    `SELECT s.id, c.id AS contribution_id, s.reviewed_payload, s.published_at
     FROM theme_evidence te
     JOIN shared_copies s ON s.id = te.shared_copy_id AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     JOIN organizations o ON o.id = c.org_id
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE te.theme_id = $1
       AND (($2::uuid IS NULL AND o.is_sandbox = false)
         OR ($2::uuid IS NOT NULL AND o.is_sandbox = true AND c.org_id = $2))
     ORDER BY s.published_at DESC, s.id
     LIMIT 100`,
    [themeId, sandboxOrgId ?? null],
  );
  return {
    ...theme,
    sample_note: sandboxOrgId
      ? 'Synthetic evidence from the shared demo workspace. This walkthrough is not cross-organisation evidence or a claim about market prevalence.'
      : 'Evidence is based on approved shared contributions and may not represent the broader market.',
    evidence: evidence.map((item) => ({
      id: item.id,
      contribution_id: item.contribution_id,
      ...item.reviewed_payload,
      published_at: item.published_at,
    }) as { id: string; title?: unknown; observation_type?: unknown; confidence?: unknown; published_at: Date; [key: string]: unknown }),
  };
}
