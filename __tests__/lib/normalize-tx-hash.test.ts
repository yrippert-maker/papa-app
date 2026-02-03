/**
 * Property-based tests: 0x/case/whitespace variants → one canonical output.
 */
import { normalizeTxHash } from '@/lib/onchain/normalize-tx-hash';

const SAMPLE = 'a1b2c3d4e5f6789012345678901234567890123456789012345678901234abcd';

describe('normalizeTxHash', () => {
  it('returns lowercase without 0x', () => {
    expect(normalizeTxHash(SAMPLE)).toBe(SAMPLE.toLowerCase());
    expect(normalizeTxHash('0x' + SAMPLE)).toBe(SAMPLE.toLowerCase());
  });

  it('trims whitespace', () => {
    expect(normalizeTxHash('  ' + SAMPLE + '  ')).toBe(SAMPLE.toLowerCase());
    expect(normalizeTxHash('\t0x' + SAMPLE + '\n')).toBe(SAMPLE.toLowerCase());
  });

  it('normalizes case', () => {
    expect(normalizeTxHash(SAMPLE.toUpperCase())).toBe(SAMPLE.toLowerCase());
    expect(normalizeTxHash('0X' + SAMPLE.toUpperCase())).toBe(SAMPLE.toLowerCase());
  });

  it('empty/whitespace returns empty string', () => {
    expect(normalizeTxHash('')).toBe('');
    expect(normalizeTxHash('   ')).toBe('');
    expect(normalizeTxHash('\t')).toBe('');
  });

  it('multiple variants produce same output', () => {
    const variants = [
      SAMPLE,
      '0x' + SAMPLE,
      '0X' + SAMPLE.toUpperCase(),
      '  ' + SAMPLE + '  ',
      '\n0x' + SAMPLE.toUpperCase() + '\n',
    ];
    const canonical = normalizeTxHash(SAMPLE);
    for (const v of variants) {
      expect(normalizeTxHash(v)).toBe(canonical);
    }
  });
});
