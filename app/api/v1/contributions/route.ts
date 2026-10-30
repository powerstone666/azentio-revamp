import 'server-only';

import { z } from 'zod';
import { contributionCreateSchema } from '@/app/(common-lib)/types/schemas';
import type { ContributionCreateInput } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import type { Contribution } from '@/app/(common-lib)/types';

// ─── GET /api/v1/contributions ──────────────────────────────────────────────

/**
 * List contributions visible to the current user within their active workspace.
 *
 * Protected: requires session + workspace:read authorisation.
 * M1 will replace the placeholder with a real SQL query respecting visibility
 * boundaries (author / org / community_proposed).
 */
export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const authz = await authorize({
    action: 'contribution:list',
    activeWorkspace: session.activeWorkspace,
  });
  if (!authz.allowed) {
    return Response.json({ error: authz.reason }, { status: 403 });
  }

  // ── Placeholder: M1 will query contributions table ──
  // const rows = await query<Contribution>(
  //   `SELECT * FROM contributions WHERE org_id = $1 ORDER BY updated_at DESC LIMIT 50`,
  //   [session.activeWorkspace!.orgId],
  // );
  const contributions: Contribution[] = [];

  return Response.json({ data: contributions });
}

// ─── POST /api/v1/contributions ─────────────────────────────────────────────

/**
 * Create a new contribution draft.
 *
 * Protected: requires session + contribution:create authorisation.
 * Delegates to the contribution service which handles the write + consent
 * capture inside a transaction.
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) {
    return Response.json({ error: 'Authentication required' }, { status: 401 });
  }

  const authz = await authorize({
    action: 'contribution:create',
    activeWorkspace: session.activeWorkspace,
  });
  if (!authz.allowed) {
    return Response.json({ error: authz.reason }, { status: 403 });
  }

  // ── Validate body ──
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const parsed = contributionCreateSchema.safeParse(body);
  if (!parsed.success) {
    return Response.json(
      { error: 'Validation failed', details: parsed.error.flatten() },
      { status: 422 },
    );
  }

  const input: ContributionCreateInput = parsed.data;

  // ── Placeholder: M1 will delegate to the contribution service ──
  // const { createDraft } = await import(
  //   '@/app/api/(services)/contributions/service'
  // );
  // const contribution = await createDraft(
  //   input,
  //   session.user.id,
  //   session.activeWorkspace!.orgId,
  // );
  // return Response.json({ data: contribution }, { status: 201 });

  return Response.json(
    { data: { id: 'placeholder', message: 'Not yet implemented (M1)' } },
    { status: 201 },
  );
}