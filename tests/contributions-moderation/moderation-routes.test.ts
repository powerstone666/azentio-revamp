jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn() }));
jest.mock('@/app/api/(db)/client', () => ({ query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {} }));
jest.mock('@/app/api/(services)/moderation/service', () => ({
  ...jest.requireActual('@/app/api/(services)/moderation/service'),
  getModerationQueue: jest.fn(),
  listModerationAudit: jest.fn(),
  applyModerationDecision: jest.fn(),
  getModerationReportScope: jest.fn(),
  updateModerationReportStatus: jest.fn(),
}));
jest.mock('@/app/api/(services)/contributions/service', () => ({
  getContributionOwner: jest.fn(),
}));
jest.mock('@/app/api/(services)/learning/comments', () => ({
  getCommunityCommentScope: jest.fn(),
  setCommunityCommentVisibility: jest.fn(),
  getCommunityCommentReportScope: jest.fn(),
  updateCommunityCommentReport: jest.fn(),
}));
jest.mock('@/app/api/(services)/learning/shared-learning', () => ({
  refreshGeneratedThemes: jest.fn(),
}));

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import * as moderation from '@/app/api/(services)/moderation/service';
import * as contributions from '@/app/api/(services)/contributions/service';
import * as comments from '@/app/api/(services)/learning/comments';
import * as sharedLearning from '@/app/api/(services)/learning/shared-learning';
import * as queueRoute from '@/app/api/v1/moderation/queue/route';
import * as auditRoute from '@/app/api/v1/moderation/audit/route';
import * as decisionRoute from '@/app/api/v1/moderation/contributions/[id]/decision/route';
import * as reportRoute from '@/app/api/v1/moderation/reports/[id]/route';
import * as commentRoute from '@/app/api/v1/moderation/comments/[id]/route';
import * as commentReportRoute from '@/app/api/v1/moderation/comment-reports/[id]/route';
import * as themesRoute from '@/app/api/v1/moderation/themes/refresh/route';
import { IDS, bareRequest, ctx, jsonRequest, makeSession } from './fixtures';

const session = getSession as jest.Mock;
const permit = authorize as jest.Mock;
const mod = moderation as unknown as Record<string, jest.Mock>;
const contrib = contributions as unknown as Record<string, jest.Mock>;
const cmt = comments as unknown as Record<string, jest.Mock>;
const learning = sharedLearning as unknown as Record<string, jest.Mock>;
const CONTRIB = IDS.contribution;
const REPORT = IDS.report;
const COMMENT = 'e5f6a7b8-0005-4e9f-8a0b-1c2d3e4f5a6b';

/** A global learning-moderator grant (org_id null, active). */
const globalGrant = (overrides: Record<string, unknown> = {}) => ({
  role: 'learning_moderator', org_id: null, revoked_at: null, expires_at: null, ...overrides,
});

const moderatorSession = (grants: Array<Record<string, unknown>> = []) =>
  makeSession({ userId: IDS.moderator, orgId: IDS.org, orgType: 'azentio', grants });

const VALID_PUBLISH = {
  action: 'publish',
  reason_code: 'quality_review',
  redacted_payload: {
    title: 'Pricing pressure in retail lending',
    observation_type: 'market_observation',
    evidence_type: 'quantitative',
    confidence: 'high',
    body: 'Customers are asking for faster approvals across branches.',
  },
  evidence_quality: 'moderate',
};

beforeEach(() => {
  jest.resetAllMocks();
  session.mockResolvedValue(moderatorSession([globalGrant()]));
  permit.mockResolvedValue({ allowed: true });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/v1/moderation/queue', () => {
  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    expect((await queueRoute.GET()).status).toBe(401);
    expect(mod.getModerationQueue).not.toHaveBeenCalled();
  });

  it('returns 403 with the authorize reason when contribution:moderate is denied', async () => {
    permit.mockResolvedValue({ allowed: false, reason: 'Learning moderator role required' });
    const res = await queueRoute.GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Learning moderator role required' });
    expect(permit).toHaveBeenCalledWith({ action: 'contribution:moderate' });
  });

  it('gives a global moderator the cross-org queue', async () => {
    mod.getModerationQueue.mockResolvedValue([]);
    await queueRoute.GET();
    expect(mod.getModerationQueue).toHaveBeenCalledWith(undefined);
  });

  it.each([
    ['an org-scoped grant', [globalGrant({ org_id: IDS.org })]],
    ['a global grant that is revoked', [globalGrant({ revoked_at: new Date('2026-01-01') })]],
    ['a global grant that has expired', [globalGrant({ expires_at: new Date('2020-01-01') })]],
    ['no moderator grant', []],
  ])('limits the queue to the active org for %s', async (_label, grants) => {
    session.mockResolvedValue(moderatorSession(grants));
    mod.getModerationQueue.mockResolvedValue([]);
    await queueRoute.GET();
    expect(mod.getModerationQueue).toHaveBeenCalledWith(IDS.org);
  });

  it('attaches sensitive_flags to each queue item from the payload, and an empty list when clean', async () => {
    const real = jest.requireActual('@/app/api/(services)/moderation/service') as typeof moderation;
    mod.getModerationQueue.mockResolvedValue([
      { id: CONTRIB, source_payload: { body: 'Reach me at jane.customer@client.example' } },
      { id: 'other', source_payload: { body: 'Clean observation about pricing.' } },
    ]);
    const res = await queueRoute.GET();
    const json = await res.json();
    expect(json.data[0].sensitive_flags).toEqual(real.detectPotentialSensitiveContent({ body: 'Reach me at jane.customer@client.example' }));
    expect(json.data[0].sensitive_flags).toContain('Possible email address');
    expect(json.data[1].sensitive_flags).toEqual([]);
  });
});

describe('GET /api/v1/moderation/audit', () => {
  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    expect((await auditRoute.GET()).status).toBe(401);
  });

  it('returns 403 when audit:list is denied', async () => {
    permit.mockResolvedValue({ allowed: false, reason: 'nope' });
    const res = await auditRoute.GET();
    expect(res.status).toBe(403);
    expect(permit).toHaveBeenCalledWith({ action: 'audit:list' });
  });

  it('shows the cross-org audit trail to a global moderator and the org trail otherwise', async () => {
    mod.listModerationAudit.mockResolvedValue([{ id: 'a' }]);
    await auditRoute.GET();
    expect(mod.listModerationAudit).toHaveBeenLastCalledWith(undefined);

    session.mockResolvedValue(moderatorSession([globalGrant({ org_id: IDS.org })]));
    await auditRoute.GET();
    expect(mod.listModerationAudit).toHaveBeenLastCalledWith(IDS.org);

    session.mockResolvedValue(moderatorSession([globalGrant({ expires_at: new Date('2020-01-01') })]));
    await auditRoute.GET();
    expect(mod.listModerationAudit).toHaveBeenLastCalledWith(IDS.org);
  });

  it('returns the audit entries as data', async () => {
    mod.listModerationAudit.mockResolvedValue([{ id: 'a', action: 'contribution.publish' }]);
    const res = await auditRoute.GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: 'a', action: 'contribution.publish' }] });
  });
});

describe('POST /api/v1/moderation/contributions/[id]/decision', () => {
  function subject(orgId = IDS.org) {
    contrib.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: orgId, state: 'submitted', visibility: 'community_proposed' });
  }
  const decide = (body: unknown, id = CONTRIB) => decisionRoute.POST(jsonRequest(body), ctx(id));

  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    expect((await decide({ action: 'reject', reason_code: 'x' })).status).toBe(401);
  });

  it('returns 404 for a malformed id, and for an unknown contribution', async () => {
    expect((await decide({ action: 'reject', reason_code: 'x' }, 'nope')).status).toBe(404);
    contrib.getContributionOwner.mockResolvedValue(null);
    expect((await decide({ action: 'reject', reason_code: 'x' })).status).toBe(404);
    expect(mod.applyModerationDecision).not.toHaveBeenCalled();
  });

  it('returns 404 when contribution:moderate is denied for the contribution org', async () => {
    subject();
    permit.mockResolvedValue({ allowed: false, reason: 'nope' });
    const res = await decide({ action: 'reject', reason_code: 'x' });
    expect(res.status).toBe(404);
    expect(permit).toHaveBeenCalledWith({
      action: 'contribution:moderate',
      resource: { type: 'contribution', id: CONTRIB, orgId: IDS.org },
    });
  });

  it('returns 400 for a body that is not JSON', async () => {
    subject();
    const res = await decisionRoute.POST(jsonRequest(null, { raw: '{' }), ctx(CONTRIB));
    expect(res.status).toBe(400);
  });

  it.each([
    ['publish without a reviewed copy', { action: 'publish', reason_code: 'x', evidence_quality: 'strong' }, 'redacted_payload'],
    ['publish without evidence quality', { ...VALID_PUBLISH, evidence_quality: undefined }, 'evidence_quality'],
    ['clarify without a question', { action: 'clarify', reason_code: 'x' }, 'clarification_message'],
    ['publish with an extra field in the reviewed copy', {
      ...VALID_PUBLISH, redacted_payload: { ...VALID_PUBLISH.redacted_payload, contact: 'jane@example.com' },
    }, 'redacted_payload'],
    ['an unknown action', { action: 'delete', reason_code: 'x' }, 'action'],
    ['a missing reason code', { action: 'reject' }, 'reason_code'],
  ])('returns 422 with the offending field for %s', async (_label, body, field) => {
    subject();
    const res = await decide(body);
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
    expect(Object.keys(json.details.fieldErrors)).toContain(field);
    expect(mod.applyModerationDecision).not.toHaveBeenCalled();
  });

  it('applies a valid publish decision with 200, passing the parsed input and the org that owns the contribution', async () => {
    subject();
    mod.applyModerationDecision.mockResolvedValue({ id: CONTRIB, state: 'published' });
    const res = await decide(VALID_PUBLISH);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: CONTRIB, state: 'published' } });
    expect(mod.applyModerationDecision).toHaveBeenCalledWith(
      CONTRIB,
      IDS.moderator,
      IDS.org,
      expect.objectContaining({ action: 'publish', evidence_quality: 'moderate', deidentified: true, attribution_consent: false }),
      expect.any(String),
    );
  });

  it('applies a clarification with its question and returns the new state', async () => {
    subject();
    mod.applyModerationDecision.mockResolvedValue({ id: CONTRIB, state: 'needs_clarification' });
    const res = await decide({ action: 'clarify', reason_code: 'missing_evidence', clarification_message: 'Which branches?' });
    expect(res.status).toBe(200);
    expect(mod.applyModerationDecision.mock.calls[0][3]).toMatchObject({ action: 'clarify', clarification_message: 'Which branches?' });
  });

  it('uses the client request id header (truncated) for the decision audit trail', async () => {
    subject();
    mod.applyModerationDecision.mockResolvedValue({ id: CONTRIB, state: 'rejected' });
    await decisionRoute.POST(jsonRequest({ action: 'reject', reason_code: 'out_of_scope' }, { headers: { 'x-request-id': 'mod-7' } }), ctx(CONTRIB));
    expect(mod.applyModerationDecision.mock.calls[0][4]).toBe('mod-7');
  });

  it.each([
    ['Contribution not found', 404, 'Contribution not found'],
    ['Storage and processing consent is not active for this version', 422, 'Storage and processing consent is not active for this version'],
    ['Only community-proposed contributions can be published', 422, 'Only community-proposed contributions can be published'],
    ['Attribution requires explicit contributor consent and a reviewed label', 422, 'Attribution requires explicit contributor consent and a reviewed label'],
    ['Decision is not allowed for the current contribution state', 409, 'Decision is not allowed for this contribution'],
    ['Resolve open reports before reinstating the contribution', 409, 'Decision is not allowed for this contribution'],
  ])('maps the service refusal "%s" to %i', async (message, status, error) => {
    subject();
    mod.applyModerationDecision.mockRejectedValue(new Error(message));
    const res = await decide({ action: 'reject', reason_code: 'x' });
    expect(res.status).toBe(status);
    expect(await res.json()).toEqual({ error });
  });
});

describe('PATCH /api/v1/moderation/reports/[id]', () => {
  function report(orgId = IDS.org) {
    mod.getModerationReportScope.mockResolvedValue({ id: REPORT, contribution_id: CONTRIB, org_id: orgId });
  }
  const patch = (body: unknown, id = REPORT) => reportRoute.PATCH(jsonRequest(body), ctx(id));

  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    expect((await patch({ status: 'resolved' })).status).toBe(401);
  });

  it('returns 404 for a malformed id, or a report that does not exist', async () => {
    expect((await patch({ status: 'resolved' }, 'nope')).status).toBe(404);
    mod.getModerationReportScope.mockResolvedValue(null);
    expect((await patch({ status: 'resolved' })).status).toBe(404);
    expect(mod.updateModerationReportStatus).not.toHaveBeenCalled();
  });

  it('returns 404 when moderation is denied for the report org', async () => {
    report();
    permit.mockResolvedValue({ allowed: false, reason: 'nope' });
    expect((await patch({ status: 'resolved' })).status).toBe(404);
    expect(permit).toHaveBeenCalledWith({
      action: 'contribution:moderate',
      resource: { type: 'contribution', id: CONTRIB, orgId: IDS.org },
    });
  });

  it.each(['open', 'closed', '', undefined])('returns 422 for a status of %j, which is not investigating or resolved', async (status) => {
    report();
    const res = await patch({ status });
    expect(res.status).toBe(422);
    expect(mod.updateModerationReportStatus).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    report();
    const res = await reportRoute.PATCH(jsonRequest(null, { raw: '{' }), ctx(REPORT));
    expect(res.status).toBe(400);
  });

  it('moves the report and returns 200 with the new status', async () => {
    report();
    mod.updateModerationReportStatus.mockResolvedValue({ id: REPORT, status: 'investigating' });
    const res = await patch({ status: 'investigating' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: REPORT, status: 'investigating' } });
    expect(mod.updateModerationReportStatus).toHaveBeenCalledWith(REPORT, IDS.moderator, IDS.org, 'investigating', expect.any(String));
  });

  it('returns 409 for a disallowed transition, and 404 for a report the service cannot find', async () => {
    report();
    mod.updateModerationReportStatus.mockRejectedValueOnce(new Error('Report status transition is not allowed'));
    expect((await patch({ status: 'investigating' })).status).toBe(409);
    mod.updateModerationReportStatus.mockRejectedValueOnce(new Error('Report not found'));
    expect((await patch({ status: 'resolved' })).status).toBe(404);
  });
});

describe('PATCH /api/v1/moderation/comments/[id]', () => {
  function scope(orgId = IDS.org) {
    cmt.getCommunityCommentScope.mockResolvedValue({ id: COMMENT, contribution_id: CONTRIB, org_id: orgId, status: 'visible' });
  }
  const patch = (body: unknown, id = COMMENT) => commentRoute.PATCH(jsonRequest(body), ctx(id));

  it('returns 401 without a session and 404 for a malformed or unknown comment', async () => {
    session.mockResolvedValue(null);
    expect((await patch({ status: 'hidden' })).status).toBe(401);
    session.mockResolvedValue(moderatorSession([globalGrant()]));
    expect((await patch({ status: 'hidden' }, 'nope')).status).toBe(404);
    cmt.getCommunityCommentScope.mockResolvedValue(null);
    expect((await patch({ status: 'hidden' })).status).toBe(404);
  });

  it('returns 404 when contribution:moderate is denied for the comment org', async () => {
    scope();
    permit.mockResolvedValue({ allowed: false, reason: 'nope' });
    expect((await patch({ status: 'hidden' })).status).toBe(404);
    expect(cmt.setCommunityCommentVisibility).not.toHaveBeenCalled();
  });

  it.each(['deleted', 'pending', ''])('returns 422 for a status of %j', async (status) => {
    scope();
    expect((await patch({ status })).status).toBe(422);
    expect(cmt.setCommunityCommentVisibility).not.toHaveBeenCalled();
  });

  it('hides a comment and returns 200', async () => {
    scope();
    cmt.setCommunityCommentVisibility.mockResolvedValue({ id: COMMENT, status: 'hidden' });
    const res = await patch({ status: 'hidden' });
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: COMMENT, status: 'hidden' } });
    expect(cmt.setCommunityCommentVisibility).toHaveBeenCalledWith(COMMENT, IDS.moderator, IDS.org, 'hidden', expect.any(String));
  });

  it('maps "Comment not found" to 404 and a missing moderator grant to 403', async () => {
    scope();
    cmt.setCommunityCommentVisibility.mockRejectedValueOnce(new Error('Comment not found'));
    expect((await patch({ status: 'visible' })).status).toBe(404);
    cmt.setCommunityCommentVisibility.mockRejectedValueOnce(new Error('Active moderator grant required'));
    const res = await patch({ status: 'visible' });
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Active moderator grant required' });
  });
});

describe('PATCH /api/v1/moderation/comment-reports/[id]', () => {
  function scope() {
    cmt.getCommunityCommentReportScope.mockResolvedValue({ id: REPORT, contribution_id: CONTRIB, org_id: IDS.org });
  }
  const patch = (body: unknown, id = REPORT) => commentReportRoute.PATCH(jsonRequest(body), ctx(id));

  it('returns 404 for a malformed or unknown report, and 401 without a session', async () => {
    session.mockResolvedValue(null);
    expect((await patch({ status: 'resolved' })).status).toBe(401);
    session.mockResolvedValue(moderatorSession([globalGrant()]));
    expect((await patch({ status: 'resolved' }, 'nope')).status).toBe(404);
    cmt.getCommunityCommentReportScope.mockResolvedValue(null);
    expect((await patch({ status: 'resolved' })).status).toBe(404);
  });

  it('returns 422 for a status outside investigating and resolved', async () => {
    scope();
    expect((await patch({ status: 'open' })).status).toBe(422);
    expect(cmt.updateCommunityCommentReport).not.toHaveBeenCalled();
  });

  it('updates the comment report and returns 200', async () => {
    scope();
    cmt.updateCommunityCommentReport.mockResolvedValue({ id: REPORT, status: 'resolved' });
    const res = await patch({ status: 'resolved' });
    expect(res.status).toBe(200);
    expect(cmt.updateCommunityCommentReport).toHaveBeenCalledWith(REPORT, IDS.moderator, IDS.org, 'resolved', expect.any(String));
  });

  it('maps a disallowed transition to 409 and a missing report to 404', async () => {
    scope();
    cmt.updateCommunityCommentReport.mockRejectedValueOnce(new Error('Report status transition is not allowed'));
    expect((await patch({ status: 'investigating' })).status).toBe(409);
    cmt.updateCommunityCommentReport.mockRejectedValueOnce(new Error('Report not found'));
    expect((await patch({ status: 'resolved' })).status).toBe(404);
  });
});

describe('POST /api/v1/moderation/themes/refresh', () => {
  const refresh = () => themesRoute.POST(bareRequest({ 'x-request-id': 'theme-1' }));

  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    expect((await refresh()).status).toBe(401);
  });

  it('returns 403 for a client workspace or no workspace, before authorizing', async () => {
    session.mockResolvedValue(makeSession({ orgType: 'client' }));
    const client = await refresh();
    expect(client.status).toBe(403);
    expect(await client.json()).toEqual({ error: 'Employee workspace required' });
    session.mockResolvedValue(makeSession({ orgId: null }));
    expect((await refresh()).status).toBe(403);
    expect(permit).not.toHaveBeenCalled();
  });

  it('returns 403 when portal:moderator:read is denied in an employee workspace', async () => {
    session.mockResolvedValue(moderatorSession([]));
    permit.mockResolvedValue({ allowed: false, reason: 'Moderator read required' });
    const res = await refresh();
    expect(res.status).toBe(403);
    expect(permit).toHaveBeenCalledWith({ action: 'portal:moderator:read' });
    expect(learning.refreshGeneratedThemes).not.toHaveBeenCalled();
  });

  it('refreshes approved themes for the moderator with 200 and no-store caching', async () => {
    session.mockResolvedValue(moderatorSession([globalGrant()]));
    learning.refreshGeneratedThemes.mockResolvedValue({ themes: 3 });
    const res = await refresh();
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(await res.json()).toEqual({ data: { themes: 3 } });
    expect(learning.refreshGeneratedThemes).toHaveBeenCalledWith(IDS.moderator, 'theme-1');
  });

  it('returns a generic 500 when the refresh fails', async () => {
    session.mockResolvedValue(moderatorSession([globalGrant()]));
    learning.refreshGeneratedThemes.mockRejectedValue(new Error('db down'));
    const res = await refresh();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Unable to refresh approved themes' });
  });
});
