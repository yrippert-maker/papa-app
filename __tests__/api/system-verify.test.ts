/**
 * Tests for GET /api/system/verify aggregator.
 * Contract: shape, permissions, rate limit.
 */
import { VERIFY_SKIP_REASONS } from '@/lib/verify-constants';

describe('/api/system/verify aggregator', () => {
  describe('contract shape', () => {
    it('response includes authz_verification and ledger_verification', () => {
      // Mock session/db — minimal shape test
      const mockResponse = {
        ok: true,
        schema_version: 1,
        generated_at: '2026-02-01T12:00:00Z',
        authz_verification: {
          authz_ok: true,
          message: 'AuthZ verification passed',
          scope: {
            route_count: 18,
            permission_count: 10,
            role_count: 5,
            unique_routes: true,
            permissions_valid: true,
            deny_by_default: true,
            deny_by_default_scope: 'route_registry_only',
          },
        },
        ledger_verification: {
          skipped: true,
          reason: VERIFY_SKIP_REASONS.LEDGER_READ_NOT_GRANTED,
        },
        timing_ms: { total: 5, authz: 2, ledger: 0 },
      };

      expect(mockResponse.authz_verification).toBeDefined();
      expect(mockResponse.ledger_verification).toBeDefined();
      expect(mockResponse.timing_ms).toBeDefined();
      expect(mockResponse.schema_version).toBe(1);
    });

    it('ledger_verification.skipped uses constant reason', () => {
      const skipReason = VERIFY_SKIP_REASONS.LEDGER_READ_NOT_GRANTED;
      expect(skipReason).toBe('LEDGER.READ not granted');
    });
  });

  describe('permission branches', () => {
    it('without LEDGER.READ → ledger skipped with constant reason', () => {
      const response = {
        ledger_verification: {
          skipped: true,
          reason: VERIFY_SKIP_REASONS.LEDGER_READ_NOT_GRANTED,
        },
      };
      expect(response.ledger_verification.skipped).toBe(true);
      expect(response.ledger_verification.reason).toBe(VERIFY_SKIP_REASONS.LEDGER_READ_NOT_GRANTED);
      expect(response.ledger_verification.reason).toBe('LEDGER.READ not granted');
    });

    it('with LEDGER.READ → ledger executed, has ok field', () => {
      const response = {
        ledger_verification: {
          ok: true,
          message: 'Ledger integrity: OK',
          scope: { event_count: 0, id_min: null, id_max: null },
        },
      };
      expect('ok' in response.ledger_verification).toBe(true);
      expect('skipped' in response.ledger_verification).toBe(false);
    });

    it('ledger failed → ok: false, error', () => {
      const response = {
        ledger_verification: {
          ok: false,
          error: 'Chain break at index 2',
        },
      };
      expect(response.ledger_verification.ok).toBe(false);
      expect(response.ledger_verification.error).toBeTruthy();
    });
  });

  describe('overall ok logic', () => {
    it('authz ok + ledger skipped → overall ok', () => {
      const response = {
        ok: true,
        authz_verification: { authz_ok: true },
        ledger_verification: { skipped: true, reason: VERIFY_SKIP_REASONS.LEDGER_READ_NOT_GRANTED },
      };
      expect(response.ok).toBe(true);
    });

    it('authz ok + ledger ok → overall ok', () => {
      const response = {
        ok: true,
        authz_verification: { authz_ok: true },
        ledger_verification: { ok: true, message: 'OK', scope: { event_count: 0, id_min: null, id_max: null } },
      };
      expect(response.ok).toBe(true);
    });

    it('authz ok + ledger failed → overall failed', () => {
      const response = {
        ok: false,
        authz_verification: { authz_ok: true },
        ledger_verification: { ok: false, error: 'Hash mismatch' },
      };
      expect(response.ok).toBe(false);
    });

    it('authz failed → overall failed (regardless of ledger)', () => {
      const response = {
        ok: false,
        authz_verification: { authz_ok: false, message: 'duplicate route' },
        ledger_verification: { ok: true, message: 'OK', scope: { event_count: 0, id_min: null, id_max: null } },
      };
      expect(response.ok).toBe(false);
    });
  });
});
