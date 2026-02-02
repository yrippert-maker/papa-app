/**
 * Constants for verify aggregator — skip reasons, error codes.
 * Use these in backend and tests to avoid string drift.
 */
export const VERIFY_SKIP_REASONS = {
  LEDGER_READ_NOT_GRANTED: 'LEDGER.READ not granted',
  INSPECTION_VIEW_NOT_GRANTED: 'INSPECTION.VIEW not granted',
} as const;
