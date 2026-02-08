/**
 * GET /api/compliance/export
 * Exports compliance data as CSV.
 * Query params:
 *   type=verify-stats|key-audit
 *   from, to (ISO dates) - for key-audit
 *   action (KEY_ROTATED|KEY_REVOKED) - for key-audit
 * Permission: COMPLIANCE.VIEW or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { getVerifyStatsCSV, getKeyAuditCSV, type KeyAuditFilter } from '@/lib/compliance-service';

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
    const url = new URL(request.url);
    const type = url.searchParams.get('type') ?? 'verify-stats';
    
    let csv: string;
    let filename: string;
    const timestamp = new Date().toISOString().slice(0, 10);
    
    switch (type) {
      case 'key-audit': {
        // Parse filters for key-audit
        const filter: Omit<KeyAuditFilter, 'cursor'> = {};
        
        const from = url.searchParams.get('from');
        if (from) filter.from = from;
        
        const to = url.searchParams.get('to');
        if (to) filter.to = to;
        
        const action = url.searchParams.get('action');
        if (action === 'KEY_ROTATED' || action === 'KEY_REVOKED') {
          filter.action = action;
        }
        
        csv = await getKeyAuditCSV(filter);
        
        // Include filter info in filename
        const parts = ['key-audit', timestamp];
        if (filter.action) parts.push(filter.action.toLowerCase());
        filename = `${parts.join('-')}.csv`;
        break;
      }
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
