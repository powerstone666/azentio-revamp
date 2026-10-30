import 'server-only';

import type { ModerationDecisionInput } from '@/app/(common-lib)/types/schemas';
import { query, transaction } from '@/app/api/(db)/client';
import type { Contribution, ContributionVersion } from '@/app/(common-lib)/types';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

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

async function notifyAuthor(tx: TxQuery, authorId: string, event: string, contributionId: string, state: string, reasonCode: string) {
  await tx(
    `INSERT INTO notifications (recipient_user_id, event, safe_payload)
     VALUES ($1, $2, $3::jsonb)`,
    [authorId, event, JSON.stringify({ contribution_id: contributionId, state, reason_code: reasonCode })],
  );
}

export async function getModerationQueue(orgId?: string) {
  return query(
    `SELECT c.id, c.org_id, o.name AS org_name, c.visibility, c.state,
            c.current_version_id, v.version, v.source_payload, c.created_at, c.updated_at
     FROM contributions c
     JOIN organizations o ON o.id = c.org_id
     JOIN contribution_versions v ON v.id = c.current_version_id
     WHERE c.state = 'submitted' AND c.withdrawn_at IS NULL
       AND ($1::uuid IS NULL OR c.org_id = $1)
     ORDER BY c.created_at, c.id
     LIMIT 100`,
    [orgId ?? null],
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

    if (['approve', 'publish'].includes(input.action)) {
      if (contribution.visibility !== 'community_proposed') throw new Error('Only community-proposed contributions can be published');
      if (!input.redacted_payload) throw new Error('Reviewed copy is required');
      const consentRows = await tx<{ purpose: string; choice: boolean }>(
        `SELECT purpose, choice FROM consents WHERE contribution_id = $1 AND version = $2`,
        [contributionId, version.version],
      );
      const consent = new Map(consentRows.map((row) => [row.purpose, row.choice]));
      if (!consent.get('store_process') || !consent.get('publish_reviewed')) {
        throw new Error('Required sharing consent is not active for this version');
      }
      if (input.attribution_consent && (!consent.get('attribute') || !input.redacted_payload.attribution_label)) {
        throw new Error('Attribution requires explicit contributor consent and a reviewed label');
      }
      if (!input.attribution_consent && input.redacted_payload.attribution_label) {
        throw new Error('Attribution label supplied without explicit approval');
      }
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
      `INSERT INTO moderation_decisions (contribution_id, version_id, moderator_id, action, reason_code, redactions)
       VALUES ($1, $2, $3, $4, $5, $6::jsonb)`,
      [contributionId, version.id, moderatorId, input.action, input.reason_code, input.redacted_payload ? JSON.stringify(input.redacted_payload) : null],
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
                  attribution_consent = $3, status = 'active', published_at = now(), invalidated_at = NULL
           WHERE id = $4`,
          [JSON.stringify(safePayload), !input.attribution_consent, input.attribution_consent, existing[0].id],
        );
      } else {
        await tx(
          `INSERT INTO shared_copies (contribution_id, source_version_id, reviewed_payload, deidentified, attribution_consent, status)
           VALUES ($1, $2, $3::jsonb, $4, $5, 'active')`,
          [contributionId, version.id, JSON.stringify(safePayload), !input.attribution_consent, input.attribution_consent],
        );
      }
    }

    if (input.action === 'suspend') {
      await tx(
        `UPDATE shared_copies SET status = 'suspended', invalidated_at = now()
         WHERE contribution_id = $1 AND status = 'active'`,
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
    });
    return { id: contributionId, state: nextState[input.action] };
  });
}
