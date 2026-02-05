/**
 * US-8: SQLite Safe Mode — re-exports для backward compatibility.
 * withRetry/SQLITE_BUSY из retry (без better-sqlite3); openDb из sqlite-adapter.
 */

export { withRetry, SQLITE_BUSY } from '@/lib/db/retry';
export { openDb } from '@/lib/adapters/sqlite-adapter';
