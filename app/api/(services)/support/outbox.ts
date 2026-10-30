import 'server-only';

import { createHmac } from 'node:crypto';
import { query, queryOne, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];
type Outcome = 'sent' | 'queued' | 'failed' | 'skipped';

function configuredWebhook() {
  const value = process.env.SUPPORT_TICKETS_WEBHOOK_URL;
  const token = process.env.SUPPORT_TICKETS_WEBHOOK_TOKEN;
  if (!value || !token) return null;
  let url: URL;
  try { url = new URL(value); } catch { throw new Error('SUPPORT_TICKETS_WEBHOOK_URL must be a valid URL'); }
  const hostname = url.hostname.replace(/^\[|\]$/g, '');
  const localhost = ['localhost', '127.0.0.1', '::1'].includes(hostname);
  if ((url.protocol !== 'https:' && !(url.protocol === 'http:' && localhost)) || url.username || url.password) {
    throw new Error('Support webhook must use HTTPS (HTTP is allowed only for localhost) and contain no URL credentials');
  }
  return { url: url.toString(), token };
}

async function markFailure(tx: TxQuery, id: string, attempts: number): Promise<'queued' | 'failed'> {
  if (attempts >= 8) {
    await tx(
      `UPDATE support_ticket_outbox SET status = 'failed', locked_at = NULL,
         last_error_code = 'webhook_delivery_failed' WHERE id = $1`,
      [id],
    );
    return 'failed' as const;
  }
  const retryMinutes = Math.min(60, 2 ** Math.min(attempts, 6));
  await tx(
    `UPDATE support_ticket_outbox SET status = 'queued', locked_at = NULL,
       last_error_code = 'webhook_delivery_failed',
       next_attempt_at = now() + ($2::text || ' minutes')::interval WHERE id = $1`,
    [id, retryMinutes],
  );
  return 'queued' as const;
}

export async function deliverSupportTicketOutboxItem(id: string): Promise<Outcome> {
  const config = configuredWebhook();
  if (!config) return 'queued';

  const claimed = await transaction(async (tx) => {
    const rows = await tx<{ id: string; ticket_id: string; attempts: number }>(
      `UPDATE support_ticket_outbox
       SET status = 'processing', attempts = attempts + 1, locked_at = now()
       WHERE id = $1 AND next_attempt_at <= now() AND attempts < 8
         AND (status IN ('queued', 'failed') OR (status = 'processing' AND locked_at < now() - interval '10 minutes'))
       RETURNING id, ticket_id, attempts`,
      [id],
    );
    return rows[0] ?? null;
  });
  if (!claimed) return 'skipped';

  const ticket = await queryOne<{
    id: string; org_id: string; org_name: string; subject: string; details: string;
    category: string; status: string; created_at: Date;
  }>(
    `SELECT t.id, t.org_id, o.name AS org_name, t.subject, t.details, t.category, t.status, t.created_at
     FROM client_support_tickets t JOIN organizations o ON o.id = t.org_id WHERE t.id = $1`,
    [claimed.ticket_id],
  );
  if (!ticket) {
    return transaction((tx) => markFailure(tx, claimed.id, claimed.attempts));
  }

  const payload = JSON.stringify({
    event: 'support_ticket.created',
    idempotency_key: `client-support-ticket:${ticket.id}:created`,
    ticket: {
      id: ticket.id, organization_id: ticket.org_id, organization_name: ticket.org_name,
      subject: ticket.subject, details: ticket.details, category: ticket.category,
      status: ticket.status, created_at: ticket.created_at,
    },
  });
  const signature = createHmac('sha256', config.token).update(payload).digest('hex');

  try {
    const response = await fetch(config.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${config.token}`,
        'Idempotency-Key': `client-support-ticket:${ticket.id}:created`,
        'X-Azentio-Signature': `sha256=${signature}`,
        'X-Azentio-Event': 'support_ticket.created',
      },
      body: payload,
      signal: AbortSignal.timeout(10_000),
      cache: 'no-store',
    });
    if (!response.ok) throw new Error('webhook_delivery_failed');

    let externalTicketId: string | null = null;
    if (response.headers.get('content-type')?.includes('application/json')) {
      const result: unknown = await response.json().catch(() => null);
      if (result && typeof result === 'object' && 'ticket_id' in result
          && typeof result.ticket_id === 'string' && result.ticket_id.length <= 255) {
        externalTicketId = result.ticket_id;
      }
    }
    await transaction(async (tx) => {
      await tx(
        `UPDATE support_ticket_outbox SET status = 'sent', locked_at = NULL,
           delivered_at = now(), last_error_code = NULL WHERE id = $1`,
        [claimed.id],
      );
      await tx(
        `UPDATE client_support_tickets SET external_system = 'webhook',
           external_ticket_id = COALESCE($2, external_ticket_id), updated_at = now() WHERE id = $1`,
        [ticket.id, externalTicketId],
      );
    });
    return 'sent';
  } catch {
    return transaction((tx) => markFailure(tx, claimed.id, claimed.attempts));
  }
}

export async function deliverSupportTicketOutboxForTicket(ticketId: string) {
  const row = await queryOne<{ id: string }>(
    `SELECT id FROM support_ticket_outbox WHERE ticket_id = $1
     ORDER BY created_at DESC, id DESC LIMIT 1`,
    [ticketId],
  );
  return row ? deliverSupportTicketOutboxItem(row.id) : 'skipped';
}

export async function drainSupportTicketOutbox(limit = 25) {
  if (!configuredWebhook()) {
    const queued = await queryOne<{ count: number }>(
      `SELECT count(*)::int AS count FROM support_ticket_outbox WHERE status IN ('queued', 'failed')`,
    );
    return { attempted: 0, sent: 0, queued: queued?.count ?? 0, provider_configured: false };
  }
  const rows = await query<{ id: string }>(
    `SELECT id FROM support_ticket_outbox
     WHERE (status IN ('queued', 'failed') OR (status = 'processing' AND locked_at < now() - interval '10 minutes'))
       AND next_attempt_at <= now() AND attempts < 8
     ORDER BY next_attempt_at, created_at LIMIT $1`,
    [Math.min(Math.max(limit, 1), 100)],
  );
  const outcomes = await Promise.all(rows.map((row) => deliverSupportTicketOutboxItem(row.id)));
  return {
    attempted: outcomes.filter((outcome) => outcome !== 'skipped').length,
    sent: outcomes.filter((outcome) => outcome === 'sent').length,
    queued: outcomes.filter((outcome) => outcome === 'queued').length,
    failed: outcomes.filter((outcome) => outcome === 'failed').length,
    provider_configured: true,
  };
}
