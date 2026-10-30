import 'server-only';

import { timingSafeEqual } from 'node:crypto';
import { drainEmailOutbox } from '@/app/api/(services)/email/outbox';
import { drainNotificationOutbox } from '@/app/api/(services)/notifications/outbox';
import { deliverSavedSearchDigests } from '@/app/api/(services)/learning/digests';
import { drainSharedCopyEmbeddingJobs } from '@/app/api/(services)/learning/semantic-index';

async function runOutbox(request: Request): Promise<Response> {
  const expectedTokens = [process.env.OUTBOX_JOB_TOKEN, process.env.CRON_SECRET].filter((value): value is string => Boolean(value));
  const supplied = request.headers.get('authorization')?.replace(/^Bearer\s+/i, '') ?? '';
  const authorized = expectedTokens.some((expected) => supplied.length === expected.length
    && timingSafeEqual(Buffer.from(supplied), Buffer.from(expected)));
  if (!authorized) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }
  // Scheduled and manual runs do nothing unless explicitly enabled, so no mail, digests or embedding calls go out by accident.
  if (process.env.EMAIL_OUTBOX_JOB_ENABLED !== 'true') {
    return Response.json({ data: { skipped: true, reason: 'EMAIL_OUTBOX_JOB_ENABLED is not true' } }, { headers: { 'Cache-Control': 'no-store' } });
  }
  const origin = new URL(request.url).origin;
  const savedSearchDigests = await deliverSavedSearchDigests(100, origin);
  const notificationHandoff = await drainNotificationOutbox(50, origin);
  const emailDelivery = await drainEmailOutbox(25, origin);
  const semanticIndex = await drainSharedCopyEmbeddingJobs(25);
  return Response.json({ data: { savedSearchDigests, notificationHandoff, emailDelivery, semanticIndex } }, { headers: { 'Cache-Control': 'no-store' } });
}

export const GET = runOutbox;
export const POST = runOutbox;
