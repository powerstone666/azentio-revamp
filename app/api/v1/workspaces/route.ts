import 'server-only';

import { z } from 'zod';
import { workspaceSelectSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { query, queryOne } from '@/app/api/(db)/client';

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

  const workspaces = await query<WorkspaceItem>(
    `SELECT m.id AS membership_id, m.org_id, o.name AS org_name, o.type AS org_type,
            m.role, m.status
     FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.status = 'active' AND o.status = 'active'
     ORDER BY o.name`,
    [session.user.id],
  );

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

  const membership = await queryOne<{ org_id: string }>(
    `SELECT m.org_id
     FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.id = $1 AND m.user_id = $2 AND m.status = 'active' AND o.status = 'active'`,
    [membership_id, session.user.id],
  );
  if (!membership) return Response.json({ error: 'Workspace membership not found' }, { status: 404 });

  const secure = process.env.NODE_ENV === 'production' ? '; Secure' : '';
  const response = Response.json({ data: { membership_id, org_id: membership.org_id } });
  response.headers.set('Set-Cookie', `azentio_active_org=${membership.org_id}; Path=/; HttpOnly; SameSite=Lax${secure}`);
  return response;
}
