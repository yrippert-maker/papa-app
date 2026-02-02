/**
 * Inspection evidence export — card snapshot + check_results + audit events + hashes.
 * For compliance / evidence layer.
 */
import crypto from 'crypto';

export const EVIDENCE_SCHEMA_VERSION = '1';

/** Recursive canonical JSON for deterministic export hash. */
function canonicalizeForHash(val: unknown): unknown {
  if (val === null || val === undefined) return null;
  if (typeof val === 'string' || typeof val === 'boolean') return val;
  if (typeof val === 'number') return Number.isFinite(val) ? val : null;
  if (Array.isArray(val)) return val.map(canonicalizeForHash);
  if (typeof val === 'object' && val !== null) {
    const out: Record<string, unknown> = {};
    for (const k of Object.keys(val as object).sort()) {
      const v = (val as Record<string, unknown>)[k];
      if (v !== undefined) out[k] = canonicalizeForHash(v);
    }
    return out;
  }
  return null;
}

export type EvidenceExport = {
  schema_version: string;
  exported_at: string;
  inspection_card_id: string;
  card: Record<string, unknown>;
  check_results: Array<Record<string, unknown>>;
  audit_events: Array<{
    id: number;
    event_type: string;
    payload: Record<string, unknown>;
    created_at: string;
    block_hash: string;
    prev_hash: string | null;
    actor_id: string | null;
  }>;
  export_hash: string;
  /** Present when signed=1: Ed25519 signature of export_hash (hex) */
  export_signature?: string;
  /** Present when signed=1: key_id for signature verification (SHA-256 fingerprint, 16 hex chars) */
  export_key_id?: string;
  /** Present when signed=1: PEM public key for verification */
  export_public_key?: string;
};

/**
 * Computes SHA-256 of canonical JSON of the export (excluding export_hash).
 */
function computeExportHash(body: Omit<EvidenceExport, 'export_hash'>): string {
  const canon = canonicalizeForHash(body);
  const str = JSON.stringify(canon);
  return crypto.createHash('sha256').update(str, 'utf8').digest('hex');
}

/**
 * Builds the evidence export structure (without export_hash).
 * Caller adds export_hash after building.
 */
export function buildEvidenceExport(
  card: Record<string, unknown>,
  checkResults: Array<Record<string, unknown>>,
  auditRows: Array<{
    id: number;
    event_type: string;
    payload_json: string;
    created_at: string;
    block_hash: string;
    prev_hash: string | null;
    actor_id: string | null;
  }>
): EvidenceExport {
  const exportedAt = new Date().toISOString();
  const cardId = (card.inspection_card_id as string) ?? '';

  const audit_events = auditRows.map((r) => {
    let payload: Record<string, unknown>;
    try {
      payload = JSON.parse(r.payload_json) as Record<string, unknown>;
    } catch {
      payload = {};
    }
    return {
      id: r.id,
      event_type: r.event_type,
      payload,
      created_at: r.created_at,
      block_hash: r.block_hash,
      prev_hash: r.prev_hash,
      actor_id: r.actor_id,
    };
  });

  const body: Omit<EvidenceExport, 'export_hash'> = {
    schema_version: EVIDENCE_SCHEMA_VERSION,
    exported_at: exportedAt,
    inspection_card_id: cardId,
    card,
    check_results: checkResults,
    audit_events,
  };

  const export_hash = computeExportHash(body);

  return { ...body, export_hash };
}

/**
 * Verifies the export_hash matches the content of the export.
 * Returns { valid, computedHash } for external verification.
 */
export function verifyExportContent(exportData: EvidenceExport): { valid: boolean; computedHash: string } {
  const { export_hash, export_signature: _, export_key_id: __, export_public_key: ___, ...body } = exportData;
  void _; void __; void ___;  // mark as used
  const computedHash = computeExportHash(body as Omit<EvidenceExport, 'export_hash'>);
  return { valid: computedHash === export_hash, computedHash };
}
