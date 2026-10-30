import 'server-only';

import { query, transaction } from '@/app/api/(db)/client';
import { getSmtpTransport } from './smtp';
import { renderEmailTemplate } from './renderer';
import { BRAND, logoAttachment } from './brand';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

export interface EnqueueEmailInput {
  idempotencyKey: string;
  recipient: string;
  subject: string;
  text: string;
  html: string;
}

export async function enqueueEmail(
  tx: TxQuery,
  email: EnqueueEmailInput,
) {
  const inserted = await tx<{ id: string }>(
    `INSERT INTO email_outbox (idempotency_key, recipient_email, subject, text_body, html_body, status)
     VALUES ($1, $2, $3, $4, $5, 'queued')
     ON CONFLICT (idempotency_key) DO NOTHING
     RETURNING id`,
    [email.idempotencyKey, email.recipient.toLowerCase(), email.subject, email.text, email.html],
  );

  if (inserted[0]) return inserted[0].id;
  const existing = await tx<{ id: string }>('SELECT id FROM email_outbox WHERE idempotency_key = $1', [email.idempotencyKey]);
  if (!existing[0]) throw new Error('Unable to persist email delivery');
  return existing[0].id;
}

export async function deliverEmailOutboxItem(id: string, origin: string): Promise<'sent' | 'queued' | 'skipped'> {
  const claimed = await transaction(async (tx) => {
    const rows = await tx<{
      id: string;
      recipient_email: string;
      subject: string;
      text_body: string;
      html_body?: string | null;
      attempts: number;
    }>(
      `UPDATE email_outbox SET status = 'processing', attempts = attempts + 1, locked_at = now()
       WHERE id = $1 AND next_attempt_at <= now() AND attempts < 8
         AND (status IN ('queued', 'failed') OR (status = 'processing' AND locked_at < now() - interval '10 minutes'))
       RETURNING id, recipient_email, subject, text_body, html_body, attempts`,
      [id],
    );
    return rows[0] ?? null;
  });
  if (!claimed) return 'skipped';

  const mailTransport = getSmtpTransport();
  if (!mailTransport) {
    await query(
      `UPDATE email_outbox SET status = 'failed', locked_at = NULL, last_error_code = 'smtp_not_configured',
              next_attempt_at = now() + interval '5 minutes'
       WHERE id = $1`,
      [id],
    );
    return 'queued';
  }

  try {
    // Generate branded Azentio HTML if not stored directly
    const html = (typeof claimed.html_body === 'string' && claimed.html_body.trim())
      ? claimed.html_body
      : renderEmailTemplate('general', {
          title: claimed.subject,
          paragraphs: claimed.text_body.split('\n\n').filter(Boolean),
        }, { subject: claimed.subject }, origin).html;

    const result = await mailTransport.sendMail({
      from: process.env.SMTP_FROM!,
      to: claimed.recipient_email,
      subject: claimed.subject,
      text: claimed.text_body,
      html,
      attachments: html.includes(`cid:${BRAND.logoCid}`) ? [logoAttachment()] : undefined,
    });
    const delivered = result.accepted.some((recipient: unknown) => String(recipient).toLowerCase() === claimed.recipient_email)
      && result.rejected.every((recipient: unknown) => String(recipient).toLowerCase() !== claimed.recipient_email);
    if (!delivered) throw new Error('smtp_delivery_failed');
    await query("UPDATE email_outbox SET status = 'sent', locked_at = NULL, sent_at = now(), last_error_code = NULL WHERE id = $1", [id]);
    return 'sent';
  } catch {
    const retryMinutes = Math.min(60, 2 ** Math.min(claimed.attempts, 6));
    await query(
      `UPDATE email_outbox SET status = 'failed', locked_at = NULL, last_error_code = 'smtp_delivery_failed',
              next_attempt_at = now() + ($2::text || ' minutes')::interval
       WHERE id = $1`,
      [id, retryMinutes],
    );
    return 'queued';
  }
}

export async function drainEmailOutbox(limit = 25, origin: string) {
  const rows = await query<{ id: string }>(
    `SELECT id FROM email_outbox
     WHERE (status IN ('queued', 'failed') OR (status = 'processing' AND locked_at < now() - interval '10 minutes'))
       AND next_attempt_at <= now() AND attempts < 8
     ORDER BY next_attempt_at, created_at
     LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)],
  );
  const outcomes = await Promise.all(rows.map((row) => deliverEmailOutboxItem(row.id, origin)));
  return {
    attempted: outcomes.filter((outcome) => outcome !== 'skipped').length,
    sent: outcomes.filter((outcome) => outcome === 'sent').length,
    queued: outcomes.filter((outcome) => outcome === 'queued').length,
  };
}
