import 'server-only';

import { query, transaction } from '@/app/api/(db)/client';
import { OFFERINGS, SCENARIOS, type OfferingId } from '@/app/(ui)/components/portal/employee/playground-data';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

async function requireEmployee(tx: TxQuery, userId: string, orgId: string) {
  const rows = await tx<{ id: string }>(
    `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active' AND o.status = 'active'
       AND ((m.role = 'employee' AND o.type = 'azentio') OR (o.is_sandbox = true AND EXISTS (
         SELECT 1 FROM role_grants g WHERE g.user_id = $1 AND g.org_id = $2 AND g.role IN ('employee', 'content_publisher')
           AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())
       )))
     FOR SHARE OF m`,
    [userId, orgId],
  );
  if (!rows[0]) throw new Error('Active employee membership required');
}

export async function listEmployeeExperiments(orgId: string) {
  return query(
    `SELECT e.id, e.title, e.problem_statement, e.offering, e.proposed_approach,
            e.status, e.created_at, e.updated_at, u.display_name AS owner
     FROM employee_experiments e JOIN users u ON u.id = e.owner_user_id
     JOIN organizations workspace ON workspace.id = $1 AND workspace.status = 'active'
     WHERE e.org_id = $1 OR (e.org_id IS NULL AND workspace.is_sandbox = false)
     ORDER BY e.updated_at DESC, e.id DESC LIMIT 100`,
    [orgId],
  );
}

export async function createEmployeeExperiment(input: {
  userId: string; orgId: string; requestId: string; title: string;
  problemStatement: string; offering: string; proposedApproach: string;
}) {
  return transaction(async (tx) => {
    await requireEmployee(tx, input.userId, input.orgId);
    const rows = await tx<{ id: string }>(
      `INSERT INTO employee_experiments (org_id, owner_user_id, title, problem_statement, offering, proposed_approach)
       VALUES (CASE WHEN (SELECT is_sandbox FROM organizations WHERE id = $1) THEN $1 ELSE NULL END, $2, $3, $4, $5, $6) RETURNING id`,
      [input.orgId, input.userId, input.title, input.problemStatement, input.offering, input.proposedApproach],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision)
       VALUES ($1, 'employee.experiment.create', 'employee_experiment', $2, $3, $4, 'allowed')`,
      [input.userId, rows[0].id, input.orgId, input.requestId],
    );
    return rows[0];
  });
}

export async function listEmployeeKnowledge(userId: string, orgId: string) {
  return query(
    `SELECT k.id, k.title, k.body, k.review_at, k.updated_at, u.display_name AS owner,
            f.helpful AS my_helpful, f.note AS my_note
     FROM employee_knowledge_items k
     JOIN users u ON u.id = k.owner_user_id
     LEFT JOIN employee_knowledge_feedback f ON f.item_id = k.id AND f.user_id = $1
     JOIN organizations workspace ON workspace.id = $2 AND workspace.status = 'active'
     WHERE k.status = 'published'
       AND (k.org_id = $2 OR (k.org_id IS NULL AND workspace.is_sandbox = false))
     ORDER BY k.review_at, k.updated_at DESC, k.id
     LIMIT 100`,
    [userId, orgId],
  );
}

export async function saveEmployeeKnowledgeFeedback(input: {
  userId: string; orgId: string; itemId: string; helpful: boolean; note: string;
}) {
  return transaction(async (tx) => {
    await requireEmployee(tx, input.userId, input.orgId);
    const item = await tx<{ id: string }>(
      `SELECT k.id FROM employee_knowledge_items k JOIN organizations workspace ON workspace.id = $2
       WHERE k.id = $1 AND k.status = 'published'
         AND (k.org_id = $2 OR (k.org_id IS NULL AND workspace.is_sandbox = false)) FOR SHARE OF k`,
      [input.itemId, input.orgId],
    );
    if (!item[0]) throw new Error('Knowledge item not found');
    const rows = await tx<{ id: string }>(
      `INSERT INTO employee_knowledge_feedback (item_id, user_id, helpful, note)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (item_id, user_id) DO UPDATE
         SET helpful = EXCLUDED.helpful, note = EXCLUDED.note, updated_at = now()
       RETURNING id`,
      [input.itemId, input.userId, input.helpful, input.note],
    );
    return rows[0];
  });
}

export async function runEmployeePlayground(input: {
  userId: string; orgId: string; requestId: string; offeringId: OfferingId;
}) {
  const offering = OFFERINGS.find((item) => item.id === input.offeringId);
  const scenario = SCENARIOS[input.offeringId];
  if (!offering || !scenario) throw new Error('Playground scenario not found');
  return transaction(async (tx) => {
    await requireEmployee(tx, input.userId, input.orgId);
    const inputSnapshot = { caption: scenario.inputsCaption, columns: scenario.columns, rows: scenario.rows };
    const outputSnapshot = { lines: scenario.output, evidence: scenario.evidence };
    const rows = await tx<{ id: string; created_at: Date }>(
      `INSERT INTO employee_playground_runs
         (org_id, user_id, offering_id, scenario_key, input_snapshot, output_snapshot)
       VALUES ($1, $2, $3, $4, $5::jsonb, $6::jsonb)
       RETURNING id, created_at`,
      [input.orgId, input.userId, input.offeringId, input.offeringId, JSON.stringify(inputSnapshot), JSON.stringify(outputSnapshot)],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'employee.playground.run', 'employee_playground_run', $2, $3, $4, 'allowed', $5::jsonb)`,
      [input.userId, rows[0].id, input.orgId, input.requestId, JSON.stringify({ offering_id: input.offeringId, synthetic: true })],
    );
    return { ...rows[0], offering_id: input.offeringId, input_snapshot: inputSnapshot, output_snapshot: outputSnapshot };
  });
}

export async function saveEmployeePlaygroundFeedback(input: {
  userId: string; orgId: string; runId: string; rating: string; comment: string;
}) {
  return transaction(async (tx) => {
    await requireEmployee(tx, input.userId, input.orgId);
    const run = await tx<{ id: string }>(
      `SELECT id FROM employee_playground_runs
       WHERE id = $1 AND org_id = $2 AND user_id = $3 FOR SHARE`,
      [input.runId, input.orgId, input.userId],
    );
    if (!run[0]) throw new Error('Playground run not found');
    const rows = await tx<{ id: string }>(
      `INSERT INTO employee_playground_feedback (run_id, org_id, user_id, rating, comment)
       VALUES ($1, $2, $3, $4, $5)
       ON CONFLICT (run_id, user_id) DO UPDATE
         SET rating = EXCLUDED.rating, comment = EXCLUDED.comment, created_at = now()
       RETURNING id`,
      [input.runId, input.orgId, input.userId, input.rating, input.comment],
    );
    return rows[0];
  });
}
