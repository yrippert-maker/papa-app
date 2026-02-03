/**
 * Unit tests for lib/dead-letter-replay.mjs — parsing dead-letter JSONL.
 */
import { parseDeadLetterLines, parsePayloadJson } from '../../lib/dead-letter-replay.mjs';

describe('parseDeadLetterLines', () => {
  it('parses valid JSONL lines', () => {
    const raw = [
      '{"event_type":"FILE_REGISTERED","payload_json":"{\\"action\\":\\"FILE_REGISTERED\\",\\"relative_path\\":\\"x\\",\\"checksum_sha256\\":\\"' +
      'a'.repeat(64) +
      '\\"}","actor_id":"1","error":"test","ts_utc":"2026-02-01T12:00:00.000Z"}',
      '{"event_type":"INSPECTION_CARD_TRANSITION","payload_json":{"inspection_card_id":"C-1","from_status":"DRAFT","to_status":"IN_PROGRESS","transitioned_by":"u","transitioned_at":"2026-02-01T12:00:00Z"},"actor_id":"2","error":"busy","ts_utc":"2026-02-01T12:01:00.000Z"}',
    ].join('\n');
    const entries = parseDeadLetterLines(raw);
    expect(entries).toHaveLength(2);
    expect(entries[0].entry.event_type).toBe('FILE_REGISTERED');
    expect(entries[0].entry.payload_json).toBeDefined();
    expect(entries[1].entry.event_type).toBe('INSPECTION_CARD_TRANSITION');
    expect(entries[1].entry.payload_json).toEqual(
      expect.objectContaining({
        inspection_card_id: 'C-1',
        from_status: 'DRAFT',
        to_status: 'IN_PROGRESS',
      })
    );
  });

  it('skips invalid JSON lines', () => {
    const raw = [
      '{"event_type":"FILE_REGISTERED","payload_json":{}}',
      'not valid json {{{',
      '{"event_type":"X","payload_json":{}}',
    ].join('\n');
    const entries = parseDeadLetterLines(raw);
    expect(entries).toHaveLength(2);
    expect(entries[0].entry.event_type).toBe('FILE_REGISTERED');
    expect(entries[1].entry.event_type).toBe('X');
  });

  it('skips malformed lines (missing event_type or payload_json)', () => {
    const raw = [
      '{"actor_id":"1","error":"x"}',
      '{"event_type":"X"}',
      '{"payload_json":{}}',
    ].join('\n');
    const entries = parseDeadLetterLines(raw);
    expect(entries).toHaveLength(0);
  });

  it('returns empty for empty input', () => {
    expect(parseDeadLetterLines('')).toHaveLength(0);
    expect(parseDeadLetterLines('\n\n  \n')).toHaveLength(0);
  });
});

describe('parsePayloadJson', () => {
  it('returns object as-is when already object', () => {
    const obj = { action: 'FILE_REGISTERED', relative_path: 'x' };
    expect(parsePayloadJson(obj)).toBe(obj);
  });

  it('parses JSON string to object', () => {
    const str = '{"action":"FILE_REGISTERED","relative_path":"x"}';
    expect(parsePayloadJson(str)).toEqual({ action: 'FILE_REGISTERED', relative_path: 'x' });
  });

  it('throws for invalid JSON string', () => {
    expect(() => parsePayloadJson('not json')).toThrow('Invalid payload_json: not valid JSON');
    expect(() => parsePayloadJson('{')).toThrow('Invalid payload_json');
  });

  it('throws for non-object parsed value', () => {
    expect(() => parsePayloadJson('"string"')).toThrow('Invalid payload_json');
    expect(() => parsePayloadJson('123')).toThrow('Invalid payload_json');
    expect(() => parsePayloadJson('[]')).toThrow('Invalid payload_json');
  });

  it('throws for null and non-object types', () => {
    expect(() => parsePayloadJson(null)).toThrow('Invalid payload_json');
    expect(() => parsePayloadJson(undefined)).toThrow('Invalid payload_json');
    expect(() => parsePayloadJson(42)).toThrow('Invalid payload_json');
  });
});
