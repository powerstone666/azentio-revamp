import 'server-only';

import { z } from 'zod';
import { workspaceSelectSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import type { Membership } from '@/app/(common-lib)/types';

// ─── Workspace list item (subset of Membership + org name) ───

interface WorkspaceItem {
  membership_id: string;
  org_id: string;
  org_name: string;
  org_type: string;
  role: string;
  status: string;
}

// ─── GET /api/v1/workspaces ─────────────────────────────────────────────────

/**
 * List the authenticated user's workspace memberships.
 *
 * Protected: requires a valid session via `getSession()`.
 * M1 will replace the placeholder body with a real `query<Membership>()` call
 * joined against the `organizations` table.
 */
export async function GET(): Promise<Response> {
  // ── Authorisation ──
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const authz = await authorize({
    action: 'workspace:list',
    activeWorkspace: session.activeWorkspace,
  });
  if (!authz.allowed) {
    return Response.json({ error: authz.reason }, { status: 403 });
  }

  // ── Placeholder: M1 will query real data ──
  // const memberships = await query<Membership & { org_name: string }>(
  //   `SELECT m.*, o.name AS org_name, o.type AS org_type
  //    FROM memberships m JOIN organizations o ON o.id = m.org_id
  //    WHERE m.user_id = $1 AND m.status = 'active'`,
  //   [session.user.id],
  // );
  const workspaces: WorkspaceItem[] = [];

  return Response.json({ data: workspaces });
}

// ─── POST /api/v1/workspaces — select active workspace ──────────────────────

const workspaceSelectBodySchema = z.object({
  membership_id: workspaceSelectSchema.shape.membership_id,
});

/**
 * Set the user's active workspace (stored as a scoped session claim or cookie).
 *
 * Protected: requires a valid session and the user must be an active member
 * of the selected organisation.
 */
export async function POST(request: Request): Promise<Response> {
  // ── Authorisation ──
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  // ── Validate body ──
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json(
      { error: 'Invalid JSON body' },
      { status: 400 },
    );
  }

  const parsed = workspaceSelectBodySchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const { membership_id } = parsed.data;

  const authz = await authorize({
    action: 'workspace:select',
    activeWorkspace: session.activeWorkspace,
  });
  if (!authz.allowed) {
    return Response.json({ error: authz.reason }, { status: 403 });
  }

  // ── Placeholder: M1 will verify membership and persist workspace selection ──
  // const membership = await queryOne<Membership>(
  //   `SELECT * FROM memberships WHERE id = $1 AND user_id = $2 AND status = 'active'`,
  //   [membership_id, session.user.id],
  // );
  // if (!membership) {
  //   return Response.json({ error: 'Invalid or inactive membership' }, { status: 404 });
  // }
  // // Persist active workspace in session-scoped store...

  return Response.json({
    data: {
      membership_id,
      message: 'Active workspace selection not yet persisted (M1 placeholder)',
    },
  });
}