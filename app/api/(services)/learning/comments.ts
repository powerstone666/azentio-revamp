import 'server-only';

import type { CommunityCommentCreateInput, ReportCreateInput } from '@/app/(common-lib)/types/schemas';
import { query, transaction } from '@/app/api/(db)/client';

type TxQuery = Parameters<Parameters<typeof transaction>[0]>[0];

async function requireMembership(tx: TxQuery, userId: string, orgId: string) {
  const rows = await tx(
    `SELECT m.id FROM memberships m JOIN organizations o ON o.id = m.org_id
     WHERE m.user_id = $1 AND m.org_id = $2 AND m.status = 'active' AND o.status = 'active'
     FOR SHARE OF m`,
    [userId, orgId],
  );
  if (!rows[0]) throw new Error('Active workspace membership required');
}

async function requireVisibleCopy(tx: TxQuery, sharedCopyId: string, orgId: string) {
  const rows = await tx<{ id: string; contribution_id: string; org_id: string }>(
    `SELECT s.id, c.id AS contribution_id, c.org_id
     FROM shared_copies s
     JOIN contributions c ON c.id = s.contribution_id
     JOIN organizations source_org ON source_org.id = c.org_id
     JOIN organizations workspace ON workspace.id = $2
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE s.id = $1 AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
       AND ((workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $2)
         OR (workspace.is_sandbox = false AND source_org.is_sandbox = false))
       AND c.state = 'published' AND c.withdrawn_at IS NULL AND c.visibility = 'community_proposed'
     FOR SHARE OF s, c`,
    [sharedCopyId, orgId],
  );
  if (!rows[0]) throw new Error('Shared contribution not found');
  return rows[0];
}

export async function listCommunityComments(sharedCopyId: string, userId: string, orgId: string) {
  return query<{ id: string; body: string; created_at: Date; author_label: string; is_mine: boolean }>(
    `SELECT cm.id, cm.body, cm.created_at,
            CASE WHEN cm.author_user_id = $2 THEN 'You' ELSE 'Community member' END AS author_label,
            (cm.author_user_id = $2) AS is_mine
     FROM shared_copy_comments cm
     JOIN shared_copies s ON s.id = cm.shared_copy_id AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
     JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published'
       AND c.withdrawn_at IS NULL AND c.visibility = 'community_proposed'
     JOIN organizations source_org ON source_org.id = c.org_id
     JOIN organizations workspace ON workspace.id = $3
     JOIN contribution_versions v ON v.id = s.source_version_id
     JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
       AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
     WHERE cm.shared_copy_id = $1 AND cm.status = 'visible'
       AND ((workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $3)
         OR (workspace.is_sandbox = false AND source_org.is_sandbox = false))
       AND EXISTS (SELECT 1 FROM memberships m JOIN organizations o ON o.id = m.org_id
         WHERE m.user_id = $2 AND m.org_id = $3 AND m.status = 'active' AND o.status = 'active')
     ORDER BY cm.created_at, cm.id LIMIT 200`,
    [sharedCopyId, userId, orgId],
  );
}

export async function createCommunityComment(
  sharedCopyId: string, userId: string, orgId: string,
  input: CommunityCommentCreateInput, requestId: string,
) {
  return transaction(async (tx) => {
    await requireMembership(tx, userId, orgId);
    const copy = await requireVisibleCopy(tx, sharedCopyId, orgId);
    const inserted = await tx<{ id: string; body: string; created_at: Date }>(
      `INSERT INTO shared_copy_comments (shared_copy_id, author_user_id, body)
       VALUES ($1, $2, $3) RETURNING id, body, created_at`,
      [sharedCopyId, userId, input.body],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'shared_comment.create', 'shared_copy_comment', $2, $3, $4, 'allowed', $5::jsonb)`,
      [userId, inserted[0].id, orgId, requestId, JSON.stringify({ shared_copy_id: sharedCopyId })],
    );
    return { ...inserted[0], author_label: 'You', is_mine: true, contribution_id: copy.contribution_id };
  });
}

export async function reportCommunityComment(
  commentId: string, reporterId: string, orgId: string, input: ReportCreateInput, requestId: string,
) {
  return transaction(async (tx) => {
    await requireMembership(tx, reporterId, orgId);
    const rows = await tx<{ id: string; shared_copy_id: string; contribution_id: string; source_org_id: string }>(
      `SELECT cm.id, s.id AS shared_copy_id, c.id AS contribution_id, c.org_id AS source_org_id
       FROM shared_copy_comments cm
       JOIN shared_copies s ON s.id = cm.shared_copy_id AND s.status = 'active' AND (s.deidentified = true OR s.attribution_consent = true)
       JOIN contributions c ON c.id = s.contribution_id AND c.state = 'published'
         AND c.withdrawn_at IS NULL AND c.visibility = 'community_proposed'
       JOIN organizations source_org ON source_org.id = c.org_id
       JOIN organizations workspace ON workspace.id = $2
       JOIN contribution_versions v ON v.id = s.source_version_id
       JOIN consents co ON co.contribution_id = c.id AND co.version = v.version
         AND co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL
       WHERE cm.id = $1 AND cm.status = 'visible'
         AND ((workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $2)
           OR (workspace.is_sandbox = false AND source_org.is_sandbox = false))
       FOR SHARE OF cm, s, c`,
      [commentId, orgId],
    );
    const comment = rows[0];
    if (!comment) throw new Error('Comment not found');
    const inserted = await tx<{ id: string }>(
      `INSERT INTO shared_copy_comment_reports (comment_id, reporter_user_id, category, details, status)
       VALUES ($1, $2, $3, $4, 'open') RETURNING id`,
      [commentId, reporterId, input.category, input.details.trim()],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'shared_comment.report', 'shared_copy_comment_report', $2, $3, $4, 'allowed', $5::jsonb)`,
      [reporterId, inserted[0].id, orgId, requestId, JSON.stringify({ comment_id: commentId, shared_copy_id: comment.shared_copy_id })],
    );
    return { id: inserted[0].id, status: 'open' as const, org_id: comment.source_org_id, contribution_id: comment.contribution_id };
  });
}

export async function getCommunityCommentReportScope(reportId: string) {
  const rows = await query<{ id: string; comment_id: string; contribution_id: string; org_id: string }>(
    `SELECT r.id, r.comment_id, c.id AS contribution_id, c.org_id
     FROM shared_copy_comment_reports r
     JOIN shared_copy_comments cm ON cm.id = r.comment_id
     JOIN shared_copies s ON s.id = cm.shared_copy_id
     JOIN contributions c ON c.id = s.contribution_id WHERE r.id = $1`,
    [reportId],
  );
  return rows[0] ?? null;
}

export async function listCommunityCommentReports(orgId?: string) {
  return query<{
    id: string; comment_id: string; contribution_id: string; org_id: string;
    comment_body: string; comment_status: string; category: string; details: string; status: string; created_at: Date;
  }>(
    `SELECT r.id, cm.id AS comment_id, c.id AS contribution_id, c.org_id,
            cm.body AS comment_body, cm.status AS comment_status, r.category, r.details, r.status, r.created_at
     FROM shared_copy_comment_reports r
     JOIN shared_copy_comments cm ON cm.id = r.comment_id
     JOIN shared_copies s ON s.id = cm.shared_copy_id
     JOIN contributions c ON c.id = s.contribution_id
     WHERE ($1::uuid IS NULL OR c.org_id = $1)
     ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'investigating' THEN 1 ELSE 2 END,
              r.created_at DESC, r.id DESC LIMIT 200`,
    [orgId ?? null],
  );
}

export async function getCommunityCommentScope(commentId: string) {
  const rows = await query<{ id: string; contribution_id: string; org_id: string; status: string }>(
    `SELECT cm.id, c.id AS contribution_id, c.org_id, cm.status
     FROM shared_copy_comments cm
     JOIN shared_copies s ON s.id = cm.shared_copy_id
     JOIN contributions c ON c.id = s.contribution_id WHERE cm.id = $1`,
    [commentId],
  );
  return rows[0] ?? null;
}

export async function setCommunityCommentVisibility(
  commentId: string, moderatorId: string, orgId: string, status: 'visible' | 'hidden', requestId: string,
) {
  return transaction(async (tx) => {
    const grant = await tx<{ id: string }>(
      `SELECT id FROM role_grants WHERE user_id = $1 AND role = 'learning_moderator'
       AND (org_id = $2 OR org_id IS NULL) AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now()) LIMIT 1 FOR SHARE`,
      [moderatorId, orgId],
    );
    if (!grant[0]) throw new Error('Active moderator grant required');
    const rows = await tx<{ status: string }>(
      `SELECT cm.status FROM shared_copy_comments cm
       JOIN shared_copies s ON s.id = cm.shared_copy_id
       JOIN contributions c ON c.id = s.contribution_id
       WHERE cm.id = $1 AND c.org_id = $2 FOR UPDATE OF cm`,
      [commentId, orgId],
    );
    const comment = rows[0];
    if (!comment || comment.status === 'deleted') throw new Error('Comment not found');
    if (comment.status === status) return { id: commentId, status };
    await tx(
      `UPDATE shared_copy_comments SET status = $1, updated_at = now() WHERE id = $2`,
      [status, commentId],
    );
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'shared_comment.visibility_update', 'shared_copy_comment', $2, $3, $4, 'allowed', $5::jsonb)`,
      [moderatorId, commentId, orgId, requestId, JSON.stringify({ from_status: comment.status, to_status: status })],
    );
    return { id: commentId, status };
  });
}

export async function updateCommunityCommentReport(
  reportId: string, moderatorId: string, orgId: string,
  status: 'investigating' | 'resolved', requestId: string,
) {
  return transaction(async (tx) => {
    const grant = await tx<{ id: string }>(
      `SELECT id FROM role_grants WHERE user_id = $1 AND role = 'learning_moderator'
       AND (org_id = $2 OR org_id IS NULL) AND revoked_at IS NULL
       AND (expires_at IS NULL OR expires_at > now()) LIMIT 1 FOR SHARE`,
      [moderatorId, orgId],
    );
    if (!grant[0]) throw new Error('Active moderator grant required');
    const rows = await tx<{ status: string }>(
      `SELECT r.status FROM shared_copy_comment_reports r
       JOIN shared_copy_comments cm ON cm.id = r.comment_id
       JOIN shared_copies s ON s.id = cm.shared_copy_id
       JOIN contributions c ON c.id = s.contribution_id
       WHERE r.id = $1 AND c.org_id = $2 FOR UPDATE OF r`,
      [reportId, orgId],
    );
    const report = rows[0];
    if (!report) throw new Error('Report not found');
    const allowed = report.status === 'open'
      ? ['investigating', 'resolved']
      : report.status === 'investigating' ? ['resolved'] : [];
    if (!allowed.includes(status)) throw new Error('Report status transition is not allowed');
    await tx('UPDATE shared_copy_comment_reports SET status = $1 WHERE id = $2', [status, reportId]);
    await tx(
      `INSERT INTO audit_log (actor_id, action, target_type, target_id, active_org_id, request_id, decision, metadata)
       VALUES ($1, 'shared_comment.report_status', 'shared_copy_comment_report', $2, $3, $4, 'allowed', $5::jsonb)`,
      [moderatorId, reportId, orgId, requestId, JSON.stringify({ from_status: report.status, to_status: status })],
    );
    return { id: reportId, status };
  });
}
