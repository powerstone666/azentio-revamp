jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { mockDb } from '../support/db';
import {
  archiveReleaseNote,
  createReleaseNote,
  getReleaseNoteScope,
  listClientReleaseNotes,
  listEmployeeReleaseNotes,
  listManageableReleaseNotes,
  publishReleaseNote,
  updateReleaseNoteDraft,
} from '@/app/api/(services)/releases/service';

const ACTOR = 'actor-1';
const ACTIVE_ORG = 'org-azentio';
const CLIENT_ORG = 'org-client';
const NOTE = 'note-1';
const OFFERING = 'fai';

type SqlCall = [string, unknown[]?];
const sqlCalls = () => query.mock.calls as SqlCall[];

beforeEach(() => {
  query.mockReset();
  queryOne.mockReset();
  transaction.mockReset();
  mockDb({ query, queryOne, transaction });
});

describe('release note reads', () => {
  it('refuses the employee feed without an active employee membership in an Azentio workspace', async () => {
    query.mockResolvedValueOnce([]);
    await expect(listEmployeeReleaseNotes(ACTOR, ACTIVE_ORG)).rejects.toThrow('Active audience membership required');
    const [membershipSql] = sqlCalls()[0];
    expect(membershipSql).toMatch(/m\.role = 'employee' AND o\.type = 'azentio'/);
    expect(sqlCalls()).toHaveLength(1);
  });

  it('lists only published employee notes that are not tied to a client organisation', async () => {
    query.mockResolvedValueOnce([{ id: 'm-1' }]).mockResolvedValueOnce([]);
    await listEmployeeReleaseNotes(ACTOR, ACTIVE_ORG);
    const [sql] = sqlCalls()[1];
    expect(sql).toMatch(/WHERE audience = 'employees' AND status = 'published'/);
    expect(sql).toMatch(/AND org_id IS NULL/);
  });

  it('refuses the client feed to users who are not active client members of that org', async () => {
    query.mockResolvedValueOnce([]);
    await expect(listClientReleaseNotes(ACTOR, CLIENT_ORG)).rejects.toThrow('Active audience membership required');
    expect(sqlCalls()[0][0]).toMatch(/m\.role IN \('client_member', 'client_admin'\) AND o\.type = 'client'/);
  });

  it('lists client notes only for the org or global notes, gated by active entitlements for offering-scoped notes', async () => {
    query.mockResolvedValueOnce([{ id: 'm-2' }]).mockResolvedValueOnce([]);
    await listClientReleaseNotes(ACTOR, CLIENT_ORG);
    const [sql, params] = sqlCalls()[1];
    expect(sql).toMatch(/r\.audience = 'clients' AND r\.status = 'published'/);
    expect(sql).toMatch(/\(r\.org_id IS NULL OR r\.org_id = \$1\)/);
    expect(sql).toMatch(/e\.org_id = \$1 AND e\.offering_id = r\.offering_id/);
    expect(sql).toMatch(/e\.status = 'active' AND e\.valid_from <= now\(\)/);
    expect(params).toEqual([CLIENT_ORG]);
  });

  it('lists manageable notes only for users holding a grant that covers the note offering', async () => {
    query.mockResolvedValueOnce([]);
    await listManageableReleaseNotes(ACTOR, ACTIVE_ORG);
    const [sql, params] = sqlCalls()[0];
    expect(sql).toMatch(/g\.user_id = \$1/);
    expect(sql).toMatch(/\(g\.org_id = \$2 OR g\.org_id IS NULL\)/);
    expect(sql).toMatch(/g\.role = 'content_publisher' AND \(g\.offering_id IS NULL OR g\.offering_id = r\.offering_id\)/);
    expect(sql).toMatch(/g\.role = 'product_owner' AND r\.offering_id IS NOT NULL AND g\.offering_id = r\.offering_id/);
    expect(params).toEqual([ACTOR, ACTIVE_ORG]);
  });

  it('returns the scope for a note, or null when it does not exist', async () => {
    query.mockResolvedValueOnce([{ id: NOTE, audience: 'clients', org_id: CLIENT_ORG, offering_id: OFFERING, status: 'draft' }]);
    await expect(getReleaseNoteScope(NOTE)).resolves.toMatchObject({ org_id: CLIENT_ORG });
    query.mockResolvedValueOnce([]);
    await expect(getReleaseNoteScope('missing')).resolves.toBeNull();
  });
});

describe('release note publishing permissions', () => {
  const grantRow = [{ id: 'g-1' }];

  it('refuses to manage notes when the active workspace is not an active Azentio workspace', async () => {
    query.mockResolvedValueOnce([]);
    await expect(createReleaseNote({
      actorId: ACTOR, activeOrgId: CLIENT_ORG, requestId: 'r', title: 'Release 1.2', body: 'Notes',
      audience: 'employees', offeringId: null, orgId: null,
    })).rejects.toThrow('An active Azentio workspace is required to manage release notes');
    expect(sqlCalls()[0][0]).toMatch(/type = 'azentio' AND status = 'active'/);
    expect(sqlCalls()).toHaveLength(1);
  });

  it('refuses to create a note without a live publishing or product-owner grant', async () => {
    query.mockResolvedValueOnce([{ id: ACTIVE_ORG }]).mockResolvedValueOnce([]);
    await expect(createReleaseNote({
      actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', title: 'Release 1.2', body: 'Notes',
      audience: 'employees', offeringId: OFFERING, orgId: null,
    })).rejects.toThrow('Release-note publishing grant is no longer active');
    const grantSql = sqlCalls()[1][0];
    expect(grantSql).toMatch(/role = 'product_owner' AND \$3::text IS NOT NULL AND offering_id = \$3/);
    expect(grantSql).toMatch(/revoked_at IS NULL AND \(expires_at IS NULL OR expires_at > now\(\)\)/);
  });

  it('refuses an employee note that targets a client organisation', async () => {
    query.mockResolvedValueOnce([{ id: ACTIVE_ORG }]).mockResolvedValueOnce(grantRow);
    await expect(createReleaseNote({
      actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', title: 'Release 1.2', body: 'Notes',
      audience: 'employees', offeringId: null, orgId: CLIENT_ORG,
    })).rejects.toThrow('Employee release notes cannot target a client organization');
  });

  it('refuses a client-targeted note whose client organisation is not active', async () => {
    query.mockResolvedValueOnce([{ id: ACTIVE_ORG }]).mockResolvedValueOnce(grantRow).mockResolvedValueOnce([]);
    await expect(createReleaseNote({
      actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', title: 'Release 1.2', body: 'Notes',
      audience: 'clients', offeringId: null, orgId: CLIENT_ORG,
    })).rejects.toThrow('Active client organization not found');
    expect(sqlCalls().some(([sql]) => sql.includes('INSERT INTO release_notes'))).toBe(false);
  });
});

describe('release note writes', () => {
  it('creates a draft authored by the actor and audits the creation', async () => {
    query
      .mockResolvedValueOnce([{ id: ACTIVE_ORG }])
      .mockResolvedValueOnce([{ id: 'g-1' }])
      .mockResolvedValueOnce([{ id: NOTE, title: 'Release 1.2', body: 'Notes', audience: 'employees', offering_id: null, published_at: null }])
      .mockResolvedValueOnce([]);

    await expect(createReleaseNote({
      actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'req-3', title: 'Release 1.2', body: 'Notes',
      audience: 'employees', offeringId: null, orgId: null,
    })).resolves.toMatchObject({ id: NOTE, title: 'Release 1.2' });

    const insert = sqlCalls()[2];
    expect(insert[0]).toMatch(/VALUES \(\$1, \$2, \$3, \$4, \$5, 'draft', \$6\)/);
    expect(insert[1]).toEqual(['Release 1.2', 'Notes', 'employees', null, null, ACTOR]);
    const audit = sqlCalls()[3];
    expect(audit[0]).toMatch(/'release_note\.create'/);
    expect(audit[1]).toEqual([ACTOR, NOTE, ACTIVE_ORG, 'req-3', JSON.stringify({ audience: 'employees', offering_id: null, org_id: null })]);
  });

  it('updates only draft notes, keeping the offering scope check, and audits the update', async () => {
    query
      .mockResolvedValueOnce([{ id: ACTIVE_ORG }])
      .mockResolvedValueOnce([{ id: 'g-1' }])
      .mockResolvedValueOnce([{ id: NOTE, title: 'T2', body: 'B2', audience: 'employees', offering_id: OFFERING, published_at: null }])
      .mockResolvedValueOnce([]);

    await updateReleaseNoteDraft({ id: NOTE, actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', title: 'T2', body: 'B2', offeringId: OFFERING });
    const update = sqlCalls()[2];
    expect(update[0]).toMatch(/WHERE id = \$1 AND status = 'draft' AND offering_id IS NOT DISTINCT FROM \$4/);
    expect(update[0]).toMatch(/AND org_id IS NOT DISTINCT FROM \$5/);
    expect(update[1]).toEqual([NOTE, 'T2', 'B2', OFFERING, null]);
  });

  it('reports a draft that is missing, already published, or moved to another offering as not found', async () => {
    query
      .mockResolvedValueOnce([{ id: ACTIVE_ORG }])
      .mockResolvedValueOnce([{ id: 'g-1' }])
      .mockResolvedValueOnce([]);
    await expect(updateReleaseNoteDraft({ id: NOTE, actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', title: 'T2', body: 'B2', offeringId: null })).rejects.toThrow(
      'Draft release note not found or offering scope changed',
    );
    expect(sqlCalls().some(([sql]) => sql.includes('release_note.update'))).toBe(false);
  });
});

describe('release note state transitions', () => {
  /** targetRows is only queued when the service performs the client-organisation check (publish of a client note). */
  function queueTransition(existing: unknown[], targetRows?: unknown[]) {
    query
      .mockResolvedValueOnce([{ id: ACTIVE_ORG }])
      .mockResolvedValueOnce([{ id: 'g-1' }])
      .mockResolvedValueOnce(existing);
    if (targetRows) query.mockResolvedValueOnce(targetRows);
    query.mockResolvedValueOnce([{ id: NOTE }]).mockResolvedValueOnce([]);
  }

  it('publishes a draft, stamping published_at and passing the allowed-from list', async () => {
    queueTransition([{ audience: 'employees', org_id: null }]);
    await publishReleaseNote({ id: NOTE, actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', offeringId: null });
    const select = sqlCalls()[2];
    expect(select[0]).toMatch(/offering_id IS NOT DISTINCT FROM \$2\s+AND org_id IS NOT DISTINCT FROM \$4 AND status = ANY\(\$3::text\[\]\)/);
    expect(select[1]).toEqual([NOTE, null, ['draft'], null]);
    const update = sqlCalls()[3];
    expect(update[0]).toMatch(/CASE WHEN \$2 = 'published' THEN now\(\) ELSE published_at END/);
    expect(update[1]).toEqual([NOTE, 'published', null, ['draft'], null]);
    expect(sqlCalls()[4][1]).toEqual([ACTOR, 'release_note.publish', NOTE, ACTIVE_ORG, 'r']);
  });

  it('archives a draft or published note and records release_note.archive', async () => {
    queueTransition([{ audience: 'employees', org_id: null }]);
    await archiveReleaseNote({ id: NOTE, actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', offeringId: null });
    expect(sqlCalls()[2][1]).toEqual([NOTE, null, ['draft', 'published'], null]);
    expect(sqlCalls()[4][1]).toEqual([ACTOR, 'release_note.archive', NOTE, ACTIVE_ORG, 'r']);
  });

  it('rejects publishing a note that is not in draft (missing, archived or published)', async () => {
    queueTransition([]);
    await expect(publishReleaseNote({ id: NOTE, actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', offeringId: null })).rejects.toThrow(
      'Release-note state transition is not allowed',
    );
    expect(sqlCalls().some(([sql]) => sql.includes('UPDATE release_notes'))).toBe(false);
  });

  it('refuses to publish a client note whose target organisation has become inactive', async () => {
    queueTransition([{ audience: 'clients', org_id: CLIENT_ORG }], []);
    await expect(publishReleaseNote({ id: NOTE, actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', offeringId: null })).rejects.toThrow(
      'Release-note target organisation is not active',
    );
    expect(sqlCalls().some(([sql]) => sql.includes('UPDATE release_notes'))).toBe(false);
  });

  it('does not re-check the target organisation when archiving', async () => {
    queueTransition([{ audience: 'clients', org_id: CLIENT_ORG }]);
    await archiveReleaseNote({ id: NOTE, actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', offeringId: null });
    expect(sqlCalls().some(([sql]) => sql.includes("type = 'client'"))).toBe(false);
  });

  it('refuses a transition when the grant has been revoked in the meantime', async () => {
    query
      .mockResolvedValueOnce([{ id: ACTIVE_ORG }])
      .mockResolvedValueOnce([]);
    await expect(archiveReleaseNote({ id: NOTE, actorId: ACTOR, activeOrgId: ACTIVE_ORG, requestId: 'r', offeringId: OFFERING })).rejects.toThrow(
      'Release-note publishing grant is no longer active',
    );
    expect(sqlCalls()).toHaveLength(2);
  });
});
