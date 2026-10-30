import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { suggestApprovedCopyFacets } from '@/app/api/(services)/learning/shared-learning';

const schema = z.object({
  field: z.enum(['offering', 'industry', 'region']),
  q: z.string().trim().max(100).optional(),
});

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'search:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const parsed = schema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: 'Invalid suggestion filters', details: parsed.error.flatten() }, { status: 422 });
  const data = await suggestApprovedCopyFacets(parsed.data.field, parsed.data.q, session.activeWorkspace?.isSandbox ? session.activeWorkspace.orgId : undefined);
  return Response.json({ data }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
}
