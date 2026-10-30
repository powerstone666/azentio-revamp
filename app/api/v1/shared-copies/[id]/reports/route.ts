import 'server-only';

import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { reportCreateSchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { reportSharedCopy } from '@/app/api/(services)/contributions/service';

const idSchema = z.string().uuid();

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  if (!session.activeWorkspace) return Response.json({ error: 'Select a workspace first' }, { status: 409 });

  const { id: rawId } = await params;
  const parsedId = idSchema.safeParse(rawId);
  if (!parsedId.success) return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
  const permission = await authorize({ action: 'contribution:report' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return Response.json({ error: 'Invalid JSON body' }, { status: 400 });
  }
  const parsed = reportCreateSchema.safeParse(body);
  if (!parsed.success) return Response.json({ error: 'Validation failed', details: parsed.error.flatten() }, { status: 422 });

  try {
    const report = await reportSharedCopy(
      parsedId.data,
      session.user.id,
      session.activeWorkspace.orgId,
      parsed.data,
      request.headers.get('x-request-id')?.slice(0, 100) || randomUUID(),
    );
    return Response.json({ data: report }, { status: 201 });
  } catch (error) {
    if (error instanceof Error && error.message.includes('not found')) {
      return Response.json({ error: 'Shared contribution not found' }, { status: 404 });
    }
    return Response.json({ error: 'Unable to submit report' }, { status: 500 });
  }
}
