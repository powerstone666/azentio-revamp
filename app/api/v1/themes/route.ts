import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listVisibleThemes } from '@/app/api/(services)/learning/shared-learning';

const filterSchema = z.object({
  offering: z.string().trim().min(1).max(60).optional(),
  topic: z.string().trim().min(1).max(60).optional(),
  period_start: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  period_end: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'themes:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const params = Object.fromEntries(new URL(request.url).searchParams.entries());
  const filters = filterSchema.safeParse(params);
  if (!filters.success) return Response.json({ error: 'Validation failed', details: filters.error.flatten() }, { status: 422 });
  return Response.json({ data: await listVisibleThemes(session.activeWorkspace?.isSandbox ? session.activeWorkspace.orgId : undefined, filters.data) });
}
