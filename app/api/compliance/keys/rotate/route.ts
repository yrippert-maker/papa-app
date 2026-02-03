/**
 * POST /api/compliance/keys/rotate
 * Direct rotation requires break-glass mode or approval flow.
 * 
 * Normal flow:
 * 1. POST /api/compliance/keys/requests { action: "ROTATE" }
 * 2. Another user: POST /api/compliance/keys/requests/:id/approve
 * 3. POST /api/compliance/keys/requests/:id/execute
 * 
 * Break-glass flow:
 * 1. POST /api/compliance/break-glass { action: "activate", reason: "..." }
 * 2. POST /api/compliance/keys/rotate (this endpoint)
 * 
 * Permission: COMPLIANCE.MANAGE or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { rotateKeys, logKeyAction } from '@/lib/compliance-service';
import { getActiveKeyId } from '@/lib/evidence-signing';
import { isBreakGlassActive, recordBreakGlassAction } from '@/lib/key-lifecycle-service';

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

  // Check break-glass mode
  if (!isBreakGlassActive()) {
    return NextResponse.json(
      {
        error: {
          code: 'APPROVAL_REQUIRED',
          message: 'Direct key rotation requires break-glass mode or approval flow. Use POST /api/compliance/keys/requests with action=ROTATE, or activate break-glass first.',
        },
      },
      { status: 403 }
    );
  }

  try {
    const oldKeyId = getActiveKeyId();
    const newKey = rotateKeys();
    
    // Log to ledger with break-glass flag
    const actorId = (session?.user?.id as string) ?? null;
    logKeyAction('KEY_ROTATED', {
      key_id: oldKeyId ?? 'none',
      new_key_id: newKey.key_id,
      break_glass: true,
    }, actorId);
    
    // Record action
    recordBreakGlassAction('ROTATE', `Rotated key from ${oldKeyId} to ${newKey.key_id}`);
    
    return NextResponse.json({
      success: true,
      key: newKey,
      message: 'Key rotated via break-glass. Previous key archived.',
      break_glass: true,
    });
  } catch (error) {
    console.error('[compliance/keys/rotate] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to rotate keys' } },
      { status: 500 }
    );
  }
}
