/**
 * Canonical JSON serializer for LEDGER_VERIFY_RESULT and similar.
 * - Object keys sorted lexicographically by Unicode code points (ascending);
 *   same order across all Node environments (Object.keys().sort()).
 * - No whitespace
 * - UTF-8 output
 */
function isPlainObject(v) {
  if (v === null || typeof v !== 'object') return false;
  const proto = Object.getPrototypeOf(v);
  return proto === Object.prototype || proto === null;
}

function canonicalize(value) {
  if (value === null) return null;
  const t = typeof value;
  if (t === 'string' || t === 'boolean') return value;
  if (t === 'number') {
    if (!Number.isFinite(value)) throw new Error('canonicalJSON: numbers must be finite');
    return value;
  }
  if (Array.isArray(value)) return value.map((v) => canonicalize(v));
  if (value instanceof Date) return value.toISOString();
  if (!isPlainObject(value)) throw new Error('canonicalJSON: only plain objects/arrays supported');
  const out = {};
  for (const k of Object.keys(value).sort()) {
    const v = value[k];
    if (v === undefined) throw new Error(`canonicalJSON: key "${k}" is undefined`);
    out[k] = canonicalize(v);
  }
  return out;
}

export function canonicalJSONStringify(value) {
  const canon = canonicalize(value);
  return JSON.stringify(canon);
}
