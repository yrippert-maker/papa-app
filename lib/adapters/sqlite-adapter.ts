/**
 * US-P2-1: SqliteAdapter — обёртка над better-sqlite3, реализует DbAdapter.
 * Единственное место импорта better-sqlite3 в lib/ (кроме scripts, migrations).
 * См. ADR-003, ADR-004.
 */

import Database from 'better-sqlite3';
import { mkdirSync, existsSync } from 'fs';
import { dirname } from 'path';
import { DB_PATH } from '@/lib/config';
import type { DbAdapter, DbPreparedStatement, DbRunResult, DbCapabilities } from './types';

export type DbMode = 'readonly' | 'readwrite';

/** SQLITE_BUSY code для retry. */
export const SQLITE_BUSY = 5;

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

/** Открывает raw SQLite connection. Экспортируется для unit-тестов (PRAGMA, load_extension). */
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

function wrapStatement(stmt: Database.Statement): DbPreparedStatement {
  return {
    run(...params: unknown[]): DbRunResult {
      const r = stmt.run(...params) as { changes: number; lastInsertRowid: number };
      return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
    },
    get<T = unknown>(...params: unknown[]): T | undefined {
      return stmt.get(...params) as T | undefined;
    },
    all<T = unknown>(...params: unknown[]): T[] {
      return stmt.all(...params) as T[];
    },
  };
}

const CAPABILITIES: DbCapabilities = {
  returning: true,
  onConflict: true,
  lastInsertId: 'last_insert_rowid',
};

/**
 * Создаёт SqliteAdapter с in-memory БД (для unit-тестов).
 * Возвращает adapter и close() для освобождения ресурсов.
 */
export function createSqliteAdapterInMemory(): { adapter: DbAdapter; close: () => void } {
  const db = new Database(':memory:');
  applySafePragmas(db, 'readwrite');
  return {
    adapter: createSqliteAdapterFromDb(db),
    close: () => db.close(),
  };
}

/**
 * Создаёт SqliteAdapter из существующего Database (для тестов с :memory:).
 */
export function createSqliteAdapterFromDb(db: Database.Database): DbAdapter {
  const adapter: DbAdapter = {
    dialect: 'sqlite',
    capabilities: CAPABILITIES,
    prepare(sql: string): DbPreparedStatement {
      return wrapStatement(db.prepare(sql));
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    transaction<T>(fn: () => T): T {
      const tr = db.transaction(fn);
      return tr();
    },
    async healthCheck(): Promise<boolean> {
      try {
        db.prepare('SELECT 1').get();
        return true;
      } catch {
        return false;
      }
    },
  };
  return adapter;
}

/**
 * Создаёт SqliteAdapter для указанного режима.
 */
export function createSqliteAdapter(options: { mode: DbMode }): DbAdapter {
  const db = openDb(options);

  const adapter: DbAdapter = {
    dialect: 'sqlite',
    capabilities: CAPABILITIES,
    prepare(sql: string): DbPreparedStatement {
      return wrapStatement(db.prepare(sql));
    },
    exec(sql: string): void {
      db.exec(sql);
    },
    transaction<T>(fn: () => T): T {
      const tr = db.transaction(fn);
      return tr();
    },
    async healthCheck(): Promise<boolean> {
      try {
        db.prepare('SELECT 1').get();
        return true;
      } catch {
        return false;
      }
    },
  };

  return adapter;
}
