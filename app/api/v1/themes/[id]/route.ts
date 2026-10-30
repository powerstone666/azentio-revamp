import 'server-only';

import { z } from 'zod';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { getVisibleTheme } from '@/app/api/(services)/learning/shared-learning';

const idSchema = z.string().uuid();

export async function GET(
  _request: Request,
  { params }: { params: Promise<{ id: string }> },
): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });
  const permission = await authorize({ action: 'themes:read' });
  if (!permission.allowed) return Response.json({ error: permission.reason }, { status: 403 });
  const { id: rawId } = await params;
  const id = idSchema.safeParse(rawId);
  if (!id.success) return Response.json({ error: 'Theme not found' }, { status: 404 });
  const theme = await getVisibleTheme(id.data);
  if (!theme) return Response.json({ error: 'Theme not found' }, { status: 404 });
  return Response.json({ data: theme });
}
