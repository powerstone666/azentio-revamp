import 'server-only';

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { listPublicSubmissions } from '@/app/api/(services)/public-submissions/service';

export async function GET(): Promise<Response> {
  const session = await getSession();
  if (!session) return Response.json({ error: 'Authentication required' }, { status: 401 });

  const permission = await authorize({ action: 'public-submissions:manage' });
  if (!permission.allowed) return Response.json({ error: 'Public submission management access required' }, { status: 403 });

  try {
    const submissions = await listPublicSubmissions();
    return Response.json({ data: { submissions } }, { headers: { 'Cache-Control': 'private, no-store, max-age=0' } });
  } catch (error) {
    console.error('Public submission inbox could not be loaded:', error);
    return Response.json({ error: 'Unable to load public submissions' }, { status: 500 });
  }
}
