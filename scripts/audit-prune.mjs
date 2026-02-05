#!/usr/bin/env node
/**
 * Удаление старых AuditEvent (retention policy).
 * Использование: node scripts/audit-prune.mjs [--days 180] [--dry-run]
 * По умолчанию: 180 дней.
 * В конце пишет ops.audit_prune в AuditEvent (для трассировки cron).
 */
import "dotenv/config";
import pg from "pg";
import { randomUUID } from "crypto";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL required");
  process.exit(1);
}

const args = process.argv.slice(2);
const dryRun = args.includes("--dry-run");
const daysIdx = args.indexOf("--days");
const days = daysIdx >= 0 && args[daysIdx + 1] ? parseInt(args[daysIdx + 1], 10) : 180;

if (Number.isNaN(days) || days < 1) {
  console.error("--days must be a positive number");
  process.exit(1);
}

const cutoff = new Date();
cutoff.setDate(cutoff.getDate() - days);

const client = new pg.Client({
  connectionString: url,
  ...(url.includes("pooler.supabase.com") && { ssl: { rejectUnauthorized: false } }),
});

async function logOpsAuditPrune(client, { status, deletedCount, cutoffDays, error }) {
  const id = `ops-prune-${randomUUID()}`;
  const metadata = { status, deletedCount: deletedCount ?? 0, cutoffDays, ...(error && { error }) };
  await client.query(
    `INSERT INTO "AuditEvent" ("id", "actorUserId", "action", "target", "metadata", "createdAt")
     VALUES ($1, NULL, $2, NULL, $3::jsonb, $4)`,
    [id, "ops.audit_prune", JSON.stringify(metadata), new Date()]
  );
}

async function main() {
  await client.connect();

  const countRes = await client.query(
    'SELECT COUNT(*) as c FROM "AuditEvent" WHERE "createdAt" < $1',
    [cutoff]
  );
  const count = parseInt(countRes.rows[0].c, 10);

  if (dryRun) {
    await logOpsAuditPrune(client, { status: "dry_run", deletedCount: count, cutoffDays: days });
    console.log(`[dry-run] Would delete ${count} events older than ${days} days (before ${cutoff.toISOString()})`);
    await client.end();
    return;
  }

  if (count === 0) {
    await logOpsAuditPrune(client, { status: "success", deletedCount: 0, cutoffDays: days });
    console.log("No events to prune");
    await client.end();
    return;
  }

  try {
    const res = await client.query('DELETE FROM "AuditEvent" WHERE "createdAt" < $1', [cutoff]);
    const deleted = res.rowCount ?? count;
    await logOpsAuditPrune(client, { status: "success", deletedCount: deleted, cutoffDays: days });
    console.log(`Pruned ${deleted} events (older than ${days} days)`);
  } catch (e) {
    await logOpsAuditPrune(client, {
      status: "fail",
      deletedCount: 0,
      cutoffDays: days,
      error: e?.message ?? String(e),
    }).catch(() => {});
    throw e;
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
