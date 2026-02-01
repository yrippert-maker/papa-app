/**
 * US-8: SQLite Safe Mode — единый DB-layer.
 * Единственное место создания соединений; safe PRAGMA baseline; read-only/readwrite.
 *
 * Правила:
 * - load_extension запрещён (проверка тестом)
 * - все запросы только параметризованные (через prepare/run/get/all)
 * - offset cap в parsePaginationParams (анти-DoS)
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { DB_PATH } from '@/lib/config';

export type DbMode = 'readonly' | 'readwrite';

/** SQLITE_BUSY code для retry. */
export const SQLITE_BUSY = 5;

/**
 * Safe PRAGMA baseline. Вызывается при открытии соединения.
 * readonly: не выставляем journal_mode (только readwrite может менять).
 */
function applySafePragmas(db: Database.Database, mode: DbMode): void {
  db.pragma('foreign_keys = ON');
  db.pragma('recursive_triggers = OFF');
  db.pragma('busy_timeout = 5000');
  try {
    db.exec('PRAGMA trusted_schema = OFF');
  } catch {
    // SQLite < 3.29 — trusted_schema отсутствует
  }
  if (mode === 'readwrite') {
    db.pragma('journal_mode = WAL');
  }
}

function ensureDbDir(): void {
  const dir = dirname(DB_PATH);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

/**
 * Открывает соединение с SQLite. Единственная точка входа для создания connection.
 */
export function openDb(options: { mode: DbMode }): Database.Database {
  const { mode } = options;
  if (mode === 'readonly') {
    if (!existsSync(DB_PATH)) {
      throw new Error('Database file does not exist; cannot open read-only');
    }
    const db = new Database(DB_PATH, { readonly: true, fileMustExist: true });
    applySafePragmas(db, 'readonly');
    return db;
  }
  ensureDbDir();
  const db = new Database(DB_PATH);
  applySafePragmas(db, 'readwrite');
  return db;
}

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retry с exponential backoff + jitter для SQLITE_BUSY.
 */
export async function withRetry<T>(
  fn: () => T,
  opts: { maxAttempts?: number } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return fn();
    } catch (e) {
      lastError = e;
      const code = (e as { errno?: number; code?: number | string })?.errno ?? (e as { code?: number | string })?.code;
      if (code === SQLITE_BUSY || code === 'SQLITE_BUSY') {
        if (attempt < maxAttempts) {
          const base = Math.min(50 * Math.pow(2, attempt - 1), 500);
          const jitter = Math.floor(Math.random() * 50);
          const ms = base + jitter;
          console.warn(`[db] SQLITE_BUSY attempt ${attempt}/${maxAttempts}, retry in ${ms}ms`);
          await sleep(ms);
        } else {
          console.warn('[db] SQLITE_BUSY max attempts exceeded');
        }
      } else {
        throw e;
      }
    }
  }
  throw lastError;
}
