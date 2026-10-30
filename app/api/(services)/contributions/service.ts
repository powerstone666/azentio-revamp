import 'server-only';

import type { Contribution, ContributionVersion } from '@/app/(common-lib)/types';
import type { ReportCreateInput } from '@/app/(common-lib)/types/schemas';
import type { ContributionCreateInput } from '@/app/(common-lib)/types/schemas';
import { transaction, query, queryOne } from '@/app/api/(db)/client';

const POLICY_VERSION = 'v1.1';
const CONSENT_PURPOSES = [
  ['store_process', 'consent_store_process'],
  ['publish_reviewed', 'consent_publish_reviewed'],
  ['attribute', 'consent_attribute'],
  ['model_training', 'consent_model_training'],
  ['semantic_analysis', 'consent_semantic_analysis'],
] as const;

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

async function requireActiveMembership(tx: TxQuery, userId: string, orgId: string) {
  const rows = await tx<{ id: string }>(
    `SELECT m.id FROM memberships m
     JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2
       AND m.status = 'active' AND o.status = 'active'
     FOR SHARE OF m`,
    [userId, orgId],
  );
  if (!rows[0]) throw new Error('Workspace membership is no longer active');
}

async function recordConsents(
  tx: TxQuery,
  input: ContributionCreateInput,
  userId: string,
  contributionId: string,
  version: number,
) {
  for (const [purpose, field] of CONSENT_PURPOSES) {
    const choice = input[field];
    await tx(
      `INSERT INTO consents (user_id, contribution_id, version, purpose, choice, policy_version, granted_at)
       VALUES ($1, $2, $3, $4, $5, $6, CASE WHEN $5 THEN now() ELSE NULL END)`,
      [userId, contributionId, version, purpose, choice, POLICY_VERSION],
    );
  }
}

async function recordAudit(
  tx: TxQuery,
  event: { actorId: string; action: string; targetType: string; targetId: string; orgId: string; requestId: string; metadata?: Record<string, unknown> },
) {
  await tx(
    `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, 'allowed', $7::jsonb)`,
    [event.actorId, event.action, event.targetType, event.targetId, event.orgId, event.requestId, JSON.stringify(event.metadata ?? {})],
  );
}

function toPayload(input: ContributionCreateInput) {
  return {
    title: input.title.trim(),
    observation_type: input.observation_type,
    offering: input.offering?.trim() || null,
    industry: input.industry?.trim() || null,
    region: input.region?.trim() || null,
    observation_period_start: input.observation_period_start || null,
    observation_period_end: input.observation_period_end || null,
    evidence_type: input.evidence_type,
    confidence: input.confidence,
    body: input.body.trim(),
  };
}

function validateSharingConsent(input: ContributionCreateInput) {
  if (!input.consent_store_process) throw new Error('Storage and processing consent is required to save a contribution');
  if (input.visibility === 'community_proposed' && !input.consent_publish_reviewed) {
    throw new Error('Community sharing requires consent to publish a reviewed copy');
  }
}

export async function createDraft(
  input: ContributionCreateInput,
  authorId: string,
  orgId: string,
  requestId: string,
): Promise<Contribution> {
  validateSharingConsent(input);
  return transaction(async (tx) => {
    await requireActiveMembership(tx, authorId, orgId);
    const inserted = await tx<Contribution>(
      `INSERT INTO contributions (author_user_id, org_id, visibility, state)
       VALUES ($1, $2, $3, 'private_draft') RETURNING *`,
      [authorId, orgId, input.visibility],
    );
    const contribution = inserted[0];
    const versions = await tx<ContributionVersion>(
      `INSERT INTO contribution_versions (contribution_id, version, source_payload, created_by)
       VALUES ($1, 1, $2::jsonb, $3) RETURNING *`,
      [contribution.id, JSON.stringify(toPayload(input)), authorId],
    );
    await tx('UPDATE contributions SET current_version_id = $1 WHERE id = $2', [versions[0].id, contribution.id]);
    await recordConsents(tx, input, authorId, contribution.id, 1);
    await recordAudit(tx, {
      actorId: authorId,
      action: 'contribution.create_draft',
      targetType: 'contribution',
      targetId: contribution.id,
      orgId,
      requestId,
      metadata: { visibility: input.visibility, version: 1 },
    });
    return { ...contribution, current_version_id: versions[0].id };
  });
}

export async function updateDraft(
  contributionId: string,
  input: ContributionCreateInput,
  authorId: string,
  orgId: string,
  requestId: string,
): Promise<Contribution> {
  validateSharingConsent(input);
  return transaction(async (tx) => {
    await requireActiveMembership(tx, authorId, orgId);
    const found = await tx<Contribution>(
      `SELECT * FROM contributions WHERE id = $1 AND org_id = $2 AND author_user_id = $3 FOR UPDATE`,
      [contributionId, orgId, authorId],
    );
    const contribution = found[0];
    if (!contribution || !['private_draft', 'needs_clarification', 'published'].includes(contribution.state)) {
      throw new Error('Only your draft, returned or published contribution can be edited');
    }
    const wasPublished = contribution.state === 'published';
    const currentVersion = await tx<{ version: number }>(
      'SELECT version FROM contribution_versions WHERE id = $1 AND contribution_id = $2',
      [contribution.current_version_id, contributionId],
    );
    const nextVersion = (currentVersion[0]?.version ?? 0) + 1;
    const created = await tx<ContributionVersion>(
      `INSERT INTO contribution_versions (contribution_id, version, source_payload, created_by, parent_version_id)
       VALUES ($1, $2, $3::jsonb, $4, $5) RETURNING *`,
      [contributionId, nextVersion, JSON.stringify(toPayload(input)), authorId, contribution.current_version_id],
    );
    await tx(
      `UPDATE contributions SET visibility = $1, current_version_id = $2,
         state = CASE WHEN $3::boolean THEN 'submitted' ELSE state END, updated_at = now()
       WHERE id = $4`,
      [input.visibility, created[0].id, wasPublished, contributionId],
    );
    if (wasPublished) {
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
      await tx(
        `INSERT INTO notifications (recipient_user_id, event, safe_payload)
         VALUES ($1, 'contribution.revision_submitted', $2::jsonb)`,
        [authorId, JSON.stringify({ contribution_id: contributionId, message: 'Your edited published version is back in review. The previous shared copy is no longer available while this version is reviewed.' })],
      );
    }
    await recordConsents(tx, input, authorId, contributionId, nextVersion);
    await recordAudit(tx, {
      actorId: authorId,
      action: wasPublished ? 'contribution.revision_submit' : 'contribution.edit_draft',
      targetType: 'contribution',
      targetId: contributionId,
      orgId,
      requestId,
      metadata: { version: nextVersion, previous_state: contribution.state, requires_review: wasPublished },
    });
    return {
      ...contribution,
      visibility: input.visibility,
      state: wasPublished ? 'submitted' : contribution.state,
      current_version_id: created[0].id,
      updated_at: new Date(),
    };
  });
}

export async function submitForReview(
  contributionId: string,
  authorId: string,
  orgId: string,
  requestId: string,
): Promise<Contribution> {
  return transaction(async (tx) => {
    await requireActiveMembership(tx, authorId, orgId);
    const found = await tx<Contribution>(
      `SELECT * FROM contributions WHERE id = $1 AND org_id = $2 AND author_user_id = $3 FOR UPDATE`,
      [contributionId, orgId, authorId],
    );
    const contribution = found[0];
    if (!contribution || !['private_draft', 'needs_clarification'].includes(contribution.state)) {
      throw new Error('Only your draft or returned contribution can be submitted');
    }
    const consent = await tx<{ purpose: string; choice: boolean }>(
      `SELECT purpose, choice FROM consents
       WHERE contribution_id = $1 AND version = (
         SELECT version FROM contribution_versions WHERE id = $2
       )`,
      [contributionId, contribution.current_version_id],
    );
    const choices = new Map(consent.map((row) => [row.purpose, row.choice]));
    if (!choices.get('store_process')) throw new Error('Storage and processing consent is required');
    if (contribution.visibility === 'community_proposed' && !choices.get('publish_reviewed')) {
      throw new Error('Community sharing requires consent to publish a reviewed copy');
    }
    const updated = await tx<Contribution>(
      `UPDATE contributions SET state = 'submitted', updated_at = now()
       WHERE id = $1 RETURNING *`,
      [contributionId],
    );
    await recordAudit(tx, {
      actorId: authorId,
      action: 'contribution.submit',
      targetType: 'contribution',
      targetId: contributionId,
      orgId,
      requestId,
      metadata: { version_id: contribution.current_version_id },
    });
    return updated[0];
  });
}

export async function withdrawContribution(
  contributionId: string,
  actorId: string,
  orgId: string,
  requestId: string,
  moderator = false,
): Promise<void> {
  await transaction(async (tx) => {
    if (!moderator) await requireActiveMembership(tx, actorId, orgId);
    const found = await tx<Contribution>(
      `SELECT * FROM contributions WHERE id = $1 AND org_id = $2 FOR UPDATE`,
      [contributionId, orgId],
    );
    const contribution = found[0];
    if (!contribution || (!moderator && contribution.author_user_id !== actorId)) {
      throw new Error('Contribution not found');
    }
    if (contribution.state === 'withdrawn') return;

    await tx(
      `UPDATE contributions SET state = 'withdrawn', withdrawn_at = now(),
              visibility_epoch = visibility_epoch + 1, updated_at = now()
       WHERE id = $1`,
      [contributionId],
    );
    await tx(
      `UPDATE shared_copies SET status = 'withdrawn', invalidated_at = now()
       WHERE contribution_id = $1 AND status <> 'withdrawn'`,
      [contributionId],
    );
    await tx(
      `DELETE FROM shared_copy_embeddings e
       USING shared_copies s
       WHERE e.shared_copy_id = s.id AND s.contribution_id = $1`,
      [contributionId],
    );
    await tx(
      `DELETE FROM shared_copy_embedding_jobs j
       USING shared_copies s
       WHERE j.shared_copy_id = s.id AND s.contribution_id = $1`,
      [contributionId],
    );
    await tx(
      `INSERT INTO notifications (recipient_user_id, event, safe_payload)
       VALUES ($1, 'contribution.withdrawn', $2::jsonb)`,
      [contribution.author_user_id, JSON.stringify({ contribution_id: contributionId, state: 'withdrawn' })],
    );
    await recordAudit(tx, {
      actorId,
      action: 'contribution.withdraw',
      targetType: 'contribution',
      targetId: contributionId,
      orgId,
      requestId,
      metadata: { moderator },
    });
  });
}

export async function revokeContributionConsent(
  contributionId: string,
  actorId: string,
  orgId: string,
  purpose: 'store_process' | 'publish_reviewed' | 'attribute' | 'model_training' | 'semantic_analysis',
  requestId: string,
) {
  await transaction(async (tx) => {
    await requireActiveMembership(tx, actorId, orgId);
    const rows = await tx<{ id: string; author_user_id: string; state: string }>(
      `SELECT id, author_user_id, state FROM contributions
       WHERE id = $1 AND org_id = $2 AND withdrawn_at IS NULL FOR UPDATE`,
      [contributionId, orgId],
    );
    const contribution = rows[0];
    if (!contribution || contribution.author_user_id !== actorId) throw new Error('Contribution not found');
    const revoked = await tx<{ id: string }>(
      `UPDATE consents SET revoked_at = now()
       WHERE contribution_id = $1 AND user_id = $2 AND purpose = $3
         AND choice = true AND revoked_at IS NULL
       RETURNING id`,
      [contributionId, actorId, purpose],
    );
    if (revoked.length === 0) throw new Error('No active consent exists for that purpose');

    if (purpose === 'store_process' || purpose === 'publish_reviewed') {
      await tx(
        `UPDATE contributions SET state = 'withdrawn', withdrawn_at = now(),
                visibility_epoch = visibility_epoch + 1, updated_at = now()
         WHERE id = $1`, [contributionId],
      );
      await tx(
        `UPDATE shared_copies SET status = 'withdrawn', invalidated_at = now()
         WHERE contribution_id = $1 AND status <> 'withdrawn'`, [contributionId],
      );
      await tx(
        `DELETE FROM shared_copy_embeddings e USING shared_copies s
         WHERE e.shared_copy_id = s.id AND s.contribution_id = $1`, [contributionId],
      );
      await tx(
        `DELETE FROM shared_copy_embedding_jobs j USING shared_copies s
         WHERE j.shared_copy_id = s.id AND s.contribution_id = $1`, [contributionId],
      );
    } else if (purpose === 'attribute') {
      await tx(
        `UPDATE shared_copies SET reviewed_payload = reviewed_payload - 'attribution_label',
                deidentified = true, attribution_consent = false
         WHERE contribution_id = $1 AND status = 'active' AND attribution_consent = true`,
        [contributionId],
      );
      await tx(
        `DELETE FROM shared_copy_embeddings e USING shared_copies s
         WHERE e.shared_copy_id = s.id AND s.contribution_id = $1`, [contributionId],
      );
    } else if (purpose === 'semantic_analysis') {
      await tx(
        `DELETE FROM shared_copy_embeddings e USING shared_copies s
         WHERE e.shared_copy_id = s.id AND s.contribution_id = $1`, [contributionId],
      );
      await tx(
        `DELETE FROM shared_copy_embedding_jobs j USING shared_copies s
         WHERE j.shared_copy_id = s.id AND s.contribution_id = $1`, [contributionId],
      );
    }

    await recordAudit(tx, {
      actorId,
      action: 'contribution.consent_revoke',
      targetType: 'contribution',
      targetId: contributionId,
      orgId,
      requestId,
      metadata: { purpose, prior_state: contribution.state },
    });
  });
}

export async function listWorkspaceContributions(userId: string, orgId: string) {
  return query(
    `SELECT c.id, c.author_user_id, c.org_id, c.visibility, c.current_version_id,
            c.state, c.withdrawn_at, c.visibility_epoch, c.created_at, c.updated_at,
            v.source_payload AS current_payload
     FROM contributions c
     LEFT JOIN contribution_versions v ON v.id = c.current_version_id
     WHERE c.org_id = $1 AND c.withdrawn_at IS NULL
       AND (c.author_user_id = $2 OR (c.visibility = 'org' AND c.state <> 'private_draft'))
     ORDER BY c.updated_at DESC, c.id DESC
     LIMIT 100`,
    [orgId, userId],
  );
}

export async function getWorkspaceContribution(contributionId: string, userId: string, orgId: string) {
  return queryOne(
    `SELECT c.id, c.author_user_id, c.org_id, c.visibility, c.current_version_id,
            c.state, c.withdrawn_at, c.visibility_epoch, c.created_at, c.updated_at, v.version,
            v.source_payload AS current_payload,
            (SELECT s.reviewed_payload FROM shared_copies s
             WHERE s.contribution_id = c.id AND s.status = 'active'
             ORDER BY s.published_at DESC, s.id DESC LIMIT 1) AS shared_payload
     FROM contributions c
     LEFT JOIN contribution_versions v ON v.id = c.current_version_id
     WHERE c.id = $1 AND c.org_id = $2 AND c.withdrawn_at IS NULL
       AND (c.author_user_id = $3 OR (c.visibility = 'org' AND c.state <> 'private_draft'))`,
    [contributionId, orgId, userId],
  );
}

export async function getAuthorContributionForEdit(contributionId: string, userId: string, orgId: string) {
  return queryOne<{
    id: string; state: string; visibility: string; current_payload: Record<string, unknown>;
    consent_choices: Record<string, boolean> | null;
  }>(
    `SELECT c.id, c.state, c.visibility, v.source_payload AS current_payload,
            COALESCE((SELECT jsonb_object_agg(cs.purpose, cs.choice)
              FROM consents cs WHERE cs.contribution_id = c.id AND cs.user_id = $2 AND cs.revoked_at IS NULL
                AND cs.version = v.version), '{}'::jsonb) AS consent_choices
     FROM contributions c
     JOIN contribution_versions v ON v.id = c.current_version_id
     WHERE c.id = $1 AND c.org_id = $3 AND c.author_user_id = $2
       AND c.withdrawn_at IS NULL AND c.state IN ('private_draft', 'needs_clarification', 'published')`,
    [contributionId, userId, orgId],
  );
}

export async function getLatestClarification(contributionId: string) {
  return queryOne<{ decision_note: string | null; reason_code: string }>(
    `SELECT decision_note, reason_code FROM moderation_decisions
     WHERE contribution_id = $1 AND action = 'clarify'
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [contributionId],
  );
}

export async function getContributionCurrentConsents(contributionId: string, userId: string) {
  return queryOne<{ choices: Record<string, boolean> | null }>(
    `SELECT COALESCE((SELECT jsonb_object_agg(cs.purpose, cs.choice) FROM consents cs
       WHERE cs.contribution_id = c.id AND cs.user_id = $2 AND cs.version = v.version
         AND cs.revoked_at IS NULL), '{}'::jsonb) AS choices
     FROM contributions c JOIN contribution_versions v ON v.id = c.current_version_id
     WHERE c.id = $1 AND c.author_user_id = $2`,
    [contributionId, userId],
  );
}

export async function getContributionOwner(contributionId: string) {
  return queryOne<{ author_user_id: string; org_id: string; state: string; visibility: string }>(
    'SELECT author_user_id, org_id, state, visibility FROM contributions WHERE id = $1 AND withdrawn_at IS NULL',
    [contributionId],
  );
}

export async function reportSharedCopy(
  sharedCopyId: string,
  reporterId: string,
  orgId: string,
  input: ReportCreateInput,
  requestId: string,
) {
  return transaction(async (tx) => {
    await requireActiveMembership(tx, reporterId, orgId);
    const copy = await tx<{ id: string; contribution_id: string; source_version_id: string }>(
      `SELECT s.id, s.contribution_id, s.source_version_id
       FROM shared_copies s JOIN contributions c ON c.id = s.contribution_id
       JOIN organizations source_org ON source_org.id = c.org_id
       JOIN organizations workspace ON workspace.id = $2
       WHERE s.id = $1 AND s.status = 'active' AND c.state = 'published'
         AND c.withdrawn_at IS NULL AND (s.deidentified = true OR s.attribution_consent = true)
         AND ((workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $2)
           OR (workspace.is_sandbox = false AND source_org.is_sandbox = false))
       FOR SHARE OF s`,
      [sharedCopyId, orgId],
    );
    if (!copy[0]) throw new Error('Shared contribution not found');

    const report = await tx<{ id: string }>(
      `INSERT INTO reports (shared_copy_id, reporter_user_id, category, details, status)
       VALUES ($1, $2, $3, $4, 'open') RETURNING id`,
      [sharedCopyId, reporterId, input.category, input.details.trim()],
    );
    await recordAudit(tx, {
      actorId: reporterId,
      action: 'shared_copy.report',
      targetType: 'report',
      targetId: report[0].id,
      orgId,
      requestId,
      metadata: { category: input.category, shared_copy_id: sharedCopyId },
    });
    return { id: report[0].id, status: 'open' as const };
  });
}
