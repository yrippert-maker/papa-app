/**
 * POST /api/inspection/evidence/verify
 * Verifies an evidence export: checks content hash and signature.
 * Useful for external integrations and offline verification.
 * Rate-limited: 20 requests per minute per IP.
 * Payload size cap: 5 MB.
 */

const MAX_PAYLOAD_SIZE = 5 * 1024 * 1024; // 5 MB
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { verifyExportContent, type EvidenceExport } from '@/lib/inspection-evidence';
import { verifyExportHashWithDetails, getKeyStatus, type VerifyResult } from '@/lib/evidence-signing';
import { jsonError, rateLimitError } from '@/lib/api/error-response';
import { VerifyErrorCodes } from '@/lib/verify-error-codes';
import { requirePermission } from '@/lib/authz';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { incEvidenceVerifyMetric } from '@/lib/metrics/evidence-verify';

export type EvidenceVerifyRequest = {
  export_json: EvidenceExport;
  signature?: string;
  key_id?: string;
};

export type EvidenceVerifyResponse = {
  ok: boolean;
  content: {
    valid: boolean;
    export_hash: string;
    computed_hash: string;
  };
  signature?: {
    valid: boolean;
    key_id?: string;
    error?: string;
    revocation_reason?: string;
    key_status?: {
      is_active: boolean;
      is_revoked: boolean;
    };
  };
  errors?: string[];
};

export async function POST(request: Request): Promise<Response> {
  // Rate limit: 20 requests per minute
  const clientKey = getClientKey(request);
  const rateCheck = checkRateLimit(`evidence-verify:${clientKey}`, { max: 20, windowMs: 60_000 });
  if (!rateCheck.allowed) {
    incEvidenceVerifyMetric('rate_limited');
    return rateLimitError('Too many requests', null, Math.ceil((rateCheck.retryAfterMs ?? 60000) / 1000));
  }

  const session = await getServerSession(authOptions);
  const permError = await requirePermission(session, 'INSPECTION.VIEW');
  if (permError) {
    incEvidenceVerifyMetric('unauthorized');
    return permError;
  }

  // Check payload size
  const contentLength = request.headers.get('content-length');
  if (contentLength && parseInt(contentLength, 10) > MAX_PAYLOAD_SIZE) {
    return jsonError(400, VerifyErrorCodes.BAD_REQUEST, `Payload too large (max ${MAX_PAYLOAD_SIZE / 1024 / 1024} MB)`);
  }

  let body: EvidenceVerifyRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, VerifyErrorCodes.BAD_REQUEST, 'Invalid JSON body');
  }

  // Double-check parsed body size
  const bodyStr = JSON.stringify(body);
  if (bodyStr.length > MAX_PAYLOAD_SIZE) {
    return jsonError(400, VerifyErrorCodes.BAD_REQUEST, `Payload too large (max ${MAX_PAYLOAD_SIZE / 1024 / 1024} MB)`);
  }

  const { export_json, signature, key_id } = body;

  if (!export_json || typeof export_json !== 'object') {
    return jsonError(400, VerifyErrorCodes.BAD_REQUEST, 'Missing or invalid export_json');
  }

  const errors: string[] = [];

  // 1. Verify content hash
  const contentResult = verifyExportContent(export_json);
  if (!contentResult.valid) {
    errors.push('Content hash mismatch: export may have been tampered with');
  }

  // 2. Verify signature if provided
  let signatureResult: EvidenceVerifyResponse['signature'];
  
  // Use signature from request or from export_json
  const sig = signature ?? export_json.export_signature;
  const keyId = key_id ?? export_json.export_key_id;

  if (sig) {
    const verifyResult: VerifyResult = verifyExportHashWithDetails(
      export_json.export_hash,
      sig,
      keyId,
      export_json.export_public_key
    );

    const keyStatus = keyId ? getKeyStatus(keyId) : null;

    signatureResult = {
      valid: verifyResult.valid,
      key_id: verifyResult.keyId,
      error: verifyResult.error,
      revocation_reason: verifyResult.revocationReason,
      key_status: keyStatus ? {
        is_active: keyStatus.isActive,
        is_revoked: keyStatus.isRevoked,
      } : undefined,
    };

    if (!verifyResult.valid) {
      if (verifyResult.error === 'KEY_REVOKED') {
        errors.push(`Signature key has been revoked: ${verifyResult.revocationReason ?? 'no reason provided'}`);
      } else if (verifyResult.error === 'KEY_NOT_FOUND') {
        errors.push('Signing key not found');
      } else if (verifyResult.error === 'SIGNATURE_INVALID') {
        errors.push('Signature is invalid');
      } else {
        errors.push('Signature verification failed');
      }
    }
  }

  const ok = contentResult.valid && (!sig || signatureResult?.valid === true);

  // Record metrics
  if (ok) {
    incEvidenceVerifyMetric('ok');
  } else if (!contentResult.valid) {
    incEvidenceVerifyMetric('content_invalid');
  } else if (signatureResult?.error === 'KEY_REVOKED') {
    incEvidenceVerifyMetric('key_revoked');
  } else if (signatureResult?.error === 'KEY_NOT_FOUND') {
    incEvidenceVerifyMetric('key_not_found');
  } else if (signatureResult?.error === 'SIGNATURE_INVALID') {
    incEvidenceVerifyMetric('signature_invalid');
  } else {
    incEvidenceVerifyMetric('other_error');
  }

  const response: EvidenceVerifyResponse = {
    ok,
    content: {
      valid: contentResult.valid,
      export_hash: export_json.export_hash,
      computed_hash: contentResult.computedHash,
    },
    signature: signatureResult,
    errors: errors.length > 0 ? errors : undefined,
  };

  return NextResponse.json(response);
}
