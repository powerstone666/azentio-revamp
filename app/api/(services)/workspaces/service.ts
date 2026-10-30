import 'server-only';

import { transaction } from '@/app/api/(db)/client';

export class WorkspaceError extends Error {
  constructor(message: string, readonly status: 403 | 409 | 422) {
    super(message);
  }
}

const MAX_OWN_SANDBOX_WORKSPACES = 5;

/**
 * A client admin of a demo (sandbox) workspace creates another sandbox workspace and becomes its client admin.
 * Real client organisations stay platform-admin only. Offerings are copied from the source workspace so the new one is usable.
 */
export async function createSandboxWorkspace(input: { actorId: string; sourceOrgId: string; name: string; requestId: string }) {
  const name = input.name.trim().replace(/\s+/g, ' ');
  if (name.length < 3 || name.length > 80) throw new WorkspaceError('Workspace name must be 3 to 80 characters.', 422);

  return transaction(async (tx) => {
    const allowed = await tx<{ ok: boolean }>(
      `SELECT EXISTS (
         SELECT 1 FROM memberships m
         JOIN organizations o ON o.id = m.org_id AND o.status = 'active' AND o.is_sandbox = true
         WHERE m.user_id = $1 AND m.org_id = $2 AND m.role = 'client_admin' AND m.status = 'active'
       ) AS ok`,
      [input.actorId, input.sourceOrgId],
    );
    if (!allowed[0]?.ok) throw new WorkspaceError('Only a client admin of a demo workspace can create workspaces.', 403);

    const owned = await tx<{ n: number }>(
      `SELECT count(*)::int AS n FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1 AND m.role = 'client_admin' AND m.status = 'active' AND o.is_sandbox = true`,
      [input.actorId],
    );
    if ((owned[0]?.n ?? 0) >= MAX_OWN_SANDBOX_WORKSPACES) {
      throw new WorkspaceError(`You can administer up to ${MAX_OWN_SANDBOX_WORKSPACES} demo workspaces.`, 409);
    }

    const created = await tx<{ id: string }>(
      `INSERT INTO organizations (name, type, status, is_sandbox) VALUES ($1, 'client', 'active', true)
       ON CONFLICT DO NOTHING RETURNING id`,
      [name],
    );
    const orgId = created[0]?.id;
    if (!orgId) throw new WorkspaceError('A workspace with that name already exists.', 409);

    const membership = await tx<{ id: string }>(
      `INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, 'client_admin', 'active') RETURNING id`,
      [orgId, input.actorId],
    );
    await tx(
      `INSERT INTO entitlements (org_id, offering_id, status, granted_by)
       SELECT $1, offering_id, 'active', $3 FROM entitlements
       WHERE org_id = $2 AND status = 'active' AND valid_from <= now() AND (valid_to IS NULL OR valid_to > now())
       GROUP BY offering_id`,
      [orgId, input.sourceOrgId, input.actorId],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'workspace.create_sandbox', 'organization', $2, $2, $3, 'allow', $4)`,
      [input.actorId, orgId, input.requestId, JSON.stringify({ source_org_id: input.sourceOrgId, sandbox: true })],
    );
    return { org_id: orgId, membership_id: membership[0].id, name };
  });
}
