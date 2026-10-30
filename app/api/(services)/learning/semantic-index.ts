import 'server-only';

import OpenAI from 'openai';
import { randomUUID } from 'node:crypto';
import { detectPotentialSensitiveContent } from '@/app/api/(services)/moderation/service';
import { query, queryOne, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];
const MAX_ATTEMPTS = 8;

function embeddingProvider() {
  const apiKey = process.env.AI_API_KEY;
  const model = process.env.AI_EMBEDDING_MODEL?.trim();
  if (!apiKey || !model) return null;
  return {
    model,
    client: new OpenAI({
      apiKey,
      baseURL: process.env.AI_BASE_URL || undefined,
      timeout: 15_000,
      maxRetries: 0,
    }),
  };
}

async function failJob(jobId: string, attempts: number, errorCode: string) {
  await query(
    `UPDATE shared_copy_embedding_jobs
     SET status = CASE WHEN $2 >= $3 THEN 'failed' ELSE 'queued' END,
         locked_at = NULL, last_error_code = $4,
         next_attempt_at = now() + (LEAST(60, power(2, LEAST($2, 6))::int)::text || ' minutes')::interval,
         updated_at = now()
     WHERE id = $1 AND status = 'processing'`,
    [jobId, attempts, MAX_ATTEMPTS, errorCode],
  );
}

async function processJob(jobId: string, model: string, client: OpenAI) {
  const claimed = await transaction(async (tx) => {
    const rows = await tx<{ id: string; shared_copy_id: string; attempts: number }>(
      `UPDATE shared_copy_embedding_jobs SET status = 'processing', attempts = attempts + 1,
         locked_at = now(), updated_at = now()
       WHERE id = $1 AND attempts < $2 AND next_attempt_at <= now()
         AND (status = 'queued' OR (status = 'processing' AND locked_at < now() - interval '15 minutes'))
       RETURNING id, shared_copy_id, attempts`,
      [jobId, MAX_ATTEMPTS],
    );
    return rows[0] ?? null;
  });
  if (!claimed) return 'skipped' as const;

  const source = await queryOne<{ id: string; title: string; body: string }>(
    `SELECT s.id, s.reviewed_payload->>'title' AS title, s.reviewed_payload->>'body' AS body
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents publish ON publish.contribution_id = c.id AND publish.version = v.version
       AND publish.purpose = 'publish_reviewed' AND publish.choice = true AND publish.revoked_at IS NULL
     JOIN consents semantic ON semantic.contribution_id = c.id AND semantic.version = v.version
       AND semantic.purpose = 'semantic_analysis' AND semantic.choice = true AND semantic.revoked_at IS NULL
     WHERE s.id = $1 AND s.status = 'active' AND c.visibility = 'community_proposed'
       AND (s.deidentified = true OR s.attribution_consent = true)`,
    [claimed.shared_copy_id],
  );
  if (!source) {
    await transaction(async (tx) => {
      await tx('DELETE FROM shared_copy_embeddings WHERE shared_copy_id = $1', [claimed.shared_copy_id]);
      await tx('DELETE FROM shared_copy_embedding_jobs WHERE id = $1', [claimed.id]);
    });
    return 'skipped' as const;
  }

  const content = { title: source.title ?? '', body: source.body ?? '' };
  if (detectPotentialSensitiveContent(content).length > 0) {
    await failJob(claimed.id, claimed.attempts, 'sensitive_reviewed_copy_blocked');
    return 'failed' as const;
  }
  const text = `${content.title}\n\n${content.body}`.trim();
  if (text.length < 10) {
    await failJob(claimed.id, claimed.attempts, 'reviewed_copy_too_short');
    return 'failed' as const;
  }

  try {
    const response = await client.embeddings.create({ input: text, model, encoding_format: 'float' });
    const vector = response.data[0]?.embedding;
    if (!vector || vector.length < 16 || vector.length > 8192 || !vector.every(Number.isFinite)) {
      await failJob(claimed.id, claimed.attempts, 'invalid_embedding_response');
      return 'failed' as const;
    }

    const stored = await transaction(async (tx) => {
      const stillAllowed = await tx<{ id: string }>(
        `SELECT j.id FROM shared_copy_embedding_jobs j
         JOIN shared_copies s ON s.id = j.shared_copy_id AND s.status = 'active'
         JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published' AND c.withdrawn_at IS NULL
         JOIN contribution_versions v ON v.id = s.source_version_id
         JOIN consents publish ON publish.contribution_id = c.id AND publish.version = v.version
           AND publish.purpose = 'publish_reviewed' AND publish.choice = true AND publish.revoked_at IS NULL
         JOIN consents semantic ON semantic.contribution_id = c.id AND semantic.version = v.version
           AND semantic.purpose = 'semantic_analysis' AND semantic.choice = true AND semantic.revoked_at IS NULL
         WHERE j.id = $1 AND j.status = 'processing' AND c.visibility = 'community_proposed'
           AND (s.deidentified = true OR s.attribution_consent = true)
         FOR UPDATE OF j, s`,
        [claimed.id],
      );
      if (!stillAllowed[0]) return false;
      await tx(
        `INSERT INTO shared_copy_embeddings (shared_copy_id, embedding, dims, model)
         VALUES ($1, $2::jsonb, $3, $4)
         ON CONFLICT (shared_copy_id, model) DO UPDATE SET embedding = EXCLUDED.embedding,
           dims = EXCLUDED.dims, created_at = now()`,
        [claimed.shared_copy_id, JSON.stringify(vector), vector.length, model],
      );
      await tx(
        `UPDATE shared_copy_embedding_jobs SET status = 'complete', locked_at = NULL,
           last_error_code = NULL, updated_at = now() WHERE id = $1`, [claimed.id],
      );
      await tx(
        `INSERT INTO audit_log (action, target_type, target_id, request_id, decision, metadata)
         VALUES ('learning.semantic_embedding', 'shared_copy', $1, $2, 'allowed', $3::jsonb)`,
        [claimed.shared_copy_id, `embedding:${claimed.id}:${randomUUID()}`, JSON.stringify({ model, dimensions: vector.length })],
      );
      return true;
    });
    return stored ? 'complete' as const : 'skipped' as const;
  } catch {
    await failJob(claimed.id, claimed.attempts, 'embedding_provider_failed');
    return 'failed' as const;
  }
}

export async function drainSharedCopyEmbeddingJobs(limit = 10) {
  const provider = embeddingProvider();
  if (!provider) return { configured: false, attempted: 0, completed: 0, failed: 0 };
  const due = await query<{ id: string }>(
    `SELECT id FROM shared_copy_embedding_jobs
     WHERE attempts < $1 AND next_attempt_at <= now()
       AND (status = 'queued' OR (status = 'processing' AND locked_at < now() - interval '15 minutes'))
     ORDER BY next_attempt_at, created_at, id LIMIT $2`,
    [MAX_ATTEMPTS, Math.min(Math.max(limit, 1), 25)],
  );
  let completed = 0;
  let failed = 0;
  for (const job of due) {
    const outcome = await processJob(job.id, provider.model, provider.client);
    if (outcome === 'complete') completed += 1;
    if (outcome === 'failed') failed += 1;
  }
  return { configured: true, attempted: due.length, completed, failed };
}

export async function listSemanticEmbeddingJobStatus() {
  return queryOne<{ queued: number; failed: number; complete: number }>(
    `SELECT count(*) FILTER (WHERE status IN ('queued', 'processing'))::int AS queued,
            count(*) FILTER (WHERE status = 'failed')::int AS failed,
            count(*) FILTER (WHERE status = 'complete')::int AS complete
     FROM shared_copy_embedding_jobs`,
  );
}
