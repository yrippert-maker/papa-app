/**
 * Dead-letter replay: parsing logic for ledger-dead-letter.jsonl.
 * Used by scripts/replay-ledger-dead-letter.mjs.
 */

/**
 * Parses a dead-letter JSONL string into entries.
 * Skips invalid JSON and malformed lines (missing event_type or payload_json).
 * @param {string} raw - Raw file content
 * @returns {{ line: string; entry: { event_type: string; payload_json: unknown; actor_id?: string | null; error?: string; ts_utc?: string } }[]}
 */
export function parseDeadLetterLines(raw) {
  const lines = raw.split('\n').filter((l) => l.trim());
  const result = [];
  for (let i = 0; i < lines.length; i++) {
    try {
      const entry = JSON.parse(lines[i]);
      if (!entry.event_type || entry.payload_json === undefined) {
        continue;
      }
      result.push({ line: lines[i], entry });
    } catch {
      // skip invalid JSON
    }
  }
  return result;
}

/**
 * Parses payload_json for replay (string -> object).
 * @param {unknown} payloadJson - From dead-letter entry (string or already object)
 * @returns {Record<string, unknown>}
 * @throws {Error} If invalid
 */
export function parsePayloadJson(payloadJson) {
  if (typeof payloadJson === 'object' && payloadJson !== null && !Array.isArray(payloadJson)) {
    return payloadJson;
  }
  if (typeof payloadJson === 'string') {
    try {
      const parsed = JSON.parse(payloadJson);
      if (typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)) {
        return parsed;
      }
    } catch {
      throw new Error('Invalid payload_json: not valid JSON');
    }
    throw new Error('Invalid payload_json: parsed value must be object');
  }
  throw new Error('Invalid payload_json: must be object or JSON string');
}
