/**
 * Routes mocked `query` calls by a substring of the SQL text, so tests do not depend on call order.
 * Unmatched SQL rejects, which makes an unexpected query fail the test loudly.
 */
export type SqlRoute = [match: string, respond: (params: unknown[]) => unknown];

export function routeSql(routes: SqlRoute[]) {
  const unmatched: string[] = [];
  const impl = (sql: string, params: unknown[] = []) => {
    const hit = routes.find(([match]) => sql.includes(match));
    if (!hit) {
      unmatched.push(sql);
      return Promise.reject(new Error(`Unexpected SQL in test: ${sql.slice(0, 120)}`));
    }
    try {
      return Promise.resolve(hit[1](params));
    } catch (error) {
      return Promise.reject(error);
    }
  };
  return { impl, unmatched };
}
