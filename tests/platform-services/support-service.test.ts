jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import {
  createClientSupportTicket,
  getClientSupportTicket,
  listClientSupportTickets,
  listSupportAccessibleOrganizations,
  listSupportTicketsForOrganization,
  updateSupportTicketStatus,
} from '@/app/api/(services)/support/service';

const USER = 'user-1';
const ORG = 'org-1';
const TICKET = 'ticket-1';

type SqlCall = [string, unknown[]?];
const sqlCalls = () => query.mock.calls as SqlCall[];

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

describe('client support ticket listing and reads', () => {
  it.each([
    ['a client member', false],
    ['a client admin', true],
  ])('lists tickets for %s with the admin flag passed to SQL', async (_label, isAdmin) => {
    queryOne.mockResolvedValueOnce({ is_member: true, is_admin: isAdmin });
    query.mockResolvedValueOnce([]);
    await listClientSupportTickets(USER, ORG);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/WHERE t\.org_id = \$2 AND \(\$3::boolean = true OR t\.requester_user_id = \$1\)/);
    expect(params).toEqual([USER, ORG, isAdmin]);
  });

  it('refuses to list tickets for a user without an active client membership in the org', async () => {
    queryOne.mockResolvedValueOnce({ is_member: false, is_admin: false });
    await expect(listClientSupportTickets(USER, ORG)).rejects.toThrow('Active client membership required');
    expect(query).not.toHaveBeenCalled();
  });

  it('refuses to list tickets when the membership lookup returns nothing', async () => {
    queryOne.mockResolvedValueOnce(null);
    await expect(listClientSupportTickets(USER, ORG)).rejects.toThrow('Active client membership required');
  });

  it.each([
    ['a client member', false, null],
    ['a client admin', true, ORG],
  ])('reads a single ticket as %s restricted by org and requester', async (_label, isAdmin) => {
    queryOne.mockResolvedValueOnce({ is_member: true, is_admin: isAdmin });
    queryOne.mockResolvedValueOnce({ id: TICKET });
    await getClientSupportTicket(TICKET, USER, ORG);
    const [sql, params] = queryOne.mock.calls[1] as SqlCall;
    expect(sql).toMatch(/WHERE id = \$1 AND org_id = \$2 AND \(\$4::boolean = true OR requester_user_id = \$3\)/);
    expect(params).toEqual([TICKET, ORG, USER, isAdmin]);
  });

  it('does not read a ticket for a user outside the client membership', async () => {
    queryOne.mockResolvedValueOnce({ is_member: false, is_admin: false });
    await expect(getClientSupportTicket(TICKET, USER, ORG)).rejects.toThrow('Active client membership required');
    expect(queryOne).toHaveBeenCalledTimes(1);
  });
});

describe('createClientSupportTicket', () => {
  it('refuses to create a ticket without an active client membership and writes nothing', async () => {
    query.mockResolvedValueOnce([]);
    await expect(createClientSupportTicket({
      userId: USER, orgId: ORG, requestId: 'req-1', subject: 'Help', details: 'Details', category: 'access',
    })).rejects.toThrow('Active client membership required');
    expect(sqlCalls()).toHaveLength(1);
  });

  it('inserts an open normal-priority ticket, queues its webhook outbox row (skipping sandboxes) and audits it in one transaction', async () => {
    query
      .mockResolvedValueOnce([{ id: 'm-1' }])
      .mockResolvedValueOnce([{ id: TICKET, created_at: new Date('2026-10-01'), updated_at: new Date('2026-10-01') }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);

    const ticket = await createClientSupportTicket({
      userId: USER, orgId: ORG, requestId: 'req-1', subject: 'Cannot log in', details: 'Since Monday', category: 'access',
    });

    expect(transaction).toHaveBeenCalledTimes(1);
    const insert = sqlCalls()[1];
    expect(insert[0]).toMatch(/INSERT INTO client_support_tickets/);
    expect(insert[0]).toMatch(/'open', 'normal'/);
    expect(insert[1]).toEqual([ORG, USER, 'Cannot log in', 'Since Monday', 'access']);

    const outbox = sqlCalls()[2];
    expect(outbox[0]).toMatch(/INSERT INTO support_ticket_outbox/);
    expect(outbox[0]).toMatch(/ON CONFLICT \(idempotency_key\) DO NOTHING/);
    // Sandbox workspaces do not forward tickets to the external webhook.
    expect(outbox[0]).toMatch(/WHERE NOT EXISTS \(SELECT 1 FROM organizations WHERE id = \$3 AND is_sandbox = true\)/);
    expect(outbox[1]).toEqual([TICKET, `client-support-ticket:${TICKET}:created`, ORG]);

    const audit = sqlCalls()[3];
    expect(audit[0]).toMatch(/'client\.support_ticket\.create'/);
    expect(audit[1]).toEqual([USER, TICKET, ORG, 'req-1', JSON.stringify({ category: 'access' })]);

    expect(ticket).toMatchObject({ id: TICKET, org_id: ORG, status: 'open', priority: 'normal', requester_user_id: USER });
  });

  it.each(['product_question', 'access', 'technical_issue', 'other'] as const)(
    'records the %s category in both the ticket row and the audit metadata',
    async (category) => {
      query
        .mockResolvedValueOnce([{ id: 'm-1' }])
        .mockResolvedValueOnce([{ id: TICKET, created_at: new Date(), updated_at: new Date() }])
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([]);
      await createClientSupportTicket({ userId: USER, orgId: ORG, requestId: 'r', subject: 'S', details: 'D', category });
      expect(sqlCalls()[1][1]).toContain(category);
      expect(JSON.parse((sqlCalls()[3][1] as unknown[])[4] as string)).toEqual({ category });
    },
  );
});

describe('organisation-wide support ticket access', () => {
  it('lists accessible organisations only for unrevoked, unexpired, active support access', async () => {
    query.mockResolvedValueOnce([]);
    await listSupportAccessibleOrganizations('admin-1');
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/sa\.contribution_id IS NULL/);
    expect(sql).toMatch(/sa\.revoked_at IS NULL AND sa\.expires_at > now\(\) AND o\.status = 'active'/);
    expect(params).toEqual(['admin-1']);
  });

  it('lists an organisation\'s tickets inside a transaction after confirming support access', async () => {
    query
      .mockResolvedValueOnce([{ id: 'sa-1' }])
      .mockResolvedValueOnce([{ id: TICKET }]);
    await expect(listSupportTicketsForOrganization('admin-1', ORG)).resolves.toEqual([{ id: TICKET }]);
    expect(transaction).toHaveBeenCalledTimes(1);
    const [accessSql, accessParams] = sqlCalls()[0];
    expect(accessSql).toMatch(/FOR SHARE OF sa/);
    expect(accessParams).toEqual(['admin-1', ORG]);
    const [listSql, listParams] = sqlCalls()[1];
    expect(listSql).toMatch(/WHERE t\.org_id = \$1/);
    expect(listParams).toEqual([ORG]);
  });

  it('never lists tickets when the admin has no organisation-wide support access', async () => {
    query.mockResolvedValueOnce([]);
    await expect(listSupportTicketsForOrganization('admin-1', ORG)).rejects.toThrow(
      'Active organisation-wide support access required',
    );
    expect(sqlCalls()).toHaveLength(1);
  });
});

describe('updateSupportTicketStatus', () => {
  function queueUpdate(currentStatus: string, hasAccess = true) {
    query
      .mockResolvedValueOnce([{ org_id: ORG }])
      .mockResolvedValueOnce(hasAccess ? [{ id: 'sa-1' }] : [])
      .mockResolvedValueOnce([{ id: TICKET, org_id: ORG, status: currentStatus }])
      .mockResolvedValueOnce([{ id: TICKET, status: 'resolved', updated_at: new Date() }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([]);
  }

  it.each([
    ['open', 'in_progress'], ['open', 'resolved'], ['open', 'closed'],
    ['in_progress', 'open'], ['in_progress', 'resolved'], ['in_progress', 'closed'],
    ['resolved', 'in_progress'], ['resolved', 'closed'],
  ])('allows the status move %s -> %s', async (from, to) => {
    queueUpdate(from);
    await updateSupportTicketStatus(TICKET, 'admin-1', to as never, 'req-1');
    expect(sqlCalls()[3][0]).toMatch(/UPDATE client_support_tickets SET status = \$1/);
    expect(sqlCalls()[3][1]).toEqual([to, TICKET]);
  });

  it.each([
    ['closed', 'open'], ['closed', 'resolved'], ['closed', 'in_progress'],
    ['resolved', 'open'], ['open', 'open'], ['in_progress', 'in_progress'],
  ])('rejects the status move %s -> %s and does not update the ticket', async (from, to) => {
    queueUpdate(from);
    await expect(updateSupportTicketStatus(TICKET, 'admin-1', to as never, 'req-1')).rejects.toThrow(
      'Support ticket status transition is not allowed',
    );
    expect(sqlCalls()).toHaveLength(3);
  });

  it('audits the change and notifies only the requester with a safe payload', async () => {
    queueUpdate('open');
    await updateSupportTicketStatus(TICKET, 'admin-1', 'resolved', 'req-9');
    const audit = sqlCalls()[4];
    expect(audit[0]).toMatch(/'support_ticket\.status_update'/);
    expect(audit[1]).toEqual(['admin-1', TICKET, ORG, 'req-9', JSON.stringify({ from_status: 'open', to_status: 'resolved' })]);
    const notification = sqlCalls()[5];
    expect(notification[0]).toMatch(/SELECT requester_user_id, 'support_ticket\.status_updated'/);
    expect(notification[1]).toEqual([TICKET, JSON.stringify({ support_ticket_id: TICKET, status: 'resolved' })]);
  });

  it('refuses an admin without organisation-wide access and changes nothing', async () => {
    queueUpdate('open', false);
    await expect(updateSupportTicketStatus(TICKET, 'admin-1', 'closed', 'req-1')).rejects.toThrow(
      'Active organisation-wide support access required',
    );
    expect(sqlCalls()).toHaveLength(2);
  });

  it('reports a missing ticket without checking access', async () => {
    query.mockResolvedValueOnce([]);
    await expect(updateSupportTicketStatus('missing', 'admin-1', 'closed', 'req-1')).rejects.toThrow('Support ticket not found');
    expect(sqlCalls()).toHaveLength(1);
  });
});
