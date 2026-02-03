/**
 * GET /api/compliance/keys
 * Returns list of all signing keys with their status.
 * Permission: COMPLIANCE.VIEW or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { getKeysStatus } from '@/lib/compliance-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  // Allow COMPLIANCE.VIEW or ADMIN.MANAGE_USERS
  const hasComplianceView = hasPermission(session, PERMISSIONS.COMPLIANCE_VIEW);
  const hasAdminAccess = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasComplianceView && !hasAdminAccess) {
    const err = requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, request);
    if (err) return err;
  }

  try {
    const keys = getKeysStatus();
    return NextResponse.json(keys);
  } catch (error) {
    console.error('[compliance/keys] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get keys status' } },
      { status: 500 }
    );
  }
}
