import { createHash } from 'crypto';

/**
 * Deterministic stringify for fingerprint (sort keys recursively).
 * Must match scripts/independent-verify.mjs stableStringify + issueFingerprint.
 */
function stableStringify(obj: unknown): string {
  const seen = new WeakSet();
  const rec = (v: unknown): unknown => {
    if (v && typeof v === 'object') {
      if (seen.has(v as object)) return '[Circular]';
      seen.add(v as object);
      if (Array.isArray(v)) return v.map(rec);
      const out: Record<string, unknown> = {};
      for (const k of Object.keys(v as object).sort()) {
        out[k] = rec((v as Record<string, unknown>)[k]);
      }
      return out;
    }
    return v;
  };
  return JSON.stringify(rec(obj));
}

export function issueFingerprint(issue: {
  type?: string | null;
  severity?: string | null;
  period?: string | null;
  window?: string | null;
  periodStart?: string | null;
  periodEnd?: string | null;
  subject_id?: string | null;
  receipt_id?: string | null;
  event_id?: string | null;
  anchorId?: string | null;
  details?: string | null;
  message?: string | null;
}): string {
  const base = {
    type: issue?.type ?? null,
    severity: issue?.severity ?? null,
    period: issue?.period ?? issue?.window ?? (issue?.periodStart && issue?.periodEnd ? `${issue.periodStart}/${issue.periodEnd}` : null),
    subject_id: issue?.subject_id ?? issue?.receipt_id ?? issue?.event_id ?? issue?.anchorId ?? null,
    details: issue?.details ?? issue?.message ?? null,
  };
  return createHash('sha256').update(stableStringify(base)).digest('hex').slice(0, 16);
}
