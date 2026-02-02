/**
 * POST /api/inspection/evidence/verify
 * Verifies an evidence export: checks content hash and signature.
 * Useful for external integrations and offline verification.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { verifyExportContent, type EvidenceExport } from '@/lib/inspection-evidence';
import { verifyExportHashWithDetails, getKeyStatus, type VerifyResult } from '@/lib/evidence-signing';
import { jsonError } from '@/lib/api/error-response';
import { VerifyErrorCodes } from '@/lib/verify-error-codes';
import { requirePermission } from '@/lib/authz';

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

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  const permError = requirePermission(session, 'INSPECTION.VIEW');
  if (permError) return permError;

  let body: EvidenceVerifyRequest;
  try {
    body = await request.json();
  } catch {
    return jsonError(400, VerifyErrorCodes.BAD_REQUEST, 'Invalid JSON body');
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
