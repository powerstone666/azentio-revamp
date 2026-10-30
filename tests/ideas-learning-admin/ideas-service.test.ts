import { query, queryOne, transaction } from '@/app/api/(db)/client';
import {
  createIdea, getIdea, getIdeaEvidence, getIdeaHistory, getIdeaScope, listIdeas, updateIdeaStatus,
} from '@/app/api/(services)/ideas/service';
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

describe('listIdeas audience scoping', () => {
  it('returns no ideas without querying when an internal reader has no offering assignments', async () => {
    await expect(listIdeas('internal', [], 'org-1')).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('returns no ideas without querying when no workspace is supplied', async () => {
    await expect(listIdeas('client', [], undefined)).resolves.toEqual([]);
    expect(query).not.toHaveBeenCalled();
  });

  it('limits client readers to public ideas or client ideas backed by an active, in-window entitlement', async () => {
    await listIdeas('client', [], 'org-1');
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain("i.audience = 'public'");
    expect(sql).toContain("i.audience = 'clients' AND EXISTS");
    expect(sql).toContain('e.org_id = $2 AND e.offering_id = i.offering');
    expect(sql).toContain("e.status = 'active' AND e.valid_from <= now() AND (e.valid_to IS NULL OR e.valid_to > now())");
    expect(params).toEqual([null, 'org-1']);
  });

  it('never selects internal-only idea fields for client readers', async () => {
    await listIdeas('client', [], 'org-1');
    const [{ sql }] = sqlCalls(query);
    expect(sql).not.toContain('i.problem_statement');
    expect(sql).not.toContain('i.proposed_outcome');
  });

  it('lets internal readers see internal, client and public ideas filtered to their assigned offerings', async () => {
    await listIdeas('internal', ['FAI'], 'org-1');
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain("i.audience IN ('internal', 'clients', 'public')");
    expect(sql).toContain('i.offering = ANY($1::text[])');
    expect(sql).toContain('i.problem_statement');
    expect(params).toEqual([['FAI'], 'org-1']);
  });

  it('scopes sandbox workspaces to their own ideas and production workspaces to platform ideas', async () => {
    await listIdeas('client', [], 'org-1');
    const [{ sql }] = sqlCalls(query);
    expect(sql).toContain('ws.is_sandbox = true) AND i.org_id = $2');
    expect(sql).toContain('ws.is_sandbox = false) AND i.org_id IS NULL');
  });

  it('counts only published, non-withdrawn, consented evidence toward the evidence count', async () => {
    await listIdeas('client', [], 'org-1');
    const [{ sql }] = sqlCalls(query);
    expect(sql).toContain("c.state = 'published' AND c.withdrawn_at IS NULL");
    expect(sql).toContain("co.purpose = 'publish_reviewed' AND co.choice = true AND co.revoked_at IS NULL");
    expect(sql).toContain("s.status = 'active'");
  });

  it('caps the idea list at 100 rows', async () => {
    await listIdeas('client', [], 'org-1');
    expect(sqlCalls(query)[0].sql).toContain('LIMIT 100');
  });
});

describe('getIdea and getIdeaScope', () => {
  it('returns null without querying for an internal reader with no offering assignments', async () => {
    await expect(getIdea(UUID_A, 'internal', [], 'org-1')).resolves.toBeNull();
    expect(queryOne).not.toHaveBeenCalled();
  });

  it('returns null without querying when no workspace is supplied', async () => {
    await expect(getIdea(UUID_A, 'client', [], undefined)).resolves.toBeNull();
    expect(queryOne).not.toHaveBeenCalled();
  });

  it('applies the same client audience predicate and binds the idea id first', async () => {
    await getIdea(UUID_A, 'client', [], 'org-1');
    const [{ sql, params }] = sqlCalls(queryOne);
    expect(sql).toContain('WHERE i.id = $1');
    expect(sql).toContain("i.audience = 'public'");
    expect(sql).not.toContain('i.problem_statement');
    expect(params).toEqual([UUID_A, null, 'org-1']);
  });

  it('binds internal offerings for internal readers', async () => {
    await getIdea(UUID_A, 'internal', ['Lending'], 'org-1');
    expect(sqlCalls(queryOne)[0].params).toEqual([UUID_A, ['Lending'], 'org-1']);
  });

  it('looks up the idea scope with the workspace sandbox rule', async () => {
    await getIdeaScope(UUID_A, 'org-9');
    const [{ sql, params }] = sqlCalls(queryOne);
    expect(sql).toContain('ws.is_sandbox = true) AND i.org_id = $2');
    expect(sql).toContain('ws.is_sandbox = false) AND i.org_id IS NULL');
    expect(params).toEqual([UUID_A, 'org-9']);
  });
});

describe('idea evidence and history', () => {
  it('returns only de-identified, community-proposed, consented evidence', async () => {
    await getIdeaEvidence(UUID_A, 'org-1');
    const [{ sql }] = sqlCalls(query);
    expect(sql).toContain('s.deidentified = true');
    expect(sql).toContain("c.visibility = 'community_proposed'");
    expect(sql).toContain("co.choice = true AND co.revoked_at IS NULL");
  });

  it('keeps sandbox evidence inside the sandbox workspace and production evidence out of it', async () => {
    await getIdeaEvidence(UUID_A, 'org-1');
    const [{ sql }] = sqlCalls(query);
    expect(sql).toContain('workspace.is_sandbox = true AND source_org.is_sandbox = true AND c.org_id = $2');
    expect(sql).toContain('workspace.is_sandbox = false AND source_org.is_sandbox = false');
  });

  it('reports the system as the actor for status history rows without a user', async () => {
    await getIdeaHistory(UUID_A);
    const [{ sql, params }] = sqlCalls(query);
    expect(sql).toContain("COALESCE(u.display_name, 'System')");
    expect(params).toEqual([UUID_A]);
  });
});

describe('createIdea', () => {
  const CONTRIBUTION = '6f1c2b1e-aaaa-4a2b-9c3d-00000000000a';
  const input = {
    title: '  Faster onboarding  ',
    problem_statement: 'Onboarding takes several weeks for new teams',
    offering: 'FAI',
    proposed_outcome: 'Cut onboarding to a few days',
    client_update: '',
    owner_team: 'Product',
    priority: 'high' as const,
    audience: 'clients' as const,
    supporting_contribution_ids: [CONTRIBUTION],
  };

  function respondCreate({ membership = [{ id: 'm1', is_sandbox: false }], allowed = true, evidence = [{ shared_copy_id: 'copy-1', contribution_id: CONTRIBUTION }] as unknown[] } = {}) {
    respondTo(query, [
      ['SELECT m.id, o.is_sandbox FROM memberships', membership],
      ['SELECT EXISTS (', [{ allowed }]],
      ['FROM contributions c', evidence],
      ['INSERT INTO improvement_ideas', [{ id: 'idea-1' }]],
    ]);
  }

  it('rejects creation when the actor no longer has an active workspace membership', async () => {
    respondCreate({ membership: [] });
    await expect(createIdea(input, 'user-1', 'org-1', 'req-1')).rejects.toThrow('Workspace membership is no longer active');
    expect(callsMatching(query, 'INSERT INTO improvement_ideas')).toHaveLength(0);
  });

  it('rejects creation when the product owner assignment is not active for the offering', async () => {
    respondCreate({ allowed: false });
    await expect(createIdea(input, 'user-1', 'org-1', 'req-1')).rejects.toThrow(
      'Product owner assignment is no longer active for this offering',
    );
    expect(callsMatching(query, 'INSERT INTO improvement_ideas')).toHaveLength(0);
  });

  it('rejects creation when any evidence reference is not an active approved shared contribution', async () => {
    respondCreate({ evidence: [] });
    await expect(createIdea(input, 'user-1', 'org-1', 'req-1')).rejects.toThrow(
      'Every evidence reference must be an active approved shared contribution',
    );
    expect(callsMatching(query, 'INSERT INTO improvement_ideas')).toHaveLength(0);
  });

  it('creates the idea as Proposed with a trimmed title and an initial history row', async () => {
    respondCreate();
    await expect(createIdea(input, 'user-1', 'org-1', 'req-1')).resolves.toEqual({ id: 'idea-1', status: 'Proposed' });
    const [insert] = callsMatching(query, 'INSERT INTO improvement_ideas');
    expect(insert.sql).toContain("'Proposed'");
    expect(insert.params[1]).toBe('Faster onboarding');
    expect(callsMatching(query, 'VALUES ($1, NULL, \'Proposed\', $2, NULL)')).toHaveLength(1);
  });

  it.each([
    ['sandbox', true, 'org-1'],
    ['production', false, null],
  ])('sets org ownership for a %s workspace to %s', async (_label, isSandbox, expectedOrg) => {
    respondCreate({ membership: [{ id: 'm1', is_sandbox: isSandbox }] });
    await createIdea(input, 'user-1', 'org-1', 'req-1');
    expect(callsMatching(query, 'INSERT INTO improvement_ideas')[0].params[0]).toBe(expectedOrg);
  });

  it.each([
    ['sandbox', true, "evidence_org.is_sandbox = true AND c.org_id = $2"],
    ['production', false, 'evidence_org.is_sandbox = false'],
  ])('only accepts %s evidence matching the workspace', async (_label, isSandbox, fragment) => {
    respondCreate({ membership: [{ id: 'm1', is_sandbox: isSandbox }] });
    await createIdea(input, 'user-1', 'org-1', 'req-1');
    expect(callsMatching(query, 'FROM contributions c')[0].sql).toContain(fragment);
  });

  it('links every evidence reference to the new idea', async () => {
    respondCreate({ evidence: [{ shared_copy_id: 'copy-1', contribution_id: CONTRIBUTION }, { shared_copy_id: 'copy-2', contribution_id: UUID_B }] as unknown[] });
    await createIdea({ ...input, supporting_contribution_ids: [CONTRIBUTION, UUID_B] }, 'user-1', 'org-1', 'req-1');
    const links = callsMatching(query, 'INSERT INTO idea_evidence');
    expect(links.map((link) => link.params)).toEqual([['idea-1', 'copy-1'], ['idea-1', 'copy-2']]);
  });

  it('acknowledges the authors of the supporting contributions, excluding the actor, with ids only', async () => {
    respondCreate({ evidence: [{ shared_copy_id: 'copy-1', contribution_id: CONTRIBUTION }, { shared_copy_id: 'copy-2', contribution_id: UUID_B }] as unknown[] });
    await createIdea({ ...input, supporting_contribution_ids: [CONTRIBUTION, UUID_B] }, 'user-1', 'org-1', 'req-1');
    const [ack] = callsMatching(query, "'contribution.acknowledged'");
    expect(ack.sql).toContain('INSERT INTO notifications');
    expect(ack.sql).toContain('c.author_user_id <> $3');
    expect(ack.sql).toContain("jsonb_build_object('contribution_id', c.id, 'idea_id', $1::text, 'status', 'Proposed')");
    expect(ack.params).toEqual(['idea-1', [CONTRIBUTION, UUID_B], 'user-1']);
    expect(ack.sql).not.toMatch(/title|problem_statement|client_update/);
  });

  it('sends no acknowledgement when the idea has no supporting evidence', async () => {
    respondCreate({ evidence: [] });
    await createIdea({ ...input, supporting_contribution_ids: [] }, 'user-1', 'org-1', 'req-1');
    expect(callsMatching(query, "'contribution.acknowledged'")).toHaveLength(0);
  });

  it('writes an idea.create audit row with the evidence count', async () => {
    respondCreate();
    await createIdea(input, 'user-1', 'org-1', 'req-42');
    const [audit] = callsMatching(query, 'INSERT INTO audit_log');
    expect(audit.params).toContain('idea.create');
    expect(audit.params).toContain('req-42');
    expect(metadataOf(audit.params)).toEqual({ offering: 'FAI', audience: 'clients', evidence_count: 1 });
  });
});

describe('updateIdeaStatus transitions', () => {
  const ALLOWED: Array<[string, string]> = [
    ['Proposed', 'Under review'],
    ['Proposed', 'Not proceeding'],
    ['Under review', 'Planned'],
    ['Under review', 'In progress'],
    ['Under review', 'Not proceeding'],
    ['Planned', 'In progress'],
    ['Planned', 'Not proceeding'],
    ['In progress', 'Released'],
    ['In progress', 'Not proceeding'],
  ];
  const DENIED: Array<[string, string]> = [
    ['Proposed', 'Planned'],
    ['Proposed', 'In progress'],
    ['Proposed', 'Released'],
    ['Under review', 'Released'],
    ['Under review', 'Proposed'],
    ['Planned', 'Released'],
    ['Planned', 'Under review'],
    ['In progress', 'Planned'],
    ['In progress', 'Under review'],
    ['Released', 'Proposed'],
    ['Released', 'Not proceeding'],
    ['Not proceeding', 'Proposed'],
    ['Not proceeding', 'Under review'],
  ];

  function respondUpdate(idea: Record<string, unknown>, { membership = [{ id: 'm1', is_sandbox: false }], allowed = true } = {}) {
    respondTo(query, [
      ['SELECT m.id, o.is_sandbox FROM memberships', membership],
      ['SELECT EXISTS (', [{ allowed }]],
      ['SELECT status, audience, title, client_update FROM improvement_ideas', [idea]],
      ['UPDATE improvement_ideas SET status', [{ status: idea.next_status }]],
    ]);
  }

  it.each(ALLOWED)('allows an idea to move from %s to %s', async (from, to) => {
    respondUpdate({ status: from, audience: 'internal', title: 'T', client_update: '', next_status: to });
    await expect(updateIdeaStatus(UUID_A, 'user-1', 'org-1', 'FAI', { status: to as never }, 'req-1'))
      .resolves.toEqual({ status: to });
  });

  it.each(DENIED)('rejects a move from %s to %s', async (from, to) => {
    respondUpdate({ status: from, audience: 'internal', title: 'T', client_update: '', next_status: to });
    await expect(updateIdeaStatus(UUID_A, 'user-1', 'org-1', 'FAI', { status: to as never }, 'req-1'))
      .rejects.toThrow('This idea status transition is not allowed');
    expect(callsMatching(query, 'UPDATE improvement_ideas SET status')).toHaveLength(0);
  });

  it('rejects status updates when the product owner assignment is no longer active', async () => {
    respondUpdate({ status: 'Proposed', audience: 'internal', title: 'T', client_update: '', next_status: 'Under review' }, { allowed: false });
    await expect(updateIdeaStatus(UUID_A, 'user-1', 'org-1', 'FAI', { status: 'Under review' }, 'req-1'))
      .rejects.toThrow('Product owner assignment is no longer active');
    expect(callsMatching(query, 'UPDATE improvement_ideas SET status')).toHaveLength(0);
  });

  it('locks the idea row and scopes the lookup to the offering and the workspace ownership rule', async () => {
    respondUpdate({ status: 'Proposed', audience: 'internal', title: 'T', client_update: '', next_status: 'Under review' });
    await updateIdeaStatus(UUID_A, 'user-1', 'org-1', 'FAI', { status: 'Under review' }, 'req-1');
    const [lookup] = callsMatching(query, 'FROM improvement_ideas WHERE id = $1');
    expect(lookup.sql).toContain('AND offering = $2');
    expect(lookup.sql).toContain('org_id IS NOT DISTINCT FROM CASE WHEN $4::boolean THEN $3::uuid ELSE NULL END');
    expect(lookup.sql).toContain('FOR UPDATE');
    expect(lookup.params).toEqual([UUID_A, 'FAI', 'org-1', false]);
  });

  it('records a status history row and an audit row when the status changes', async () => {
    respondUpdate({ status: 'Proposed', audience: 'internal', title: 'T', client_update: '', next_status: 'Under review' });
    await updateIdeaStatus(UUID_A, 'user-1', 'org-1', 'FAI', { status: 'Under review', status_note: 'triaged' }, 'req-7');
    const [history] = callsMatching(query, 'INSERT INTO idea_status_history');
    expect(history.params).toEqual([UUID_A, 'Proposed', 'Under review', 'user-1', 'triaged']);
    const [audit] = callsMatching(query, 'INSERT INTO audit_log');
    expect(audit.params).toContain('idea.status_update');
    expect(metadataOf(audit.params)).toEqual({
      from_status: 'Proposed', to_status: 'Under review', client_update_changed: false, audience: 'internal',
    });
  });

  it.each([
    ['clients', 1],
    ['public', 1],
    ['internal', 0],
  ])('notifies evidence authors only for %s ideas (expected notification inserts: %i)', async (audience, expected) => {
    respondUpdate({ status: 'Proposed', audience, title: 'T', client_update: '', next_status: 'Under review' });
    await updateIdeaStatus(UUID_A, 'user-1', 'org-1', 'FAI', { status: 'Under review' }, 'req-1');
    const notifications = callsMatching(query, 'INSERT INTO notifications');
    expect(notifications).toHaveLength(expected);
    if (expected) expect(notifications[0].sql).toContain("'idea.status_updated'");
  });

  it('allows a client-facing update on a clients idea without changing its status', async () => {
    respondUpdate({ status: 'Planned', audience: 'clients', title: 'T', client_update: 'Old note', next_status: 'Planned' });
    await updateIdeaStatus(UUID_A, 'user-1', 'org-1', 'FAI', { status: 'Planned', client_update: 'New note' }, 'req-1');
    expect(callsMatching(query, 'INSERT INTO idea_status_history')).toHaveLength(0);
    expect(metadataOf(callsMatching(query, 'INSERT INTO audit_log')[0].params)).toMatchObject({ client_update_changed: true });
  });

  it.each([
    ['internal', 'Planned', 'New note'],
    ['clients', 'Planned', 'Old note'],
  ])('rejects a same-status client update when the audience is %s and the note is unchanged or internal-only', async (audience, status, note) => {
    respondUpdate({ status, audience, title: 'T', client_update: 'Old note', next_status: status });
    await expect(updateIdeaStatus(UUID_A, 'user-1', 'org-1', 'FAI', { status: status as never, client_update: note }, 'req-1'))
      .rejects.toThrow('not allowed');
  });
});
