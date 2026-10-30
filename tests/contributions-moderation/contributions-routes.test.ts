jest.mock('@/app/api/(services)/authz/session', () => ({ getSession: jest.fn() }));
jest.mock('@/app/api/(services)/authz/authorize', () => ({ authorize: jest.fn() }));
jest.mock('@/app/api/(services)/contributions/service', () => ({
  createDraft: jest.fn(),
  listWorkspaceContributions: jest.fn(),
  getContributionOwner: jest.fn(),
  getWorkspaceContribution: jest.fn(),
  updateDraft: jest.fn(),
  withdrawContribution: jest.fn(),
  submitForReview: jest.fn(),
  revokeContributionConsent: jest.fn(),
}));

import { getSession } from '@/app/api/(services)/authz/session';
import { authorize } from '@/app/api/(services)/authz/authorize';
import * as service from '@/app/api/(services)/contributions/service';
import * as listRoute from '@/app/api/v1/contributions/route';
import * as itemRoute from '@/app/api/v1/contributions/[id]/route';
import * as submitRoute from '@/app/api/v1/contributions/[id]/submit/route';
import * as consentRoute from '@/app/api/v1/contributions/[id]/consent-revocation/route';
import { IDS, bareRequest, contributionInput, ctx, jsonRequest, makeSession } from './fixtures';

const session = getSession as jest.Mock;
const permit = authorize as jest.Mock;
const svc = service as unknown as Record<string, jest.Mock>;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;
const CONTRIB = IDS.contribution;

beforeEach(() => {
  jest.resetAllMocks();
  session.mockResolvedValue(makeSession());
  permit.mockResolvedValue({ allowed: true });
  jest.spyOn(console, 'error').mockImplementation(() => undefined);
});

afterEach(() => {
  jest.restoreAllMocks();
});

describe('GET /api/v1/contributions', () => {
  it('returns 401 when there is no session and does not call authorize or the service', async () => {
    session.mockResolvedValue(null);
    const res = await listRoute.GET();
    expect(res.status).toBe(401);
    expect(permit).not.toHaveBeenCalled();
    expect(svc.listWorkspaceContributions).not.toHaveBeenCalled();
  });

  it('returns 409 when the caller has not selected a workspace', async () => {
    session.mockResolvedValue(makeSession({ orgId: null }));
    const res = await listRoute.GET();
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Select a workspace first' });
  });

  it('returns 403 with the authorize reason when the action is denied', async () => {
    permit.mockResolvedValue({ allowed: false, reason: 'Not allowed for this role' });
    const res = await listRoute.GET();
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Not allowed for this role' });
    expect(svc.listWorkspaceContributions).not.toHaveBeenCalled();
  });

  it('authorizes contribution:list and lists only for the caller and active org', async () => {
    svc.listWorkspaceContributions.mockResolvedValue([{ id: CONTRIB }]);
    const res = await listRoute.GET();
    expect(permit).toHaveBeenCalledWith({ action: 'contribution:list' });
    expect(svc.listWorkspaceContributions).toHaveBeenCalledWith(IDS.author, IDS.org);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: [{ id: CONTRIB }] });
  });
});

describe('POST /api/v1/contributions', () => {
  it('returns 401 for an anonymous caller', async () => {
    session.mockResolvedValue(null);
    const res = await listRoute.POST(jsonRequest(contributionInput()));
    expect(res.status).toBe(401);
    expect(svc.createDraft).not.toHaveBeenCalled();
  });

  it('returns 409 when no workspace is active', async () => {
    session.mockResolvedValue(makeSession({ orgId: null }));
    const res = await listRoute.POST(jsonRequest(contributionInput()));
    expect(res.status).toBe(409);
  });

  it('returns 403 when authorize denies contribution:create', async () => {
    permit.mockResolvedValue({ allowed: false, reason: 'Only client members can contribute' });
    const res = await listRoute.POST(jsonRequest(contributionInput()));
    expect(res.status).toBe(403);
    expect(permit).toHaveBeenCalledWith({ action: 'contribution:create' });
    expect(svc.createDraft).not.toHaveBeenCalled();
  });

  it('returns 400 for a body that is not JSON', async () => {
    const res = await listRoute.POST(jsonRequest(null, { raw: '{not json' }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: 'Invalid JSON body' });
  });

  it.each([
    ['title too short', { title: 'ab' }],
    ['body too short', { body: 'short' }],
    ['unknown observation type', { observation_type: 'rumour' }],
    ['missing storage consent field', { consent_store_process: undefined }],
    ['unknown visibility', { visibility: 'public' }],
    ['malformed period start', { observation_period_start: '01/02/2026' }],
  ])('returns 422 with field details when the payload has %s', async (_label, patch) => {
    const body = { ...contributionInput(), ...patch };
    const res = await listRoute.POST(jsonRequest(body));
    expect(res.status).toBe(422);
    const json = await res.json();
    expect(json.error).toBe('Validation failed');
    expect(json.details).toHaveProperty('fieldErrors');
    expect(svc.createDraft).not.toHaveBeenCalled();
  });

  it('creates a private draft with 201 and passes the parsed input, actor and org to the service', async () => {
    svc.createDraft.mockResolvedValue({ id: CONTRIB, state: 'private_draft' });
    const res = await listRoute.POST(jsonRequest(contributionInput(), { headers: { 'x-request-id': 'client-req-42' } }));
    expect(permit).toHaveBeenCalledWith({ action: 'contribution:create' });
    expect(res.status).toBe(201);
    expect(await res.json()).toEqual({ data: { id: CONTRIB, state: 'private_draft' } });
    expect(svc.createDraft).toHaveBeenCalledWith(
      expect.objectContaining({ visibility: 'author', consent_store_process: true, consent_semantic_analysis: false }),
      IDS.author,
      IDS.org,
      'client-req-42',
    );
  });

  it('truncates a long client request id to 100 characters and generates one when it is absent', async () => {
    svc.createDraft.mockResolvedValue({ id: CONTRIB });
    await listRoute.POST(jsonRequest(contributionInput(), { headers: { 'x-request-id': 'x'.repeat(150) } }));
    expect(svc.createDraft.mock.calls[0][3]).toHaveLength(100);

    await listRoute.POST(jsonRequest(contributionInput()));
    expect(svc.createDraft.mock.calls[1][3]).toMatch(UUID_RE);
  });

  it('maps a consent refusal from the service to 422 with its message', async () => {
    svc.createDraft.mockRejectedValue(new Error('Storage and processing consent is required to save a contribution'));
    const res = await listRoute.POST(jsonRequest(contributionInput()));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Storage and processing consent is required to save a contribution' });
  });

  it('maps an inactive membership from the service to 403', async () => {
    svc.createDraft.mockRejectedValue(new Error('Workspace membership is no longer active'));
    const res = await listRoute.POST(jsonRequest(contributionInput()));
    expect(res.status).toBe(403);
    expect(await res.json()).toEqual({ error: 'Workspace membership is no longer active' });
  });

  it('hides unexpected database errors behind a generic 500', async () => {
    svc.createDraft.mockRejectedValue(new Error('connection terminated'));
    const res = await listRoute.POST(jsonRequest(contributionInput()));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Unable to save the contribution' });
    expect(console.error).toHaveBeenCalled();
  });
});

describe('GET /api/v1/contributions/[id]', () => {
  function subjectFor(orgId = IDS.org, author = IDS.author) {
    return { author_user_id: author, org_id: orgId, state: 'private_draft', visibility: 'author' };
  }

  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    const res = await itemRoute.GET(bareRequest(), ctx(CONTRIB));
    expect(res.status).toBe(401);
  });

  it.each(['not-a-uuid', '1234'])('returns 404 for the malformed id %s without querying the database', async (id) => {
    const res = await itemRoute.GET(bareRequest(), ctx(id));
    expect(res.status).toBe(404);
    expect(svc.getContributionOwner).not.toHaveBeenCalled();
  });

  it('returns 404 when the contribution does not exist', async () => {
    svc.getContributionOwner.mockResolvedValue(null);
    const res = await itemRoute.GET(bareRequest(), ctx(CONTRIB));
    expect(res.status).toBe(404);
    expect(await res.json()).toEqual({ error: 'Contribution not found' });
  });

  it('returns 404 (not 403) when authorize denies contribution:read, so existence is not revealed', async () => {
    svc.getContributionOwner.mockResolvedValue(subjectFor());
    permit.mockResolvedValue({ allowed: false, reason: 'nope' });
    const res = await itemRoute.GET(bareRequest(), ctx(CONTRIB));
    expect(res.status).toBe(404);
    expect(permit).toHaveBeenCalledWith({
      action: 'contribution:read',
      resource: { type: 'contribution', id: CONTRIB, orgId: IDS.org },
    });
  });

  it('returns 404 when the caller cannot see the contribution inside its org', async () => {
    svc.getContributionOwner.mockResolvedValue(subjectFor());
    svc.getWorkspaceContribution.mockResolvedValue(null);
    const res = await itemRoute.GET(bareRequest(), ctx(CONTRIB));
    expect(res.status).toBe(404);
  });

  it('returns the contribution, scoped to the owning org, for an authorized caller', async () => {
    svc.getContributionOwner.mockResolvedValue(subjectFor());
    svc.getWorkspaceContribution.mockResolvedValue({ id: CONTRIB, state: 'private_draft' });
    const res = await itemRoute.GET(bareRequest(), ctx(CONTRIB));
    expect(svc.getWorkspaceContribution).toHaveBeenCalledWith(CONTRIB, IDS.author, IDS.org);
    expect(await res.json()).toEqual({ data: { id: CONTRIB, state: 'private_draft' } });
  });
});

describe('PATCH /api/v1/contributions/[id]', () => {
  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    const res = await itemRoute.PATCH(jsonRequest(contributionInput()), ctx(CONTRIB));
    expect(res.status).toBe(401);
  });

  it('returns 404 for a malformed id', async () => {
    const res = await itemRoute.PATCH(jsonRequest(contributionInput()), ctx('nope'));
    expect(res.status).toBe(404);
    expect(svc.getContributionOwner).not.toHaveBeenCalled();
  });

  it('returns 404 when the caller is not the author, even if the contribution exists', async () => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.otherAuthor, org_id: IDS.org, state: 'private_draft' });
    const res = await itemRoute.PATCH(jsonRequest(contributionInput()), ctx(CONTRIB));
    expect(res.status).toBe(404);
    expect(permit).not.toHaveBeenCalled();
    expect(svc.updateDraft).not.toHaveBeenCalled();
  });

  it('returns 404 when authorize denies contribution:update', async () => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: IDS.org, state: 'private_draft' });
    permit.mockResolvedValue({ allowed: false, reason: 'nope' });
    const res = await itemRoute.PATCH(jsonRequest(contributionInput()), ctx(CONTRIB));
    expect(res.status).toBe(404);
    expect(permit).toHaveBeenCalledWith(expect.objectContaining({ action: 'contribution:update' }));
  });

  it('returns 400 for invalid JSON and 422 for an invalid body, without updating', async () => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: IDS.org, state: 'private_draft' });
    const bad = await itemRoute.PATCH(jsonRequest(null, { raw: '{' }), ctx(CONTRIB));
    expect(bad.status).toBe(400);
    const invalid = await itemRoute.PATCH(jsonRequest({ ...contributionInput(), body: 'x' }), ctx(CONTRIB));
    expect(invalid.status).toBe(422);
    expect(svc.updateDraft).not.toHaveBeenCalled();
  });

  it('saves a new version with 200 and passes the owner org and request id to the service', async () => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: IDS.org, state: 'private_draft' });
    svc.updateDraft.mockResolvedValue({ id: CONTRIB, state: 'private_draft' });
    const res = await itemRoute.PATCH(jsonRequest(contributionInput()), ctx(CONTRIB));
    expect(res.status).toBe(200);
    expect(svc.updateDraft).toHaveBeenCalledWith(CONTRIB, expect.objectContaining({ title: contributionInput().title }), IDS.author, IDS.org, expect.any(String));
  });

  it('maps a consent refusal to 422, and a membership refusal to 403', async () => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: IDS.org, state: 'private_draft' });
    svc.updateDraft.mockRejectedValueOnce(new Error('Community sharing requires consent to publish a reviewed copy'));
    expect((await itemRoute.PATCH(jsonRequest(contributionInput()), ctx(CONTRIB))).status).toBe(422);
    svc.updateDraft.mockRejectedValueOnce(new Error('Workspace membership is no longer active'));
    expect((await itemRoute.PATCH(jsonRequest(contributionInput()), ctx(CONTRIB))).status).toBe(403);
  });

  it.each([
    'Only your draft, returned or published contribution can be edited',
  ])('maps the state refusal "%s" to 409', async (message) => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: IDS.org, state: 'submitted' });
    svc.updateDraft.mockRejectedValue(new Error(message));
    const res = await itemRoute.PATCH(jsonRequest(contributionInput()), ctx(CONTRIB));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Contribution cannot be edited in its current state' });
  });
});

describe('DELETE /api/v1/contributions/[id]', () => {
  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    const res = await itemRoute.DELETE(bareRequest(), ctx(CONTRIB));
    expect(res.status).toBe(401);
  });

  it('returns 404 for a malformed id or an unknown contribution', async () => {
    expect((await itemRoute.DELETE(bareRequest(), ctx('nope'))).status).toBe(404);
    svc.getContributionOwner.mockResolvedValue(null);
    expect((await itemRoute.DELETE(bareRequest(), ctx(CONTRIB))).status).toBe(404);
    expect(svc.withdrawContribution).not.toHaveBeenCalled();
  });

  it('lets the author withdraw through contribution:withdraw and returns 204 with no body', async () => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: IDS.org, state: 'published' });
    const res = await itemRoute.DELETE(bareRequest(), ctx(CONTRIB));
    expect(permit).toHaveBeenCalledWith(expect.objectContaining({ action: 'contribution:withdraw' }));
    expect(res.status).toBe(204);
    expect(await res.text()).toBe('');
    expect(svc.withdrawContribution).toHaveBeenCalledWith(CONTRIB, IDS.author, IDS.org, expect.any(String), false);
  });

  it('routes a non-author removal through contribution:moderate and flags it as a moderator withdraw', async () => {
    session.mockResolvedValue(makeSession({ userId: IDS.moderator }));
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.otherAuthor, org_id: IDS.org, state: 'published' });
    const res = await itemRoute.DELETE(bareRequest(), ctx(CONTRIB));
    expect(permit).toHaveBeenCalledWith(expect.objectContaining({ action: 'contribution:moderate' }));
    expect(res.status).toBe(204);
    expect(svc.withdrawContribution).toHaveBeenCalledWith(CONTRIB, IDS.moderator, IDS.org, expect.any(String), true);
  });

  it('returns 404 when moderation authorization is denied for a non-author', async () => {
    session.mockResolvedValue(makeSession({ userId: IDS.moderator }));
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.otherAuthor, org_id: IDS.org, state: 'published' });
    permit.mockResolvedValue({ allowed: false, reason: 'nope' });
    const res = await itemRoute.DELETE(bareRequest(), ctx(CONTRIB));
    expect(res.status).toBe(404);
    expect(svc.withdrawContribution).not.toHaveBeenCalled();
  });

  it('returns 409 when the service cannot withdraw', async () => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: IDS.org, state: 'published' });
    svc.withdrawContribution.mockRejectedValue(new Error('Contribution not found'));
    const res = await itemRoute.DELETE(bareRequest(), ctx(CONTRIB));
    expect(res.status).toBe(409);
    expect(await res.json()).toEqual({ error: 'Unable to withdraw this contribution' });
  });
});

describe('POST /api/v1/contributions/[id]/submit', () => {
  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    expect((await submitRoute.POST(bareRequest(), ctx(CONTRIB))).status).toBe(401);
  });

  it('returns 404 for a malformed id, an unknown contribution or a contribution owned by someone else', async () => {
    expect((await submitRoute.POST(bareRequest(), ctx('nope'))).status).toBe(404);
    svc.getContributionOwner.mockResolvedValueOnce(null);
    expect((await submitRoute.POST(bareRequest(), ctx(CONTRIB))).status).toBe(404);
    svc.getContributionOwner.mockResolvedValueOnce({ author_user_id: IDS.otherAuthor, org_id: IDS.org });
    expect((await submitRoute.POST(bareRequest(), ctx(CONTRIB))).status).toBe(404);
    expect(svc.submitForReview).not.toHaveBeenCalled();
  });

  it('returns 403 with the authorize reason when contribution:submit is denied', async () => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: IDS.org });
    permit.mockResolvedValue({ allowed: false, reason: 'Membership suspended' });
    const res = await submitRoute.POST(bareRequest(), ctx(CONTRIB));
    expect(res.status).toBe(403);
    expect(permit).toHaveBeenCalledWith({
      action: 'contribution:submit',
      resource: { type: 'contribution', id: CONTRIB, orgId: IDS.org },
    });
  });

  it('submits the author contribution for review and returns the updated row', async () => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: IDS.org });
    svc.submitForReview.mockResolvedValue({ id: CONTRIB, state: 'submitted' });
    const res = await submitRoute.POST(bareRequest({ 'x-request-id': 'r-1' }), ctx(CONTRIB));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ data: { id: CONTRIB, state: 'submitted' } });
    expect(svc.submitForReview).toHaveBeenCalledWith(CONTRIB, IDS.author, IDS.org, 'r-1');
  });

  it('maps a missing-consent refusal to 422 and a wrong-state refusal to 409', async () => {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: IDS.author, org_id: IDS.org });
    svc.submitForReview.mockRejectedValueOnce(new Error('Storage and processing consent is required'));
    expect((await submitRoute.POST(bareRequest(), ctx(CONTRIB))).status).toBe(422);
    svc.submitForReview.mockRejectedValueOnce(new Error('Only your draft or returned contribution can be submitted'));
    const conflict = await submitRoute.POST(bareRequest(), ctx(CONTRIB));
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toEqual({ error: 'Contribution cannot be submitted in its current state' });
  });
});

describe('POST /api/v1/contributions/[id]/consent-revocation', () => {
  function ownedBy(author = IDS.author) {
    svc.getContributionOwner.mockResolvedValue({ author_user_id: author, org_id: IDS.org });
  }

  it('returns 401 without a session', async () => {
    session.mockResolvedValue(null);
    expect((await consentRoute.POST(jsonRequest({ purpose: 'attribute' }), ctx(CONTRIB))).status).toBe(401);
  });

  it('returns 404 for a malformed id or a contribution the caller does not author', async () => {
    expect((await consentRoute.POST(jsonRequest({ purpose: 'attribute' }), ctx('nope'))).status).toBe(404);
    ownedBy(IDS.otherAuthor);
    expect((await consentRoute.POST(jsonRequest({ purpose: 'attribute' }), ctx(CONTRIB))).status).toBe(404);
    expect(svc.revokeContributionConsent).not.toHaveBeenCalled();
  });

  it('returns 404 when contribution:withdraw authorization is denied', async () => {
    ownedBy();
    permit.mockResolvedValue({ allowed: false, reason: 'nope' });
    const res = await consentRoute.POST(jsonRequest({ purpose: 'attribute' }), ctx(CONTRIB));
    expect(res.status).toBe(404);
    expect(permit).toHaveBeenCalledWith(expect.objectContaining({ action: 'contribution:withdraw' }));
  });

  it('returns 400 for invalid JSON', async () => {
    ownedBy();
    const res = await consentRoute.POST(jsonRequest(null, { raw: '{' }), ctx(CONTRIB));
    expect(res.status).toBe(400);
  });

  it.each([
    ['an unknown purpose', { purpose: 'advertising' }],
    ['a missing purpose', {}],
  ])('returns 422 for %s', async (_label, body) => {
    ownedBy();
    const res = await consentRoute.POST(jsonRequest(body), ctx(CONTRIB));
    expect(res.status).toBe(422);
    expect(await res.json()).toEqual({ error: 'Invalid consent purpose' });
    expect(svc.revokeContributionConsent).not.toHaveBeenCalled();
  });

  it.each(['store_process', 'publish_reviewed', 'attribute', 'model_training', 'semantic_analysis'])('revokes %s, returns 200 and sets no-store caching', async (purpose) => {
    ownedBy();
    const res = await consentRoute.POST(jsonRequest({ purpose }), ctx(CONTRIB));
    expect(res.status).toBe(200);
    expect(res.headers.get('cache-control')).toBe('private, no-store, max-age=0');
    expect(await res.json()).toEqual({ data: { contribution_id: CONTRIB, revoked: purpose } });
    expect(svc.revokeContributionConsent).toHaveBeenCalledWith(CONTRIB, IDS.author, IDS.org, purpose, expect.any(String));
  });

  it('maps "no active consent" to 409, "not found" to 404 and anything else to 500', async () => {
    ownedBy();
    svc.revokeContributionConsent.mockRejectedValueOnce(new Error('No active consent exists for that purpose'));
    expect((await consentRoute.POST(jsonRequest({ purpose: 'attribute' }), ctx(CONTRIB))).status).toBe(409);
    svc.revokeContributionConsent.mockRejectedValueOnce(new Error('Contribution not found'));
    expect((await consentRoute.POST(jsonRequest({ purpose: 'attribute' }), ctx(CONTRIB))).status).toBe(404);
    svc.revokeContributionConsent.mockRejectedValueOnce(new Error('boom'));
    const res = await consentRoute.POST(jsonRequest({ purpose: 'attribute' }), ctx(CONTRIB));
    expect(res.status).toBe(500);
    expect(await res.json()).toEqual({ error: 'Unable to revoke consent' });
  });
});
