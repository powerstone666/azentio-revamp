jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import {
  createDraft,
  getAuthorContributionForEdit,
  getContributionCurrentConsents,
  getContributionOwner,
  getLatestClarification,
  getWorkspaceContribution,
  listWorkspaceContributions,
  reportSharedCopy,
  revokeContributionConsent,
  submitForReview,
  updateDraft,
  withdrawContribution,
} from '@/app/api/(services)/contributions/service';
import { mockDb } from '../support/db';
import { IDS, contributionInput, executed, find, routeQueries } from './fixtures';

let db: ReturnType<typeof mockDb>;

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  db = mockDb({ query, queryOne, transaction });
});

/** Row shape the services read from `contributions` joined to the current version. */
function contributionRow(overrides: Record<string, unknown> = {}) {
  return {
    id: IDS.contribution,
    author_user_id: IDS.author,
    org_id: IDS.org,
    visibility: 'author',
    state: 'private_draft',
    current_version_id: IDS.version,
    withdrawn_at: null,
    ...overrides,
  };
}

/** Queues the membership check that every mutating service runs first. */
function activeMembership() {
  db.query.mockResolvedValueOnce([{ id: IDS.membership }]);
}

describe('createDraft', () => {
  it('refuses to save a draft without storage and processing consent, before touching the database', async () => {
    await expect(createDraft(contributionInput({ consent_store_process: false }), IDS.author, IDS.org, IDS.request))
      .rejects.toThrow('Storage and processing consent is required to save a contribution');
    expect(db.transaction).not.toHaveBeenCalled();
    expect(db.query).not.toHaveBeenCalled();
  });

  it.each([
    [false],
    [true],
  ])('allows a community-proposed draft only when publish consent is also given (publish consent=%s)', async (publishConsent) => {
    activeMembership();
    db.query.mockResolvedValueOnce([contributionRow({ visibility: 'community_proposed' })]);
    db.query.mockResolvedValueOnce([{ id: IDS.version, version: 1 }]);
    const run = createDraft(contributionInput({
      visibility: 'community_proposed',
      consent_publish_reviewed: publishConsent,
    }), IDS.author, IDS.org, IDS.request);
    if (publishConsent) {
      await expect(run).resolves.toMatchObject({ visibility: 'community_proposed' });
    } else {
      await expect(run).rejects.toThrow('Community sharing requires consent to publish a reviewed copy');
      expect(db.transaction).not.toHaveBeenCalled();
    }
  });

  it('starts every new contribution in the private_draft state with the requested visibility', async () => {
    activeMembership();
    db.query.mockResolvedValueOnce([contributionRow({ visibility: 'org' })]);
    db.query.mockResolvedValueOnce([{ id: IDS.version, version: 1 }]);

    const result = await createDraft(contributionInput({ visibility: 'org' }), IDS.author, IDS.org, IDS.request);

    const insert = find(db.query, /INSERT INTO contributions/);
    expect(insert).toHaveLength(1);
    expect(insert[0].sql).toContain("'private_draft'");
    expect(insert[0].params).toEqual([IDS.author, IDS.org, 'org']);
    expect(result).toMatchObject({ id: IDS.contribution, state: 'private_draft', current_version_id: IDS.version });
  });

  it('defaults a new contribution to author-only visibility when the author chooses it', async () => {
    activeMembership();
    db.query.mockResolvedValueOnce([contributionRow()]);
    db.query.mockResolvedValueOnce([{ id: IDS.version, version: 1 }]);

    await createDraft(contributionInput(), IDS.author, IDS.org, IDS.request);

    expect(find(db.query, /INSERT INTO contributions/)[0].params[2]).toBe('author');
  });

  it('stores version 1 with trimmed reviewed-field payload and links it as the current version', async () => {
    activeMembership();
    db.query.mockResolvedValueOnce([contributionRow()]);
    db.query.mockResolvedValueOnce([{ id: IDS.version, version: 1 }]);

    await createDraft(contributionInput(), IDS.author, IDS.org, IDS.request);

    const version = find(db.query, /INSERT INTO contribution_versions/);
    expect(version).toHaveLength(1);
    expect(version[0].sql).toContain('VALUES ($1, 1, $2::jsonb, $3)');
    expect(version[0].params[2]).toBe(IDS.author);
    const payload = JSON.parse(version[0].params[1] as string);
    expect(payload).toMatchObject({
      title: 'Pricing pressure in retail lending',
      body: 'Customers are asking for faster approvals across branches.',
      offering: 'Lending Suite',
    });
    expect(find(db.query, /UPDATE contributions SET current_version_id = \$1/)[0].params).toEqual([IDS.version, IDS.contribution]);
  });

  it('records one consent row per purpose for version 1, with granted_at only when the choice is true', async () => {
    activeMembership();
    db.query.mockResolvedValueOnce([contributionRow()]);
    db.query.mockResolvedValueOnce([{ id: IDS.version, version: 1 }]);

    await createDraft(contributionInput({ consent_store_process: true, consent_attribute: false }), IDS.author, IDS.org, IDS.request);

    const consents = find(db.query, /INSERT INTO consents/);
    expect(consents.map((c) => c.params[3])).toEqual([
      'store_process', 'publish_reviewed', 'attribute', 'model_training', 'semantic_analysis',
    ]);
    expect(consents.map((c) => c.params[4])).toEqual([true, false, false, false, false]);
    expect(consents[0].params[2]).toBe(1);
    expect(consents[0].sql).toContain('CASE WHEN $5 THEN now() ELSE NULL END');
  });

  it('writes a create_draft audit row and performs no sharing side effects', async () => {
    activeMembership();
    db.query.mockResolvedValueOnce([contributionRow()]);
    db.query.mockResolvedValueOnce([{ id: IDS.version, version: 1 }]);

    await createDraft(contributionInput(), IDS.author, IDS.org, IDS.request);

    const audit = find(db.query, /INSERT INTO audit_log/);
    expect(audit).toHaveLength(1);
    expect(audit[0].params.slice(0, 6)).toEqual([IDS.author, 'contribution.create_draft', 'contribution', IDS.contribution, IDS.org, IDS.request]);
    expect(JSON.parse(audit[0].params[6] as string)).toEqual({ visibility: 'author', version: 1 });
    expect(find(db.query, /shared_copies|notifications|'published'|'submitted'/)).toHaveLength(0);
  });

  it('refuses to create a draft when the author membership or workspace is no longer active', async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(createDraft(contributionInput(), IDS.author, IDS.org, IDS.request))
      .rejects.toThrow('Workspace membership is no longer active');
    expect(find(db.query, /INSERT INTO contributions/)).toHaveLength(0);
  });

  it('scopes the membership check to the requested org and requires active membership and organization', async () => {
    activeMembership();
    db.query.mockResolvedValueOnce([contributionRow()]);
    db.query.mockResolvedValueOnce([{ id: IDS.version, version: 1 }]);
    await createDraft(contributionInput(), IDS.author, IDS.org, IDS.request);
    const membership = find(db.query, /FROM memberships m/)[0];
    expect(membership.sql).toContain("m.status = 'active' AND o.status = 'active'");
    expect(membership.params).toEqual([IDS.author, IDS.org]);
  });
});

describe('updateDraft', () => {
  /** Queues membership, the owned contribution row, and the version number it sits on. */
  function queueExisting(state: string, currentVersion = 2, extra: Record<string, unknown> = {}) {
    activeMembership();
    db.query.mockResolvedValueOnce([contributionRow({ state, ...extra })]);
    db.query.mockResolvedValueOnce([{ version: currentVersion }]);
    db.query.mockResolvedValueOnce([{ id: IDS.nextVersion, version: currentVersion + 1 }]);
  }

  it.each(['private_draft', 'needs_clarification', 'published'])('lets the author save a new version of a %s contribution', async (state) => {
    queueExisting(state);
    await expect(updateDraft(IDS.contribution, contributionInput(), IDS.author, IDS.org, IDS.request))
      .resolves.toMatchObject({ id: IDS.contribution, current_version_id: IDS.nextVersion });
  });

  it.each(['submitted', 'approved', 'rejected', 'suspended', 'withdrawn'])('refuses to edit a contribution in the %s state', async (state) => {
    queueExisting(state);
    await expect(updateDraft(IDS.contribution, contributionInput(), IDS.author, IDS.org, IDS.request))
      .rejects.toThrow('Only your draft, returned or published contribution can be edited');
    expect(find(db.query, /INSERT INTO contribution_versions/)).toHaveLength(0);
  });

  it('refuses to edit when the contribution is not owned by the caller in this org', async () => {
    activeMembership();
    db.query.mockResolvedValueOnce([]);
    await expect(updateDraft(IDS.contribution, contributionInput(), IDS.otherAuthor, IDS.otherOrg, IDS.request))
      .rejects.toThrow('Only your draft, returned or published contribution can be edited');
    const select = find(db.query, /FROM contributions WHERE id = \$1 AND org_id = \$2 AND author_user_id = \$3/);
    expect(select[0].params).toEqual([IDS.contribution, IDS.otherOrg, IDS.otherAuthor]);
  });

  it('creates the next version number and links it to the previous current version', async () => {
    queueExisting('private_draft', 4);
    await updateDraft(IDS.contribution, contributionInput(), IDS.author, IDS.org, IDS.request);
    const version = find(db.query, /INSERT INTO contribution_versions/)[0];
    expect(version.params[1]).toBe(5);
    expect(version.params[4]).toBe(IDS.version);
  });

  it('keeps the state of a draft unchanged and writes an edit_draft audit row without review', async () => {
    queueExisting('needs_clarification');
    const result = await updateDraft(IDS.contribution, contributionInput(), IDS.author, IDS.org, IDS.request);
    expect(result.state).toBe('needs_clarification');
    expect(find(db.query, /UPDATE contributions SET visibility/)[0].params[2]).toBe(false);
    const audit = find(db.query, /INSERT INTO audit_log/)[0];
    expect(audit.params[1]).toBe('contribution.edit_draft');
    expect(JSON.parse(audit.params[6] as string)).toEqual({ version: 3, previous_state: 'needs_clarification', requires_review: false });
    expect(find(db.query, /shared_copies/)).toHaveLength(0);
  });

  it('sends an edited published contribution back to review and suspends its shared copy', async () => {
    queueExisting('published');
    const result = await updateDraft(IDS.contribution, contributionInput(), IDS.author, IDS.org, IDS.request);

    expect(result.state).toBe('submitted');
    expect(find(db.query, /UPDATE contributions SET visibility/)[0].params[2]).toBe(true);
    const suspend = find(db.query, /UPDATE shared_copies SET status = 'suspended'/);
    expect(suspend).toHaveLength(1);
    expect(suspend[0].sql).toContain("status = 'active'");
    expect(suspend[0].params).toEqual([IDS.contribution]);
    expect(find(db.query, /DELETE FROM shared_copy_embeddings/)).toHaveLength(1);
    expect(find(db.query, /DELETE FROM shared_copy_embedding_jobs/)).toHaveLength(1);
    const notice = find(db.query, /INSERT INTO notifications/)[0];
    expect(notice.params[0]).toBe(IDS.author);
    expect(notice.sql).toContain("'contribution.revision_submitted'");
    const audit = find(db.query, /INSERT INTO audit_log/)[0];
    expect(audit.params[1]).toBe('contribution.revision_submit');
    expect(JSON.parse(audit.params[6] as string)).toMatchObject({ requires_review: true, previous_state: 'published' });
  });

  it('does not touch shared copies when a non-published draft is edited', async () => {
    queueExisting('private_draft');
    await updateDraft(IDS.contribution, contributionInput(), IDS.author, IDS.org, IDS.request);
    expect(find(db.query, /shared_copies|shared_copy_embeddings|revision_submitted/)).toHaveLength(0);
  });

  it('refuses an edit that drops storage consent, before writing anything', async () => {
    await expect(updateDraft(IDS.contribution, contributionInput({ consent_store_process: false }), IDS.author, IDS.org, IDS.request))
      .rejects.toThrow('Storage and processing consent is required');
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it('refuses a community-proposed edit without publish consent', async () => {
    await expect(updateDraft(
      IDS.contribution,
      contributionInput({ visibility: 'community_proposed', consent_publish_reviewed: false }),
      IDS.author, IDS.org, IDS.request,
    )).rejects.toThrow('Community sharing requires consent to publish a reviewed copy');
  });
});

describe('submitForReview', () => {
  function queueSubmit(state: string, consents: Array<[string, boolean]>, visibility = 'author') {
    activeMembership();
    db.query.mockResolvedValueOnce([contributionRow({ state, visibility })]);
    db.query.mockResolvedValueOnce(consents.map(([purpose, choice]) => ({ purpose, choice })));
    db.query.mockResolvedValueOnce([{ ...contributionRow({ state: 'submitted', visibility }) }]);
  }
  const storeOnly: Array<[string, boolean]> = [['store_process', true]];

  it.each(['private_draft', 'needs_clarification'])('submits a %s contribution for review', async (state) => {
    queueSubmit(state, storeOnly);
    const result = await submitForReview(IDS.contribution, IDS.author, IDS.org, IDS.request);
    expect(result.state).toBe('submitted');
    expect(find(db.query, /UPDATE contributions SET state = 'submitted'/)).toHaveLength(1);
  });

  it.each(['submitted', 'approved', 'published', 'suspended', 'rejected', 'withdrawn'])('refuses to submit a contribution in the %s state', async (state) => {
    queueSubmit(state, storeOnly);
    await expect(submitForReview(IDS.contribution, IDS.author, IDS.org, IDS.request))
      .rejects.toThrow('Only your draft or returned contribution can be submitted');
    expect(find(db.query, /UPDATE contributions SET state = 'submitted'/)).toHaveLength(0);
  });

  it('refuses to submit without storage and processing consent on the current version', async () => {
    queueSubmit('private_draft', [['store_process', false]]);
    await expect(submitForReview(IDS.contribution, IDS.author, IDS.org, IDS.request))
      .rejects.toThrow('Storage and processing consent is required');
    expect(find(db.query, /UPDATE contributions SET state/)).toHaveLength(0);
  });

  it.each([
    [false, 'Community sharing requires consent to publish a reviewed copy'],
    [true, null],
  ])('for community-proposed visibility with publish consent=%s, error is %s', async (publishConsent, expected) => {
    queueSubmit('private_draft', [['store_process', true], ['publish_reviewed', publishConsent]], 'community_proposed');
    const run = submitForReview(IDS.contribution, IDS.author, IDS.org, IDS.request);
    if (expected) await expect(run).rejects.toThrow(expected);
    else await expect(run).resolves.toMatchObject({ state: 'submitted' });
  });

  it('reads consents for the current version only and writes a submit audit row', async () => {
    queueSubmit('private_draft', storeOnly);
    await submitForReview(IDS.contribution, IDS.author, IDS.org, IDS.request);
    const consentRead = find(db.query, /FROM consents WHERE contribution_id = \$1 AND version = \(/)[0];
    expect(consentRead.params).toEqual([IDS.contribution, IDS.version]);
    const audit = find(db.query, /INSERT INTO audit_log/)[0];
    expect(audit.params[1]).toBe('contribution.submit');
    expect(JSON.parse(audit.params[6] as string)).toEqual({ version_id: IDS.version });
  });

  it('refuses to submit another author contribution or one from another org', async () => {
    activeMembership();
    db.query.mockResolvedValueOnce([]);
    await expect(submitForReview(IDS.contribution, IDS.otherAuthor, IDS.otherOrg, IDS.request))
      .rejects.toThrow('Only your draft or returned contribution can be submitted');
  });

  it('refuses to submit when the membership is no longer active', async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(submitForReview(IDS.contribution, IDS.author, IDS.org, IDS.request))
      .rejects.toThrow('Workspace membership is no longer active');
  });
});

describe('withdrawContribution', () => {
  function queueWithdraw(row: Record<string, unknown> = {}) {
    activeMembership();
    db.query.mockResolvedValueOnce([contributionRow({ state: 'published', visibility: 'community_proposed', ...row })]);
  }

  it('withdraws the contribution, bumps the visibility epoch, and invalidates every shared copy', async () => {
    queueWithdraw();
    await withdrawContribution(IDS.contribution, IDS.author, IDS.org, IDS.request);

    const state = find(db.query, /UPDATE contributions SET state = 'withdrawn'/);
    expect(state).toHaveLength(1);
    expect(state[0].sql).toContain('visibility_epoch = visibility_epoch + 1');
    const copies = find(db.query, /UPDATE shared_copies SET status = 'withdrawn'/);
    expect(copies).toHaveLength(1);
    expect(copies[0].sql).toContain("status <> 'withdrawn'");
    expect(find(db.query, /DELETE FROM shared_copy_embeddings/)).toHaveLength(1);
    expect(find(db.query, /DELETE FROM shared_copy_embedding_jobs/)).toHaveLength(1);
  });

  it('notifies the author and writes a withdraw audit row marking a non-moderator action', async () => {
    queueWithdraw({ state: 'submitted' });
    await withdrawContribution(IDS.contribution, IDS.author, IDS.org, IDS.request);
    const notice = find(db.query, /INSERT INTO notifications/)[0];
    expect(notice.params[0]).toBe(IDS.author);
    expect(notice.sql).toContain("'contribution.withdrawn'");
    const audit = find(db.query, /INSERT INTO audit_log/)[0];
    expect(audit.params.slice(0, 5)).toEqual([IDS.author, 'contribution.withdraw', 'contribution', IDS.contribution, IDS.org]);
    expect(JSON.parse(audit.params[6] as string)).toEqual({ moderator: false });
  });

  it('is idempotent: an already withdrawn contribution is left alone with no writes', async () => {
    queueWithdraw({ state: 'withdrawn' });
    await expect(withdrawContribution(IDS.contribution, IDS.author, IDS.org, IDS.request)).resolves.toBeUndefined();
    expect(find(db.query, /^UPDATE|^INSERT|^DELETE/)).toHaveLength(0);
  });

  it('refuses a withdraw by someone who is neither the author nor a moderator', async () => {
    queueWithdraw();
    await expect(withdrawContribution(IDS.contribution, IDS.otherAuthor, IDS.org, IDS.request))
      .rejects.toThrow('Contribution not found');
    expect(find(db.query, /UPDATE contributions/)).toHaveLength(0);
  });

  it('refuses a withdraw for a contribution that is not in the given org', async () => {
    activeMembership();
    db.query.mockResolvedValueOnce([]);
    await expect(withdrawContribution(IDS.contribution, IDS.author, IDS.otherOrg, IDS.request))
      .rejects.toThrow('Contribution not found');
    expect(find(db.query, /FROM contributions WHERE id = \$1 AND org_id = \$2 FOR UPDATE/)[0].params).toEqual([IDS.contribution, IDS.otherOrg]);
  });

  it('lets a moderator withdraw another author contribution without a membership check, flagged as moderator', async () => {
    db.query.mockResolvedValueOnce([contributionRow({ state: 'published', author_user_id: IDS.otherAuthor })]);
    await withdrawContribution(IDS.contribution, IDS.moderator, IDS.org, IDS.request, true);
    expect(find(db.query, /FROM memberships/)).toHaveLength(0);
    const audit = find(db.query, /INSERT INTO audit_log/)[0];
    expect(JSON.parse(audit.params[6] as string)).toEqual({ moderator: true });
    expect(find(db.query, /INSERT INTO notifications/)[0].params[0]).toBe(IDS.otherAuthor);
  });

  it('refuses a non-moderator withdraw when their membership is inactive', async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(withdrawContribution(IDS.contribution, IDS.author, IDS.org, IDS.request))
      .rejects.toThrow('Workspace membership is no longer active');
  });
});

describe('revokeContributionConsent', () => {
  /**
   * Routes the revoke lookup so each purpose can be exercised. The author owns the contribution
   * and has an active consent for the purpose.
   */
  function queueRevoke(opts: { author?: string; revoked?: boolean } = {}) {
    routeQueries(db.query, [
      [/FROM memberships/, [{ id: IDS.membership }]],
      [/SELECT id, author_user_id, state FROM contributions/, [{ id: IDS.contribution, author_user_id: opts.author ?? IDS.author, state: 'published' }]],
      [/UPDATE consents SET revoked_at/, opts.revoked === false ? [] : [{ id: 'consent-1' }]],
    ]);
  }

  it.each([
    ['store_process', true],
    ['publish_reviewed', true],
    ['attribute', false],
    ['semantic_analysis', false],
    ['model_training', false],
  ] as const)('revoking %s withdraws the contribution: %s', async (purpose, withdraws) => {
    queueRevoke();
    await revokeContributionConsent(IDS.contribution, IDS.author, IDS.org, purpose, IDS.request);
    const withdrawn = find(db.query, /UPDATE contributions SET state = 'withdrawn'/);
    expect(withdrawn.length > 0).toBe(withdraws);
  });

  it.each([
    ['store_process', true],
    ['publish_reviewed', true],
  ] as const)('revoking %s also withdraws every shared copy and clears its embeddings', async (purpose) => {
    queueRevoke();
    await revokeContributionConsent(IDS.contribution, IDS.author, IDS.org, purpose, IDS.request);
    expect(find(db.query, /UPDATE shared_copies SET status = 'withdrawn'/)).toHaveLength(1);
    expect(find(db.query, /DELETE FROM shared_copy_embeddings/)).toHaveLength(1);
    expect(find(db.query, /DELETE FROM shared_copy_embedding_jobs/)).toHaveLength(1);
  });

  it('revoking attribute strips the attribution label and de-identifies the active copy without withdrawing it', async () => {
    queueRevoke();
    await revokeContributionConsent(IDS.contribution, IDS.author, IDS.org, 'attribute', IDS.request);
    const strip = find(db.query, /reviewed_payload - 'attribution_label'/);
    expect(strip).toHaveLength(1);
    expect(strip[0].sql).toContain('deidentified = true, attribution_consent = false');
    expect(find(db.query, /shared_copies SET status = 'withdrawn'/)).toHaveLength(0);
  });

  it('revoking semantic_analysis clears embeddings and queued jobs but keeps the shared copy', async () => {
    queueRevoke();
    await revokeContributionConsent(IDS.contribution, IDS.author, IDS.org, 'semantic_analysis', IDS.request);
    expect(find(db.query, /DELETE FROM shared_copy_embeddings/)).toHaveLength(1);
    expect(find(db.query, /DELETE FROM shared_copy_embedding_jobs/)).toHaveLength(1);
    expect(find(db.query, /shared_copies SET status/)).toHaveLength(0);
  });

  it('writes a consent_revoke audit row with the purpose and prior state', async () => {
    queueRevoke();
    await revokeContributionConsent(IDS.contribution, IDS.author, IDS.org, 'attribute', IDS.request);
    const audit = find(db.query, /INSERT INTO audit_log/)[0];
    expect(audit.params[1]).toBe('contribution.consent_revoke');
    expect(JSON.parse(audit.params[6] as string)).toEqual({ purpose: 'attribute', prior_state: 'published' });
  });

  it('refuses to revoke a consent that is not active', async () => {
    queueRevoke({ revoked: false });
    await expect(revokeContributionConsent(IDS.contribution, IDS.author, IDS.org, 'model_training', IDS.request))
      .rejects.toThrow('No active consent exists for that purpose');
    expect(find(db.query, /INSERT INTO audit_log/)).toHaveLength(0);
  });

  it('refuses to revoke consent on a contribution the caller does not author', async () => {
    queueRevoke({ author: IDS.otherAuthor });
    await expect(revokeContributionConsent(IDS.contribution, IDS.author, IDS.org, 'store_process', IDS.request))
      .rejects.toThrow('Contribution not found');
    expect(find(db.query, /UPDATE consents SET revoked_at/)).toHaveLength(0);
  });
});

describe('read models and scoping', () => {
  it('lists only the caller own contributions or org-visible non-draft ones, excluding withdrawn', async () => {
    await listWorkspaceContributions(IDS.author, IDS.org);
    const [statement] = executed(db.query);
    expect(statement.params).toEqual([IDS.org, IDS.author]);
    expect(statement.sql).toContain("c.org_id = $1 AND c.withdrawn_at IS NULL");
    expect(statement.sql).toContain("c.author_user_id = $2 OR (c.visibility = 'org' AND c.state <> 'private_draft')");
    expect(statement.sql).toContain('LIMIT 100');
  });

  it('reads one contribution only inside the org, with the same author-or-org-visible rule', async () => {
    await getWorkspaceContribution(IDS.contribution, IDS.otherAuthor, IDS.org);
    const [statement] = executed(db.queryOne);
    expect(statement.params).toEqual([IDS.contribution, IDS.org, IDS.otherAuthor]);
    expect(statement.sql).toContain('c.id = $1 AND c.org_id = $2 AND c.withdrawn_at IS NULL');
    expect(statement.sql).toContain("c.author_user_id = $3 OR (c.visibility = 'org' AND c.state <> 'private_draft')");
  });

  it('exposes the shared payload from the newest active shared copy only', async () => {
    await getWorkspaceContribution(IDS.contribution, IDS.author, IDS.org);
    expect(executed(db.queryOne)[0].sql).toContain("s.status = 'active' ORDER BY s.published_at DESC, s.id DESC LIMIT 1");
  });

  it('allows the author to load the edit form only for editable states', async () => {
    await getAuthorContributionForEdit(IDS.contribution, IDS.author, IDS.org);
    const [statement] = executed(db.queryOne);
    expect(statement.sql).toContain("c.author_user_id = $2");
    expect(statement.sql).toContain("c.state IN ('private_draft', 'needs_clarification', 'published')");
    expect(statement.params).toEqual([IDS.contribution, IDS.author, IDS.org]);
  });

  it('treats withdrawn contributions as absent from the owner lookup', async () => {
    await getContributionOwner(IDS.contribution);
    expect(executed(db.queryOne)[0].sql).toContain('withdrawn_at IS NULL');
  });

  it('reads the latest clarification request, newest first', async () => {
    await getLatestClarification(IDS.contribution);
    const [statement] = executed(db.queryOne);
    expect(statement.sql).toContain("WHERE contribution_id = $1 AND action = 'clarify'");
    expect(statement.sql).toContain('ORDER BY created_at DESC, id DESC LIMIT 1');
  });

  it('reads current consents only for the author and only non-revoked rows', async () => {
    await getContributionCurrentConsents(IDS.contribution, IDS.author);
    const [statement] = executed(db.queryOne);
    expect(statement.params).toEqual([IDS.contribution, IDS.author]);
    expect(statement.sql).toContain('cs.revoked_at IS NULL');
    expect(statement.sql).toContain('AND c.author_user_id = $2');
  });
});

describe('reportSharedCopy', () => {
  function queueReport(copyRows: unknown[] = [{ id: IDS.sharedCopy, contribution_id: IDS.contribution, source_version_id: IDS.version }]) {
    routeQueries(db.query, [
      [/FROM memberships/, [{ id: IDS.membership }]],
      [/SELECT s\.id, s\.contribution_id, s\.source_version_id/, copyRows],
      [/INSERT INTO reports/, [{ id: IDS.report }]],
    ]);
  }

  it('records an open report against an active published copy and returns its open status', async () => {
    queueReport();
    const result = await reportSharedCopy(IDS.sharedCopy, IDS.otherAuthor, IDS.otherOrg, { category: 'misleading', details: '  The figures do not match the source.  ' }, IDS.request);
    expect(result).toEqual({ id: IDS.report, status: 'open' });
    const insert = find(db.query, /INSERT INTO reports/)[0];
    expect(insert.params).toEqual([IDS.sharedCopy, IDS.otherAuthor, 'misleading', 'The figures do not match the source.']);
    const audit = find(db.query, /INSERT INTO audit_log/)[0];
    expect(audit.params[1]).toBe('shared_copy.report');
    expect(JSON.parse(audit.params[6] as string)).toEqual({ category: 'misleading', shared_copy_id: IDS.sharedCopy });
  });

  it('only matches copies that are active, published and not withdrawn', async () => {
    queueReport();
    await reportSharedCopy(IDS.sharedCopy, IDS.otherAuthor, IDS.otherOrg, { category: 'other', details: 'Needs a second look.' }, IDS.request);
    const lookup = find(db.query, /SELECT s\.id, s\.contribution_id/)[0];
    expect(lookup.sql).toContain("s.status = 'active' AND c.state = 'published'");
    expect(lookup.sql).toContain('c.withdrawn_at IS NULL');
    expect(lookup.sql).toContain('FOR SHARE OF s');
  });

  it('keeps sandbox and production copies apart: a sandbox copy is reportable only from the same sandbox org', async () => {
    queueReport();
    await reportSharedCopy(IDS.sharedCopy, IDS.otherAuthor, IDS.otherOrg, { category: 'other', details: 'Needs a second look.' }, IDS.request);
    const lookup = find(db.query, /SELECT s\.id, s\.contribution_id/)[0];
    expect(lookup.sql).toContain('(workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $2)');
    expect(lookup.sql).toContain('(workspace.is_sandbox = false AND source_org.is_sandbox = false)');
  });

  it('reports "Shared contribution not found" and inserts nothing when no copy is reportable', async () => {
    queueReport([]);
    await expect(reportSharedCopy(IDS.sharedCopy, IDS.otherAuthor, IDS.otherOrg, { category: 'other', details: 'Needs a second look.' }, IDS.request))
      .rejects.toThrow('Shared contribution not found');
    expect(find(db.query, /INSERT INTO reports/)).toHaveLength(0);
  });

  it('refuses a report from a reporter whose membership is inactive', async () => {
    db.query.mockResolvedValueOnce([]);
    await expect(reportSharedCopy(IDS.sharedCopy, IDS.otherAuthor, IDS.otherOrg, { category: 'other', details: 'Needs a second look.' }, IDS.request))
      .rejects.toThrow('Workspace membership is no longer active');
  });
});

