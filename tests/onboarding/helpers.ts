/**
 * Shared fake for the onboarding service's SQL. Responses are chosen by SQL fragment, so the tests
 * do not depend on the exact order of statements inside the provisioning transaction.
 */
export const norm = (sql: string) => sql.replace(/\s+/g, ' ').trim();

export interface Call {
  sql: string;
  params: unknown[];
}

export interface FakeDbOptions {
  /** Existing application user found by email (null = none). */
  existingUser?: { id: string; display_name: string; disabled_at: string | null } | null;
  /** Organisation insert returns a row (true) or hits ON CONFLICT (false). Default true. */
  orgCreated?: boolean;
  /** The shared sandbox organisation is found as active (FOR SHARE lookup). Default true. */
  orgAvailable?: boolean;
  /** Membership insert returns a row (true) or hits ON CONFLICT (false). Default true. */
  membershipCreated?: boolean;
  /** Status of the membership row read back. Default 'active'. */
  membershipStatus?: string;
}

export function recordedCalls(query: jest.Mock): Call[] {
  return query.mock.calls.map(([sql, params]) => ({
    sql: norm(String(sql)),
    params: (params ?? []) as unknown[],
  }));
}

/** Calls whose normalised SQL contains the fragment, in call order. */
export function callsMatching(query: jest.Mock, fragment: string): Call[] {
  return recordedCalls(query).filter((call) => call.sql.includes(fragment));
}

export function installFakeDb(query: jest.Mock, options: FakeDbOptions = {}) {
  let membershipRole = 'client_member';
  query.mockImplementation(async (rawSql: string, params: unknown[] = []) => {
    const sql = norm(rawSql);
    if (sql.includes('FROM users WHERE lower(email)')) {
      return options.existingUser ? [options.existingUser] : [];
    }
    if (sql.startsWith('INSERT INTO users (email')) {
      return [{ id: 'user-new', display_name: params[1] }];
    }
    if (sql.startsWith('INSERT INTO organizations')) {
      return options.orgCreated === false ? [] : [{ id: params[0] }];
    }
    if (sql.includes('FROM organizations WHERE id')) {
      return options.orgAvailable === false ? [] : [{ id: params[0] }];
    }
    if (sql.startsWith('INSERT INTO memberships') && sql.endsWith('RETURNING id')) {
      membershipRole = params[2] as string;
      return options.membershipCreated === false ? [] : [{ id: 'membership-1' }];
    }
    if (sql.includes('FROM memberships WHERE org_id') && sql.endsWith('FOR SHARE')) {
      return [{ id: 'membership-1', role: membershipRole, status: options.membershipStatus ?? 'active' }];
    }
    if (sql === 'SELECT id FROM users WHERE email = $1') {
      return [{ id: `synthetic:${params[0]}` }];
    }
    return [];
  });
}
