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

/** Re-export для обратной совместимости (реализация в lib/db/retry.ts). */
export { SQLITE_BUSY } from '@/lib/db/retry';

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

function wrapStatement(stmt: Database.Statement): DbPreparedStatement {
  return {
    async run(...params: unknown[]): Promise<DbRunResult> {
      const r = stmt.run(...params) as { changes: number; lastInsertRowid: number };
      return { changes: r.changes, lastInsertRowid: r.lastInsertRowid };
    },
    async get<T = unknown>(...params: unknown[]): Promise<T | undefined> {
      return stmt.get(...params) as T | undefined;
    },
    async all<T = unknown>(...params: unknown[]): Promise<T[]> {
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
    async prepare(sql: string): Promise<DbPreparedStatement> {
      return wrapStatement(db.prepare(sql));
    },
    async exec(sql: string): Promise<void> {
      db.exec(sql);
    },
    async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
      const tr = db.transaction(fn as () => T);
      return Promise.resolve(tr());
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
    async prepare(sql: string): Promise<DbPreparedStatement> {
      return wrapStatement(db.prepare(sql));
    },
    async exec(sql: string): Promise<void> {
      db.exec(sql);
    },
    async transaction<T>(fn: () => T | Promise<T>): Promise<T> {
      const tr = db.transaction(fn as () => T);
      return Promise.resolve(tr());
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
