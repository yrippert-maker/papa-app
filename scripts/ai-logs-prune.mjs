#!/usr/bin/env node
/**
 * NFR-2.3, FR-2.6: Автоочистка AI-логов старше retention_years.
 * Удаляет agent_sessions (→ CASCADE agent_messages), обнуляет session_id в agent_generated_documents.
 * Retention берётся из config/retention-policy.json (ai_logs.retention_years, по умолчанию 3).
 *
 * Использование:
 *   node scripts/ai-logs-prune.mjs [--dry-run] [--years 3]
 *   npm run ai:logs:prune         # execute
 *   npm run ai:logs:prune:dry     # dry-run
 */
import 'dotenv/config';
import pg from 'pg';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const url = process.env.DATABASE_URL;
if (!url) {
  console.error('DATABASE_URL required for AI logs prune');
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const yearsIdx = args.indexOf('--years');
let retentionYears = 3;
if (yearsIdx >= 0 && args[yearsIdx + 1]) {
  retentionYears = parseInt(args[yearsIdx + 1], 10);
} else {
  const policyPath = join(process.cwd(), 'config', 'retention-policy.json');
  if (existsSync(policyPath)) {
    const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
    retentionYears = policy.ai_logs?.retention_years ?? 3;
  }
}

if (Number.isNaN(retentionYears) || retentionYears < 1) {
  console.error('--years must be a positive number');
  process.exit(1);
}

const cutoff = new Date();
cutoff.setFullYear(cutoff.getFullYear() - retentionYears);

const client = new pg.Client({
  connectionString: url,
  ...(url.includes('pooler.supabase.com') && { ssl: { rejectUnauthorized: false } }),
});

async function main() {
  await client.connect();

  // Check if agent_sessions exists (Postgres agent schema)
  const tableCheck = await client.query(`
    SELECT EXISTS (
      SELECT 1 FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = 'agent_sessions'
    )
  `);
  if (!tableCheck.rows[0]?.exists) {
    console.log('agent_sessions table not found — skip (SQLite or schema not migrated)');
    await client.end();
    return;
  }

  const countRes = await client.query(
    'SELECT COUNT(*) as c FROM agent_sessions WHERE created_at < $1',
    [cutoff]
  );
  const count = parseInt(countRes.rows[0].c, 10);

  if (dryRun) {
    console.log(`[dry-run] Would prune ${count} AI sessions older than ${retentionYears} years (before ${cutoff.toISOString()})`);
    await client.end();
    return;
  }

  if (count === 0) {
    console.log('No AI sessions to prune');
    await client.end();
    return;
  }

  try {
    // DELETE agent_sessions — CASCADE deletes agent_messages; agent_generated_documents gets session_id SET NULL
    const res = await client.query('DELETE FROM agent_sessions WHERE created_at < $1', [cutoff]);
    const deleted = res.rowCount ?? count;
    console.log(`Pruned ${deleted} AI sessions (older than ${retentionYears} years). NFR-2.3.`);
  } catch (e) {
    console.error('AI logs prune failed:', e?.message ?? e);
    process.exit(1);
  } finally {
    await client.end();
  }
}

main();
