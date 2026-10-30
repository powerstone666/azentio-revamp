import { createHash } from 'node:crypto';

/** Collapses whitespace so SQL fragment assertions do not depend on formatting. */
export function normalizeSql(sql: unknown): string {
  return String(sql).replace(/\s+/g, ' ').trim();
}

export function sqlCalls(mock: jest.Mock): Array<{ sql: string; params: unknown[] }> {
  return mock.mock.calls.map((call) => ({
    sql: normalizeSql(call[0]),
    params: Array.isArray(call[1]) ? call[1] : [],
  }));
}

export function callsMatching(mock: jest.Mock, fragment: string) {
  return sqlCalls(mock).filter((call) => call.sql.includes(fragment));
}

/**
 * Answers a query mock by SQL fragment. The first matching fragment wins; a function value receives the
 * normalized SQL so it can compute a result. Unmatched statements resolve to `fallback`.
 */
export function respondTo(mock: jest.Mock, table: Array<[string, unknown]>, fallback: unknown = []) {
  mock.mockImplementation(async (sql: unknown) => {
    const normalized = normalizeSql(sql);
    const hit = table.find(([fragment]) => normalized.includes(fragment));
    if (!hit) return fallback;
    const value = hit[1];
    return typeof value === 'function' ? (value as (s: string) => unknown)(normalized) : value;
  });
}

/** Parses the JSON metadata bound to an audit_log insert (the last JSON-object string parameter). */
export function metadataOf(params: unknown[]): Record<string, unknown> {
  const json = [...params].reverse().find((p): p is string => typeof p === 'string' && p.startsWith('{'));
  return JSON.parse(json ?? '{}');
}

export function sha256(value: string) {
  return createHash('sha256').update(value).digest('hex');
}

export function sessionFixture(overrides: Record<string, unknown> = {}) {
  return {
    user: { id: 'user-1', email: 'person@example.com', display_name: 'Person' },
    memberships: [],
    grants: [],
    activeWorkspace: { orgId: 'org-1', orgName: 'Acme', orgType: 'client', role: 'client_admin', isSandbox: false },
    ...overrides,
  };
}

export function jsonRequest(url: string, body?: unknown, headers: Record<string, string> = {}) {
  return new Request(url, {
    method: body === undefined ? 'GET' : 'POST',
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : typeof body === 'string' ? body : JSON.stringify(body),
  });
}

export function routeContext<T extends Record<string, string>>(params: T) {
  return { params: Promise.resolve(params) };
}

export const UUID_A = '6f1c2b1e-1111-4a2b-9c3d-000000000001';
export const UUID_B = '6f1c2b1e-2222-4a2b-9c3d-000000000002';
