/**
 * GET /api/compliance/export
 * Exports compliance data as CSV.
 * Query params: type=verify-stats|key-audit
 * Permission: COMPLIANCE.VIEW or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { getVerifyStatsCSV, getKeyAuditCSV } from '@/lib/compliance-service';

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
    const type = url.searchParams.get('type') ?? 'verify-stats';
    
    let csv: string;
    let filename: string;
    const timestamp = new Date().toISOString().slice(0, 10);
    
    switch (type) {
      case 'key-audit':
        csv = getKeyAuditCSV();
        filename = `key-audit-${timestamp}.csv`;
        break;
      case 'verify-stats':
      default:
        csv = getVerifyStatsCSV();
        filename = `verify-stats-${timestamp}.csv`;
        break;
    }
    
    return new NextResponse(csv, {
      status: 200,
      headers: {
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    });
  } catch (error) {
    console.error('[compliance/export] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to export data' } },
      { status: 500 }
    );
  }
}
