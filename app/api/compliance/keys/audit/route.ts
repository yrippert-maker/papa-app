/**
 * GET /api/compliance/keys/audit
 * Returns audit log for key actions (rotate/revoke).
 * Supports filters: from, to (ISO dates), action (KEY_ROTATED|KEY_REVOKED)
 * Supports pagination: limit, cursor
 * Permission: COMPLIANCE.VIEW or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { getKeyAuditEvents, type KeyAuditFilter } from '@/lib/compliance-service';

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
    
    // Parse filter params
    const filter: KeyAuditFilter = {};
    
    const from = url.searchParams.get('from');
    if (from) filter.from = from;
    
    const to = url.searchParams.get('to');
    if (to) filter.to = to;
    
    const action = url.searchParams.get('action');
    if (action === 'KEY_ROTATED' || action === 'KEY_REVOKED') {
      filter.action = action;
    }
    
    const limit = url.searchParams.get('limit');
    if (limit) filter.limit = parseInt(limit, 10);
    
    const cursor = url.searchParams.get('cursor');
    if (cursor) filter.cursor = parseInt(cursor, 10);
    
    const result = await getKeyAuditEvents(filter);
    
    return NextResponse.json(result);
  } catch (error) {
    console.error('[compliance/keys/audit] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get audit events' } },
      { status: 500 }
    );
  }
}
