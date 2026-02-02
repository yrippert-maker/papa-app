/**
 * Unit-тесты для lib/ledger-schema — валидация ledger append.
 */
import { validateLedgerAppend } from '@/lib/ledger-schema';

describe('validateLedgerAppend', () => {
  it('accepts valid FILE_REGISTERED payload', () => {
    const result = validateLedgerAppend({
      event_type: 'FILE_REGISTERED',
      payload_json: {
        action: 'FILE_REGISTERED',
        relative_path: 'ai-inbox/123_doc.pdf',
        checksum_sha256: 'a'.repeat(64),
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.event_type).toBe('FILE_REGISTERED');
    }
  });

  it('rejects unknown event type', () => {
    const result = validateLedgerAppend({
      event_type: 'MALICIOUS_EVENT',
      payload_json: { foo: 'bar' },
    });
    expect(result.success).toBe(false);
    if (!result.success) expect(result.error).toContain('Invalid');
  });

  it('rejects invalid FILE_REGISTERED payload', () => {
    const result = validateLedgerAppend({
      event_type: 'FILE_REGISTERED',
      payload_json: {
        action: 'FILE_REGISTERED',
        relative_path: 'ok',
        checksum_sha256: 'too-short',
      },
    });
    expect(result.success).toBe(false);
  });

  it('rejects empty payload', () => {
    const result = validateLedgerAppend({
      event_type: 'FILE_REGISTERED',
      payload_json: {},
    });
    expect(result.success).toBe(false);
  });

  it('rejects invalid input shape', () => {
    expect(validateLedgerAppend(null).success).toBe(false);
    expect(validateLedgerAppend({}).success).toBe(false);
    expect(validateLedgerAppend({ event_type: 'FILE_REGISTERED' }).success).toBe(false);
  });

  it('accepts valid INSPECTION_CHECK_RECORDED payload', () => {
    const result = validateLedgerAppend({
      event_type: 'INSPECTION_CHECK_RECORDED',
      payload_json: {
        inspection_card_id: 'CARD-001',
        card_no: 'IC-001',
        check_code: 'DOCS',
        result: 'PASS',
        value: '12.3',
        unit: 'kg',
        comment: null,
        recorded_at: '2026-02-02T12:00:00.000Z',
        recorded_by: 'user@example.com',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.event_type).toBe('INSPECTION_CHECK_RECORDED');
    }
  });

  it('accepts valid INSPECTION_CARD_TRANSITION payload', () => {
    const result = validateLedgerAppend({
      event_type: 'INSPECTION_CARD_TRANSITION',
      payload_json: {
        inspection_card_id: 'CARD-001',
        card_no: 'IC-001',
        from_status: 'DRAFT',
        to_status: 'IN_PROGRESS',
        transitioned_by: 'user@example.com',
        transitioned_at: '2026-02-01T12:00:00.000Z',
      },
    });
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.event_type).toBe('INSPECTION_CARD_TRANSITION');
    }
  });
});
