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
});
