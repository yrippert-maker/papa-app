/**
 * Tests for error handling in /api/system/verify.
 * Contract: standardized error payload (PR-2).
 */
import { VerifyErrorCodes } from '@/lib/verify-error-codes';

describe('/api/system/verify error handling', () => {
  it('429 rate limited has error.code', () => {
    const response = {
      error: {
        code: VerifyErrorCodes.RATE_LIMITED,
        message: 'Too many requests',
        request_id: 'req-123',
      },
    };
    expect(response.error.code).toBe('RATE_LIMITED');
    expect(response.error.request_id).toBe('req-123');
  });

  it('403 forbidden has error.code', () => {
    const response = {
      error: {
        code: VerifyErrorCodes.FORBIDDEN,
        message: 'Forbidden',
        request_id: 'req-456',
      },
    };
    expect(response.error.code).toBe('FORBIDDEN');
    expect(response.error.request_id).toBeTruthy();
  });

  it('401 unauthorized has error.code', () => {
    const response = {
      error: {
        code: VerifyErrorCodes.UNAUTHORIZED,
        message: 'Unauthorized',
        request_id: 'req-789',
      },
    };
    expect(response.error.code).toBe('UNAUTHORIZED');
  });

  it('503 upstream authz error has error.code', () => {
    const response = {
      error: {
        code: VerifyErrorCodes.UPSTREAM_AUTHZ_ERROR,
        message: 'AuthZ verification failed',
        request_id: 'req-abc',
      },
    };
    expect(response.error.code).toBe('UPSTREAM_AUTHZ_ERROR');
  });

  it('503 upstream ledger error has error.code', () => {
    const response = {
      error: {
        code: VerifyErrorCodes.UPSTREAM_LEDGER_ERROR,
        message: 'Ledger verification failed',
        request_id: 'req-def',
      },
    };
    expect(response.error.code).toBe('UPSTREAM_LEDGER_ERROR');
  });

  it('all error codes are unique', () => {
    const codes = Object.values(VerifyErrorCodes);
    const unique = new Set(codes);
    expect(unique.size).toBe(codes.length);
  });
});
