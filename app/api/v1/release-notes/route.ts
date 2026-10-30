import 'server-only';

import { authorize } from '@/app/api/(services)/authz/authorize';
import { getSession } from '@/app/api/(services)/authz/session';
import { listClientReleaseNotes, listEmployeeReleaseNotes } from '@/app/api/(services)/releases/service';
import { createReleaseNote } from '@/app/api/(services)/releases/service';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { safeErrorResponse } from '@/app/api/(services)/http/safe-error';

const createSchema = z.object({
  title: z.string().trim().min(3).max(200),
  body: z.string().trim().min(10).max(10000),
  audience: z.enum(['employees', 'clients']),
  offering_id: z.string().trim().min(1).max(100).nullable().optional(),
  org_id: z.string().uuid().nullable().optional(),
}).strict();

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const workspace = session.activeWorkspace;
  if (!workspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });

  const employeeAudience = workspace.orgType === 'azentio';
  const permission = await authorize({ action: employeeAudience ? 'portal:employee:read' : 'portal:client:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });

  try {
    const data = employeeAudience
      ? await listEmployeeReleaseNotes(session.user.id, workspace.orgId)
      : await listClientReleaseNotes(session.user.id, workspace.orgId);
    return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Unable to load release notes' }, { status: 403, headers: { 'Cache-Control': 'private, no-store' } });
  }
}

export async function POST(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });
  let body: unknown;
  try { body = await request.json(); } catch { return Response.json({ error: 'Invalid JSON body' }, { status: 400 }); }
  const parsed = createSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });
  const offeringId = parsed.data.offering_id ?? null;
  const permission = await authorize({ action: 'release-notes:manage', resource: { type: 'release_note', offeringId: offeringId ?? undefined } });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  try {
    const data = await createReleaseNote({
      actorId: session.user.id,
      activeOrgId: session.activeWorkspace.orgId,
      requestId: request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
      title: parsed.data.title,
      body: parsed.data.body,
      audience: parsed.data.audience,
      offeringId,
      orgId: parsed.data.org_id ?? null,
    });
    return Response.json({ data }, { status: 201, headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) {
    return safeErrorResponse(error, [{ match: 'grant', status: 403 }, { match: /grant|audience|workspace|transition|Draft release note|organi[sz]ation|\bstate\b/i, status: 422 }], 'Unable to create release note');
  }
}
