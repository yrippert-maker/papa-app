/**
 * POST /api/compliance/keys/:keyId/revoke
 * Revokes an archived signing key.
 * Permission: COMPLIANCE.MANAGE or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { revokeKey, logKeyAction } from '@/lib/compliance-service';
import { getActiveKeyId } from '@/lib/evidence-signing';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ keyId: string }> }
) {
  const session = await getServerSession(authOptions);
  
  // Allow COMPLIANCE.MANAGE or ADMIN.MANAGE_USERS
  const hasComplianceManage = hasPermission(session, PERMISSIONS.COMPLIANCE_MANAGE);
  const hasAdminAccess = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasComplianceManage && !hasAdminAccess) {
    const err = requirePermission(session, PERMISSIONS.COMPLIANCE_MANAGE, request);
    if (err) return err;
  }

  const { keyId } = await params;
  
  if (!keyId || keyId.length < 8) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid key ID' } },
      { status: 400 }
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
    // Empty body is ok, reason is optional
  }
  
  const reason = body.reason || 'Manual revocation';

  try {
    const success = revokeKey(keyId, reason);
    
    if (!success) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Key not found in archive' } },
        { status: 404 }
      );
    }
    
    // Log to ledger
    const actorId = (session?.user?.id as string) ?? null;
    logKeyAction('KEY_REVOKED', { key_id: keyId, reason }, actorId);
    
    return NextResponse.json({
      success: true,
      key_id: keyId,
      message: 'Key revoked successfully',
      reason,
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
