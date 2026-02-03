#!/usr/bin/env node
/**
 * Migration 002: Add actor_id to ledger_events for hash-chain attribution.
 * Creates table if not exists; adds actor_id column if missing.
 */
import Database from 'better-sqlite3';
import { dirname, join } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const dbPath = process.env.DB_PATH || join(process.env.WORKSPACE_ROOT || join(root, 'data'), '00_SYSTEM/db/papa.sqlite');

const db = new Database(dbPath);

// 1. Create ledger_events if not exists (with actor_id)
db.exec(`
  CREATE TABLE IF NOT EXISTS ledger_events (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    event_type TEXT NOT NULL,
    payload_json TEXT NOT NULL,
    prev_hash TEXT,
    block_hash TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    actor_id TEXT
  );
  CREATE INDEX IF NOT EXISTS idx_ledger_created ON ledger_events(created_at);
  CREATE INDEX IF NOT EXISTS idx_ledger_event_type ON ledger_events(event_type);
`);

// 2. Add actor_id if table existed without it
const cols = db.prepare('PRAGMA table_info(ledger_events)').all();
const hasActorId = cols.some((c) => c.name === 'actor_id');
if (!hasActorId) {
  db.exec('ALTER TABLE ledger_events ADD COLUMN actor_id TEXT');
}

db.close();
