#!/usr/bin/env node
/**
 * monitor:run — запускает сбор/дифф compliance monitor.
 * Пока создаёт тестовый change-event. Реальный парсинг источников — следующий шаг.
 */
import Database from 'better-sqlite3';
import { join } from 'path';
import { fileURLToPath } from 'url';
import { randomUUID } from 'crypto';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const dbPath = process.env.DB_PATH || join(process.env.WORKSPACE_ROOT || join(root, 'data'), '00_SYSTEM/db/papa.sqlite');

const db = new Database(dbPath);

// Ensure tables exist (migration may not have run)
db.exec(`
  CREATE TABLE IF NOT EXISTS compliance_change_event (
    id TEXT PRIMARY KEY,
    source TEXT NOT NULL,
    title TEXT NOT NULL,
    published_at TEXT,
    url TEXT,
    artifact_sha256 TEXT,
    summary TEXT,
    severity TEXT NOT NULL DEFAULT 'info',
    tags TEXT,
    fulltext_path TEXT,
    diff_summary TEXT,
    status TEXT NOT NULL DEFAULT 'NEW',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
  );
`);

const id = `ce-${randomUUID().slice(0, 8)}`;
db.prepare(
  `INSERT INTO compliance_change_event (id, source, title, summary, severity, tags, status)
   VALUES (?, ?, ?, ?, ?, ?, ?)`
).run(id, 'MONITOR_RUN', 'Test change (monitor:run)', 'Stub event for pipeline verification', 'info', '["quality","test"]', 'NEW');

const count = db.prepare("SELECT COUNT(*) as c FROM compliance_change_event WHERE status = 'NEW'").get();
console.log('Monitor run complete. Created:', id);
console.log('New items in inbox:', (count && count.c) || 0);
db.close();
