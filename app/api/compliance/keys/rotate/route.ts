/**
 * POST /api/compliance/keys/rotate
 * Rotates signing keys: archives current and creates new.
 * Permission: COMPLIANCE.MANAGE or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { rotateKeys, logKeyAction } from '@/lib/compliance-service';
import { getActiveKeyId } from '@/lib/evidence-signing';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  // Allow COMPLIANCE.MANAGE or ADMIN.MANAGE_USERS
  const hasComplianceManage = hasPermission(session, PERMISSIONS.COMPLIANCE_MANAGE);
  const hasAdminAccess = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasComplianceManage && !hasAdminAccess) {
    const err = requirePermission(session, PERMISSIONS.COMPLIANCE_MANAGE, request);
    if (err) return err;
  }

  try {
    const oldKeyId = getActiveKeyId();
    const newKey = rotateKeys();
    
    // Log to ledger
    const actorId = (session?.user?.id as string) ?? null;
    logKeyAction('KEY_ROTATED', {
      key_id: oldKeyId ?? 'none',
      new_key_id: newKey.key_id,
    }, actorId);
    
    return NextResponse.json({
      success: true,
      key: newKey,
      message: 'Key rotated successfully. Previous key archived.',
    });
  } catch (error) {
    console.error('[compliance/keys/rotate] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to rotate keys' } },
      { status: 500 }
    );
  }
}
