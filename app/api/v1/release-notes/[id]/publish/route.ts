import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { safeErrorResponse } from '@/app/api/(services)/http/safe-error';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getSession } from '@/app/api/(services)/authz/session';
import { getReleaseNoteScope, publishReleaseNote } from '@/app/api/(services)/releases/service';

const idSchema = z.string().uuid();

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Release note not found' }, { status: 404 });
  const scope = await getReleaseNoteScope(id.data);
  if (!scope) return Response.json({ error: 'Release note not found' }, { status: 404 });
  const permission = await authorize({ action: 'release-notes:manage', resource: { type: 'release_note', offeringId: scope.offering_id ?? undefined } });
  if (!permission.allowed) return Response.json({ error: 'Release note not found' }, { status: 404 });
  try {
    const data = await publishReleaseNote({
      id: id.data, actorId: session.user.id, activeOrgId: session.activeWorkspace.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(), offeringId: scope.offering_id, orgId: scope.org_id,
    });
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return safeErrorResponse(error, [
      { match: 'transition', status: 409 },
      { match: /grant|audience|workspace|organi[sz]ation|not found/i, status: 403 },
    ], 'Unable to publish release note');
  }
}
