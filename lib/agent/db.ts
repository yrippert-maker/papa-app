/**
 * AI Agent: Postgres client для pgvector.
 * Требует DATABASE_URL. Регистрирует pgvector types.
 */
import pg from 'pg';
import pgvector from 'pgvector/pg';

let pool: pg.Pool | null = null;

export async function getAgentDb(): Promise<pg.Pool> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL is required for AI Agent (Postgres + pgvector)');
  }
  if (!pool) {
    pool = new pg.Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
    const client = await pool.connect();
    try {
      await pgvector.registerTypes(client);
    } finally {
      client.release();
    }
  }
  return pool;
}
