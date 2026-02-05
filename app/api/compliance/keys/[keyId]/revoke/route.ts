/**
 * POST /api/compliance/keys/:keyId/revoke
 * Direct revocation requires break-glass mode or approval flow.
 * 
 * Normal flow:
 * 1. POST /api/compliance/keys/requests { action: "REVOKE", target_key_id: "..." }
 * 2. Another user: POST /api/compliance/keys/requests/:id/approve
 * 3. POST /api/compliance/keys/requests/:id/execute
 * 
 * Break-glass flow:
 * 1. POST /api/compliance/break-glass { action: "activate", reason: "..." }
 * 2. POST /api/compliance/keys/:keyId/revoke (this endpoint)
 * 
 * Permission: COMPLIANCE.MANAGE or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { revokeKey, logKeyAction } from '@/lib/compliance-service';
import { getActiveKeyId } from '@/lib/evidence-signing';
import { isBreakGlassActive, recordBreakGlassAction } from '@/lib/key-lifecycle-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  
  // Allow COMPLIANCE.MANAGE or ADMIN.MANAGE_USERS
  const hasComplianceManage = hasPermission(session, PERMISSIONS.COMPLIANCE_MANAGE);
  const hasAdminAccess = await hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasComplianceManage && !hasAdminAccess) {
    const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_MANAGE, request);
    if (err) return err;
  }

  const { keyId } = await params;
  
  if (!keyId || keyId.length < 8) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid key ID' } },
      { status: 400 }
    );
  }

  // Check break-glass mode
  if (!(await isBreakGlassActive())) {
    return NextResponse.json(
      {
        error: {
          code: 'APPROVAL_REQUIRED',
          message: `Direct key revocation requires break-glass mode or approval flow. Use POST /api/compliance/keys/requests with action=REVOKE and target_key_id=${keyId}, or activate break-glass first.`,
        },
      },
      { status: 403 }
    );
  }
  
  // Check if trying to revoke active key
  const activeKeyId = getActiveKeyId();
  if (activeKeyId === keyId) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Cannot revoke active key. Rotate first.' } },
      { status: 400 }
    );
  }

  let body: { reason?: string } = {};
  try {
    body = await request.json();
  } catch {
    // Empty body is ok
  }
  
  const reason = body.reason || 'Break-glass emergency revocation';

  try {
    const success = revokeKey(keyId, reason);
    
    if (!success) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Key not found in archive' } },
        { status: 404 }
      );
    }
    
    // Log to ledger with break-glass flag
    const actorId = (session?.user?.id as string) ?? null;
    await logKeyAction('KEY_REVOKED', { key_id: keyId, reason, break_glass: true }, actorId);
    
    // Record action
    recordBreakGlassAction('REVOKE', `Revoked key ${keyId}: ${reason}`);
    
    return NextResponse.json({
      success: true,
      key_id: keyId,
      message: 'Key revoked via break-glass',
      reason,
      break_glass: true,
    });
  } catch (error) {
    console.error('[compliance/keys/revoke] Error:', error);
    const message = error instanceof Error ? error.message : 'Failed to revoke key';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
