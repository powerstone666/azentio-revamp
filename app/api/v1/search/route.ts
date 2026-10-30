import 'server-only';

import { searchQuerySchema } from '@/app/(common-lib)/types/schemas';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { searchApprovedCopies } from '@/app/api/(services)/learning/shared-learning';

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'search:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });

  const parsed = searchQuerySchema.safeParse(Object.fromEntries(new URL(request.url).searchParams));
  if (!parsed.success) return Response.json({ error: 'Invalid search filters', details: parsed.error.flatten() }, { status: 422 });
  try {
    return Response.json(await searchApprovedCopies(parsed.data));
  } catch {
    return Response.json({ error: 'Invalid search cursor' }, { status: 400 });
  }
}
