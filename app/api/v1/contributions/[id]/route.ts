import 'server-only';

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import type { Contribution } from '@/app/(common-lib)/types';

// ─── GET /api/v1/contributions/[id] ─────────────────────────────────────────

/**
 * Fetch a single contribution by ID.
 *
 * Visibility rules (M1):
 * - `author` visibility → only the author.
 * - `org` visibility → any active member of the same org.
 * - `community_proposed` → any authenticated user (subject to moderator
 *    approval before the shared copy is published).
 */
export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const { id } = await params;

  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const authz = await authorize({
    action: 'contribution:read',
    resource: { type: 'contribution', id },
    activeWorkspace: session.activeWorkspace,
  });
  if (!authz.allowed) {
    return Response.json({ error: authz.reason }, { status: 403 });
  }

  // ── Placeholder: M1 will query the contribution + latest version ──
  // const contribution = await queryOne<Contribution>(
  //   `SELECT * FROM contributions WHERE id = $1`,
  //   [id],
  // );
  // if (!contribution) {
  //   return Response.json({ error: 'Not found' }, { status: 404 });
  // }
  // // Visibility gate...

  return Response.json({
    data: { id, message: 'Not yet implemented (M1 placeholder)' },
  });
}