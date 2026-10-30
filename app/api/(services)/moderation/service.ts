import 'server-only';

import type { ModerationDecisionInput } from '@/app/(common-lib)/types/schemas';
import { query, queryOne, transaction } from '@/app/api/(db)/client';
import type { Contribution, ContributionVersion } from '@/app/(common-lib)/types';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

async function requireActiveModerator(tx: TxQuery, moderatorId: string, orgId: string) {
  const grant = await tx<{ id: string }>(
    `SELECT id FROM role_grants
     WHERE user_id = $1 AND role = 'learning_moderator'
       AND (org_id = $2 OR org_id IS NULL)
       AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())
     ORDER BY (org_id IS NULL), id
     LIMIT 1 FOR SHARE`,
    [moderatorId, orgId],
  );
  if (!grant[0]) throw new Error('Learning moderator grant is no longer active');
}

async function audit(
  tx: TxQuery,
  actorId: string,
  action: string,
  contributionId: string,
  orgId: string,
  requestId: string,
  metadata: Record<string, unknown>,
) {
  await tx(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
     VALUES ($1, $2, 'contribution', $3, $4, $5, 'allowed', $6::jsonb)`,
    [actorId, action, contributionId, orgId, requestId, JSON.stringify(metadata)],
  );
}

// Audit actions are verbs; notification events are what the author sees, so they use the labelled past-tense names.
const AUTHOR_EVENT: Record<string, string> = {
  'contribution.clarify': 'contribution.needs_clarification',
  'contribution.reject': 'contribution.rejected',
  'contribution.approve': 'contribution.approved',
  'contribution.publish': 'contribution.published',
  'contribution.suspend': 'contribution.suspended',
  'contribution.reinstate': 'contribution.reinstated',
};

async function notifyAuthor(tx: TxQuery, authorId: string, action: string, contributionId: string, state: string, reasonCode: string) {
  const event = AUTHOR_EVENT[action] ?? action;
  await tx(
    `INSERT INTO notifications (recipient_user_id, event, safe_payload)
     VALUES ($1, $2, $3::jsonb)`,
    [authorId, event, JSON.stringify({ contribution_id: contributionId, state, reason_code: reasonCode })],
  );
}

export async function getModerationQueue(orgId?: string) {
  return query<{
    id: string; org_id: string; org_name: string; visibility: string; state: string;
    current_version_id: string; version: number; source_payload: Record<string, unknown>;
    author_name: string; created_at: Date; updated_at: Date;
  }>(
    `SELECT c.id, c.org_id, o.name AS org_name, c.visibility, c.state, u.display_name AS author_name,
            c.current_version_id, v.version, v.source_payload, c.created_at, c.updated_at
     FROM contributions c
     JOIN organizations o ON o.id = c.org_id
     JOIN users u ON u.id = c.author_user_id
     JOIN contribution_versions v ON v.id = c.current_version_id
       WHERE c.state IN ('submitted', 'needs_clarification') AND c.withdrawn_at IS NULL
       AND (($1::uuid IS NULL AND NOT EXISTS (SELECT 1 FROM organizations so WHERE so.id = c.org_id AND so.is_sandbox)) OR c.org_id = $1)
     ORDER BY c.created_at, c.id
     LIMIT 100`,
    [orgId ?? null],
  );
}

export function detectPotentialSensitiveContent(payload: Record<string, unknown>): string[] {
  const strings: string[] = [];
  const collect = (value: unknown, depth = 0) => {
    if (typeof value === 'string') strings.push(value);
    else if (depth < 4 && Array.isArray(value)) value.forEach((item) => collect(item, depth + 1));
    else if (depth < 4 && value && typeof value === 'object') Object.values(value).forEach((item) => collect(item, depth + 1));
  };
  Object.values(payload).forEach((value) => collect(value));
  const text = strings.join('\n');
  const flags: string[] = [];
  if (/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(text)) flags.push('Possible email address');
  if (/\b(?:\d[ -]*?){13,19}\b/.test(text)) flags.push('Possible payment or account number');
  if (/\b[A-Z]{2}\d{2}(?:[ ]?[A-Z0-9]){11,30}\b/i.test(text)) flags.push('Possible IBAN');
  if (/\b(?:password|passcode|api[_ -]?key|secret|credential)\s*[:=]\s*\S+/i.test(text)) flags.push('Possible credential');
  if (/\b(?:account|customer|phone|mobile)\s*(?:number|no\.?|#)?\s*[:=]?\s*[+\d][\d ()-]{7,}\b/i.test(text)) flags.push('Possible customer or phone identifier');
  return flags;
}

const MONTH = '(?:jan|feb|mar|apr|may|jun|jul|aug|sep|sept|oct|nov|dec)[a-z]*';

/**
 * Stricter checks for human review of shared copies: everything in detectPotentialSensitiveContent plus
 * confidential pricing, exact dates and street-level places, and wording that points at one identifiable organisation.
 * These are prompts for the moderator, not automatic rejections. AIRA keeps the narrower check so ordinary questions are not blocked.
 */
export function detectReviewRisks(payload: Record<string, unknown>): string[] {
  const flags = detectPotentialSensitiveContent(payload);
  const strings: string[] = [];
  const collect = (value: unknown, depth = 0) => {
    if (typeof value === 'string') strings.push(value);
    else if (depth < 4 && Array.isArray(value)) value.forEach((item) => collect(item, depth + 1));
    else if (depth < 4 && value && typeof value === 'object') Object.values(value).forEach((item) => collect(item, depth + 1));
  };
  Object.values(payload).forEach((value) => collect(value));
  const text = strings.join('\n');
  if (/(?:[$€£₹]|\b(?:USD|EUR|GBP|INR|AED|SAR)\b)\s?\d|\b\d[\d,.]*\s?(?:USD|EUR|GBP|INR|AED|SAR)\b/i.test(text)
    || /\b(?:pric(?:e|es|ing)|fees?|discount|rebate|contract (?:value|sum)|licen[cs]e (?:cost|fee))\b[^.\n]{0,40}\d/i.test(text)) {
    flags.push('Possible confidential pricing or financial figure');
  }
  if (new RegExp(`\\b\\d{4}-\\d{2}-\\d{2}\\b|\\b\\d{1,2}[/.-]\\d{1,2}[/.-]\\d{2,4}\\b|\\b\\d{1,2}(?:st|nd|rd|th)?\\s+${MONTH}\\s+\\d{4}\\b|\\b${MONTH}\\s+\\d{1,2}(?:st|nd|rd|th)?,?\\s+\\d{4}\\b`, 'i').test(text)) {
    flags.push('Exact date; generalise to a month or period');
  }
  if (/\b\d{1,5}\s+[A-Z][\w'-]+(?:\s+[A-Z][\w'-]+)?\s+(?:Street|St|Road|Rd|Avenue|Ave|Lane|Ln|Boulevard|Blvd|Drive|Dr)\b/.test(text)) {
    flags.push('Street-level location; generalise to a region');
  }
  if (/\b(?:our|the|an?)\s+(?:only|sole|single|largest|smallest|first)\s+(?:\w+\s+)?(?:client|customer|bank|lender|insurer|branch|institution|borrower|subsidiary)\b|\bone of (?:only )?(?:two|three|the only)\b/i.test(text)) {
    flags.push('Possible rare or identifying observation; a removed name alone may not make it anonymous');
  }
  return flags;
}

export async function getModerationOverview(orgId?: string) {
  const [queueRows, counts] = await Promise.all([
    query<{
      id: string; org_id: string; org_name: string; visibility: string; state: string;
      current_version_id: string; version: number; source_payload: Record<string, unknown>;
      author_name: string; created_at: Date; updated_at: Date;
    }>(
      `SELECT c.id, c.org_id, o.name AS org_name, c.visibility, c.state, u.display_name AS author_name,
              c.current_version_id, v.version, v.source_payload, c.created_at, c.updated_at
       FROM contributions c JOIN organizations o ON o.id = c.org_id
       JOIN users u ON u.id = c.author_user_id
       JOIN contribution_versions v ON v.id = c.current_version_id
       WHERE c.state IN ('submitted', 'needs_clarification') AND c.withdrawn_at IS NULL
         AND (($1::uuid IS NULL AND NOT EXISTS (SELECT 1 FROM organizations so WHERE so.id = c.org_id AND so.is_sandbox)) OR c.org_id = $1)
       ORDER BY c.created_at, c.id LIMIT 3`,
      [orgId ?? null],
    ),
    queryOne<{ awaiting_review: number; flagged_sensitive: number; open_reports: number }>(
      `SELECT
         (SELECT count(*)::int FROM contributions c
          WHERE c.state IN ('submitted', 'needs_clarification') AND c.withdrawn_at IS NULL
            AND (($1::uuid IS NULL AND NOT EXISTS (SELECT 1 FROM organizations so WHERE so.id = c.org_id AND so.is_sandbox)) OR c.org_id = $1)) AS awaiting_review,
         (SELECT count(*)::int FROM contributions c
          JOIN contribution_versions v ON v.id = c.current_version_id
          WHERE c.state IN ('submitted', 'needs_clarification') AND c.withdrawn_at IS NULL
            AND (($1::uuid IS NULL AND NOT EXISTS (SELECT 1 FROM organizations so WHERE so.id = c.org_id AND so.is_sandbox)) OR c.org_id = $1)
            AND (v.source_payload::text ~* '[A-Z0-9._%+-]+@[A-Z0-9.-]+\\.[A-Z]{2,}'
              OR v.source_payload::text ~ '([0-9][ -]?){13,19}'
              OR v.source_payload::text ~* '[A-Z]{2}[0-9]{2}([ ]?[A-Z0-9]){11,30}'
              OR v.source_payload::text ~* '(account|customer|phone|mobile)[[:space:]_#-]*(number|no)?[[:space:]:=+()-]*[0-9][0-9 ()-]{7,}'
              OR v.source_payload::text ~* '(password|passcode|api[_ -]?key|secret|credential)[[:space:]]*[:=][[:space:]]*[^",} ]+')
         ) AS flagged_sensitive,
         (SELECT count(*)::int FROM reports r
          JOIN shared_copies s ON s.id = r.shared_copy_id
          JOIN contributions c ON c.id = s.contribution_id
          WHERE r.status IN ('open', 'investigating') AND (($1::uuid IS NULL AND NOT EXISTS (SELECT 1 FROM organizations so WHERE so.id = c.org_id AND so.is_sandbox)) OR c.org_id = $1)) AS open_reports`,
      [orgId ?? null],
    ),
  ]);
  return {
    awaiting_review: counts?.awaiting_review ?? 0,
    flagged_sensitive: counts?.flagged_sensitive ?? 0,
    open_reports: counts?.open_reports ?? 0,
    queue: queueRows,
  };
}

export async function listModerationAudit(orgId?: string) {
  return query<{
    id: string; actor: string | null; org_name: string | null; action: string;
    target_type: string; target_id: string; request_id: string; created_at: Date;
  }>(
    `SELECT a.id, u.display_name AS actor, o.name AS org_name, a.action,
            a.target_type, a.target_id, a.request_id, a.created_at
     FROM audit_log a
     LEFT JOIN users u ON u.id = a.actor_id
     LEFT JOIN organizations o ON o.id = a.active_org_id
     WHERE a.action IN ('contribution.clarify', 'contribution.reject', 'contribution.approve',
                        'contribution.publish', 'contribution.suspend', 'contribution.reinstate',
                        'report.status_update')
       AND ($1::uuid IS NULL OR a.active_org_id = $1)
     ORDER BY a.created_at DESC, a.id DESC
     LIMIT 200`,
    [orgId ?? null],
  );
}

export async function getModerationReports(orgId?: string) {
  return query<{
    id: string; contribution_id: string; shared_copy_id: string; title: string;
    category: string; details: string; status: string; created_at: Date;
  }>(
    `SELECT r.id, s.contribution_id, s.id AS shared_copy_id,
            s.reviewed_payload->>'title' AS title, r.category, r.details, r.status, r.created_at
     FROM reports r
     JOIN shared_copies s ON s.id = r.shared_copy_id
     JOIN contributions c ON c.id = s.contribution_id
     WHERE (($1::uuid IS NULL AND NOT EXISTS (SELECT 1 FROM organizations so WHERE so.id = c.org_id AND so.is_sandbox)) OR c.org_id = $1)
     ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'investigating' THEN 1 ELSE 2 END,
              r.created_at DESC, r.id DESC
     LIMIT 200`,
    [orgId ?? null],
  );
}

export async function getModerationReportScope(reportId: string) {
  const rows = await query<{ id: string; contribution_id: string; org_id: string }>(
    `SELECT r.id, s.contribution_id, c.org_id
     FROM reports r JOIN shared_copies s ON s.id = r.shared_copy_id
     JOIN contributions c ON c.id = s.contribution_id
     WHERE r.id = $1`,
    [reportId],
  );
  return rows[0] ?? null;
}

export async function updateModerationReportStatus(
  reportId: string,
  moderatorId: string,
  orgId: string,
  status: 'investigating' | 'resolved',
  requestId: string,
) {
  return transaction(async (tx) => {
    await requireActiveModerator(tx, moderatorId, orgId);
    const found = await tx<{
      status: string; contribution_id: string; shared_copy_id: string; author_user_id: string;
      current_version_id: string; contribution_state: string;
    }>(
      `SELECT r.status, s.contribution_id, s.id AS shared_copy_id, c.author_user_id,
              c.current_version_id, c.state AS contribution_state
       FROM reports r JOIN shared_copies s ON s.id = r.shared_copy_id
       JOIN contributions c ON c.id = s.contribution_id
       WHERE r.id = $1 AND c.org_id = $2 FOR UPDATE OF r`,
      [reportId, orgId],
    );
    const report = found[0];
    if (!report) throw new Error('Report not found');
    const allowed = report.status === 'open'
      ? ['investigating', 'resolved']
      : report.status === 'investigating' ? ['resolved'] : [];
    if (!allowed.includes(status)) throw new Error('Report status transition is not allowed');
    await tx('UPDATE reports SET status = $1 WHERE id = $2', [status, reportId]);
    if (status === 'investigating' && report.contribution_state === 'published') {
      await tx(
        `UPDATE shared_copies SET status = 'suspended', invalidated_at = now()
         WHERE contribution_id = $1 AND status = 'active'`,
        [report.contribution_id],
      );
      await tx(
        `DELETE FROM shared_copy_embeddings e USING shared_copies s
         WHERE e.shared_copy_id = s.id AND s.contribution_id = $1`,
        [report.contribution_id],
      );
      await tx(
        `DELETE FROM shared_copy_embedding_jobs j USING shared_copies s
         WHERE j.shared_copy_id = s.id AND s.contribution_id = $1`,
        [report.contribution_id],
      );
      await tx('UPDATE contributions SET state = \'suspended\', updated_at = now() WHERE id = $1', [report.contribution_id]);
      await tx(
        `INSERT INTO moderation_decisions
           (contribution_id, version_id, moderator_id, action, reason_code, decision_note)
         VALUES ($1, $2, $3, 'suspend', 'report_investigation', 'Temporarily unpublished while the associated report is investigated.')`,
        [report.contribution_id, report.current_version_id, moderatorId],
      );
      await notifyAuthor(tx, report.author_user_id, 'contribution.suspend', report.contribution_id, 'suspended', 'report_investigation');
      await audit(tx, moderatorId, 'contribution.suspend', report.contribution_id, orgId, requestId, {
        reason_code: 'report_investigation', report_id: reportId, shared_copy_id: report.shared_copy_id,
      });
    } else {
      await tx(
        `INSERT INTO notifications (recipient_user_id, event, safe_payload)
         VALUES ($1, 'report.status_updated', $2::jsonb)`,
        [report.author_user_id, JSON.stringify({
          report_id: reportId,
          contribution_id: report.contribution_id,
          status,
          message: status === 'resolved'
            ? 'The report investigation is resolved. A suspended shared contribution requires a moderator decision before it can be republished.'
            : 'A report about your shared contribution is being investigated.',
        })],
      );
    }
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'report.status_update', 'report', $2, $3, $4, 'allowed', $5::jsonb)`,
      [moderatorId, reportId, orgId, requestId, JSON.stringify({ from_status: report.status, to_status: status, contribution_id: report.contribution_id })],
    );
    return { id: reportId, status };
  });
}

export async function getModerationContribution(contributionId: string) {
  return query<{
    id: string; org_id: string; org_name: string; author_name: string; visibility: string;
    state: string; version: number; source_payload: Record<string, unknown>; decision_note: string | null; created_at: Date;
  }>(
    `SELECT c.id, c.org_id, o.name AS org_name, u.display_name AS author_name,
            c.visibility, c.state, v.version,
            COALESCE((
              SELECT d.redactions FROM moderation_decisions d
              WHERE d.contribution_id = c.id AND d.version_id = v.id
                AND d.action IN ('approve', 'publish') AND d.redactions IS NOT NULL
              ORDER BY d.created_at DESC, d.id DESC LIMIT 1
            ), v.source_payload) AS source_payload,
            (SELECT d.decision_note FROM moderation_decisions d
             WHERE d.contribution_id = c.id AND d.action = 'clarify'
             ORDER BY d.created_at DESC, d.id DESC LIMIT 1) AS decision_note,
            c.created_at
     FROM contributions c
     JOIN organizations o ON o.id = c.org_id
     JOIN users u ON u.id = c.author_user_id
     JOIN contribution_versions v ON v.id = c.current_version_id
     WHERE c.id = $1 AND c.withdrawn_at IS NULL
       AND c.state IN ('submitted', 'needs_clarification', 'approved', 'published', 'suspended')`,
    [contributionId],
  ).then((rows) => rows[0] ?? null);
}

export async function findPotentialSharedDuplicates(input: {
  orgId: string; payload: Record<string, unknown>;
}) {
  const queryText = [input.payload.title, input.payload.body, input.payload.offering]
    .filter((value): value is string => typeof value === 'string')
    .join(' ')
    .trim()
    .slice(0, 1200);
  if (queryText.length < 12) return [];
  return query<{
    id: string; title: string; body_excerpt: string; offering: string | null;
    published_at: Date; relevance: number;
  }>(
    `WITH query AS (SELECT plainto_tsquery('english', $2) AS terms)
     SELECT s.id, s.reviewed_payload->>'title' AS title,
            left(s.reviewed_payload->>'body', 320) AS body_excerpt,
            NULLIF(s.reviewed_payload->>'offering', '') AS offering,
            s.published_at, ts_rank(
              to_tsvector('english', coalesce(s.reviewed_payload->>'title', '') || ' ' || coalesce(s.reviewed_payload->>'body', '')),
              query.terms
            )::float8 AS relevance
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id
     JOIN organizations source_org ON source_org.id = c.org_id
     JOIN organizations workspace ON workspace.id = $1
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     CROSS JOIN query
     WHERE s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
       AND c.state = 'published' AND c.withdrawn_at IS NULL
       AND ((workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $1)
         OR (workspace.is_sandbox = false AND source_org.is_sandbox = false AND c.org_id <> $1))
       AND c.visibility = 'community_proposed'
       AND to_tsvector('english', coalesce(s.reviewed_payload->>'title', '') || ' ' || coalesce(s.reviewed_payload->>'body', '')) @@ query.terms
     ORDER BY relevance DESC, s.published_at DESC, s.id
     LIMIT 5`,
    [input.orgId, queryText],
  );
}

export async function applyModerationDecision(
  contributionId: string,
  moderatorId: string,
  orgId: string,
  input: ModerationDecisionInput,
  requestId: string,
) {
  return transaction(async (tx) => {
    await requireActiveModerator(tx, moderatorId, orgId);
    const found = await tx<Contribution>(
      `SELECT * FROM contributions WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [contributionId, orgId],
    );
    const contribution = found[0];
    if (!contribution || contribution.withdrawn_at) throw new Error('Contribution not found');
    const versionRows = await tx<ContributionVersion>(
      `SELECT * FROM contribution_versions WHERE id = $1 AND contribution_id = $2`,
      [contribution.current_version_id, contributionId],
    );
    const version = versionRows[0];
    if (!version) throw new Error('Contribution version not found');

    const allowedStates: Record<ModerationDecisionInput['action'], string[]> = {
      clarify: ['submitted'],
      reject: ['submitted', 'approved'],
      approve: ['submitted'],
      publish: ['approved'],
      suspend: ['published'],
      reinstate: ['suspended'],
    };
    if (!allowedStates[input.action].includes(contribution.state)) {
      throw new Error('Decision is not allowed for the current contribution state');
    }
    if (input.action === 'clarify' && !input.clarification_message?.trim()) {
      throw new Error('A clarification request is required');
    }

    // A duplicate rejection must point at an active shared copy of another contribution. The reference is checked here, inside the transaction, never trusted from the client.
    const isDuplicateRejection = input.action === 'reject' && input.reason_code === 'duplicate';
    if (input.duplicate_of_shared_copy_id !== undefined && !isDuplicateRejection) {
      throw new Error('Duplicate reference is only accepted when rejecting as a duplicate');
    }
    let duplicateOfSharedCopyId: string | null = null;
    if (isDuplicateRejection) {
      if (!input.duplicate_of_shared_copy_id) throw new Error('Duplicate reference is required when rejecting as a duplicate');
      const copies = await tx<{ id: string }>(
        `SELECT id FROM shared_copies
         WHERE id = $1 AND status = 'active' AND contribution_id <> $2`,
        [input.duplicate_of_shared_copy_id, contributionId],
      );
      if (!copies[0]) throw new Error('Duplicate reference must be an active shared copy');
      duplicateOfSharedCopyId = copies[0].id;
    }

    if (input.action === 'publish' && contribution.visibility !== 'community_proposed') {
      throw new Error('Only community-proposed contributions can be published');
    }
    let semanticAnalysisConsent = false;
    if (input.action === 'publish' || (input.action === 'approve' && contribution.visibility === 'community_proposed')) {
      if (input.action === 'publish' && !input.redacted_payload) throw new Error('Reviewed copy is required');
      const consentRows = await tx<{ purpose: string; choice: boolean }>(
        `SELECT purpose, choice FROM consents WHERE contribution_id = $1 AND version = $2 AND revoked_at IS NULL`,
        [contributionId, version.version],
      );
      const consent = new Map(consentRows.map((row) => [row.purpose, row.choice]));
      semanticAnalysisConsent = consent.get('semantic_analysis') === true;
      if (!consent.get('store_process')) throw new Error('Storage and processing consent is not active for this version');
      if (input.action === 'publish' && !consent.get('publish_reviewed')) {
        throw new Error('Publishing consent is not active for this version');
      }
      if (input.attribution_consent && (!consent.get('attribute') || !input.redacted_payload?.attribution_label)) {
        throw new Error('Attribution requires explicit contributor consent and a reviewed label');
      }
      if (!input.attribution_consent && input.redacted_payload?.attribution_label) {
        throw new Error('Attribution label supplied without explicit approval');
      }
    } else if (input.action === 'approve') {
      const stored = await tx<{ choice: boolean }>(
        `SELECT choice FROM consents WHERE contribution_id = $1 AND version = $2 AND purpose = 'store_process' AND revoked_at IS NULL`,
        [contributionId, version.version],
      );
      if (!stored[0]?.choice) throw new Error('Storage and processing consent is not active for this version');
    }

    const nextState: Record<ModerationDecisionInput['action'], string> = {
      clarify: 'needs_clarification',
      reject: 'rejected',
      approve: 'approved',
      publish: 'published',
      suspend: 'suspended',
      reinstate: 'published',
    };
    await tx(
      `INSERT INTO moderation_decisions (contribution_id, version_id, moderator_id, action, reason_code, decision_note, redactions, evidence_quality)
       VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb, $8)`,
      [contributionId, version.id, moderatorId, input.action, input.reason_code,
        input.action === 'clarify' ? input.clarification_message?.trim() : duplicateOfSharedCopyId,
        input.redacted_payload ? JSON.stringify(input.redacted_payload) : null,
        input.action === 'publish' ? input.evidence_quality : null],
    );

    if (input.action === 'publish') {
      const safePayload = { ...input.redacted_payload };
      if (!input.attribution_consent) delete safePayload.attribution_label;
      const existing = await tx<{ id: string }>(
        `SELECT id FROM shared_copies WHERE source_version_id = $1 FOR UPDATE`,
        [version.id],
      );
      if (existing[0]) {
        await tx(
          `UPDATE shared_copies SET reviewed_payload = $1::jsonb, deidentified = $2,
                  attribution_consent = $3, evidence_quality = $4, status = 'active', published_at = now(), invalidated_at = NULL
           WHERE id = $5`,
          [JSON.stringify(safePayload), !input.attribution_consent, input.attribution_consent, input.evidence_quality, existing[0].id],
        );
      } else {
        await tx(
          `INSERT INTO shared_copies (contribution_id, source_version_id, reviewed_payload, deidentified, attribution_consent, evidence_quality, status)
           VALUES ($1, $2, $3::jsonb, $4, $5, $6, 'active')`,
          [contributionId, version.id, JSON.stringify(safePayload), !input.attribution_consent, input.attribution_consent, input.evidence_quality],
        );
      }
      const publishedCopy = existing[0]
        ? existing[0]
        : (await tx<{ id: string }>(
            `SELECT id FROM shared_copies WHERE source_version_id = $1`, [version.id],
          ))[0];
      if (!publishedCopy) throw new Error('Published copy was not created');
      if (semanticAnalysisConsent) {
        await tx(
          `INSERT INTO shared_copy_embedding_jobs (shared_copy_id, status, attempts, next_attempt_at, locked_at, last_error_code, updated_at)
           VALUES ($1, 'queued', 0, now(), NULL, NULL, now())
           ON CONFLICT (shared_copy_id) DO UPDATE SET status = 'queued', attempts = 0,
             next_attempt_at = now(), locked_at = NULL, last_error_code = NULL, updated_at = now()`,
          [publishedCopy.id],
        );
      } else {
        await tx('DELETE FROM shared_copy_embeddings WHERE shared_copy_id = $1', [publishedCopy.id]);
        await tx('DELETE FROM shared_copy_embedding_jobs WHERE shared_copy_id = $1', [publishedCopy.id]);
      }
    }

    if (input.action === 'suspend') {
      await tx(
        `UPDATE shared_copies SET status = 'suspended', invalidated_at = now()
         WHERE contribution_id = $1 AND status = 'active'`,
        [contributionId],
      );
      await tx(
        `DELETE FROM shared_copy_embeddings e USING shared_copies s
         WHERE e.shared_copy_id = s.id AND s.contribution_id = $1`,
        [contributionId],
      );
      await tx(
        `DELETE FROM shared_copy_embedding_jobs j USING shared_copies s
         WHERE j.shared_copy_id = s.id AND s.contribution_id = $1`,
        [contributionId],
      );
    }
    if (input.action === 'reinstate') {
      const openReports = await tx<{ count: string }>(
        `SELECT count(*)::text AS count FROM reports r
         JOIN shared_copies s ON s.id = r.shared_copy_id
         WHERE s.contribution_id = $1 AND r.status <> 'resolved'`,
        [contributionId],
      );
      if (Number(openReports[0]?.count ?? '0') > 0) throw new Error('Resolve open reports before reinstating the contribution');
      await tx(
        `UPDATE shared_copies SET status = 'active', invalidated_at = NULL
         WHERE contribution_id = $1 AND status = 'suspended'`,
        [contributionId],
      );
    }

    await tx('UPDATE contributions SET state = $1, updated_at = now() WHERE id = $2', [nextState[input.action], contributionId]);
    await notifyAuthor(tx, contribution.author_user_id, `contribution.${input.action}`, contributionId, nextState[input.action], input.reason_code);
    await audit(tx, moderatorId, `contribution.${input.action}`, contributionId, orgId, requestId, {
      version_id: version.id,
      reason_code: input.reason_code,
      deidentified: input.action === 'publish' ? !input.attribution_consent : undefined,
      attributed: input.action === 'publish' && input.attribution_consent,
      evidence_quality: input.action === 'publish' ? input.evidence_quality : undefined,
      duplicate_of_shared_copy_id: duplicateOfSharedCopyId ?? undefined,
    });
    return { id: contributionId, state: nextState[input.action] };
  });
}
