/**
 * Контракты DB и Storage адаптеров (P2-Core).
 * См. ADR-003 и BACKLOG_P2_CORE.md.
 */

/** Результат INSERT/UPDATE/DELETE */
export interface DbRunResult {
  lastInsertRowid: number;
  changes: number;
}

/** Подготовленное выражение — совместимость с better-sqlite3 prepare(); всегда await для PG. */
export interface DbPreparedStatement {
  run(...params: unknown[]): Promise<DbRunResult>;
  get<T = unknown>(...params: unknown[]): Promise<T | undefined>;
  all<T = unknown>(...params: unknown[]): Promise<T[]>;
}

/** Диалект БД. См. ADR-004. */
export type DbDialect = 'sqlite' | 'postgres';

/** Возможности диалекта. Использовать только внутри adapter или миграционных скриптов. */
export interface DbCapabilities {
  returning: boolean;
  onConflict: boolean;
  lastInsertId: 'lastval' | 'last_insert_rowid';
}

/** Адаптер доступа к БД. Единый интерфейс для SQLite и Postgres. Все методы — async. */
export interface DbAdapter {
  /** Диалект — для условной логики в миграциях. См. ADR-004. */
  readonly dialect: DbDialect;
  /** Возможности диалекта (опционально). */
  readonly capabilities?: DbCapabilities;
  prepare(sql: string): Promise<DbPreparedStatement>;
  exec(sql: string): Promise<void>;
  /** Транзакция: fn выполняется в BEGIN/COMMIT; при ошибке — ROLLBACK. */
  transaction<T>(fn: () => T | Promise<T>): Promise<T>;
  /** Для readiness check. Возвращает true если БД доступна. */
  healthCheck(): Promise<boolean>;
}

/** Элемент списка хранилища (файл или префикс). */
export interface StorageEntry {
  key: string;
  size?: number;
  isDir?: boolean;
}

/** Адаптер хранилища файлов. Единый интерфейс для FS и S3. */
export interface StorageAdapter {
  put(key: string, buffer: Buffer): Promise<void>;
  get(key: string): Promise<Buffer | null>;
  list(prefix?: string): Promise<StorageEntry[]>;
  delete(key: string): Promise<void>;
  /** Для readiness check. Возвращает true если хранилище доступно. */
  healthCheck(): Promise<boolean>;
}
