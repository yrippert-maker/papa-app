/**
 * Normalize tx_hash for consistent manifest/file lookup.
 * Single source of truth: trim, lowercase, remove 0x prefix.
 */
export function normalizeTxHash(v: string): string {
  const s = (v || '').trim().toLowerCase();
  const no0x = s.startsWith('0x') ? s.slice(2) : s;
  return no0x;
}
