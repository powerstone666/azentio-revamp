import 'server-only';

/**
 * Better Auth catch-all route handler.
 *
 * Next.js 16 route handler receiving all requests under /api/v1/auth/*.
 * M1 will configure Better Auth with the email-OTP + organization plugin and
 * replace the placeholder exports below with the real handler.
 *
 * ## Expected M1 setup
 * ```ts
 * import { auth } from '@/app/api/(services)/auth/better-auth-config';
 * import { toNextJsHandler } from 'better-auth/next-js';
 *
 * const handler = toNextJsHandler(auth);
 * export const { GET, POST } = handler;
 * ```
 *
 * ## Next.js 16 notes
 * - Route handlers use Web `Request` / `Response`.
 * - No `cookies()` / `headers()` sync convenience — always await.
 * - Dynamic segment `[...all]` is **not** a Promise in route handlers;
 *   use the second argument's `params` field directly (it is already resolved).
 */

// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function placeholderHandler(_request: Request, _ctx: any): Promise<Response> {
  return Response.json(
    { error: 'Auth not configured — pending M1 Better Auth wiring' },
    { status: 501 },
  );
}

/**
 * GET handler — M1 will replace with Better Auth's GET export.
 * Handles email-OTP verification callbacks, session lookups, etc.
 */
export async function GET(
  request: Request,
  ctx: { params: Promise<{ all: string[] }> },
): Promise<Response> {
  return placeholderHandler(request, ctx);
}

/**
 * POST handler — M1 will replace with Better Auth's POST export.
 * Handles sign-in, sign-up, token exchange, etc.
 */
export async function POST(
  request: Request,
  ctx: { params: Promise<{ all: string[] }> },
): Promise<Response> {
  return placeholderHandler(request, ctx);
}