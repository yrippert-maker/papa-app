/**
 * Unit-тесты для lib/log-sanitize.
 */
import { sanitizeForLog } from '@/lib/log-sanitize';

describe('sanitizeForLog', () => {
  it('returns short strings unchanged', () => {
    expect(sanitizeForLog('hello')).toBe('hello');
  });

  it('truncates long strings and adds ellipsis', () => {
    const long = 'a'.repeat(250);
    expect(sanitizeForLog(long)).toHaveLength(201);
    expect(sanitizeForLog(long)).toMatch(/…$/);
  });

  it('replaces control characters with ?', () => {
    expect(sanitizeForLog('a\x00b\x1f')).toBe('a?b?');
    expect(sanitizeForLog('tab\there')).toContain('?');
  });

  it('respects custom maxLen', () => {
    expect(sanitizeForLog('12345', 3)).toBe('123…');
  });
});
