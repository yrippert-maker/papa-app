/**
 * GET /api/compliance/snapshots
 * Lists audit snapshots.
 * Permission: COMPLIANCE.VIEW or ADMIN.MANAGE_USERS
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { listSnapshots, readSnapshot } from '@/lib/audit-snapshot-service';

export const dynamic = 'force-dynamic';

export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  
  const hasView = await hasPermission(session, PERMISSIONS.COMPLIANCE_VIEW);
  const hasAdmin = await hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasView && !hasAdmin) {
    const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, request);
    if (err) return err;
  }

  try {
    const url = new URL(request.url);
    const filename = url.searchParams.get('filename');
    
    if (filename) {
      // Return specific snapshot
      const snapshot = readSnapshot(filename);
      if (!snapshot) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Snapshot not found' } },
          { status: 404 }
        );
      }
      return NextResponse.json(snapshot);
    }
    
    // Return list
    const snapshots = listSnapshots();
    return NextResponse.json({ snapshots });
  } catch (error) {
    console.error('[compliance/snapshots] Error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list snapshots' } },
      { status: 500 }
    );
  }
}
