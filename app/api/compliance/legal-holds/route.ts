/**
 * GET/POST /api/compliance/legal-holds
 * Manage legal holds for evidence retention.
 * Permission: ADMIN.MANAGE_USERS only
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import {
  createLegalHold,
  releaseLegalHold,
  listLegalHolds,
  type LegalHoldStatus,
} from '@/lib/audit-pack-service';

export const dynamic = 'force-dynamic';

/**
 * GET - List legal holds
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  const hasAdmin = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  const hasView = hasPermission(session, PERMISSIONS.COMPLIANCE_VIEW);
  
  if (!hasAdmin && !hasView) {
    const err = requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, request);
    if (err) return err;
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as LegalHoldStatus | null;
    
    const holds = listLegalHolds(status ?? undefined);
    
    return NextResponse.json({
      holds,
      active_count: holds.filter(h => h.status === 'active').length,
      total_count: holds.length,
    });
  } catch (error) {
    console.error('[compliance/legal-holds] GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list holds' } },
      { status: 500 }
    );
  }
}

/**
 * POST - Create or release legal hold
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  const hasAdmin = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  if (!hasAdmin) {
    const err = requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, request);
    if (err) return err;
  }

  try {
    const body = await request.json();
    const action = body.action as 'create' | 'release';
    const userId = (session?.user?.id as string) ?? 'unknown';
    
    if (action === 'create') {
      if (!body.reason || !body.custodian || !body.scope) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'reason, custodian, and scope required' } },
          { status: 400 }
        );
      }
      
      const hold = createLegalHold({
        reason: body.reason,
        custodian: body.custodian,
        scope: body.scope,
        created_by: userId,
      });
      
      return NextResponse.json({
        success: true,
        hold,
        message: 'Legal hold created',
      });
      
    } else if (action === 'release') {
      if (!body.hold_id) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'hold_id required' } },
          { status: 400 }
        );
      }
      
      const hold = releaseLegalHold(body.hold_id, userId);
      
      if (!hold) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Hold not found or already released' } },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        hold,
        message: 'Legal hold released',
      });
      
    } else {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Invalid action. Use create or release.' } },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[compliance/legal-holds] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
