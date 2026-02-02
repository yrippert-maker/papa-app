#!/usr/bin/env node
/**
 * Expire timed-out key lifecycle requests.
 * 
 * Usage:
 *   node scripts/expire-requests.mjs
 * 
 * Run via cron:
 *   0 * * * * cd /app && node scripts/expire-requests.mjs >> /var/log/papa-expire.log 2>&1
 */
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const dbPath = process.env.DB_PATH || join(process.env.WORKSPACE_ROOT || join(root, 'data'), '00_SYSTEM/db/papa.sqlite');

if (!existsSync(dbPath)) {
  console.log('[expire-requests] Database not found, skipping');
  process.exit(0);
}

const db = new Database(dbPath);

const now = new Date().toISOString();

const result = db.prepare(`
  UPDATE key_lifecycle_requests 
  SET status = 'EXPIRED'
  WHERE status IN ('PENDING', 'APPROVED') AND expires_at < ?
`).run(now);

const expired = result.changes;

if (expired > 0) {
  console.log(`[expire-requests] Expired ${expired} request(s) at ${now}`);
} else {
  console.log(`[expire-requests] No expired requests at ${now}`);
}

// Output JSON for monitoring
const stats = {
  timestamp: now,
  expired_count: expired,
};

console.log('[json]', JSON.stringify(stats));

db.close();
