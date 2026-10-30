import 'server-only';

import { cache } from 'react';
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
 * ## M1 wiring
 * - Replace the placeholder body with Better Auth's `auth.api.getSession()`
 *   equivalent, then hydrate memberships + grants via `query()`.
 */

async function verifySession(): Promise<AppSession | null> {
  // ── Placeholder: M1 will wire Better Auth session resolution ──
  // Steps for M1:
  //  1. const { headers } = await import('next/headers');
  //  2. const auth = getAuth(); // Better Auth server client
  //  3. const session = await auth.api.getSession({ headers: await headers() });
  //  4. if (!session) return null;
  //  5. Query memberships, role grants, and resolve active workspace from
  //     a session-scoped claim or dedicated cookie.
  //
  // For now, return null so every protected endpoint denies access until
  // Better Auth is configured.

  return null;
}

/** React-cached session resolver — safe to call multiple times per request. */
export const getSession = cache(verifySession);

export { verifySession };