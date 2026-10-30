import 'server-only';

import { z } from 'zod';
import { getPublishedPublicPage } from '@/app/api/(services)/public-content/service';

const slugSchema = z.string().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/).max(100);

export async function GET(request: Request): Promise<Response> {
  const slug = slugSchema.safeParse(new URL(request.url).searchParams.get('slug'));
  if (!slug.success) return Response.json({ error: 'Page not found' }, { status: 404 });
  const data = await getPublishedPublicPage(slug.data);
  if (!data) return Response.json({ error: 'Page not found' }, { status: 404, headers: { 'Cache-Control': 'public, max-age=60' } });
  return Response.json({ data }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
}
