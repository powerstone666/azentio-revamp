import { query, queryOne, transaction } from '@/app/api/(db)/client';
import { OnboardingError, provisionDemoWorkspaces, type VerifiedIdentity } from '@/app/api/(services)/onboarding/service';
import { SANDBOX_DEMOS } from '@/app/(config)/sandbox';
import { mockDb } from '../support/db';
import { callsMatching, installFakeDb, norm, type FakeDbOptions } from './helpers';

jest.mock('next/headers', () => ({ headers: jest.fn(async () => new Headers()) }));
jest.mock('@/app/api/(services)/auth/better-auth-config', () => ({
  auth: { api: { getSession: jest.fn() } },
}));
jest.mock('@/app/api/(services)/auth/request-origin', () => ({ createAuthApiRequest: jest.fn() }));
jest.mock('@/app/api/(db)/client', () => ({
  query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
}));

const q = query as unknown as jest.Mock;
const identity: VerifiedIdentity = { email: 'priya.sharma@x.com', name: null };
const PRODUCT_OWNER_OFFERINGS = ['FAI', 'Lending', 'AMLOCK', 'Digital', 'Insurance', 'iMAL'];

function setup(options?: FakeDbOptions) {
  installFakeDb(q, options);
}

beforeEach(() => {
  mockDb({ query, queryOne, transaction });
  setup();
});

describe('user resolution', () => {
  it.each([
    ['priya.sharma@x.com', null, 'Priya Sharma'],
    ['jo_ng+tag2@x.com', null, 'Jo Ng Tag'],
    ['123@x.com', null, 'Demo user'],
    ['someone@x.com', 'Priya Sharma', 'Priya Sharma'],
    ['priya.sharma@x.com', 'priya@elsewhere.com', 'Priya Sharma'],
  ])('creates a user for %s (name %p) with display name %s', async (email, name, expected) => {
    await provisionDemoWorkspaces({ email, name }, ['employee']);
    const [insert] = callsMatching(q, 'INSERT INTO users (email');
    expect(insert.params).toEqual([email, expected]);
    expect(insert.sql).toContain('verified_at');
  });

  it('caps a long display name at 80 characters', async () => {
    await provisionDemoWorkspaces({ email: 'a@x.com', name: 'x'.repeat(120) }, ['employee']);
    expect(callsMatching(q, 'INSERT INTO users (email')[0].params[1]).toHaveLength(80);
  });

  it('reuses an existing active user without inserting a new one', async () => {
    setup({ existingUser: { id: 'user-existing', display_name: 'Existing Name', disabled_at: null } });
    await provisionDemoWorkspaces(identity, ['employee']);
    expect(callsMatching(q, 'INSERT INTO users (email')).toHaveLength(0);
    expect(callsMatching(q, 'UPDATE users SET verified_at')[0].params).toEqual(['user-existing']);
    expect(callsMatching(q, 'RETURNING id')
      .filter((c) => c.sql.startsWith('INSERT INTO memberships'))[0].params[1]).toBe('user-existing');
  });

  it('looks up an existing account by email case-insensitively', async () => {
    await provisionDemoWorkspaces(identity, ['employee']);
    const [lookup] = callsMatching(q, 'FROM users WHERE lower(email)');
    expect(lookup.sql).toContain('lower(email) = lower($1)');
    expect(lookup.params).toEqual([identity.email]);
  });

  it('rejects a disabled account with a 403 and creates nothing', async () => {
    setup({ existingUser: { id: 'user-disabled', display_name: 'Old', disabled_at: '2026-01-01T00:00:00Z' } });
    const attempt = provisionDemoWorkspaces(identity, ['employee']);
    await expect(attempt).rejects.toBeInstanceOf(OnboardingError);
    await expect(attempt).rejects.toMatchObject({ status: 403 });
    expect(callsMatching(q, 'INSERT INTO organizations')).toHaveLength(0);
  });
});

describe('role selection and membership', () => {
  it('grants only the one chosen role, even if several are passed', async () => {
    await provisionDemoWorkspaces(identity, ['product_owner', 'employee'] as never);
    const grants = callsMatching(q, 'INSERT INTO role_grants');
    expect(grants.filter((g) => g.params[2] === 'product_owner')).toHaveLength(PRODUCT_OWNER_OFFERINGS.length);
    expect(grants.filter((g) => g.params[2] === 'employee')).toHaveLength(0);
  });

  it('refuses a second role for an account that already has a demo membership', async () => {
    const base = q.getMockImplementation()!;
    q.mockImplementation(async (sql: string, params: unknown[] = []) =>
      norm(sql).includes('JOIN organizations o ON o.id = m.org_id AND o.is_sandbox') ? [{ role: 'employee' }] : base(sql, params));
    await expect(provisionDemoWorkspaces(identity, ['client_member'])).rejects.toMatchObject({ status: 409 });
    expect(callsMatching(q, 'INSERT INTO memberships')).toHaveLength(0);
  });

  it.each<[string[], string]>([
    [['client_member'], 'client_member'],
    [['client_admin'], 'client_admin'],
    [['employee'], 'employee'],
    [['content_publisher'], 'content_publisher'],
    [['learning_moderator'], 'learning_moderator'],
    [['product_owner'], 'product_owner'],
  ])('uses the chosen role %p as the membership role -> %s', async (roles, expected) => {
    const result = await provisionDemoWorkspaces(identity, roles as never);
    expect(callsMatching(q, 'INSERT INTO memberships (org_id, user_id, role, status) VALUES ($1, $2, $3')[0].params[2])
      .toBe(expected);
    expect(result[0].role).toBe(expected);
  });

  it('upgrades the membership to client_admin only when client_admin is selected', async () => {
    await provisionDemoWorkspaces(identity, ['client_member']);
    expect(callsMatching(q, "SET role = 'client_admin'")).toHaveLength(0);

    setup();
    await provisionDemoWorkspaces(identity, ['client_admin']);
    expect(callsMatching(q, "SET role = 'client_admin'")).toHaveLength(1);
  });

  it('returns the shared workspace with its membership id and creation flag', async () => {
    const [workspace] = await provisionDemoWorkspaces(identity, ['client_admin']);
    expect(workspace).toEqual({
      membership_id: 'membership-1',
      org_id: expect.any(String),
      org_name: 'Azentio Shared Demo',
      role: 'client_admin',
      created: true,
    });
  });

  it('throws a 503 when the shared demo workspace is unavailable', async () => {
    setup({ orgAvailable: false });
    await expect(provisionDemoWorkspaces(identity, ['employee'])).rejects.toMatchObject({ status: 503 });
  });

  it('throws a 403 when the membership in the shared workspace is not active', async () => {
    setup({ membershipStatus: 'suspended' });
    await expect(provisionDemoWorkspaces(identity, ['employee'])).rejects.toMatchObject({ status: 403 });
  });
});

describe('sandbox organisation', () => {
  it('creates the shared organisation as an active sandbox', async () => {
    await provisionDemoWorkspaces(identity, ['employee']);
    const [insert] = callsMatching(q, 'INSERT INTO organizations');
    expect(insert.sql).toContain("'active', true");
    expect(insert.params[1]).toBe('Azentio Shared Demo');
    expect(insert.params[2]).toBe('client');
  });

  // Known gap: service.ts always inserts type 'client'; onboarding.ts declares orgType 'azentio' for staff roles.
  it.failing('provisions staff roles into an azentio-type organisation as the catalogue declares', async () => {
    await provisionDemoWorkspaces(identity, ['employee']);
    expect(callsMatching(q, 'INSERT INTO organizations')[0].params[2]).toBe('azentio');
  });

  it('derives the same organisation and starter ids on every run', async () => {
    await provisionDemoWorkspaces(identity, ['client_member']);
    const firstOrg = callsMatching(q, 'INSERT INTO organizations')[0].params[0];
    const firstContributions = callsMatching(q, 'INSERT INTO contributions').map((c) => c.params[0]);

    q.mockClear();
    setup();
    await provisionDemoWorkspaces(identity, ['client_member']);
    expect(callsMatching(q, 'INSERT INTO organizations')[0].params[0]).toBe(firstOrg);
    expect(callsMatching(q, 'INSERT INTO contributions').map((c) => c.params[0])).toEqual(firstContributions);
  });

  it('gives different users the same shared organisation', async () => {
    await provisionDemoWorkspaces(identity, ['employee']);
    const first = callsMatching(q, 'INSERT INTO organizations')[0].params[0];
    q.mockClear();
    setup();
    await provisionDemoWorkspaces({ email: 'jo@x.com', name: null }, ['employee']);
    expect(callsMatching(q, 'INSERT INTO organizations')[0].params[0]).toBe(first);
  });
});

describe('grant-based roles', () => {
  it.each(['learning_moderator', 'content_publisher'])('grants %s on the shared workspace without an offering', async (role) => {
    await provisionDemoWorkspaces(identity, [role as never]);
    const grants = callsMatching(q, 'INSERT INTO role_grants').filter((g) => g.params[2] === role);
    expect(grants).toHaveLength(1);
    expect(grants[0].params[3]).toBeNull();
  });

  it('scopes every grant to the shared organisation and the signed-in user', async () => {
    await provisionDemoWorkspaces(identity, ['product_owner']);
    const orgId = callsMatching(q, 'INSERT INTO organizations')[0].params[0];
    for (const grant of callsMatching(q, 'INSERT INTO role_grants')) {
      expect(grant.params[0]).toBe(orgId);
      expect(grant.params[1]).toBe('user-new');
    }
  });

  it('grants product_owner one offering per demo offering key, including FAI, Lending and AMLOCK', async () => {
    await provisionDemoWorkspaces(identity, ['product_owner']);
    const offerings = callsMatching(q, 'INSERT INTO role_grants')
      .filter((g) => g.params[2] === 'product_owner')
      .map((g) => g.params[3]);
    expect(offerings).toEqual(PRODUCT_OWNER_OFFERINGS);
    expect(offerings).toEqual(expect.arrayContaining(['FAI', 'Lending', 'AMLOCK']));
  });

  it('keeps grants idempotent with a NOT EXISTS guard', async () => {
    await provisionDemoWorkspaces(identity, ['learning_moderator']);
    expect(callsMatching(q, 'INSERT INTO role_grants')[0].sql).toContain('WHERE NOT EXISTS');
  });
});

describe('starter data on creation', () => {
  it('entitles the workspace to every sandbox demo', async () => {
    await provisionDemoWorkspaces(identity, ['client_member']);
    const entitlements = callsMatching(q, 'INSERT INTO entitlements');
    expect(entitlements.map((e) => e.params[1])).toEqual(SANDBOX_DEMOS.map((demo) => demo.id));
    expect(entitlements.every((e) => e.params[0] === callsMatching(q, 'INSERT INTO organizations')[0].params[0])).toBe(true);
  });

  it('seeds the three client starter contributions in order of state', async () => {
    await provisionDemoWorkspaces(identity, ['client_member']);
    const states = callsMatching(q, 'INSERT INTO contributions').map((c) => c.params[4]);
    expect(states.slice(0, 3)).toEqual(['private_draft', 'submitted', 'needs_clarification']);
  });

  it('keeps the private draft out of sharing and never seeds a published copy', async () => {
    await provisionDemoWorkspaces(identity, ['client_member']);
    // The single idempotent synthetic shared example (3 params, literal 'published') is the only published row.
    const all = callsMatching(q, 'INSERT INTO contributions');
    expect(all.filter((c) => c.sql.includes("'published'"))).toHaveLength(1);
    const contributions = all.filter((c) => c.params.length > 3);
    const consents = callsMatching(q, 'INSERT INTO consents');

    expect(contributions.some((c) => c.params[4] === 'published')).toBe(false);
    expect(contributions.some((c) => c.sql.includes('published'))).toBe(false);

    const draft = contributions.find((c) => c.params[4] === 'private_draft');
    expect(draft?.params[3]).toBe('author');
    const draftPublish = consents.find((c) => c.params[1] === draft?.params[0] && c.params[2] === 'publish_reviewed');
    expect(draftPublish?.params[3]).toBe(false);

    for (const contribution of contributions.filter((c) => c.params[3] === 'author')) {
      const publishConsent = consents.find((c) => c.params[1] === contribution.params[0] && c.params[2] === 'publish_reviewed');
      expect(publishConsent?.params[3]).toBe(false);
    }
  });

  it('records a moderator clarification with a safe reason for the needs_clarification item', async () => {
    await provisionDemoWorkspaces(identity, ['client_member']);
    const [clientClarify] = callsMatching(q, 'INSERT INTO moderation_decisions');
    expect(clientClarify.params[2]).toEqual(expect.stringContaining('client-demo-moderator'));
    expect(clientClarify.sql).toContain("'clarify', 'needs_detail'");
  });

  it('seeds three moderation-queue contributions from distinct synthetic authors', async () => {
    await provisionDemoWorkspaces(identity, ['learning_moderator']);
    const queue = callsMatching(q, 'INSERT INTO contributions').filter((c) => c.params.length > 3).slice(3);
    expect(queue.map((c) => c.params[4])).toEqual(['submitted', 'submitted', 'needs_clarification']);
    const authors = queue.map((c) => c.params[1]);
    expect(new Set(authors).size).toBe(3);
    expect(authors.every((a) => String(a).includes('internal-author-'))).toBe(true);
    expect(authors).not.toContain('user-new');
  });

  it('routes the queue clarification to the signed-in learning moderator', async () => {
    await provisionDemoWorkspaces(identity, ['learning_moderator']);
    const decisions = callsMatching(q, 'INSERT INTO moderation_decisions');
    expect(decisions[1].params[2]).toBe('user-new');
  });

  it('uses only synthetic demo.invalid accounts for every seeded user', async () => {
    await provisionDemoWorkspaces(identity, ['employee']);
    const syntheticInserts = callsMatching(q, 'INSERT INTO users (id, email');
    expect(syntheticInserts.length).toBeGreaterThan(0);
    for (const insert of syntheticInserts) {
      expect(String(insert.params[1])).toMatch(/@demo\.invalid$/);
    }
  });

  it.each(['employee', 'content_publisher'])('seeds two shared broadcast sessions for %s', async (role) => {
    await provisionDemoWorkspaces(identity, [role as never]);
    const sessions = callsMatching(q, 'INSERT INTO broadcast_sessions');
    expect(sessions.map((s) => s.params[6])).toEqual(['employees', 'clients']);
    expect(sessions.every((s) => s.params[4] === 'user-new')).toBe(true);
  });
});

describe('notification and audit on creation', () => {
  it('writes one demo_workspace_ready notification to the user with a synthetic-only message', async () => {
    await provisionDemoWorkspaces(identity, ['employee']);
    const [notification] = callsMatching(q, 'INSERT INTO notifications');
    expect(notification.sql).toContain("'demo_workspace_ready'");
    expect(notification.params[0]).toBe('user-new');
    const payload = JSON.parse(String(notification.params[1]));
    expect(payload.role).toBe('employee');
    expect(payload.message).toContain('synthetic');
  });

  it('writes one join audit entry for the user against the new membership', async () => {
    const [workspace] = await provisionDemoWorkspaces(identity, ['employee']);
    const [audit] = callsMatching(q, 'INSERT INTO audit_log');
    expect(audit.sql).toContain("'onboarding.join_demo_workspace'");
    expect(audit.sql).toContain("'allow'");
    expect(audit.params[0]).toBe('user-new');
    expect(audit.params[1]).toBe(workspace.membership_id);
    expect(audit.params[2]).toBe(workspace.org_id);
    expect(JSON.parse(String(audit.params[4]))).toEqual({ role: 'employee', sandbox: true, shared: true });
  });
});

describe('idempotency', () => {
  it('returns created false and seeds nothing when the organisation and membership already exist', async () => {
    setup({ orgCreated: false, membershipCreated: false });
    const [workspace] = await provisionDemoWorkspaces(identity, ['employee']);
    expect(workspace.created).toBe(false);
    for (const fragment of [
      'INSERT INTO entitlements',
      'INSERT INTO improvement_ideas',
      'INSERT INTO broadcast_sessions',
      'INSERT INTO employee_experiments',
      'INSERT INTO public_content_items',
      'INSERT INTO notifications',
      'INSERT INTO audit_log',
    ]) {
      expect(callsMatching(q, fragment)).toHaveLength(0);
    }
  });

  // Known gap: service.ts writes notification and audit whenever the membership row is new, even when the org pre-existed.
  it.failing('does not write the creation notification or audit when the organisation already exists', async () => {
    setup({ orgCreated: false, membershipCreated: true });
    await provisionDemoWorkspaces(identity, ['employee']);
    expect(callsMatching(q, 'INSERT INTO notifications')).toHaveLength(0);
    expect(callsMatching(q, 'INSERT INTO audit_log')).toHaveLength(0);
  });
});
