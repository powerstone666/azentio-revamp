import 'server-only';

import { enqueueEmail } from '@/app/api/(services)/email/outbox';
import { renderNotificationEmail } from '@/app/api/(services)/email/renderer';
import { query, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

const SUBJECTS: Record<string, string> = {
  'contribution.published': 'Your contribution was published to shared learning',
  'contribution.needs_clarification': 'A moderator requested an update to your contribution',
  'contribution.rejected': 'There is an update on your contribution',
  'contribution.withdrawn': 'Your contribution was withdrawn',
  'contribution.approved': 'Your contribution was approved',
  'contribution.suspended': 'A shared contribution was temporarily unpublished for review',
  'contribution.reinstated': 'A shared contribution was reinstated',
  'contribution.acknowledged': 'A contribution you shared informed an improvement idea',
  'idea.status_updated': 'An improvement idea has an update',
  'support_ticket.status_updated': 'Your support request has an update',
  'workspace.joined': 'You joined an Azentio workspace',
  'workspace.access_revoked': 'Your Azentio workspace access changed',
  'demo_workspace_ready': 'Your demo workspace is ready',
};

async function handoff(tx: TxQuery, outboxId: string, origin: string): Promise<'queued' | 'skipped'> {
  const rows = await tx<{ id: string; notification_id: string; event: string; email: string; disabled_at: Date | null }>(
    `SELECT o.id, n.id AS notification_id, n.event, u.email, u.disabled_at
     FROM notification_outbox o
     JOIN notifications n ON n.id = o.notification_id
     JOIN users u ON u.id = n.recipient_user_id
     WHERE o.id = $1 AND o.delivered_at IS NULL AND o.attempts < 8
       AND (o.next_attempt_at IS NULL OR o.next_attempt_at <= now())
     FOR UPDATE OF o SKIP LOCKED`, [outboxId],
  );
  const item = rows[0];
  if (!item) return 'skipped';
  if (item.disabled_at) {
    await tx(
      `UPDATE notification_outbox SET delivered_at = now(), last_error_code = 'recipient_disabled'
       WHERE id = $1`, [item.id],
    );
    return 'skipped';
  }
  const eventSubject = SUBJECTS[item.event] ?? 'There is an update in your Azentio portal';
  const rendered = renderNotificationEmail({
    subject: eventSubject,
    heading: eventSubject,
    message: 'There is a new update in your Azentio portal. Sign in to review the latest activity and status.',
    badge: 'Portal Notification',
    actionUrl: '/portal',
    actionLabel: 'Sign in to review →',
    origin,
  });
  await enqueueEmail(tx, {
    idempotencyKey: `notification:${item.notification_id}:email`,
    recipient: item.email,
    subject: rendered.subject,
    text: rendered.text,
    html: rendered.html,
  });
  await tx(
    `UPDATE notification_outbox SET attempts = attempts + 1, delivered_at = now(),
            next_attempt_at = NULL, last_error_code = NULL
     WHERE id = $1`, [item.id],
  );
  return 'queued';
}

export async function drainNotificationOutbox(limit = 50, origin: string) {
  const rows = await query<{ id: string }>(
    `SELECT id FROM notification_outbox
     WHERE delivered_at IS NULL AND attempts < 8
       AND (next_attempt_at IS NULL OR next_attempt_at <= now())
     ORDER BY created_at, id LIMIT $1`, [Math.min(Math.max(limit, 1), 100)],
  );
  let queued = 0;
  let failed = 0;
  for (const row of rows) {
    try {
      const outcome = await transaction((tx) => handoff(tx, row.id, origin));
      if (outcome === 'queued') queued += 1;
    } catch {
      failed += 1;
      await query(
        `UPDATE notification_outbox
         SET attempts = attempts + 1,
             next_attempt_at = now() + (LEAST(60, power(2, LEAST(attempts + 1, 6)))::text || ' minutes')::interval,
             last_error_code = 'email_queue_handoff_failed'
         WHERE id = $1 AND delivered_at IS NULL AND attempts < 8`, [row.id],
      ).catch(() => undefined);
    }
  }
  return { attempted: rows.length, queued, failed };
}
