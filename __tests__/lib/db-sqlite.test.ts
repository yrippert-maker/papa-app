/**
 * US-8: Unit tests for SQLite safe mode.
 */
import { openDb, withRetry, SQLITE_BUSY } from '@/lib/db/sqlite';
import { parsePaginationParams, MAX_OFFSET } from '@/lib/pagination';

describe('openDb', () => {
  it('applies PRAGMA baseline on readwrite', () => {
    const db = openDb({ mode: 'readwrite' });
    const fk = db.pragma('foreign_keys', { simple: true }) as 0 | 1;
    expect(fk).toBe(1);
    const jm = db.pragma('journal_mode', { simple: true }) as string;
    expect(jm.toUpperCase()).toBe('WAL');
    db.close();
  });

  it('readonly opens when DB exists (after readwrite created it)', () => {
    const rw = openDb({ mode: 'readwrite' });
    rw.exec('SELECT 1'); // ensure schema/connection works
    rw.close();
    const ro = openDb({ mode: 'readonly' });
    const r = ro.prepare('SELECT 1 as x').get() as { x: number };
    expect(r.x).toBe(1);
    ro.close();
  });
});

describe('load_extension forbidden', () => {
  it('loadExtension throws or is unavailable (AC3)', () => {
    const db = openDb({ mode: 'readwrite' });
    const d = db as unknown as { loadExtension?: (name: string) => void };
    if (typeof d.loadExtension === 'function') {
      expect(() => d.loadExtension!('.load')).toThrow();
    }
    db.close();
  });
});

describe('withRetry', () => {
  it('returns result on success', async () => {
    const r = await withRetry(() => 42);
    expect(r).toBe(42);
  });

  it('retries on SQLITE_BUSY and eventually succeeds', async () => {
    let attempts = 0;
    const r = await withRetry(() => {
      attempts++;
      if (attempts < 2) {
        const e = new Error('database is locked') as Error & { errno?: number };
        e.errno = SQLITE_BUSY;
        throw e;
      }
      return 'ok';
    }, { maxAttempts: 3 });
    expect(r).toBe('ok');
    expect(attempts).toBe(2);
  });

  it('throws after max attempts on SQLITE_BUSY', async () => {
    await expect(
      withRetry(() => {
        const e = new Error('database is locked') as Error & { errno?: number };
        e.errno = SQLITE_BUSY;
        throw e;
      }, { maxAttempts: 2 })
    ).rejects.toThrow(/database is locked/);
  });

  it('throws immediately on non-BUSY error', async () => {
    await expect(
      withRetry(() => {
        throw new Error('other error');
      })
    ).rejects.toThrow('other error');
  });
});

describe('pagination MAX_OFFSET', () => {
  it('caps offset at MAX_OFFSET', () => {
    const params = parsePaginationParams(new URLSearchParams({ offset: '999999' }));
    expect(params.offset).toBe(MAX_OFFSET);
  });
});
