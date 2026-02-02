/**
 * Standardized API error responses (v0.1.8).
 * All non-2xx responses use { error: { code, message, request_id } }.
 */
import { NextResponse } from 'next/server';
import { VerifyErrorCodes } from '@/lib/verify-error-codes';

function requestId(headers?: Headers | null): string {
  const id = headers?.get?.('x-request-id');
  if (id?.trim()) return id.trim();
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `req-${Date.now()}-${Math.random().toString(36).slice(2, 11)}`;
}

export function jsonError(
  status: number,
  code: string,
  message: string,
  headers?: Headers | null
): NextResponse {
  const rid = requestId(headers);
  return NextResponse.json(
    { error: { code, message, request_id: rid } },
    { status }
  );
}

export function forbidden(headers?: Headers | null): NextResponse {
  return jsonError(403, VerifyErrorCodes.FORBIDDEN, 'Forbidden', headers);
}

export function unauthorized(headers?: Headers | null): NextResponse {
  return jsonError(401, VerifyErrorCodes.UNAUTHORIZED, 'Unauthorized', headers);
}

export function badRequest(message: string, headers?: Headers | null): NextResponse {
  return jsonError(400, VerifyErrorCodes.BAD_REQUEST, message, headers);
}
