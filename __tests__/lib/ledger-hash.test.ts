/**
 * Unit tests for ledger-hash (computeEventHash, verifyLedgerChain).
 */
import crypto from 'crypto';
import { computeEventHash, verifyLedgerChain, canonicalJSON } from '@/lib/ledger-hash';

function legacyHash(prev: string | null, event: string, payload: string): string {
  const p = prev ?? '';
  return crypto.createHash('sha256').update(`${event}\n${payload}\n${p}`, 'utf8').digest('hex');
}

describe('canonicalJSON', () => {
  it('sorts keys', () => {
    expect(canonicalJSON({ b: 1, a: 2 })).toBe('{"a":2,"b":1}');
  });
});

describe('computeEventHash', () => {
  it('produces deterministic hash with ts_utc and actor_id', () => {
    const h1 = computeEventHash({
      prev_hash: null,
      event_type: 'USER_CREATED',
      ts_utc: '2026-02-01T12:00:00.000Z',
      actor_id: '1',
      canonical_payload_json: '{"actor_email":"a@b.c","actor_id":"1","target_email":"x@y.z","role_code":"ADMIN"}',
    });
    const h2 = computeEventHash({
      prev_hash: null,
      event_type: 'USER_CREATED',
      ts_utc: '2026-02-01T12:00:00.000Z',
      actor_id: '1',
      canonical_payload_json: '{"actor_email":"a@b.c","actor_id":"1","target_email":"x@y.z","role_code":"ADMIN"}',
    });
    expect(h1).toBe(h2);
    expect(h1).toMatch(/^[a-f0-9]{64}$/);
  });
});

describe('verifyLedgerChain', () => {
  it('verifies legacy chain (actor_id null)', () => {
    const bh0 = legacyHash(null, 'X', '{}');
    const events = [
      { event_type: 'X', payload_json: '{}', prev_hash: null, block_hash: bh0, actor_id: null },
    ];
    expect(verifyLedgerChain(events)).toBe(true);
  });

  it('verifies chain with ts_utc and actor_id', () => {
    const payload = '{"actor_id":"1","target_email":"a@b.c","role_code":"ADMIN"}';
    const bh1 = computeEventHash({
      prev_hash: null,
      event_type: 'USER_CREATED',
      ts_utc: '2026-02-01T12:00:00.000Z',
      actor_id: '1',
      canonical_payload_json: payload,
    });
    const events = [
      {
        event_type: 'USER_CREATED',
        payload_json: payload,
        prev_hash: null,
        block_hash: bh1,
        created_at: '2026-02-01T12:00:00.000Z',
        actor_id: '1',
      },
    ];
    expect(verifyLedgerChain(events)).toBe(true);
  });

  it('throws on hash mismatch', () => {
    const events = [
      {
        event_type: 'X',
        payload_json: '{}',
        prev_hash: null,
        block_hash: 'wrong',
        actor_id: null,
      },
    ];
    expect(() => verifyLedgerChain(events)).toThrow(/Hash mismatch/);
  });

  it('throws on chain break', () => {
    const bh0 = legacyHash(null, 'X', '{}');
    const events = [
      { event_type: 'X', payload_json: '{}', prev_hash: null, block_hash: bh0, actor_id: null },
      { event_type: 'Y', payload_json: '{}', prev_hash: 'wrong', block_hash: 'b'.repeat(64), actor_id: null },
    ];
    expect(() => verifyLedgerChain(events)).toThrow(/Chain break/);
  });
});
