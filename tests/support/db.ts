/**
 * Helpers for tests that mock the database client.
 *
 * Usage in a test file (jest.mock is hoisted, so the factory must not reference outer variables):
 *
 *   jest.mock('@/app/api/(db)/client', () => ({
 *     query: jest.fn(), queryOne: jest.fn(), transaction: jest.fn(), default: {},
 *   }));
 *   import { query, queryOne, transaction } from '@/app/api/(db)/client';
 *   const db = mockDb({ query, queryOne, transaction });
 *   db.query.mockResolvedValueOnce([{ id: '1' }]);
 *
 * `transaction(fn)` runs `fn` with the same `query` mock as the transaction handle, so rows queued with
 * `mockResolvedValueOnce` are consumed in call order across both.
 */
type AnyFn = jest.Mock;

export function mockDb(fns: { query: unknown; queryOne: unknown; transaction: unknown }) {
  const query = fns.query as AnyFn;
  const queryOne = fns.queryOne as AnyFn;
  const transaction = fns.transaction as AnyFn;
  transaction.mockImplementation(async (fn: (tx: AnyFn) => unknown) => fn(query));
  return { query, queryOne, transaction };
}
