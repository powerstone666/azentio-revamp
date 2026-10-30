import 'server-only';

import { getLivePublicAnnouncement } from '@/app/api/(services)/public-content/service';

export async function GET(): Promise<Response> {
  const data = await getLivePublicAnnouncement();
  return Response.json({ data }, { headers: { 'Cache-Control': 'public, max-age=60, stale-while-revalidate=300' } });
}
