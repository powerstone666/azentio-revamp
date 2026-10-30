import 'server-only';

import { query, queryOne, transaction } from '@/app/api/(db)/client';

type TicketCategory = 'product_question' | 'access' | 'technical_issue' | 'other';
type TicketStatus = 'open' | 'in_progress' | 'resolved' | 'closed';
type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

async function requireSupportAccess(tx: TxQuery, portalAdminId: string, orgId: string) {
  const rows = await tx<{ id: string }>(
    `SELECT sa.id FROM support_access sa
     JOIN organizations o ON o.id = sa.org_id
     WHERE sa.portal_admin_id = $1 AND sa.org_id = $2 AND sa.contribution_id IS NULL
       AND sa.revoked_at IS NULL AND sa.expires_at > now() AND o.status = 'active'
     ORDER BY sa.expires_at DESC, sa.id LIMIT 1 FOR SHARE OF sa`,
    [portalAdminId, orgId],
  );
  if (!rows[0]) throw new Error('Active organisation-wide support access required');
}

async function activeClientMembership(userId: string, orgId: string) {
  const membership = await queryOne<{ is_member: boolean; is_admin: boolean }>(
    `SELECT (count(*) > 0) AS is_member,
            coalesce(bool_or(m.role = 'client_admin' OR EXISTS (
              SELECT 1 FROM role_grants g WHERE g.user_id = m.user_id AND g.org_id = m.org_id
                AND g.role = 'client_admin' AND g.revoked_at IS NULL AND (g.expires_at IS NULL OR g.expires_at > now())
            )), false) AND NOT coalesce(bool_or(o.is_sandbox), false) AS is_admin
     FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2
       AND (m.role IN ('client_member', 'client_admin') OR (o.is_sandbox = true AND EXISTS (
         SELECT 1 FROM role_grants g WHERE g.user_id = $1 AND g.org_id = $2
           AND g.role IN ('client_member', 'client_admin') AND g.revoked_at IS NULL
           AND (g.expires_at IS NULL OR g.expires_at > now())
       )))
       AND m.status = 'active' AND o.type = 'client' AND o.status = 'active'`,
    [userId, orgId],
  );
  if (!membership?.is_member) throw new Error('Active client membership required');
  return membership.is_admin === true;
}

export async function listClientSupportTickets(userId: string, orgId: string) {
  const isAdmin = await activeClientMembership(userId, orgId);
  return query<{
    id: string; org_id: string; requester_user_id: string; requester: string;
    subject: string; details: string; category: TicketCategory; status: TicketStatus;
    priority: string; created_at: Date; updated_at: Date;
  }>(
    `SELECT t.id, t.org_id, t.requester_user_id, u.display_name AS requester,
            t.subject, t.details, t.category, t.status, t.priority, t.created_at, t.updated_at
     FROM client_support_tickets t
     JOIN users u ON u.id = t.requester_user_id
     WHERE t.org_id = $2 AND ($3::boolean = true OR t.requester_user_id = $1)
     ORDER BY t.updated_at DESC, t.id DESC LIMIT 100`,
    [userId, orgId, isAdmin],
  );
}

export async function createClientSupportTicket(input: {
  userId: string; orgId: string; requestId: string; subject: string;
  details: string; category: TicketCategory;
}) {
  return transaction(async (tx) => {
    const rows = await tx<{ id: string }>(
      `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
       WHERE m.user_id = $1 AND m.org_id = $2
         AND (m.role IN ('client_member', 'client_admin') OR (o.is_sandbox = true AND EXISTS (
           SELECT 1 FROM role_grants g WHERE g.user_id = $1 AND g.org_id = $2
             AND g.role IN ('client_member', 'client_admin') AND g.revoked_at IS NULL
             AND (g.expires_at IS NULL OR g.expires_at > now())
         )))
         AND m.status = 'active' AND o.type = 'client' AND o.status = 'active'
       FOR SHARE OF m`,
      [input.userId, input.orgId],
    );
    if (!rows[0]) throw new Error('Active client membership required');
    const inserted = await tx<{ id: string; created_at: Date; updated_at: Date }>(
      `INSERT INTO client_support_tickets
         (org_id, requester_user_id, subject, details, category, status, priority)
       VALUES ($1, $2, $3, $4, $5, 'open', 'normal')
       RETURNING id, created_at, updated_at`,
      [input.orgId, input.userId, input.subject, input.details, input.category],
    );
    await tx(
      `INSERT INTO support_ticket_outbox (ticket_id, idempotency_key)
       SELECT $1, $2 WHERE NOT EXISTS (SELECT 1 FROM organizations WHERE id = $3 AND is_sandbox = true)
       ON CONFLICT (idempotency_key) DO NOTHING`,
      [inserted[0].id, `client-support-ticket:${inserted[0].id}:created`, input.orgId],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'client.support_ticket.create', 'client_support_ticket', $2, $3, $4, 'allowed', $5::jsonb)`,
      [input.userId, inserted[0].id, input.orgId, input.requestId, JSON.stringify({ category: input.category })],
    );
    return {
      id: inserted[0].id, org_id: input.orgId, requester_user_id: input.userId,
      subject: input.subject, details: input.details, category: input.category,
      status: 'open' as const, priority: 'normal', created_at: inserted[0].created_at,
      updated_at: inserted[0].updated_at,
    };
  });
}

export async function getClientSupportTicket(ticketId: string, userId: string, orgId: string) {
  const isAdmin = await activeClientMembership(userId, orgId);
  return queryOne<{
    id: string; org_id: string; requester_user_id: string; subject: string;
    details: string; category: TicketCategory; status: TicketStatus; priority: string;
    created_at: Date; updated_at: Date;
  }>(
    `SELECT id, org_id, requester_user_id, subject, details, category, status, priority, created_at, updated_at
     FROM client_support_tickets
     WHERE id = $1 AND org_id = $2 AND ($4::boolean = true OR requester_user_id = $3)`,
    [ticketId, orgId, userId, isAdmin],
  );
}

export async function listSupportAccessibleOrganizations(portalAdminId: string) {
  return query<{ id: string; name: string; expires_at: Date }>(
    `SELECT DISTINCT ON (o.id) o.id, o.name, sa.expires_at
     FROM support_access sa JOIN organizations o ON o.id = sa.org_id
     WHERE sa.portal_admin_id = $1 AND sa.contribution_id IS NULL
       AND sa.revoked_at IS NULL AND sa.expires_at > now() AND o.status = 'active'
     ORDER BY o.id, sa.expires_at DESC LIMIT 100`,
    [portalAdminId],
  );
}

export async function listSupportTicketsForOrganization(portalAdminId: string, orgId: string) {
  return transaction(async (tx) => {
    await requireSupportAccess(tx, portalAdminId, orgId);
    return tx(
      `SELECT t.id, t.org_id, t.requester_user_id, u.display_name AS requester,
              t.subject, t.details, t.category, t.status, t.priority, t.created_at, t.updated_at
       FROM client_support_tickets t JOIN users u ON u.id = t.requester_user_id
       WHERE t.org_id = $1 ORDER BY
         CASE t.status WHEN 'open' THEN 0 WHEN 'in_progress' THEN 1 ELSE 2 END,
         t.priority DESC, t.updated_at DESC, t.id DESC LIMIT 200`,
      [orgId],
    );
  });
}

export async function updateSupportTicketStatus(
  ticketId: string, portalAdminId: string, status: TicketStatus, requestId: string,
) {
  return transaction(async (tx) => {
    const scopeRows = await tx<{ org_id: string }>(
      'SELECT org_id FROM client_support_tickets WHERE id = $1',
      [ticketId],
    );
    const scope = scopeRows[0];
    if (!scope) throw new Error('Support ticket not found');
    await requireSupportAccess(tx, portalAdminId, scope.org_id);
    const rows = await tx<{ id: string; org_id: string; status: TicketStatus }>(
      'SELECT id, org_id, status FROM client_support_tickets WHERE id = $1 AND org_id = $2 FOR UPDATE',
      [ticketId, scope.org_id],
    );
    const ticket = rows[0];
    if (!ticket) throw new Error('Support ticket not found');
    const transitions: Record<TicketStatus, TicketStatus[]> = {
      open: ['in_progress', 'resolved', 'closed'],
      in_progress: ['open', 'resolved', 'closed'],
      resolved: ['in_progress', 'closed'],
      closed: [],
    };
    if (!transitions[ticket.status].includes(status)) throw new Error('Support ticket status transition is not allowed');
    const updated = await tx<{ id: string; status: TicketStatus; updated_at: Date }>(
      `UPDATE client_support_tickets SET status = $1, updated_at = now()
       WHERE id = $2 RETURNING id, status, updated_at`,
      [status, ticketId],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'support_ticket.status_update', 'client_support_ticket', $2, $3, $4, 'allowed', $5::jsonb)`,
      [portalAdminId, ticketId, ticket.org_id, requestId, JSON.stringify({ from_status: ticket.status, to_status: status })],
    );
    await tx(
      `INSERT INTO notifications (recipient_user_id, event, safe_payload)
       SELECT requester_user_id, 'support_ticket.status_updated', $2::jsonb
       FROM client_support_tickets WHERE id = $1`,
      [ticketId, JSON.stringify({ support_ticket_id: ticketId, status })],
    );
    return updated[0];
  });
}
