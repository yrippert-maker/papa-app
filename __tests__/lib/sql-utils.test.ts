import { escapeLike } from '@/lib/sql-utils';

describe('escapeLike', () => {
  it('escapes %', () => {
    expect(escapeLike('foo%bar')).toBe('foo\\%bar');
  });

  it('escapes _', () => {
    expect(escapeLike('foo_bar')).toBe('foo\\_bar');
  });

  it('escapes backslash', () => {
    expect(escapeLike('foo\\bar')).toBe('foo\\\\bar');
  });

  it('escapes multiple wildcards', () => {
    expect(escapeLike('a%b_c%')).toBe('a\\%b\\_c\\%');
  });

  it('returns empty string for empty input', () => {
    expect(escapeLike('')).toBe('');
  });

  it('leaves normal chars unchanged', () => {
    expect(escapeLike('abc123')).toBe('abc123');
  });
});
