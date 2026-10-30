import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { drainSupportTicketOutbox } from '@/app/api/(services)/support/outbox';

export async function POST(request: Request): Promise<Response> {
  const expected = process.env.OUTBOX_JOB_TOKEN;
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  if (!expected || supplied.length !== expected.length
      || !timingSafeEqual(Buffer.from(supplied), Buffer.from(expected))) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  try {
    return Response.json({ data: await drainSupportTicketOutbox() }, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch {
    return Response.json({ error: 'Unable to drain support ticket outbox' }, { status: 500 });
  }
}
