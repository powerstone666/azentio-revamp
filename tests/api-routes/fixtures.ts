/**
 * Shared fixtures for the API route tests in this folder.
 * Not a test file (no *.test.ts suffix). jest.mock calls stay in each test file because they are hoisted.
 */
import type { AppSession } from '@/app/(common-lib)/types';

export const IDS = {
  user: '11111111-1111-4111-8111-111111111111',
  otherUser: '12121212-1212-4121-8121-121212121212',
  orgA: '22222222-2222-4222-8222-222222222222',
  orgB: '33333333-3333-4333-8333-333333333333',
  orgC: '77777777-7777-4777-8777-777777777777',
  membershipA: '44444444-4444-4444-8444-444444444444',
  membershipB: '55555555-5555-4555-8555-555555555555',
  record: '66666666-6666-4666-8666-666666666666',
  grant: '88888888-8888-4888-8888-888888888888',
} as const;

export interface SessionOptions {
  orgType?: 'azentio' | 'client';
  isSandbox?: boolean;
  role?: string;
  orgId?: string;
  /** Pass true for a signed-in user with no active workspace selected. */
  noWorkspace?: boolean;
  grants?: Array<Record<string, unknown>>;
  userId?: string;
}

/** Builds an AppSession shaped like the one session.ts returns. */
export function makeSession(options: SessionOptions = {}): AppSession {
  const orgType = options.orgType ?? 'client';
  const isSandbox = options.isSandbox ?? false;
  const orgId = options.orgId ?? IDS.orgA;
  const role = options.role ?? (orgType === 'azentio' ? 'employee' : 'client_member');
  const userId = options.userId ?? IDS.user;
  const session = {
    user: {
      id: userId,
      email: 'user@example.com',
      display_name: 'Test User',
      verified_at: '2026-01-01T00:00:00.000Z',
      disabled_at: null,
      created_at: '2026-01-01T00:00:00.000Z',
    },
    memberships: [
      {
        id: IDS.membershipA,
        org_id: orgId,
        user_id: userId,
        role,
        status: 'active',
        joined_at: '2026-01-01T00:00:00.000Z',
        org_name: 'Acme Bank',
        org_type: orgType,
        is_sandbox: isSandbox,
      },
    ],
    grants: options.grants ?? [],
    activeWorkspace: options.noWorkspace ? null : {
      orgId,
      orgName: 'Acme Bank',
      orgType,
      role,
      isSandbox,
    },
  };
  return session as unknown as AppSession;
}

/** Real Request with an absolute URL, as the App Router passes to handlers. */
export function makeRequest(
  path: string,
  init: { method?: string; body?: unknown; rawBody?: string; headers?: Record<string, string> } = {},
): Request {
  const headers = new Headers(init.headers);
  let body: string | undefined;
  if (init.rawBody !== undefined) {
    body = init.rawBody;
  } else if (init.body !== undefined) {
    body = JSON.stringify(init.body);
    if (!headers.has('content-type')) headers.set('content-type', 'application/json');
  }
  const method = init.method ?? (body === undefined ? 'GET' : 'POST');
  return new Request(`http://localhost${path}`, { method, headers, body });
}

/** Next.js passes dynamic segments as a Promise. */
export function routeParams<T extends Record<string, string>>(values: T) {
  return { params: Promise.resolve(values) };
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export async function readJson(response: Response): Promise<any> {
  return response.json();
}

/** Asserts that a serialized error body does not expose stack frames, SQL or driver messages. */
export function expectNoInternals(serialized: string) {
  expect(serialized).not.toMatch(/\bstack\b|\.ts:\d+|\bat\s+\S+\s+\(|\bSELECT\s|\bINSERT\s|ECONNREFUSED|violates|relation "|pg_/i);
}
