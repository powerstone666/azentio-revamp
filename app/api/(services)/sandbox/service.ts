import 'server-only';

import type { SandboxDemo } from '@/app/(config)/sandbox';
import { query, transaction } from '@/app/api/(db)/client';

export async function listEntitledSandboxDemos(orgId: string) {
  const rows = await query<{ offering_id: string }>(
    `SELECT DISTINCT offering_id FROM entitlements
     WHERE org_id = $1 AND status = 'active'
       AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now())
       AND (feature IS NULL OR feature = 'sandbox')
     ORDER BY offering_id`,
    [orgId],
  );
  return rows.map((row) => row.offering_id);
}

export async function listSandboxRuns(orgId: string, userId: string, offeringId: string) {
  return query<{
    id: string; scenario_key: string; input_snapshot: Record<string, unknown>;
    output_snapshot: SandboxDemo['scenarioOutput']; created_at: Date;
  }>(
    `SELECT id, scenario_key, input_snapshot, output_snapshot, created_at
     FROM sandbox_runs
     WHERE org_id = $1 AND user_id = $2 AND offering_id = $3
     ORDER BY created_at DESC, id DESC LIMIT 10`,
    [orgId, userId, offeringId],
  );
}

export async function runSandboxDemo(
  demo: SandboxDemo,
  orgId: string,
  userId: string,
  requestId: string,
) {
  return transaction(async (tx) => {
    const membership = await tx<{ id: string }>(
      `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
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
    if (!membership[0]) throw new Error('Active client membership is required');

    const entitlement = await tx<{ id: string }>(
      `SELECT id FROM entitlements
       WHERE org_id = $1 AND offering_id = $2 AND status = 'active'
         AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now())
         AND (feature IS NULL OR feature = 'sandbox')
       ORDER BY id LIMIT 1 FOR SHARE`,
      [orgId, demo.id],
    );
    if (!entitlement[0]) throw new Error('This workspace is not entitled to this sandbox');

    const inserted = await tx<{ id: string; created_at: Date }>(
      `INSERT INTO sandbox_runs (org_id, user_id, offering_id, scenario_key, input_snapshot, output_snapshot)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       RETURNING id, created_at`,
      [orgId, userId, demo.id, demo.scenarioKey, JSON.stringify(demo.scenarioInput), JSON.stringify(demo.scenarioOutput)],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'sandbox.run', 'sandbox_run', $2, $3, $4, 'allowed', $5::jsonb)`,
      [userId, inserted[0].id, orgId, requestId, JSON.stringify({ offering_id: demo.id, scenario_key: demo.scenarioKey, synthetic: true })],
    );
    return {
      id: inserted[0].id,
      offering_id: demo.id,
      scenario_key: demo.scenarioKey,
      input_snapshot: demo.scenarioInput,
      output_snapshot: demo.scenarioOutput,
      created_at: inserted[0].created_at,
    };
  });
}
