import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { safeErrorResponse } from '@/app/api/(services)/http/safe-error';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getSession } from '@/app/api/(services)/authz/session';
import { getReleaseNoteScope, updateReleaseNoteDraft } from '@/app/api/(services)/releases/service';

const idSchema = z.string().uuid();
const updateSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(10000),
}).strict();

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  const { id: rawId } = await params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) return Response.json({ error: 'Release note not found' }, { status: 404 });
  const scope = await getReleaseNoteScope(parsedId.data);
  if (!scope) return Response.json({ error: 'Release note not found' }, { status: 404 });
  const permission = await authorize({ action: 'release-notes:manage', resource: { type: 'release_note', offeringId: scope.offering_id ?? undefined } });
  if (!permission.allowed) return Response.json({ error: 'Release note not found' }, { status: 404 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = updateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  try {
    const data = await updateReleaseNoteDraft({
      id: parsedId.data, actorId: session.user.id, activeOrgId: session.activeWorkspace.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      title: parsed.data.title, body: parsed.data.body, offeringId: scope.offering_id, orgId: scope.org_id,
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return safeErrorResponse(error, [
      { match: /\bstate\b|Draft/, status: 409 },
      { match: /grant|audience|workspace|organi[sz]ation|scope/i, status: 403 },
    ], 'Unable to update release note');
  }
}
