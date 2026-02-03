/**
 * Structured JSON logging for /api/system/verify.
 * Output to stdout for log aggregation (Datadog, CloudWatch, etc.).
 */
import { sanitizeForLog } from './log-sanitize';

export type VerifyLogContext = {
  request_id: string;
  event: 'verify_start' | 'verify_end';
  actor?: string;
  workspace_id?: string;
  http_status?: number;
  timing_ms?: number;
  ledger_included?: boolean;
  skip_reason?: string;
  error?: string; // error_code (e.g. RATE_LIMITED, FORBIDDEN)
  rate_limited?: boolean;
};

function safeString(val: unknown, maxLen = 200): string {
  if (val == null) return '';
  const s = String(val);
  return sanitizeForLog(s, maxLen);
}

export function logVerify(ctx: VerifyLogContext): void {
  const payload: Record<string, unknown> = {
    ts: new Date().toISOString(),
    service: 'verify-aggregator',
    ...ctx,
  };
  // Redact actor for privacy in logs (keep last 4 chars for correlation)
  if (payload.actor && typeof payload.actor === 'string') {
    const a = payload.actor as string;
    payload.actor = a.length > 4 ? `***${a.slice(-4)}` : '***';
  }
  console.log(JSON.stringify(payload));
}
