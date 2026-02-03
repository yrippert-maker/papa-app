/**
 * US-8: SQLite Safe Mode — re-exports для backward compatibility.
 * US-P2-1: Реализация перенесена в lib/adapters/sqlite-adapter.ts.
 * openDb — для unit-тестов (PRAGMA, load_extension); withRetry/SQLITE_BUSY — публичный API.
 */

export { withRetry, SQLITE_BUSY, openDb } from '@/lib/adapters/sqlite-adapter';
