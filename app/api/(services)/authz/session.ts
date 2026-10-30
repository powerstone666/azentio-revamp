import 'server-only';

import { cache } from 'react';
import { headers } from 'next/headers';
import { auth } from '@/app/api/(services)/auth/better-auth-config';
import { query, queryOne } from '@/app/api/(db)/client';
import type { AppSession, User, Membership, RoleGrant } from '@/app/(common-lib)/types';

/**
 * Server-only session resolution.
 *
 * Reads the session cookie/token, validates it against the auth provider,
 * and returns a fully-hydrated AppSession with user, memberships, grants, and
 * active workspace.
 *
 * ## Next.js 16 notes
 * - Never call `cookies()` from a sync context — always `await cookies()`.
 * - This function is wrapped in React `cache()` so every Server Component /
 *   Server Action / route handler that calls `getSession()` within the same
 *   request tree receives the same resolved promise.
 *
 */

async function verifySession(): Promise<AppSession | null> {
  const authSession = await auth.api.getSession({ headers: await headers() });
  if (!authSession?.user.email || !authSession.user.emailVerified) return null;

  const user = await queryOne<User>(
    `SELECT id, email, display_name, verified_at, disabled_at, created_at
     FROM users WHERE lower(email) = lower($1) AND disabled_at IS NULL AND verified_at IS NOT NULL`,
    [authSession.user.email],
  );
  if (!user) return null;

  const memberships = await query<Membership & { org_name: string; org_type: 'azentio' | 'client' }>(
    `SELECT m.id, m.org_id, m.user_id, m.role, m.status, m.joined_at,
            o.name AS org_name, o.type AS org_type
     FROM memberships m
     JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.status = 'active' AND o.status = 'active'
     ORDER BY m.joined_at, m.id`,
    [user.id],
  );
  if (memberships.length === 0) return null;

  const grants = await query<RoleGrant>(
    `SELECT id, org_id, user_id, role, offering_id, granted_by, expires_at, revoked_at
     FROM role_grants
     WHERE user_id = $1 AND revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())`,
    [user.id],
  );

  const cookie = (await headers()).get('cookie') ?? '';
  const activeOrgId = cookie.match(/(?:^|;\s*)azentio_active_org=([^;]+)/)?.[1];
  const selected = memberships.find((membership) => membership.org_id === activeOrgId)
    ?? (memberships.length === 1 ? memberships[0] : null);

  return {
    user,
    memberships,
    grants,
    activeWorkspace: selected ? {
      orgId: selected.org_id,
      orgName: selected.org_name,
      orgType: selected.org_type,
      role: selected.role,
    } : null,
  };
}

/** React-cached session resolver — safe to call multiple times per request. */
export const getSession = cache(verifySession);

export { verifySession };
