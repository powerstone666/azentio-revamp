jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn() }));
jest.mock('@/app/api/(services)/contributions/service', () => ({ reportSharedCopy: jest.fn() }));
jest.mock('@/app/api/(services)/learning/comments', () => ({
  listCommunityComments: jest.fn(),
  createCommunityComment: jest.fn(),
}));
jest.mock('@/app/api/(services)/learning/personalization', () => ({ setBookmark: jest.fn() }));
jest.mock('@/app/api/(services)/learning/feedback', () => ({
  getMySharedCopyFeedback: jest.fn(),
  saveSharedCopyFeedback: jest.fn(),
}));

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import * as contributions from '@/app/api/(services)/contributions/service';
import * as comments from '@/app/api/(services)/learning/comments';
import * as personalization from '@/app/api/(services)/learning/personalization';
import * as feedback from '@/app/api/(services)/learning/feedback';
import * as commentRoute from '@/app/api/v1/shared-copies/[id]/comments/route';
import * as bookmarkRoute from '@/app/api/v1/shared-copies/[id]/bookmark/route';
import * as feedbackRoute from '@/app/api/v1/shared-copies/[id]/feedback/route';
import * as reportsRoute from '@/app/api/v1/shared-copies/[id]/reports/route';
import { IDS, bareRequest, ctx, jsonRequest, makeSession } from './fixtures';

const session = getSession as jest.Mock;
const permit = authorize as jest.Mock;
const svc = contributions as unknown as Record<string, jest.Mock>;
const cmt = comments as unknown as Record<string, jest.Mock>;
const personal = personalization as unknown as Record<string, jest.Mock>;
const fb = feedback as unknown as Record<string, jest.Mock>;
const COPY = IDS.sharedCopy;
const BAD_ID = 'not-a-uuid';

beforeEach(() => {
  jest.resetAllMocks();
  session.mockResolvedValue(makeSession({ orgType: 'client' }));
  permit.mockResolvedValue({ allowed: true });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/v1/shared-copies/[id]/comments', () => {
  const list = () => commentRoute.GET(bareRequest(), ctx(COPY));

  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    expect((await list()).status).toBe(401);
  });

  it('returns 409 when no workspace is selected', async () => {
    session.mockResolvedValue(makeSession({ orgId: null }));
    expect((await list()).status).toBe(409);
  });

  it('returns 404 for a malformed shared copy id without reading comments', async () => {
    const res = await commentRoute.GET(bareRequest(), ctx(BAD_ID));
    expect(res.status).toBe(404);
    expect(cmt.listCommunityComments).not.toHaveBeenCalled();
  });

  it('returns 403 with the authorize reason when community-comment:read is denied', async () => {
    permit.mockResolvedValue({ allowed: false, reason: 'Active membership required' });
    const res = await list();
    expect(res.status).toBe(403);
    expect(permit).toHaveBeenCalledWith({ action: 'community-comment:read' });
    expect(cmt.listCommunityComments).not.toHaveBeenCalled();
  });

  it('lists comments for the caller workspace and returns them as data', async () => {
    cmt.listCommunityComments.mockResolvedValue([{ id: 'c1', body: 'Useful' }]);
    const res = await list();
    expect(cmt.listCommunityComments).toHaveBeenCalledWith(COPY, IDS.author, IDS.org);
    expect(await res.json()).toEqual({ data: [{ id: 'c1', body: 'Useful' }] });
  });

  it('maps a not-found service error to 404 and any other error to a generic 500', async () => {
    cmt.listCommunityComments.mockRejectedValueOnce(new Error('Shared contribution not found'));
    expect((await list()).status).toBe(404);
    cmt.listCommunityComments.mockRejectedValueOnce(new Error('db down'));
    const res = await list();
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Unable to load comments' });
  });
});

describe('POST /api/v1/shared-copies/[id]/comments', () => {
  const post = (body: unknown, id = COPY) => commentRoute.POST(jsonRequest(body), ctx(id));

  it('returns 401 without a session and 409 without a workspace', async () => {
    session.mockResolvedValue(null);
    expect((await post({ body: 'Helpful' })).status).toBe(401);
    session.mockResolvedValue(makeSession({ orgId: null }));
    expect((await post({ body: 'Helpful' })).status).toBe(409);
  });

  it('returns 404 for a malformed id and 403 when community-comment:create is denied', async () => {
    expect((await post({ body: 'Helpful' }, BAD_ID)).status).toBe(404);
    permit.mockResolvedValue({ allowed: false, reason: 'Membership required' });
    const res = await post({ body: 'Helpful' });
    expect(res.status).toBe(403);
    expect(permit).toHaveBeenCalledWith({ action: 'community-comment:create' });
    expect(cmt.createCommunityComment).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    const res = await commentRoute.POST(jsonRequest(null, { raw: '{' }), ctx(COPY));
    expect(res.status).toBe(400);
  });

  it.each([
    ['an empty body', '   '],
    ['a body over 2000 characters', 'x'.repeat(2001)],
  ])('returns 422 for %s', async (_label, text) => {
    const res = await post({ body: text });
    expect(res.status).toBe(422);
    expect(cmt.createCommunityComment).not.toHaveBeenCalled();
  });

  it('rejects unknown fields in the comment body (strict schema)', async () => {
    const res = await post({ body: 'Helpful', author_id: IDS.otherAuthor });
    expect(res.status).toBe(422);
    expect(cmt.createCommunityComment).not.toHaveBeenCalled();
  });

  it('creates the comment with 201, passing the trimmed body, actor, org and request id', async () => {
    cmt.createCommunityComment.mockResolvedValue({ id: 'c1', body: 'Helpful' });
    const res = await commentRoute.POST(jsonRequest({ body: '  Helpful  ' }, { headers: { 'x-request-id': 'cm-1' } }), ctx(COPY));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: 'c1', body: 'Helpful' } });
    expect(cmt.createCommunityComment).toHaveBeenCalledWith(COPY, IDS.author, IDS.org, { body: 'Helpful' }, 'cm-1');
  });

  it('maps not-found to 404, membership to 403 and anything else to a generic 500', async () => {
    cmt.createCommunityComment.mockRejectedValueOnce(new Error('Shared contribution not found'));
    expect((await post({ body: 'Helpful' })).status).toBe(404);
    cmt.createCommunityComment.mockRejectedValueOnce(new Error('membership lapsed'));
    expect((await post({ body: 'Helpful' })).status).toBe(403);
    cmt.createCommunityComment.mockRejectedValueOnce(new Error('boom'));
    const res = await post({ body: 'Helpful' });
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Unable to add comment' });
  });
});

describe('PUT and DELETE /api/v1/shared-copies/[id]/bookmark', () => {
  it('returns 401 without a session and 409 without a workspace', async () => {
    session.mockResolvedValue(null);
    expect((await bookmarkRoute.PUT(bareRequest(), ctx(COPY))).status).toBe(401);
    session.mockResolvedValue(makeSession({ orgId: null }));
    expect((await bookmarkRoute.PUT(bareRequest(), ctx(COPY))).status).toBe(409);
  });

  it('returns 403 when search:personalize is denied, before looking at the id', async () => {
    permit.mockResolvedValue({ allowed: false, reason: 'nope' });
    const res = await bookmarkRoute.PUT(bareRequest(), ctx(BAD_ID));
    expect(res.status).toBe(403);
    expect(permit).toHaveBeenCalledWith({ action: 'search:personalize' });
    expect(personal.setBookmark).not.toHaveBeenCalled();
  });

  it('returns 404 for a malformed id without writing', async () => {
    const res = await bookmarkRoute.DELETE(bareRequest(), ctx(BAD_ID));
    expect(res.status).toBe(404);
    expect(personal.setBookmark).not.toHaveBeenCalled();
  });

  it('bookmarks with PUT and removes with DELETE, both scoped to the caller and org', async () => {
    personal.setBookmark.mockResolvedValue({ bookmarked: true });
    const put = await bookmarkRoute.PUT(bareRequest(), ctx(COPY));
    expect(put.status).toBe(200);
    expect(put.headers.get('cache-control')).toBe('private, no-store');
    expect(personal.setBookmark).toHaveBeenLastCalledWith(COPY, IDS.author, IDS.org, true);

    personal.setBookmark.mockResolvedValue({ bookmarked: false });
    const del = await bookmarkRoute.DELETE(bareRequest(), ctx(COPY));
    expect(del.status).toBe(200);
    expect(personal.setBookmark).toHaveBeenLastCalledWith(COPY, IDS.author, IDS.org, false);
  });

  it('returns 404 when the service cannot find the shared copy', async () => {
    personal.setBookmark.mockRejectedValue(new Error('Shared contribution not found'));
    const res = await bookmarkRoute.PUT(bareRequest(), ctx(COPY));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Shared contribution not found' });
  });
});

describe('/api/v1/shared-copies/[id]/feedback (client workspaces only)', () => {
  it('returns 404 for an employee workspace that is not a sandbox, before authorizing', async () => {
    session.mockResolvedValue(makeSession({ orgType: 'azentio', isSandbox: false }));
    const get = await feedbackRoute.GET(bareRequest(), ctx(COPY));
    expect(get.status).toBe(404);
    const post = await feedbackRoute.POST(jsonRequest({ feedback: 'useful' }), ctx(COPY));
    expect(post.status).toBe(404);
    expect(permit).not.toHaveBeenCalled();
  });

  it('allows a sandbox employee workspace through to the feedback service', async () => {
    session.mockResolvedValue(makeSession({ orgType: 'azentio', isSandbox: true }));
    fb.getMySharedCopyFeedback.mockResolvedValue({ feedback: null });
    const res = await feedbackRoute.GET(bareRequest(), ctx(COPY));
    expect(res.status).toBe(200);
  });

  it('returns 404 without a session, for a malformed id, and when portal:client:read is denied', async () => {
    session.mockResolvedValue(null);
    expect((await feedbackRoute.GET(bareRequest(), ctx(COPY))).status).toBe(404);
    session.mockResolvedValue(makeSession({ orgType: 'client' }));
    expect((await feedbackRoute.GET(bareRequest(), ctx(BAD_ID))).status).toBe(404);
    permit.mockResolvedValue({ allowed: false, reason: 'nope' });
    expect((await feedbackRoute.GET(bareRequest(), ctx(COPY))).status).toBe(404);
    expect(permit).toHaveBeenCalledWith({ action: 'portal:client:read' });
    expect(fb.getMySharedCopyFeedback).not.toHaveBeenCalled();
  });

  it('returns the caller own feedback with no-store caching', async () => {
    fb.getMySharedCopyFeedback.mockResolvedValue({ feedback: 'useful' });
    const res = await feedbackRoute.GET(bareRequest(), ctx(COPY));
    expect(fb.getMySharedCopyFeedback).toHaveBeenCalledWith(COPY, IDS.author, IDS.org);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(await res.json()).toEqual({ data: { feedback: 'useful' } });
  });

  it.each([
    ['an unknown value', { feedback: 'love' }],
    ['a missing value', {}],
    ['an extra field', { feedback: 'useful', note: 'x' }],
  ])('returns 422 for %s without saving', async (_label, body) => {
    const res = await feedbackRoute.POST(jsonRequest(body), ctx(COPY));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Choose useful or needs evidence' });
    expect(fb.saveSharedCopyFeedback).not.toHaveBeenCalled();
  });

  it('returns 422 when the body is not JSON at all', async () => {
    const res = await feedbackRoute.POST(jsonRequest(null, { raw: '{' }), ctx(COPY));
    expect(res.status).toBe(422);
  });

  it.each(['useful', 'needs_evidence'] as const)('saves %s feedback with 200 and no-store caching', async (feedbackValue) => {
    fb.saveSharedCopyFeedback.mockResolvedValue({ feedback: feedbackValue });
    const res = await feedbackRoute.POST(jsonRequest({ feedback: feedbackValue }, { headers: { 'x-request-id': 'fb-1' } }), ctx(COPY));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store');
    expect(fb.saveSharedCopyFeedback).toHaveBeenCalledWith({
      sharedCopyId: COPY, userId: IDS.author, orgId: IDS.org, feedback: feedbackValue, requestId: 'fb-1',
    });
  });

  it('maps membership to 403, not-found to 404 and anything else to a generic 500', async () => {
    fb.saveSharedCopyFeedback.mockRejectedValueOnce(new Error('membership lapsed'));
    expect((await feedbackRoute.POST(jsonRequest({ feedback: 'useful' }), ctx(COPY))).status).toBe(403);
    fb.saveSharedCopyFeedback.mockRejectedValueOnce(new Error('Shared contribution not found'));
    expect((await feedbackRoute.POST(jsonRequest({ feedback: 'useful' }), ctx(COPY))).status).toBe(404);
    fb.saveSharedCopyFeedback.mockRejectedValueOnce(new Error('boom'));
    const res = await feedbackRoute.POST(jsonRequest({ feedback: 'useful' }), ctx(COPY));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Unable to save feedback' });
  });
});

describe('POST /api/v1/shared-copies/[id]/reports', () => {
  const report = (body: unknown, id = COPY) => reportsRoute.POST(jsonRequest(body), ctx(id));
  const valid = { category: 'misleading', details: 'The figures do not match the source.' };

  it('returns 401 without a session and 409 without a workspace', async () => {
    session.mockResolvedValue(null);
    expect((await report(valid)).status).toBe(401);
    session.mockResolvedValue(makeSession({ orgId: null }));
    expect((await report(valid)).status).toBe(409);
  });

  it('returns 404 for a malformed id and 403 when contribution:report is denied', async () => {
    expect((await report(valid, BAD_ID)).status).toBe(404);
    permit.mockResolvedValue({ allowed: false, reason: 'Membership required' });
    const res = await report(valid);
    expect(res.status).toBe(403);
    expect(permit).toHaveBeenCalledWith({ action: 'contribution:report' });
    expect(svc.reportSharedCopy).not.toHaveBeenCalled();
  });

  it('returns 400 for invalid JSON', async () => {
    const res = await reportsRoute.POST(jsonRequest(null, { raw: '{' }), ctx(COPY));
    expect(res.status).toBe(400);
  });

  it.each([
    ['an unknown category', { category: 'spam', details: 'Looks like spam to me.' }],
    ['details that are too short', { category: 'other', details: 'short' }],
    ['details over 2000 characters', { category: 'other', details: 'x'.repeat(2001) }],
  ])('returns 422 for %s', async (_label, body) => {
    const res = await report(body);
    expect(res.status).toBe(422);
    expect(svc.reportSharedCopy).not.toHaveBeenCalled();
  });

  it('files the report with 201, passing the parsed input, actor, org and request id', async () => {
    svc.reportSharedCopy.mockResolvedValue({ id: IDS.report, status: 'open' });
    const res = await reportsRoute.POST(jsonRequest(valid, { headers: { 'x-request-id': 'rp-1' } }), ctx(COPY));
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: IDS.report, status: 'open' } });
    expect(svc.reportSharedCopy).toHaveBeenCalledWith(COPY, IDS.author, IDS.org, valid, 'rp-1');
  });

  it('maps a not-found copy to 404 and any other failure to a generic 500', async () => {
    svc.reportSharedCopy.mockRejectedValueOnce(new Error('Shared contribution not found'));
    expect((await report(valid)).status).toBe(404);
    svc.reportSharedCopy.mockRejectedValueOnce(new Error('boom'));
    const res = await report(valid);
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Unable to submit report' });
  });
});
