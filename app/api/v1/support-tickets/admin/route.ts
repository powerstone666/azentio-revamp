import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listSupportAccessibleOrganizations, listSupportTicketsForOrganization } from '@/app/api/(services)/support/service';

const orgIdSchema = z.string().uuid();

export async function GET(request: Request): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'portal:admin:read' });
  if (!permission.allowed) return Response.json({ error: 'Portal administrator access required' }, { status: 403 });
  const orgIdValue = new URL(request.url).searchParams.get('org_id');
  if (!orgIdValue) {
    const organizations = await listSupportAccessibleOrganizations(session.user.id);
    return Response.json({ data: { organizations } }, { headers: { 'Cache-Control': 'private, no-store' } });
  }
  const orgId = orgIdSchema.safeParse(orgIdValue);
  if (!orgId.success) return Response.json({ error: 'Invalid organisation' }, { status: 422 });
  try {
    const tickets = await listSupportTicketsForOrganization(session.user.id, orgId.data);
    return Response.json({ data: { tickets } }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Active support access is required for this organisation' }, { status: 403 });
  }
}
