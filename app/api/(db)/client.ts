import 'server-only';
import { Pool } from 'pg';

/**
 * Server-only pg Pool connected to Supabase Postgres.
 * Never import this file in client components.
 *
 * Database URL sourced from environment:
 * - Local dev: SUPABASE_DB_URL or DATABASE_URL from `supabase start`
 * - Hosted: Supabase project connection string
 */

const pool = new Pool({
  connectionString: process.env.DATABASE_URL ?? process.env.SUPABASE_DB_URL,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 5_000,
});

pool.on('error', (err) => {
  console.error('Unexpected pg pool error:', err.message);
});

/**
 * Execute a single query with parameterised arguments.
 * Use this for read queries and simple writes.
 */
export async function query<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

/**
 * Execute a query and return the first row, or null.
 */
export async function queryOne<T = Record<string, unknown>>(
  text: string,
  params?: unknown[],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/**
 * Run multiple queries inside a transaction.
 * The callback receives a transaction-aware query function.
 * If the callback throws, the transaction is rolled back.
 */
export async function transaction<T>(
  fn: (tx: typeof query) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const txQuery = async <R = Record<string, unknown>>(
      text: string,
      params?: unknown[],
    ): Promise<R[]> => {
      const result = await client.query(text, params);
      return result.rows as R[];
    };
    const result = await fn(txQuery);
    await client.query('COMMIT');
    return result;
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

export default pool;