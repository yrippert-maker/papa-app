/**
 * US-7: Унифицированный контракт пагинации.
 * limit cap 100, cursor-based или offset.
 */

const MAX_LIMIT = 100;
const MAX_OFFSET = 10000; // US-8: анти-DoS для offset-пагинации
const DEFAULT_LIMIT = 50;

export type PaginationParams = {
  limit: number;
  cursor: string | null;
  offset: number;
};

export type PaginationResult<T> = {
  items: T[];
  nextCursor: string | null;
  hasMore: boolean;
};

/**
 * Парсит limit и cursor из URL searchParams.
 * limit capped at MAX_LIMIT; invalid cursor/limit → throws или возвращает ошибку.
 */
function getParam(sp: URLSearchParams | Record<string, string | undefined>, key: string): string | undefined {
  if (sp instanceof URLSearchParams) return sp.get(key) ?? undefined;
  return (sp as Record<string, string | undefined>)[key];
}

export function parsePaginationParams(searchParams: URLSearchParams | Record<string, string | undefined>): PaginationParams {
  const limitRaw = getParam(searchParams, 'limit');
  const cursorRaw = getParam(searchParams, 'cursor');
  const offsetRaw = getParam(searchParams, 'offset');

  let limit = DEFAULT_LIMIT;
  if (limitRaw != null && limitRaw !== '') {
    const parsed = parseInt(String(limitRaw), 10);
    if (Number.isNaN(parsed) || parsed < 1) {
      throw new Error('Invalid limit');
    }
    limit = Math.min(parsed, MAX_LIMIT);
  }

  let cursor: string | null = null;
  if (cursorRaw != null && cursorRaw !== '') {
    const decoded = decodeCursor(cursorRaw);
    if (!decoded) throw new Error('Invalid cursor');
    cursor = decoded;
  }

  let offset = 0;
  if (offsetRaw != null && offsetRaw !== '') {
    const parsed = parseInt(String(offsetRaw), 10);
    if (Number.isNaN(parsed) || parsed < 0) throw new Error('Invalid offset');
    offset = Math.min(parsed, MAX_OFFSET);
  }

  return { limit, cursor, offset };
}

/**
 * Cursor: base64-encoded opaque string (e.g. lastId or "created_at,id").
 * Валидация: не пустой, base64.
 */
function decodeCursor(raw: string): string | null {
  if (!raw || raw.length > 256) return null;
  try {
    const decoded = Buffer.from(raw, 'base64').toString('utf-8');
    return decoded || null;
  } catch {
    return null;
  }
}

export function encodeCursor(value: string): string {
  return Buffer.from(value, 'utf-8').toString('base64');
}

export { MAX_LIMIT, MAX_OFFSET, DEFAULT_LIMIT };
