jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import {
  applyModerationDecision,
  getModerationOverview,
  getModerationQueue,
  getModerationReportScope,
  getModerationReports,
  listModerationAudit,
  updateModerationReportStatus,
} from '@/app/api/(services)/moderation/service';
import { mockDb } from '../support/db';
import { ALL_STATES, IDS, executed, find, routeQueries } from './fixtures';

let db: ReturnType<typeof mockDb>;

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  db = mockDb({ query, queryOne, transaction });
});

const COPY_ID = IDS.sharedCopy;
const SOURCE_PAYLOAD = {
  title: 'Pricing pressure in retail lending',
  body: 'Customers are asking for faster approvals across branches.',
  contact: 'jane.customer@client.example',
  internal_note: 'do not publish',
};
const REDACTED_PAYLOAD = {
  title: 'Pricing pressure in retail lending',
  observation_type: 'market_observation',
  offering: 'Lending Suite',
  industry: 'Banking',
  region: 'APAC',
  observation_period_start: '2026-01-01',
  observation_period_end: '2026-03-31',
  evidence_type: 'quantitative',
  confidence: 'high',
  body: 'Customers are asking for faster approvals across branches.',
};

type Action = 'clarify' | 'reject' | 'approve' | 'publish' | 'suspend' | 'reinstate';
const ACTIONS: Action[] = ['clarify', 'reject', 'approve', 'publish', 'suspend', 'reinstate'];
const ALLOWED_FROM: Record<Action, string[]> = {
  clarify: ['submitted'],
  reject: ['submitted', 'approved'],
  approve: ['submitted'],
  publish: ['approved'],
  suspend: ['published'],
  reinstate: ['suspended'],
};

/** Moderation decision input, as the zod schema would hand it to the service. */
function decision(action: Action, extra: Record<string, unknown> = {}) {
  const base: Record<string, unknown> = {
    action,
    reason_code: 'quality_review',
    deidentified: true,
    attribution_consent: false,
  };
  if (action === 'clarify') base.clarification_message = '  Which region does this cover?  ';
  if (action === 'publish') {
    base.redacted_payload = REDACTED_PAYLOAD;
    base.evidence_quality = 'moderate';
  }
  return { ...base, ...extra } as Parameters<typeof applyModerationDecision>[3];
}

/**
 * Answers the decision flow's reads from one place: the moderator grant, the locked contribution,
 * its current version (with a source payload holding fields that must never be published),
 * consents for that version, any existing shared copy and the open-report count.
 */
function queueModeration(opts: {
  state?: string;
  visibility?: string;
  consents?: Record<string, boolean>;
  grant?: boolean;
  found?: boolean;
  withdrawn?: boolean;
  existingCopy?: boolean;
  openReports?: number;
} = {}) {
  const consents = opts.consents ?? { store_process: true, publish_reviewed: true, attribute: false, semantic_analysis: false };
  const row = {
    id: IDS.contribution,
    author_user_id: IDS.author,
    org_id: IDS.org,
    visibility: opts.visibility ?? 'community_proposed',
    state: opts.state ?? 'submitted',
    current_version_id: IDS.version,
    withdrawn_at: opts.withdrawn ? new Date('2026-01-01') : null,
  };
  routeQueries(db.query, [
    [/FROM role_grants/, opts.grant === false ? [] : [{ id: 'grant-1' }]],
    [/SELECT \* FROM contributions WHERE id = \$1 AND org_id = \$2 FOR UPDATE/, opts.found === false ? [] : [row]],
    [/SELECT \* FROM contribution_versions WHERE id = \$1 AND contribution_id = \$2/, [{
      id: IDS.version, contribution_id: IDS.contribution, version: 2, source_payload: SOURCE_PAYLOAD,
    }]],
    [/SELECT purpose, choice FROM consents/, Object.entries(consents).map(([purpose, choice]) => ({ purpose, choice }))],
    [/SELECT choice FROM consents/, [{ choice: consents.store_process === true }]],
    [/SELECT id FROM shared_copies WHERE source_version_id = \$1 FOR UPDATE/, opts.existingCopy ? [{ id: COPY_ID }] : []],
    [/SELECT id FROM shared_copies WHERE source_version_id = \$1/, [{ id: COPY_ID }]],
    [/SELECT count\(\*\)::text AS count FROM reports/, [{ count: String(opts.openReports ?? 0) }]],
  ]);
}

describe('moderator queue and overview scoping', () => {
  it('scopes the global queue to non-sandbox organizations when no org is given', async () => {
    await getModerationQueue();
    const [statement] = executed(db.query);
    expect(statement.params).toEqual([null]);
    expect(statement.sql).toContain('NOT EXISTS (SELECT 1 FROM organizations so WHERE so.id = c.org_id AND so.is_sandbox)');
  });

  it('scopes an org moderator queue to that organization only', async () => {
    await getModerationQueue(IDS.org);
    const [statement] = executed(db.query);
    expect(statement.params).toEqual([IDS.org]);
    expect(statement.sql).toContain('OR c.org_id = $1)');
  });

  it('queues only submitted or clarification-pending contributions that are not withdrawn', async () => {
    await getModerationQueue(IDS.org);
    const [statement] = executed(db.query);
    expect(statement.sql).toContain("c.state IN ('submitted', 'needs_clarification') AND c.withdrawn_at IS NULL");
    expect(statement.sql).toContain('ORDER BY c.created_at, c.id');
  });

  it.each([
    [undefined, null],
    [IDS.org, IDS.org],
  ])('uses the same global-vs-org scope for the overview counts (org=%s)', async (orgId, expected) => {
    query.mockResolvedValueOnce([]);
    queryOne.mockResolvedValueOnce({ awaiting_review: 0, flagged_sensitive: 0, open_reports: 0 });
    await getModerationOverview(orgId);
    expect(executed(db.query)[0].params).toEqual([expected]);
    expect(executed(db.queryOne)[0].params).toEqual([expected]);
  });

  it('returns zeroed counts and the queue for the overview, even when counts are absent', async () => {
    query.mockResolvedValueOnce([{ id: IDS.contribution }]);
    queryOne.mockResolvedValueOnce(undefined);
    await expect(getModerationOverview()).resolves.toEqual({
      awaiting_review: 0, flagged_sensitive: 0, open_reports: 0, queue: [{ id: IDS.contribution }],
    });
  });

  it('caps the overview queue preview at three items', async () => {
    query.mockResolvedValueOnce([]);
    queryOne.mockResolvedValueOnce({ awaiting_review: 0, flagged_sensitive: 0, open_reports: 0 });
    await getModerationOverview();
    expect(executed(db.query)[0].sql).toContain('LIMIT 3');
  });

  it('lists audit entries only for moderation actions, scoped to the org when one is given', async () => {
    await listModerationAudit(IDS.org);
    const [statement] = executed(db.query);
    expect(statement.params).toEqual([IDS.org]);
    for (const action of ['contribution.clarify', 'contribution.reject', 'contribution.approve', 'contribution.publish',
      'contribution.suspend', 'contribution.reinstate', 'report.status_update']) {
      expect(statement.sql).toContain(`'${action}'`);
    }
    expect(statement.sql).toContain('($1::uuid IS NULL OR a.active_org_id = $1)');
  });

  it('lists audit entries across orgs for a global moderator', async () => {
    await listModerationAudit();
    expect(executed(db.query)[0].params).toEqual([null]);
  });

  it('orders reports so open ones come first, then investigating, then resolved', async () => {
    await getModerationReports(IDS.org);
    expect(executed(db.query)[0].sql).toContain("ORDER BY CASE r.status WHEN 'open' THEN 0 WHEN 'investigating' THEN 1 ELSE 2 END");
  });

  it('resolves a report to its scope, or null when the report does not exist', async () => {
    query.mockResolvedValueOnce([{ id: IDS.report, contribution_id: IDS.contribution, org_id: IDS.org }]);
    await expect(getModerationReportScope(IDS.report)).resolves.toEqual({ id: IDS.report, contribution_id: IDS.contribution, org_id: IDS.org });
    query.mockResolvedValueOnce([]);
    await expect(getModerationReportScope(IDS.report)).resolves.toBeNull();
  });
});

describe('applyModerationDecision: state machine', () => {
  it.each(ACTIONS.flatMap((action) =>
    ALL_STATES.filter((state) => !ALLOWED_FROM[action].includes(state)).map((state) => [action, state]),
  ))('rejects "%s" when the contribution is in the %s state', async (action, state) => {
    queueModeration({ state });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision(action), IDS.request))
      .rejects.toThrow('Decision is not allowed for the current contribution state');
    expect(find(db.query, /INSERT INTO moderation_decisions/)).toHaveLength(0);
    expect(find(db.query, /UPDATE contributions SET state/)).toHaveLength(0);
  });

  it.each([
    ['clarify', 'submitted', 'needs_clarification'],
    ['reject', 'submitted', 'rejected'],
    ['reject', 'approved', 'rejected'],
    ['approve', 'submitted', 'approved'],
    ['publish', 'approved', 'published'],
    ['suspend', 'published', 'suspended'],
    ['reinstate', 'suspended', 'published'],
  ] as const)('moves "%s" from %s to %s and reports the new state', async (action, from, to) => {
    queueModeration({ state: from, visibility: 'community_proposed' });
    const result = await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision(action), IDS.request);
    expect(result).toEqual({ id: IDS.contribution, state: to });
    expect(find(db.query, /UPDATE contributions SET state = \$1/)[0].params[0]).toBe(to);
  });

  it('records every decision in moderation_decisions against the version it judged', async () => {
    queueModeration({ state: 'submitted', visibility: 'author' });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('reject'), IDS.request);
    const row = find(db.query, /INSERT INTO moderation_decisions/)[0];
    expect(row.params).toEqual([IDS.contribution, IDS.version, IDS.moderator, 'reject', 'quality_review', null, null, null]);
  });

  it('writes one audit row and one author notification per decision, with the same action name', async () => {
    queueModeration({ state: 'submitted', visibility: 'author' });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('reject'), IDS.request);
    const audit = find(db.query, /INSERT INTO audit_log/);
    expect(audit).toHaveLength(1);
    expect(audit[0].sql).toContain("'contribution', $3");
    expect(audit[0].params.slice(0, 5)).toEqual([IDS.moderator, 'contribution.reject', IDS.contribution, IDS.org, IDS.request]);
    const notice = find(db.query, /INSERT INTO notifications/);
    expect(notice).toHaveLength(1);
    expect(notice[0].params[0]).toBe(IDS.author);
    expect(notice[0].params[1]).toBe('contribution.reject');
    expect(JSON.parse(notice[0].params[2] as string)).toEqual({ contribution_id: IDS.contribution, state: 'rejected', reason_code: 'quality_review' });
  });

  it('refuses any decision from a moderator whose grant is revoked, expired or outside the org', async () => {
    queueModeration({ grant: false });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('reject'), IDS.request))
      .rejects.toThrow('Learning moderator grant is no longer active');
    expect(find(db.query, /FROM contributions WHERE id/)).toHaveLength(0);
  });

  it('checks the moderator grant for the org or a global grant, not revoked and not expired', async () => {
    queueModeration({ state: 'submitted', visibility: 'author' });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('reject'), IDS.request);
    const grant = find(db.query, /FROM role_grants/)[0];
    expect(grant.sql).toContain("role = 'learning_moderator'");
    expect(grant.sql).toContain('(org_id = $2 OR org_id IS NULL)');
    expect(grant.sql).toContain('revoked_at IS NULL AND (expires_at IS NULL OR expires_at > now())');
    expect(grant.params).toEqual([IDS.moderator, IDS.org]);
  });

  it('refuses to decide on a withdrawn contribution as if it were not found', async () => {
    queueModeration({ withdrawn: true });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('reject'), IDS.request))
      .rejects.toThrow('Contribution not found');
  });

  it('refuses to decide on a contribution outside the moderator org', async () => {
    queueModeration({ found: false });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.otherOrg, decision('reject'), IDS.request))
      .rejects.toThrow('Contribution not found');
    expect(find(db.query, /FROM contributions WHERE id = \$1 AND org_id = \$2 FOR UPDATE/)[0].params).toEqual([IDS.contribution, IDS.otherOrg]);
  });
});

describe('clarification requests', () => {
  it('stores the trimmed clarification question as the decision note and moves to needs_clarification', async () => {
    queueModeration({ state: 'submitted' });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('clarify'), IDS.request);
    const row = find(db.query, /INSERT INTO moderation_decisions/)[0];
    expect(row.params[3]).toBe('clarify');
    expect(row.params[5]).toBe('Which region does this cover?');
    expect(find(db.query, /UPDATE contributions SET state = \$1/)[0].params[0]).toBe('needs_clarification');
  });

  it('refuses a clarification request with a blank message before writing anything', async () => {
    queueModeration({ state: 'submitted' });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('clarify', { clarification_message: '   ' }), IDS.request))
      .rejects.toThrow('A clarification request is required');
    expect(find(db.query, /INSERT INTO moderation_decisions/)).toHaveLength(0);
  });

  it('does not ask for a reviewed copy or consent when the decision is clarify', async () => {
    queueModeration({ state: 'submitted' });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('clarify'), IDS.request);
    expect(find(db.query, /FROM consents/)).toHaveLength(0);
    expect(find(db.query, /shared_copies/)).toHaveLength(0);
  });
});

describe('approve and reject', () => {
  it('approves an author-visible contribution only when storage consent is active for this version', async () => {
    queueModeration({ state: 'submitted', visibility: 'author', consents: { store_process: false } });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('approve'), IDS.request))
      .rejects.toThrow('Storage and processing consent is not active for this version');
  });

  it('approves an author-visible contribution with storage consent, without creating a shared copy', async () => {
    queueModeration({ state: 'submitted', visibility: 'author', consents: { store_process: true } });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('approve'), IDS.request))
      .resolves.toEqual({ id: IDS.contribution, state: 'approved' });
    expect(find(db.query, /INSERT INTO shared_copies/)).toHaveLength(0);
  });

  it('refuses attribution on approval when the contributor did not consent to attribution', async () => {
    queueModeration({ state: 'submitted', consents: { store_process: true, publish_reviewed: true, attribute: false } });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org,
      decision('approve', { attribution_consent: true, redacted_payload: { ...REDACTED_PAYLOAD, attribution_label: 'Regional bank' } }), IDS.request))
      .rejects.toThrow('Attribution requires explicit contributor consent and a reviewed label');
  });

  it('keeps an approved community-proposed contribution unpublished and rejects it on a later decision', async () => {
    queueModeration({ state: 'approved', visibility: 'community_proposed' });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('reject'), IDS.request))
      .resolves.toEqual({ id: IDS.contribution, state: 'rejected' });
  });
});

describe('publish copies only the reviewed fields', () => {
  it('stores exactly the moderator-redacted payload as the shared copy, never the source payload', async () => {
    queueModeration({ state: 'approved' });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('publish'), IDS.request);

    const copy = find(db.query, /INSERT INTO shared_copies/)[0];
    const stored = JSON.parse(copy.params[2] as string);
    expect(stored).toEqual(REDACTED_PAYLOAD);
    expect(stored).not.toHaveProperty('contact');
    expect(stored).not.toHaveProperty('internal_note');
    expect(JSON.stringify(copy.params)).not.toContain('jane.customer@client.example');
    expect(JSON.stringify(copy.params)).not.toContain('do not publish');
  });

  it('links the shared copy to the source version and records evidence quality', async () => {
    queueModeration({ state: 'approved' });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('publish'), IDS.request);
    const copy = find(db.query, /INSERT INTO shared_copies/)[0];
    expect(copy.params.slice(0, 2)).toEqual([IDS.contribution, IDS.version]);
    expect(copy.params.slice(3)).toEqual([true, false, 'moderate']);
    expect(copy.sql).toContain("'active')");
  });

  it('keeps the attribution label and marks the copy attributed when contributor and moderator both approved it', async () => {
    queueModeration({ state: 'approved', consents: { store_process: true, publish_reviewed: true, attribute: true } });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org,
      decision('publish', { attribution_consent: true, redacted_payload: { ...REDACTED_PAYLOAD, attribution_label: 'Regional bank' } }), IDS.request);
    const copy = find(db.query, /INSERT INTO shared_copies/)[0];
    expect(JSON.parse(copy.params[2] as string)).toMatchObject({ attribution_label: 'Regional bank' });
    expect(copy.params[3]).toBe(false);
    expect(copy.params[4]).toBe(true);
    const audit = find(db.query, /INSERT INTO audit_log/)[0];
    expect(JSON.parse(audit.params[5] as string)).toMatchObject({ attributed: true, deidentified: false });
  });

  it('refuses attribution without an explicit contributor attribute consent', async () => {
    queueModeration({ state: 'approved', consents: { store_process: true, publish_reviewed: true, attribute: false } });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org,
      decision('publish', { attribution_consent: true, redacted_payload: { ...REDACTED_PAYLOAD, attribution_label: 'Regional bank' } }), IDS.request))
      .rejects.toThrow('Attribution requires explicit contributor consent and a reviewed label');
    expect(find(db.query, /INSERT INTO shared_copies/)).toHaveLength(0);
  });

  it('refuses an attribution label supplied without the moderator approving attribution', async () => {
    queueModeration({ state: 'approved', consents: { store_process: true, publish_reviewed: true, attribute: true } });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org,
      decision('publish', { attribution_consent: false, redacted_payload: { ...REDACTED_PAYLOAD, attribution_label: 'Regional bank' } }), IDS.request))
      .rejects.toThrow('Attribution label supplied without explicit approval');
  });

  it('updates the existing copy for the same version instead of inserting a second copy', async () => {
    queueModeration({ state: 'approved', existingCopy: true });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('publish'), IDS.request);
    expect(find(db.query, /INSERT INTO shared_copies/)).toHaveLength(0);
    const update = find(db.query, /UPDATE shared_copies SET reviewed_payload/)[0];
    expect(update.sql).toContain("status = 'active', published_at = now(), invalidated_at = NULL");
    expect(update.params[4]).toBe(COPY_ID);
  });

  it('refuses to publish a non community-proposed contribution', async () => {
    queueModeration({ state: 'approved', visibility: 'author' });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('publish'), IDS.request))
      .rejects.toThrow('Only community-proposed contributions can be published');
  });

  it('refuses to publish without a reviewed copy (service-level guard)', async () => {
    queueModeration({ state: 'approved' });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('publish', { redacted_payload: undefined }), IDS.request))
      .rejects.toThrow('Reviewed copy is required');
  });

  it('refuses to publish without active publishing consent for this version', async () => {
    queueModeration({ state: 'approved', consents: { store_process: true, publish_reviewed: false } });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('publish'), IDS.request))
      .rejects.toThrow('Publishing consent is not active for this version');
  });

  it('refuses to publish without active storage consent for this version', async () => {
    queueModeration({ state: 'approved', consents: { store_process: false, publish_reviewed: true } });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('publish'), IDS.request))
      .rejects.toThrow('Storage and processing consent is not active for this version');
  });

  it('queues an embedding job only when semantic-analysis consent is active, and clears any stale embeddings otherwise', async () => {
    queueModeration({ state: 'approved', consents: { store_process: true, publish_reviewed: true, semantic_analysis: true } });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('publish'), IDS.request);
    expect(find(db.query, /INSERT INTO shared_copy_embedding_jobs/)).toHaveLength(1);
    expect(find(db.query, /DELETE FROM shared_copy_embeddings/)).toHaveLength(0);
  });

  it('clears embeddings and jobs on publish when semantic-analysis consent is not active', async () => {
    queueModeration({ state: 'approved', consents: { store_process: true, publish_reviewed: true, semantic_analysis: false } });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('publish'), IDS.request);
    expect(find(db.query, /INSERT INTO shared_copy_embedding_jobs/)).toHaveLength(0);
    expect(find(db.query, /DELETE FROM shared_copy_embeddings WHERE shared_copy_id/)).toHaveLength(1);
    expect(find(db.query, /DELETE FROM shared_copy_embedding_jobs WHERE shared_copy_id/)).toHaveLength(1);
  });

  it('records evidence quality and the de-identified flag on the publish audit row', async () => {
    queueModeration({ state: 'approved' });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('publish'), IDS.request);
    const audit = find(db.query, /INSERT INTO audit_log/)[0];
    expect(audit.params[1]).toBe('contribution.publish');
    expect(JSON.parse(audit.params[5] as string)).toMatchObject({ version_id: IDS.version, deidentified: true, attributed: false, evidence_quality: 'moderate' });
  });
});

describe('suspend and reinstate', () => {
  it('suspends every active shared copy of a published contribution', async () => {
    queueModeration({ state: 'published' });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('suspend'), IDS.request);
    const copies = find(db.query, /UPDATE shared_copies SET status = 'suspended'/);
    expect(copies).toHaveLength(1);
    expect(copies[0].sql).toContain("status = 'active'");
    expect(copies[0].params).toEqual([IDS.contribution]);
  });

  it('moderator suspend clears embeddings and queued embedding jobs', async () => {
    queueModeration({ state: 'published' });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('suspend'), IDS.request);
    expect(find(db.query, /DELETE FROM shared_copy_embeddings/).length).toBeGreaterThan(0);
    expect(find(db.query, /DELETE FROM shared_copy_embedding_jobs/).length).toBeGreaterThan(0);
  });

  it('refuses to reinstate while any report on the contribution is still open or investigating', async () => {
    queueModeration({ state: 'suspended', openReports: 2 });
    await expect(applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('reinstate'), IDS.request))
      .rejects.toThrow('Resolve open reports before reinstating the contribution');
    expect(find(db.query, /UPDATE shared_copies SET status = 'active'/)).toHaveLength(0);
    expect(find(db.query, /UPDATE contributions SET state/)).toHaveLength(0);
  });

  it('reinstates only suspended copies and republishes the contribution once reports are resolved', async () => {
    queueModeration({ state: 'suspended', openReports: 0 });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('reinstate'), IDS.request);
    const copies = find(db.query, /UPDATE shared_copies SET status = 'active'/);
    expect(copies).toHaveLength(1);
    expect(copies[0].sql).toContain("WHERE contribution_id = $1 AND status = 'suspended'");
    expect(find(db.query, /UPDATE contributions SET state = \$1/)[0].params[0]).toBe('published');
  });

  it('counts only reports that are not resolved when deciding whether reinstatement is allowed', async () => {
    queueModeration({ state: 'suspended', openReports: 0 });
    await applyModerationDecision(IDS.contribution, IDS.moderator, IDS.org, decision('reinstate'), IDS.request);
    expect(find(db.query, /FROM reports r/)[0].sql).toContain("r.status <> 'resolved'");
  });
});

describe('report status updates', () => {
  /** Report lookup row. Override the contribution state to test suspension on investigation. */
  function queueReport(opts: { status?: string; contributionState?: string; grant?: boolean; found?: boolean } = {}) {
    routeQueries(db.query, [
      [/FROM role_grants/, opts.grant === false ? [] : [{ id: 'grant-1' }]],
      [/FROM reports r JOIN shared_copies s ON s.id = r.shared_copy_id/, opts.found === false ? [] : [{
        status: opts.status ?? 'open',
        contribution_id: IDS.contribution,
        shared_copy_id: COPY_ID,
        author_user_id: IDS.author,
        current_version_id: IDS.version,
        contribution_state: opts.contributionState ?? 'published',
      }]],
    ]);
  }

  it.each([
    ['open', 'investigating'],
    ['open', 'resolved'],
    ['investigating', 'resolved'],
  ] as const)('moves a report from %s to %s', async (from, to) => {
    queueReport({ status: from, contributionState: 'submitted' });
    await expect(updateModerationReportStatus(IDS.report, IDS.moderator, IDS.org, to, IDS.request))
      .resolves.toEqual({ id: IDS.report, status: to });
    expect(find(db.query, /UPDATE reports SET status = \$1/)[0].params).toEqual([to, IDS.report]);
  });

  it.each([
    ['investigating', 'investigating'],
    ['resolved', 'investigating'],
    ['resolved', 'resolved'],
    ['investigating', 'open' as unknown as 'resolved'],
  ] as const)('refuses to move a report from %s to %s', async (from, to) => {
    queueReport({ status: from });
    await expect(updateModerationReportStatus(IDS.report, IDS.moderator, IDS.org, to, IDS.request))
      .rejects.toThrow('Report status transition is not allowed');
    expect(find(db.query, /UPDATE reports SET status/)).toHaveLength(0);
  });

  it('suspends a published contribution while its report is investigated, with a moderator decision and audit', async () => {
    queueReport({ status: 'open', contributionState: 'published' });
    await updateModerationReportStatus(IDS.report, IDS.moderator, IDS.org, 'investigating', IDS.request);
    expect(find(db.query, /UPDATE shared_copies SET status = 'suspended'/)).toHaveLength(1);
    expect(find(db.query, /DELETE FROM shared_copy_embeddings/)).toHaveLength(1);
    expect(find(db.query, /DELETE FROM shared_copy_embedding_jobs/)).toHaveLength(1);
    expect(find(db.query, /UPDATE contributions SET state = 'suspended'/)).toHaveLength(1);
    const decisionRow = find(db.query, /INSERT INTO moderation_decisions/)[0];
    expect(decisionRow.params[0]).toBe(IDS.contribution);
    expect(decisionRow.params[2]).toBe(IDS.moderator);
    expect(decisionRow.sql).toContain("'suspend', 'report_investigation'");
    expect(find(db.query, /INSERT INTO notifications/)[0].params[1]).toBe('contribution.suspend');
    const audit = find(db.query, /INSERT INTO audit_log/).find((c) => c.params[1] === 'contribution.suspend');
    expect(JSON.parse(audit!.params[5] as string)).toMatchObject({ reason_code: 'report_investigation', report_id: IDS.report });
  });

  it('does not suspend anything when investigating a report on a contribution that is not published', async () => {
    queueReport({ status: 'open', contributionState: 'submitted' });
    await updateModerationReportStatus(IDS.report, IDS.moderator, IDS.org, 'investigating', IDS.request);
    expect(find(db.query, /UPDATE shared_copies/)).toHaveLength(0);
    expect(find(db.query, /UPDATE contributions SET state = 'suspended'/)).toHaveLength(0);
    expect(find(db.query, /INSERT INTO notifications/)[0].sql).toContain("'report.status_updated'");
  });

  it('tells the author a resolved report still needs a moderator decision before republishing', async () => {
    queueReport({ status: 'investigating', contributionState: 'suspended' });
    await updateModerationReportStatus(IDS.report, IDS.moderator, IDS.org, 'resolved', IDS.request);
    const notice = find(db.query, /INSERT INTO notifications/)[0];
    expect(JSON.parse(notice.params[1] as string).message).toContain('requires a moderator decision before it can be republished');
  });

  it('refuses a report status change from a moderator without an active grant', async () => {
    queueReport({ grant: false });
    await expect(updateModerationReportStatus(IDS.report, IDS.moderator, IDS.org, 'resolved', IDS.request))
      .rejects.toThrow('Learning moderator grant is no longer active');
  });

  it('refuses a report status change for a report outside the moderator org', async () => {
    queueReport({ found: false });
    await expect(updateModerationReportStatus(IDS.report, IDS.moderator, IDS.otherOrg, 'resolved', IDS.request))
      .rejects.toThrow('Report not found');
  });

  it('audits each report status change with from and to status', async () => {
    queueReport({ status: 'open', contributionState: 'submitted' });
    await updateModerationReportStatus(IDS.report, IDS.moderator, IDS.org, 'resolved', IDS.request);
    const audit = find(db.query, /'report\.status_update'/)[0];
    expect(audit.params[0]).toBe(IDS.moderator);
    expect(JSON.parse(audit.params[4] as string)).toEqual({ from_status: 'open', to_status: 'resolved', contribution_id: IDS.contribution });
  });
});
