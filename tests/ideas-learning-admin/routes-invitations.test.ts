import { auth } from '@/app/api/(services)/auth/better-auth-config';
import { createAuthApiRequest } from '@/app/api/(services)/auth/request-origin';
import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import { reportCommunityComment } from '@/app/api/(services)/learning/comments';
import { deliverEmailOutboxItem } from '@/app/api/(services)/email/outbox';
import {
  acceptInvitation, createInvitation, listPendingInvitations, listWorkspaceMembers, revokeInvitation, revokeWorkspaceMember,
} from '@/app/api/(services)/invitations/service';
import { GET as invitationsGet, POST as invitationsPost } from '@/app/api/v1/invitations/route';
import { POST as acceptPost } from '@/app/api/v1/invitations/accept/route';
import { DELETE as invitationDelete } from '@/app/api/v1/invitations/[id]/route';
import { DELETE as memberDelete } from '@/app/api/v1/members/[membershipId]/route';
import { POST as reportPost } from '@/app/api/v1/shared-copy-comments/[commentId]/reports/route';
import { UUID_A, jsonRequest, routeContext, sessionFixture } from './helpers';

jest.mock('@/app/api/(services)/auth/better-auth-config', () => ({ auth: { api: { getSession: jest.fn() } } }));
jest.mock('@/app/api/(services)/auth/request-origin', () => ({ createAuthApiRequest: jest.fn() }));
jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn() }));
jest.mock('@/app/api/(services)/invitations/service', () => ({
  acceptInvitation: jest.fn(), createInvitation: jest.fn(), listPendingInvitations: jest.fn(),
  listWorkspaceMembers: jest.fn(), revokeInvitation: jest.fn(), revokeWorkspaceMember: jest.fn(),
}));
jest.mock('@/app/api/(services)/email/outbox', () => ({ enqueueEmail: jest.fn(), deliverEmailOutboxItem: jest.fn() }));
jest.mock('@/app/api/(services)/learning/comments', () => ({ reportCommunityComment: jest.fn() }));

const ORIGIN = 'http://portal.test';
const AZENTIO_WORKSPACE = { orgId: 'org-1', orgName: 'Azentio', orgType: 'azentio', role: 'employee', isSandbox: false };
const SANDBOX_WORKSPACE = { orgId: 'org-sbx', orgName: 'Sandbox', orgType: 'client', role: 'client_admin', isSandbox: true };

beforeEach(() => {
  jest.mocked(getSession).mockResolvedValue(sessionFixture() as never);
  jest.mocked(authorize).mockResolvedValue({ allowed: true });
  jest.mocked(deliverEmailOutboxItem).mockResolvedValue('sent');
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

function useWorkspace(workspace: Record<string, unknown> | null) {
  jest.mocked(getSession).mockResolvedValue(sessionFixture({ activeWorkspace: workspace }) as never);
}

describe('GET /api/v1/invitations', () => {
  it('requires a client workspace (demo workspaces count)', async () => {
    useWorkspace(AZENTIO_WORKSPACE);
    expect((await invitationsGet()).status).toBe(409);
    expect(listWorkspaceMembers).not.toHaveBeenCalled();
    useWorkspace(SANDBOX_WORKSPACE);
    expect((await invitationsGet()).status).toBe(200);
  });

  it('returns 401 without a session', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await invitationsGet()).status).toBe(401);
  });

  it('returns 403 when members:list is denied', async () => {
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Action is not permitted' });
    expect((await invitationsGet()).status).toBe(403);
    expect(authorize).toHaveBeenCalledWith({ action: 'members:list' });
  });

  it('returns current members and pending invitations for the workspace', async () => {
    jest.mocked(listWorkspaceMembers).mockResolvedValue([{ membership_id: 'm1' }] as never);
    jest.mocked(listPendingInvitations).mockResolvedValue([{ id: 'inv-1' }] as never);
    const response = await invitationsGet();
    expect(listWorkspaceMembers).toHaveBeenCalledWith('org-1');
    expect(listPendingInvitations).toHaveBeenCalledWith('org-1');
    expect(await response.json()).toEqual({ data: { members: [{ membership_id: 'm1' }], invitations: [{ id: 'inv-1' }] } });
  });
});

describe('POST /api/v1/invitations', () => {
  const invite = { email: 'new.person@acme.test', role: 'client_member' };
  const post = (body: unknown) => invitationsPost(jsonRequest(`${ORIGIN}/api/v1/invitations`, body));

  it('requires a client workspace (demo workspaces count)', async () => {
    useWorkspace(AZENTIO_WORKSPACE);
    expect((await post(invite)).status).toBe(409);
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('returns 403 when members:invite is denied', async () => {
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Action is not permitted' });
    expect((await post(invite)).status).toBe(403);
    expect(authorize).toHaveBeenCalledWith({ action: 'members:invite' });
  });

  it('returns 400 for a body that is not JSON', async () => {
    expect((await post('{oops')).status).toBe(400);
  });

  it.each([
    ['an employee role', { email: 'a@acme.test', role: 'employee' }],
    ['a moderator role', { email: 'a@acme.test', role: 'learning_moderator' }],
    ['a publisher role', { email: 'a@acme.test', role: 'content_publisher' }],
    ['a product owner role', { email: 'a@acme.test', role: 'product_owner' }],
    ['a portal admin role', { email: 'a@acme.test', role: 'portal_admin' }],
    ['a malformed email', { email: 'not-an-email', role: 'client_member' }],
  ])('returns 422 for %s and never creates an invitation', async (_label, body) => {
    const response = await post(body);
    expect(response.status).toBe(422);
    expect((await response.json()).error).toBe('Validation failed');
    expect(createInvitation).not.toHaveBeenCalled();
  });

  it('creates the invitation, never returns the token, and reports the email as sent', async () => {
    jest.mocked(createInvitation).mockResolvedValue({ id: UUID_A, expires_at: new Date('2026-11-07T00:00:00Z'), email_outbox_id: 'outbox-1' } as never);
    const response = await post(invite);
    expect(response.status).toBe(201);
    const body = await response.json();
    expect(body).toEqual({
      data: { id: UUID_A, email: 'new.person@acme.test', role: 'client_member', expires_at: '2026-11-07T00:00:00.000Z' },
      email_status: 'sent',
    });
    const args = jest.mocked(createInvitation).mock.calls[0][0];
    expect(args.token).toHaveLength(43);
    expect(JSON.stringify(body)).not.toContain(args.token);
    expect(args).toMatchObject({ orgId: 'org-1', inviterId: 'user-1', origin: ORIGIN, role: 'client_member' });
    expect(deliverEmailOutboxItem).toHaveBeenCalledWith('outbox-1', ORIGIN);
  });

  it('reports the email as queued when it is not delivered immediately', async () => {
    jest.mocked(createInvitation).mockResolvedValue({ id: UUID_A, expires_at: new Date(), email_outbox_id: 'outbox-1' } as never);
    jest.mocked(deliverEmailOutboxItem).mockResolvedValue('queued');
    const response = await post(invite);
    expect((await response.json()).email_status).toBe('queued');
  });

  it.each([
    ['an existing member', 'This person is already a member', 409],
    ['a live invitation', 'An active invitation already exists for this email', 409],
    ['a lost membership', 'Client workspace membership is no longer active', 403],
  ])('maps %s to %i', async (_label, message, status) => {
    jest.mocked(createInvitation).mockRejectedValue(new Error(message));
    expect((await post(invite)).status).toBe(status);
  });

  it('hides unexpected failures behind a generic 500', async () => {
    jest.mocked(createInvitation).mockRejectedValue(new Error('smtp pool exhausted'));
    const response = await post(invite);
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'Unable to create invitation' });
  });
});

describe('POST /api/v1/invitations/accept', () => {
  const token = 'a'.repeat(43);
  const accept = (body: unknown) => acceptPost(jsonRequest(`${ORIGIN}/api/v1/invitations/accept`, body));
  const acceptance = { token, accept_workspace_terms: true, understands_sharing_is_separate: true };

  beforeEach(() => {
    jest.mocked(auth.api.getSession).mockResolvedValue({ user: { email: 'new.person@acme.test', emailVerified: true, name: 'New Person' } } as never);
    jest.mocked(acceptInvitation).mockResolvedValue({ org_id: 'org-1', role: 'client_member' } as never);
  });

  it('returns 400 for a body that is not JSON', async () => {
    expect((await accept('{bad')).status).toBe(400);
  });

  it.each([
    ['the workspace terms are not accepted', { ...acceptance, accept_workspace_terms: false }],
    ['the sharing explanation is not acknowledged', { ...acceptance, understands_sharing_is_separate: false }],
    ['the token is too short to be an invitation token', { ...acceptance, token: 'short' }],
  ])('returns 422 when %s', async (_label, body) => {
    const response = await accept(body);
    expect(response.status).toBe(422);
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('returns 401 when there is no signed-in session', async () => {
    jest.mocked(auth.api.getSession).mockResolvedValue(null as never);
    expect((await accept(acceptance)).status).toBe(401);
    expect(acceptInvitation).not.toHaveBeenCalled();
  });

  it('returns 401 when the signed-in email has not been verified', async () => {
    jest.mocked(auth.api.getSession).mockResolvedValue({ user: { email: 'new.person@acme.test', emailVerified: false, name: 'N' } } as never);
    expect((await accept(acceptance)).status).toBe(401);
  });

  it('validates the request host before using the session', async () => {
    await accept(acceptance);
    expect(createAuthApiRequest).toHaveBeenCalled();
  });

  it('accepts the invitation for the verified signed-in email and returns the joined workspace', async () => {
    const response = await accept(acceptance);
    expect(acceptInvitation).toHaveBeenCalledWith(expect.objectContaining({ token, verifiedEmail: 'new.person@acme.test', displayName: 'New Person' }));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ data: { org_id: 'org-1', role: 'client_member' } });
  });

  it.each([
    ['an email mismatch', 'Signed-in email does not match this invitation', 403],
    ['a disabled account', 'This account is disabled', 403],
    ['an invalid, expired or used invitation', 'Invitation is no longer valid', 409],
  ])('maps %s to %i', async (_label, message, status) => {
    jest.mocked(acceptInvitation).mockRejectedValue(new Error(message));
    expect((await accept(acceptance)).status).toBe(status);
  });
});

describe('DELETE /api/v1/invitations/[id]', () => {
  const revoke = (id: string) => invitationDelete(new Request('http://t'), routeContext({ id }));

  it('requires a client workspace (demo workspaces count)', async () => {
    useWorkspace(AZENTIO_WORKSPACE);
    expect((await revoke(UUID_A)).status).toBe(409);
  });

  it('returns 403 when members:revoke is denied', async () => {
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Action is not permitted' });
    expect((await revoke(UUID_A)).status).toBe(403);
    expect(authorize).toHaveBeenCalledWith({ action: 'members:revoke' });
  });

  it('returns 404 for a malformed id', async () => {
    expect((await revoke('nope')).status).toBe(404);
    expect(revokeInvitation).not.toHaveBeenCalled();
  });

  it('returns 404 when the invitation is already resolved', async () => {
    jest.mocked(revokeInvitation).mockRejectedValue(new Error('Invitation not found or already resolved'));
    expect((await revoke(UUID_A)).status).toBe(404);
  });

  it('revokes the invitation for the caller\'s workspace and returns the result', async () => {
    jest.mocked(revokeInvitation).mockResolvedValue({ id: UUID_A, revoked: true } as never);
    const response = await revoke(UUID_A);
    expect(revokeInvitation).toHaveBeenCalledWith(UUID_A, 'user-1', 'org-1', expect.any(String));
    expect(await response.json()).toEqual({ data: { id: UUID_A, revoked: true } });
  });
});

describe('DELETE /api/v1/members/[membershipId]', () => {
  const remove = (membershipId: string) => memberDelete(new Request('http://t'), routeContext({ membershipId }));

  it('requires a non-sandbox client workspace', async () => {
    useWorkspace(AZENTIO_WORKSPACE);
    expect((await remove(UUID_A)).status).toBe(409);
  });

  it('returns 403 when members:revoke is denied', async () => {
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'Action is not permitted' });
    expect((await remove(UUID_A)).status).toBe(403);
  });

  it('returns 404 for a malformed membership id', async () => {
    expect((await remove('nope')).status).toBe(404);
    expect(revokeWorkspaceMember).not.toHaveBeenCalled();
  });

  it.each([
    ['revoking your own workspace', 'You cannot revoke your own active workspace', 409],
    ['removing the last client administrator', 'The last client administrator cannot be revoked', 409],
  ])('maps %s to %i', async (_label, message, status) => {
    jest.mocked(revokeWorkspaceMember).mockRejectedValue(new Error(message));
    expect((await remove(UUID_A)).status).toBe(status);
  });

  it('reports any other failure as member not found', async () => {
    jest.mocked(revokeWorkspaceMember).mockRejectedValue(new Error('Member not found'));
    const response = await remove(UUID_A);
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Member not found' });
  });

  it('revokes the membership and returns the result', async () => {
    jest.mocked(revokeWorkspaceMember).mockResolvedValue({ membership_id: UUID_A, status: 'revoked' } as never);
    const response = await remove(UUID_A);
    expect(revokeWorkspaceMember).toHaveBeenCalledWith(UUID_A, 'user-1', 'org-1', expect.any(String));
    expect(await response.json()).toEqual({ data: { membership_id: UUID_A, status: 'revoked' } });
  });
});

describe('POST /api/v1/shared-copy-comments/[commentId]/reports', () => {
  const validReport = { category: 'misleading', details: 'This observation looks wrong' };
  const report = (commentId: string, body: unknown = validReport) =>
    reportPost(jsonRequest(`${ORIGIN}/api/v1/shared-copy-comments/${commentId}/reports`, body), routeContext({ commentId }));

  it('returns 401 without a session and 409 without a workspace', async () => {
    jest.mocked(getSession).mockResolvedValue(null);
    expect((await report(UUID_A)).status).toBe(401);
    useWorkspace(null);
    expect((await report(UUID_A)).status).toBe(409);
  });

  it('returns 404 for a malformed comment id', async () => {
    expect((await report('nope')).status).toBe(404);
  });

  it('returns 403 when community-comment:report is denied', async () => {
    jest.mocked(authorize).mockResolvedValue({ allowed: false, reason: 'An active workspace membership is required' });
    const response = await report(UUID_A);
    expect(authorize).toHaveBeenCalledWith({ action: 'community-comment:report' });
    expect(response.status).toBe(403);
  });

  it.each([
    ['an unknown category', { category: 'spam', details: 'This observation looks wrong' }],
    ['an explanation shorter than ten characters', { category: 'other', details: 'short' }],
  ])('returns 422 for %s', async (_label, body) => {
    expect((await report(UUID_A, body)).status).toBe(422);
    expect(reportCommunityComment).not.toHaveBeenCalled();
  });

  it('opens the report as open and returns 201', async () => {
    jest.mocked(reportCommunityComment).mockResolvedValue({ id: 'rep-1', status: 'open' } as never);
    const response = await report(UUID_A);
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual({ data: { id: 'rep-1', status: 'open' } });
    expect(reportCommunityComment).toHaveBeenCalledWith(UUID_A, 'user-1', 'org-1', validReport, expect.any(String));
  });

  it.each([
    ['a missing comment', new Error('Comment not found'), 404, 'Comment not found'],
    ['a lost membership', new Error('Active workspace membership required'), 403, 'Active workspace membership required'],
    ['a duplicate open report', new Error('duplicate key value violates unique constraint'), 409, 'An open report already exists for this comment'],
  ])('maps %s to %i', async (_label, error, status, message) => {
    jest.mocked(reportCommunityComment).mockRejectedValue(error);
    const response = await report(UUID_A);
    expect(response.status).toBe(status);
    expect(await response.json()).toEqual({ error: message });
  });

  it('hides unexpected failures behind a generic 500', async () => {
    jest.mocked(reportCommunityComment).mockRejectedValue(new Error('deadlock detected'));
    expect((await report(UUID_A)).status).toBe(500);
  });
});
