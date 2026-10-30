import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { auth } from '@/app/api/(services)/auth/better-auth-config';
import { createAuthApiRequest } from '@/app/api/(services)/auth/request-origin';
import { acceptInvitation } from '@/app/api/(services)/invitations/service';

const acceptSchema = z.object({
  token: z.string().min(40).max(100),
  accept_workspace_terms: z.literal(true),
  understands_sharing_is_separate: z.literal(true),
});

export async function POST(request: Request): Promise<Response> {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = acceptSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Review and accept the workspace terms and sharing explanation' }, { status: 422 });

  createAuthApiRequest(request.headers, request.url); // validates the host
  const authSession = await auth.api.getSession({ headers: request.headers });
  if (!authSession?.user?.email || !authSession.user.emailVerified) {
    return Response.json({ error: 'Sign in with the invited, verified email address first' }, { status: 401 });
  }
  try {
    const result = await acceptInvitation({
      token: parsed.data.token,
      verifiedEmail: authSession.user.email,
      displayName: authSession.user.name,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    });
    return Response.json({ data: result });
  } catch (error) {
    const message = error instanceof Error ? error.message : '';
    if (message.includes('does not match')) return Response.json({ error: message }, { status: 403 });
    if (message.includes('disabled')) return Response.json({ error: message }, { status: 403 });
    return Response.json({ error: 'Invitation is invalid, expired, revoked, or already accepted' }, { status: 409 });
  }
}
