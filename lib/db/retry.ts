/**
 * Retry + SQLITE_BUSY без зависимости от better-sqlite3.
 * Используется lib/db.ts и route handlers; sqlite-adapter импортирует только SQLITE_BUSY.
 */

export const SQLITE_BUSY = 5;

function sleep(ms: number): Promise<void> {
  return new Promise((r) => setTimeout(r, ms));
}

/**
 * Retry с exponential backoff + jitter для SQLITE_BUSY.
 * fn может быть sync или async.
 */
export async function withRetry<T>(
  fn: () => T | Promise<T>,
  opts: { maxAttempts?: number } = {}
): Promise<T> {
  const maxAttempts = opts.maxAttempts ?? 3;
  let lastError: unknown;
  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn();
    } catch (e) {
      lastError = e;
      const code = (e as { errno?: number; code?: string })?.errno ?? (e as { code?: string })?.code;
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
