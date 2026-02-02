/**
 * Error codes for /api/system/verify.
 * Stable enum for client-side error handling.
 */
export const VerifyErrorCodes = {
  UNAUTHORIZED: 'UNAUTHORIZED',
  FORBIDDEN: 'FORBIDDEN',
  BAD_REQUEST: 'BAD_REQUEST',
  RATE_LIMITED: 'RATE_LIMITED',
  UPSTREAM_AUTHZ_ERROR: 'UPSTREAM_AUTHZ_ERROR',
  UPSTREAM_LEDGER_ERROR: 'UPSTREAM_LEDGER_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR',
} as const;

export type VerifyErrorCode = (typeof VerifyErrorCodes)[keyof typeof VerifyErrorCodes];

export type VerifyErrorPayload = {
  error: {
    code: VerifyErrorCode;
    message: string;
    request_id: string;
  };
};
