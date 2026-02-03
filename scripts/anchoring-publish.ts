#!/usr/bin/env npx tsx
/**
 * anchoring:publish — публикует anchor в Polygon.
 * Требует: viem, ANCHOR_* env.
 */
import { publishAnchor } from '../lib/anchor-publisher';
import Database from 'better-sqlite3';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || join(ROOT, 'data');
const DB_PATH = join(WORKSPACE_ROOT, '00_SYSTEM', 'db', 'papa.sqlite');

async function main() {
  const args = process.argv.slice(2);
  const anchorIdx = args.indexOf('--anchor');
  const latest = args.includes('--latest');

  let anchorId: string;
  if (anchorIdx >= 0 && args[anchorIdx + 1]) {
    anchorId = args[anchorIdx + 1];
  } else if (latest) {
    const db = new Database(DB_PATH);
    const row = db
      .prepare(
        `SELECT id FROM ledger_anchors WHERE status = 'pending' AND tx_hash IS NULL ORDER BY created_at DESC LIMIT 1`
      )
      .get() as { id: string } | undefined;
    db.close();
    if (!row) {
      console.log('[anchoring:publish] No pending anchor found');
      process.exit(0);
    }
    anchorId = row.id;
  } else {
    console.error('Usage: npx tsx scripts/anchoring-publish.ts --anchor <id> | --latest');
    process.exit(1);
  }

  const result = await publishAnchor(anchorId);
  if (result.ok) {
    console.log('[anchoring:publish] OK', result.tx_hash || '(already confirmed)');
  } else {
    console.error('[anchoring:publish] Failed:', result.error);
    process.exit(1);
  }
}

main();
