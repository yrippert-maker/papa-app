/**
 * GET /api/compliance/retention
 * Returns retention status report.
 * Permission: COMPLIANCE.VIEW or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { getRetentionReport } from '@/lib/retention-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  
  // Allow COMPLIANCE.VIEW or ADMIN.MANAGE_USERS
  const hasComplianceView = await hasPermission(session, PERMISSIONS.COMPLIANCE_VIEW);
  const hasAdminAccess = await hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasComplianceView && !hasAdminAccess) {
    const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, request);
    if (err) return err;
  }

  try {
    const report = getRetentionReport();
    return NextResponse.json(report);
  } catch (error) {
    console.error('[compliance/retention] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get retention report' } },
      { status: 500 }
    );
  }
}
