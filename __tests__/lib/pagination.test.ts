/**
 * US-7.5: Unit tests for pagination helper.
 */
import { parsePaginationParams, encodeCursor, MAX_LIMIT } from '@/lib/pagination';

describe('parsePaginationParams', () => {
  it('returns default limit when no params', () => {
    const params = parsePaginationParams(new URLSearchParams());
    expect(params.limit).toBe(50);
    expect(params.cursor).toBeNull();
    expect(params.offset).toBe(0);
  });

  it('caps limit at MAX_LIMIT (100)', () => {
    const params = parsePaginationParams(new URLSearchParams({ limit: '200' }));
    expect(params.limit).toBe(MAX_LIMIT);
  });

  it('accepts valid limit', () => {
    const params = parsePaginationParams(new URLSearchParams({ limit: '25' }));
    expect(params.limit).toBe(25);
  });

  it('throws Invalid limit for non-numeric', () => {
    expect(() => parsePaginationParams(new URLSearchParams({ limit: 'abc' }))).toThrow('Invalid limit');
    expect(() => parsePaginationParams(new URLSearchParams({ limit: '0' }))).toThrow('Invalid limit');
    expect(() => parsePaginationParams(new URLSearchParams({ limit: '-1' }))).toThrow('Invalid limit');
  });

  it('parses valid cursor', () => {
    const cursor = encodeCursor('123');
    const params = parsePaginationParams(new URLSearchParams({ cursor }));
    expect(params.cursor).toBe('123');
  });

  it('throws Invalid cursor for invalid base64', () => {
    expect(() => parsePaginationParams(new URLSearchParams({ cursor: '!!!' }))).toThrow('Invalid cursor');
  });

  it('parses offset', () => {
    const params = parsePaginationParams(new URLSearchParams({ offset: '10' }));
    expect(params.offset).toBe(10);
  });

  it('throws Invalid offset for negative', () => {
    expect(() => parsePaginationParams(new URLSearchParams({ offset: '-1' }))).toThrow('Invalid offset');
  });
});

describe('encodeCursor / decodeCursor', () => {
  it('round-trips id', () => {
    const id = '42';
    const encoded = encodeCursor(id);
    expect(encoded).toBeTruthy();
    const params = parsePaginationParams(new URLSearchParams({ cursor: encoded }));
    expect(params.cursor).toBe(id);
  });
});
