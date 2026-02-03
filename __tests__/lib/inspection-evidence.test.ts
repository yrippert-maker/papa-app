/**
 * Unit tests for lib/inspection-evidence — buildEvidenceExport, export_hash.
 */
import { buildEvidenceExport, EVIDENCE_SCHEMA_VERSION } from '@/lib/inspection-evidence';

describe('buildEvidenceExport', () => {
  it('builds valid export with card, check_results, audit_events, export_hash', () => {
    const card = { inspection_card_id: 'C-1', status: 'IN_PROGRESS', card_no: 'IC-001' };
    const checkResults = [{ check_code: 'DOCS', result: 'PASS' }];
    const auditRows = [
      {
        id: 1,
        event_type: 'INSPECTION_CARD_TRANSITION',
        payload_json: JSON.stringify({ inspection_card_id: 'C-1', from_status: 'DRAFT', to_status: 'IN_PROGRESS' }),
        created_at: '2026-02-02T12:00:00.000Z',
        block_hash: 'h1',
        prev_hash: null,
        actor_id: 'u@t',
      },
    ];
    const exp = buildEvidenceExport(card, checkResults, auditRows);
    expect(exp.schema_version).toBe(EVIDENCE_SCHEMA_VERSION);
    expect(exp.inspection_card_id).toBe('C-1');
    expect(exp.card).toEqual(card);
    expect(exp.check_results).toEqual(checkResults);
    expect(exp.audit_events).toHaveLength(1);
    expect(exp.audit_events[0].block_hash).toBe('h1');
    expect(exp.export_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('export_hash is deterministic for same input', () => {
    const card = { inspection_card_id: 'C-1' };
    const checkResults: Array<Record<string, unknown>> = [];
    const auditRows: Array<{
      id: number;
      event_type: string;
      payload_json: string;
      created_at: string;
      block_hash: string;
      prev_hash: string | null;
      actor_id: string | null;
    }> = [];
    const opts = { exportedAt: '2026-02-02T12:00:00.000Z' };
    const a = buildEvidenceExport(card, checkResults, auditRows, opts);
    const b = buildEvidenceExport(card, checkResults, auditRows, opts);
    expect(a.export_hash).toBe(b.export_hash);
  });

  it('export_hash changes when data changes', () => {
    const card = { inspection_card_id: 'C-1' };
    const checkResults: Array<Record<string, unknown>> = [];
    const auditRows: Array<{
      id: number;
      event_type: string;
      payload_json: string;
      created_at: string;
      block_hash: string;
      prev_hash: string | null;
      actor_id: string | null;
    }> = [];
    const opts = { exportedAt: '2026-02-02T12:00:00.000Z' };
    const a = buildEvidenceExport(card, checkResults, auditRows, opts);
    const b = buildEvidenceExport({ ...card, status: 'DRAFT' }, checkResults, auditRows, opts);
    expect(a.export_hash).not.toBe(b.export_hash);
  });

  it('array order is preserved (audit_events order affects hash)', () => {
    const card = { inspection_card_id: 'C-1' };
    const checkResults: Array<Record<string, unknown>> = [];
    const auditRowsA = [
      { id: 1, event_type: 'X', payload_json: '{}', created_at: '2026-01-01T00:00:00Z', block_hash: 'h1', prev_hash: null, actor_id: null },
      { id: 2, event_type: 'Y', payload_json: '{}', created_at: '2026-01-01T00:01:00Z', block_hash: 'h2', prev_hash: 'h1', actor_id: null },
    ];
    const auditRowsB = [...auditRowsA].reverse();
    const opts = { exportedAt: '2026-02-02T12:00:00.000Z' };
    const expA = buildEvidenceExport(card, checkResults, auditRowsA, opts);
    const expB = buildEvidenceExport(card, checkResults, auditRowsB, opts);
    expect(expA.export_hash).not.toBe(expB.export_hash);
  });
});
