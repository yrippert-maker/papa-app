/**
 * GET /api/compliance/keys/audit
 * Returns audit log for key actions (rotate/revoke).
 * Permission: COMPLIANCE.VIEW or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { getKeyAuditEvents } from '@/lib/compliance-service';

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
    const url = new URL(request.url);
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    const events = getKeyAuditEvents(Math.min(limit, 1000));
    
    return NextResponse.json({ events });
  } catch (error) {
    console.error('[compliance/keys/audit] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get audit events' } },
      { status: 500 }
    );
  }
}
