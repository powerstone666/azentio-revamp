/**
 * Shared fixtures for the contribution and moderation lifecycle tests.
 * Not a test file (no `.test.` in the name), so Jest does not collect it.
 */
import type { ContributionCreateInput } from '@/app/(common-lib)/types/schemas';

// Valid RFC 9562 v4 UUIDs (zod's z.uuid() is strict about version and variant nibbles).
export const IDS = {
  author: '5a6b7c8d-1234-4abc-8def-0123456789ab',
  otherAuthor: '6b7c8d9e-2345-4bcd-9ef0-123456789abc',
  moderator: '7c8d9e0f-3456-4cde-8f01-23456789abcd',
  org: '8d9e0f10-4567-4def-8012-3456789abcde',
  otherOrg: '9e0f1021-5678-4ef0-8123-456789abcdef',
  contribution: '3f2c1a10-7b1e-4c2a-9d3e-1a2b3c4d5e6f',
  version: 'a1b2c3d4-0001-4a5b-8c6d-7e8f9a0b1c2d',
  nextVersion: 'a1b2c3d4-0002-4a5b-8c6d-7e8f9a0b1c2e',
  sharedCopy: 'b2c3d4e5-0002-4b6c-9d7e-8f9a0b1c2d3e',
  report: 'c3d4e5f6-0003-4c7d-8e8f-9a0b1c2d3e4f',
  membership: 'd4e5f6a7-0004-4d8e-9f9a-0b1c2d3e4f5a',
  request: 'req-test-1',
} as const;

export const ALL_STATES = [
  'private_draft', 'submitted', 'needs_clarification', 'approved',
  'published', 'suspended', 'rejected', 'withdrawn',
] as const;

export function contributionInput(overrides: Partial<ContributionCreateInput> = {}): ContributionCreateInput {
  return {
    title: '  Pricing pressure in retail lending  ',
    observation_type: 'market_observation',
    offering: ' Lending Suite ',
    industry: 'Banking',
    region: 'APAC',
    observation_period_start: '2026-01-01',
    observation_period_end: '2026-03-31',
    evidence_type: 'quantitative',
    confidence: 'high',
    body: '  Customers are asking for faster approvals across branches.  ',
    visibility: 'author',
    consent_store_process: true,
    consent_publish_reviewed: false,
    consent_attribute: false,
    consent_model_training: false,
    consent_semantic_analysis: false,
    ...overrides,
  };
}

/** Collapses whitespace so SQL fragment assertions do not depend on formatting. */
export function normalizeSql(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').trim();
}

type Mockish = { mock: { calls: unknown[][] } };

/** Every statement sent through a query mock, normalized, with its parameters. */
export function executed(fn: Mockish): Array<{ sql: string; params: unknown[] }> {
  return fn.mock.calls.map((call) => ({
    sql: normalizeSql(call[0]),
    params: (call[1] as unknown[] | undefined) ?? [],
  }));
}

/** Statements whose normalized SQL matches the pattern. */
export function find(fn: Mockish, pattern: RegExp) {
  return executed(fn).filter((statement) => pattern.test(statement.sql));
}

/**
 * Answers queries by the first matching SQL pattern. Unmatched statements (INSERT/UPDATE/DELETE)
 * return an empty array, which is what the services ignore.
 */
export function routeQueries(
  fn: Mockish & { mockImplementation: (impl: (sql: string, params?: unknown[]) => Promise<unknown[]>) => unknown },
  routes: Array<[RegExp, unknown[] | ((params: unknown[]) => unknown[])]>,
) {
  fn.mockImplementation(async (sql: string, params?: unknown[]) => {
    const normalized = normalizeSql(sql);
    for (const [pattern, rows] of routes) {
      if (pattern.test(normalized)) return typeof rows === 'function' ? rows(params ?? []) : rows;
    }
    return [];
  });
}

/** An AppSession for route tests. Defaults to a client member in a client workspace. */
export function makeSession(overrides: Partial<{
  userId: string;
  orgId: string | null;
  orgType: 'azentio' | 'client';
  isSandbox: boolean;
  grants: Array<Record<string, unknown>>;
}> = {}) {
  const userId = overrides.userId ?? IDS.author;
  const hasWorkspace = overrides.orgId !== null;
  return {
    user: { id: userId, email: 'member@example.com', display_name: 'Member', verified_at: new Date(), disabled_at: null, created_at: new Date() },
    memberships: [],
    grants: overrides.grants ?? [],
    activeWorkspace: hasWorkspace ? {
      orgId: overrides.orgId ?? IDS.org,
      orgName: 'Acme Client',
      orgType: overrides.orgType ?? 'client',
      role: 'client_member',
      isSandbox: overrides.isSandbox ?? false,
    } : null,
  };
}

/** Route context for `{ params: Promise<{ id }> }` handlers. */
export function ctx(id: string) {
  return { params: Promise.resolve({ id }) };
}

/** A JSON request, or a raw-text request when `raw` is given (for invalid JSON cases). */
export function jsonRequest(body: unknown, opts: { headers?: Record<string, string>; raw?: string } = {}) {
  return new Request('http://localhost/api/v1/test', {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(opts.headers ?? {}) },
    body: opts.raw ?? JSON.stringify(body),
  });
}

/** A request with no body (GET/DELETE). */
export function bareRequest(headers: Record<string, string> = {}) {
  return new Request('http://localhost/api/v1/test', { headers });
}
