import { query, queryOne, transaction } from '@/app/api/(db)/client';
import {
  createCommunityComment, listCommunityComments, reportCommunityComment, setCommunityCommentVisibility,
  updateCommunityCommentReport,
} from '@/app/api/(services)/learning/comments';
import {
  createSavedSearch, deleteSavedSearch, isBookmarked, listBookmarkedCopies, listSavedSearches, setBookmark,
} from '@/app/api/(services)/learning/personalization';
import { getMySharedCopyFeedback, saveSharedCopyFeedback } from '@/app/api/(services)/learning/feedback';
import { mockDb } from '@/tests/support/db';
import { UUID_A, UUID_B, callsMatching, metadataOf, respondTo, sqlCalls } from './helpers';

jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  query.mockResolvedValue([]);
  queryOne.mockResolvedValue(null);
  mockDb({ query, queryOne, transaction });
});

const MEMBERSHIP_SQL = 'SELECT m.id FROM memberships m JOIN organizations o';
const VISIBLE_COPY_SQL = 'SELECT s.id, c.id AS contribution_id, c.org_id';
const MODERATOR_GRANT_SQL = "role = 'learning_moderator'";

describe('shared copy comments', () => {
  it('lists only visible comments, labels the reader\'s own comments, and keeps sandbox parity', async () => {
    await listCommunityComments(UUID_A, 'user-1', 'org-1');
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain("WHEN cm.author_user_id = $2 THEN 'You' ELSE 'Community member' END");
    expect(sql).toContain("cm.status = 'visible'");
    expect(sql).toContain('workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $3');
    expect(sql).toContain('workspace.is_sandbox = false AND source_org.is_sandbox = false');
    expect(params).toEqual([UUID_A, 'user-1', 'org-1']);
  });

  it('refuses to create a comment without an active workspace membership', async () => {
    respondTo(query, [[MEMBERSHIP_SQL, []]]);
    await expect(createCommunityComment(UUID_A, 'user-1', 'org-1', { body: 'Helpful' }, 'req-1'))
      .rejects.toThrow('Active workspace membership required');
    expect(callsMatching(query, 'INSERT INTO shared_copy_comments')).toHaveLength(0);
  });

  it('refuses to comment on a copy that is not visible to the workspace', async () => {
    respondTo(query, [[MEMBERSHIP_SQL, [{ id: 'm1' }]], [VISIBLE_COPY_SQL, []]]);
    await expect(createCommunityComment(UUID_A, 'user-1', 'org-1', { body: 'Helpful' }, 'req-1'))
      .rejects.toThrow('Shared contribution not found');
    expect(callsMatching(query, 'INSERT INTO shared_copy_comments')).toHaveLength(0);
  });

  it('stores the comment and writes a shared_comment.create audit row', async () => {
    respondTo(query, [
      [MEMBERSHIP_SQL, [{ id: 'm1' }]],
      [VISIBLE_COPY_SQL, [{ id: UUID_A, contribution_id: 'contrib-1', org_id: 'org-src' }]],
      ['INSERT INTO shared_copy_comments', [{ id: 'cm-1', body: 'Helpful', created_at: new Date('2026-06-01') }]],
    ]);
    await expect(createCommunityComment(UUID_A, 'user-1', 'org-1', { body: 'Helpful' }, 'req-5')).resolves.toMatchObject({
      id: 'cm-1', author_label: 'You', is_mine: true, contribution_id: 'contrib-1',
    });
    const [audit] = callsMatching(query, 'INSERT INTO audit_log');
    expect(audit.sql).toContain("'shared_comment.create'");
    expect(audit.params).toContain('req-5');
  });

  it('reports a visible comment with a trimmed explanation and opens the report', async () => {
    respondTo(query, [
      [MEMBERSHIP_SQL, [{ id: 'm1' }]],
      ['SELECT cm.id, s.id AS shared_copy_id', [{ id: 'cm-1', shared_copy_id: UUID_A, contribution_id: 'contrib-1', source_org_id: 'org-src' }]],
      ['INSERT INTO shared_copy_comment_reports', [{ id: 'rep-1' }]],
    ]);
    await expect(reportCommunityComment('cm-1', 'user-1', 'org-1', { category: 'misleading', details: '  Looks wrong to me  ' }, 'req-1'))
      .resolves.toEqual({ id: 'rep-1', status: 'open', org_id: 'org-src', contribution_id: 'contrib-1' });
    const [insert] = callsMatching(query, 'INSERT INTO shared_copy_comment_reports');
    expect(insert.params).toEqual(['cm-1', 'user-1', 'misleading', 'Looks wrong to me']);
    expect(metadataOf(callsMatching(query, 'INSERT INTO audit_log')[0].params)).toMatchObject({ comment_id: 'cm-1', shared_copy_id: UUID_A });
  });

  it('does not allow reporting a comment that is hidden or outside the workspace scope', async () => {
    respondTo(query, [
      [MEMBERSHIP_SQL, [{ id: 'm1' }]],
      ['SELECT cm.id, s.id AS shared_copy_id', []],
    ]);
    await expect(reportCommunityComment('cm-1', 'user-1', 'org-1', { category: 'other', details: 'Reason text here' }, 'req-1'))
      .rejects.toThrow('Comment not found');
    expect(callsMatching(query, 'INSERT INTO shared_copy_comment_reports')).toHaveLength(0);
  });

  it('requires a platform-level or workspace-scoped moderator grant before changing comment visibility', async () => {
    respondTo(query, [[MODERATOR_GRANT_SQL, []]]);
    await expect(setCommunityCommentVisibility('cm-1', 'mod-1', 'org-1', 'hidden', 'req-1'))
      .rejects.toThrow('Active moderator grant required');
    expect(callsMatching(query, 'UPDATE shared_copy_comments')).toHaveLength(0);
  });

  it('scopes the moderator grant to the workspace or a platform-wide grant', async () => {
    respondTo(query, [[MODERATOR_GRANT_SQL, []]]);
    await expect(setCommunityCommentVisibility('cm-1', 'mod-1', 'org-1', 'hidden', 'req-1')).rejects.toThrow();
    expect(callsMatching(query, MODERATOR_GRANT_SQL)[0].sql).toContain('(org_id = $2 OR org_id IS NULL)');
  });

  it.each([
    ['deleted', 'hidden', 'Comment not found'],
  ])('refuses to change a %s comment to %s', async (current, next, message) => {
    respondTo(query, [
      [MODERATOR_GRANT_SQL, [{ id: 'g1' }]],
      ['SELECT cm.status FROM shared_copy_comments cm', [{ status: current }]],
    ]);
    await expect(setCommunityCommentVisibility('cm-1', 'mod-1', 'org-1', next as 'hidden', 'req-1')).rejects.toThrow(message);
  });

  it('is a no-op when the comment already has the requested visibility', async () => {
    respondTo(query, [
      [MODERATOR_GRANT_SQL, [{ id: 'g1' }]],
      ['SELECT cm.status FROM shared_copy_comments cm', [{ status: 'hidden' }]],
    ]);
    await expect(setCommunityCommentVisibility('cm-1', 'mod-1', 'org-1', 'hidden', 'req-1'))
      .resolves.toEqual({ id: 'cm-1', status: 'hidden' });
    expect(callsMatching(query, 'UPDATE shared_copy_comments')).toHaveLength(0);
    expect(callsMatching(query, 'INSERT INTO audit_log')).toHaveLength(0);
  });

  it.each([
    ['visible', 'hidden'],
    ['hidden', 'visible'],
  ])('changes a comment from %s to %s and audits both states', async (from, to) => {
    respondTo(query, [
      [MODERATOR_GRANT_SQL, [{ id: 'g1' }]],
      ['SELECT cm.status FROM shared_copy_comments cm', [{ status: from }]],
    ]);
    await expect(setCommunityCommentVisibility('cm-1', 'mod-1', 'org-1', to as 'visible', 'req-1'))
      .resolves.toEqual({ id: 'cm-1', status: to });
    expect(callsMatching(query, 'UPDATE shared_copy_comments SET status')[0].params).toEqual([to, 'cm-1']);
    expect(metadataOf(callsMatching(query, 'INSERT INTO audit_log')[0].params)).toEqual({ from_status: from, to_status: to });
  });

  it.each([
    ['open', 'investigating', true],
    ['open', 'resolved', true],
    ['investigating', 'resolved', true],
    ['investigating', 'open', false],
    ['open', 'open', false],
    ['investigating', 'investigating', false],
    ['resolved', 'investigating', false],
    ['resolved', 'resolved', false],
  ])('report status %s to %s allowed: %s', async (from, to, allowed) => {
    respondTo(query, [
      [MODERATOR_GRANT_SQL, [{ id: 'g1' }]],
      ['SELECT r.status FROM shared_copy_comment_reports r', [{ status: from }]],
    ]);
    const attempt = updateCommunityCommentReport('rep-1', 'mod-1', 'org-1', to as 'resolved', 'req-1');
    if (allowed) {
      await expect(attempt).resolves.toEqual({ id: 'rep-1', status: to });
      expect(callsMatching(query, 'UPDATE shared_copy_comment_reports SET status')).toHaveLength(1);
      expect(metadataOf(callsMatching(query, 'INSERT INTO audit_log')[0].params)).toEqual({ from_status: from, to_status: to });
    } else {
      await expect(attempt).rejects.toThrow('Report status transition is not allowed');
      expect(callsMatching(query, 'UPDATE shared_copy_comment_reports SET status')).toHaveLength(0);
    }
  });

  it('reports a missing or out-of-scope report as not found', async () => {
    respondTo(query, [[MODERATOR_GRANT_SQL, [{ id: 'g1' }]]]);
    await expect(updateCommunityCommentReport('rep-404', 'mod-1', 'org-1', 'resolved', 'req-1')).rejects.toThrow('Report not found');
  });
});

describe('saved searches and bookmarks', () => {
  it('limits saved searches to the owner and the workspace', async () => {
    await listSavedSearches('user-1', 'org-1');
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain('WHERE user_id = $1 AND org_id = $2');
    expect(params).toEqual(['user-1', 'org-1']);
  });

  it('refuses to save a search without an active client membership', async () => {
    respondTo(query, [[MEMBERSHIP_SQL, []]]);
    await expect(createSavedSearch('user-1', 'org-1', { name: 'Lending', filters: {}, digest_enabled: false } as never))
      .rejects.toThrow('Active client workspace membership required');
    expect(callsMatching(query, 'INSERT INTO client_saved_searches')).toHaveLength(0);
  });

  it('only lets sandbox grants stand in for a client membership inside a sandbox client workspace', async () => {
    respondTo(query, [[MEMBERSHIP_SQL, [{ id: 'm1' }]]]);
    await createSavedSearch('user-1', 'org-1', { name: 'Lending', filters: {}, digest_enabled: false } as never);
    const [membership] = callsMatching(query, MEMBERSHIP_SQL);
    expect(membership.sql).toContain("o.type = 'client' AND o.status = 'active'");
    expect(membership.sql).toContain('(o.is_sandbox = true AND EXISTS');
    expect(membership.sql).toContain("g.role IN ('client_member', 'client_admin')");
  });

  it('upserts by name and clears the digest watermark when digests are switched off', async () => {
    respondTo(query, [
      [MEMBERSHIP_SQL, [{ id: 'm1' }]],
      ['INSERT INTO client_saved_searches', [{ id: 'ss-1', name: 'Lending' }]],
    ]);
    await expect(createSavedSearch('user-1', 'org-1', { name: 'Lending', filters: { offering: 'FAI' }, digest_enabled: false } as never))
      .resolves.toEqual({ id: 'ss-1', name: 'Lending' });
    const [insert] = callsMatching(query, 'INSERT INTO client_saved_searches');
    expect(insert.sql).toContain('ON CONFLICT (user_id, org_id, name) DO UPDATE');
    expect(insert.sql).toContain('CASE WHEN EXCLUDED.digest_enabled THEN client_saved_searches.last_digest_at ELSE NULL END');
    expect(insert.params).toEqual(['user-1', 'org-1', 'Lending', JSON.stringify({ offering: 'FAI' }), false]);
  });

  it('deletes only the caller\'s own saved search and reports whether anything was removed', async () => {
    respondTo(query, [[MEMBERSHIP_SQL, [{ id: 'm1' }]], ['DELETE FROM client_saved_searches', []]]);
    await expect(deleteSavedSearch('ss-1', 'user-1', 'org-1')).resolves.toBe(false);
    respondTo(query, [
      [MEMBERSHIP_SQL, [{ id: 'm1' }]],
      ['DELETE FROM client_saved_searches', [{ id: 'ss-1' }]],
    ]);
    await expect(deleteSavedSearch('ss-1', 'user-1', 'org-1')).resolves.toBe(true);
    expect(callsMatching(query, 'DELETE FROM client_saved_searches')[0].params).toEqual(['ss-1', 'user-1', 'org-1']);
  });

  it('lists bookmarks only for production or same-sandbox copies and the owner', async () => {
    await listBookmarkedCopies('user-1', 'org-1');
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain("c.visibility = 'community_proposed'");
    expect(sql).toContain('workspace.is_sandbox = false AND source_org.is_sandbox = false');
    expect(params).toEqual(['user-1', 'org-1']);
  });

  it('reports bookmark state as a boolean', async () => {
    query.mockResolvedValueOnce([{ exists: true }]);
    await expect(isBookmarked(UUID_A, 'user-1', 'org-1')).resolves.toBe(true);
    query.mockResolvedValueOnce([]);
    await expect(isBookmarked(UUID_A, 'user-1', 'org-1')).resolves.toBe(false);
  });

  it('refuses to bookmark a copy the workspace cannot see', async () => {
    respondTo(query, [[MEMBERSHIP_SQL, [{ id: 'm1' }]], ['SELECT s.id FROM shared_copies s', []]]);
    await expect(setBookmark(UUID_A, 'user-1', 'org-1', true)).rejects.toThrow('Shared contribution not found');
    expect(callsMatching(query, 'INSERT INTO shared_copy_bookmarks')).toHaveLength(0);
  });

  it('bookmarks idempotently and removes bookmarks on request', async () => {
    respondTo(query, [[MEMBERSHIP_SQL, [{ id: 'm1' }]], ['SELECT s.id FROM shared_copies s', [{ id: UUID_A }]]]);
    await expect(setBookmark(UUID_A, 'user-1', 'org-1', true)).resolves.toEqual({ shared_copy_id: UUID_A, bookmarked: true });
    expect(callsMatching(query, 'ON CONFLICT DO NOTHING')).toHaveLength(1);
    await expect(setBookmark(UUID_A, 'user-1', 'org-1', false)).resolves.toEqual({ shared_copy_id: UUID_A, bookmarked: false });
    expect(callsMatching(query, 'DELETE FROM shared_copy_bookmarks')[0].params).toEqual(['user-1', 'org-1', UUID_A]);
  });
});

describe('shared copy feedback', () => {
  it('refuses feedback from someone who is not an active client member', async () => {
    respondTo(query, [[MEMBERSHIP_SQL, []]]);
    await expect(saveSharedCopyFeedback({ sharedCopyId: UUID_A, userId: 'user-1', orgId: 'org-1', feedback: 'useful', requestId: 'r' }))
      .rejects.toThrow('Active client membership required');
    expect(callsMatching(query, 'INSERT INTO shared_copy_feedback')).toHaveLength(0);
  });

  it('refuses feedback on a copy outside the workspace scope', async () => {
    respondTo(query, [[MEMBERSHIP_SQL, [{ id: 'm1' }]], ['SELECT s.id FROM shared_copies s', []]]);
    await expect(saveSharedCopyFeedback({ sharedCopyId: UUID_A, userId: 'user-1', orgId: 'org-1', feedback: 'needs_evidence', requestId: 'r' }))
      .rejects.toThrow('Shared contribution not found');
  });

  it('upserts one feedback value per user and copy and audits it', async () => {
    respondTo(query, [
      [MEMBERSHIP_SQL, [{ id: 'm1' }]],
      ['SELECT s.id FROM shared_copies s', [{ id: UUID_A }]],
      ['INSERT INTO shared_copy_feedback', [{ feedback: 'needs_evidence' }]],
    ]);
    await expect(saveSharedCopyFeedback({ sharedCopyId: UUID_A, userId: 'user-1', orgId: 'org-1', feedback: 'needs_evidence', requestId: 'req-3' }))
      .resolves.toEqual({ feedback: 'needs_evidence' });
    const [insert] = callsMatching(query, 'INSERT INTO shared_copy_feedback');
    expect(insert.sql).toContain('ON CONFLICT (user_id, org_id, shared_copy_id) DO UPDATE');
    const [audit] = callsMatching(query, 'INSERT INTO audit_log');
    expect(audit.sql).toContain("'shared_copy.feedback'");
    expect(metadataOf(audit.params)).toEqual({ feedback: 'needs_evidence' });
  });

  it('only returns the caller\'s own feedback within the same sandbox or production boundary', async () => {
    await getMySharedCopyFeedback(UUID_A, UUID_B, 'org-1');
    const [{ sql, params }] = sqlCalls(queryOne);
    expect(sql).toContain('f.user_id = $2');
    expect(sql).toContain('o.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $3');
    expect(params).toEqual([UUID_A, UUID_B, 'org-1']);
  });
});
