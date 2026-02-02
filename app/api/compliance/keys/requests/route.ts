/**
 * GET/POST /api/compliance/keys/requests
 * List or create key lifecycle requests.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import {
  createRequest,
  listRequests,
  getPendingCount,
  expireTimedOutRequests,
  type RequestAction,
  type RequestStatus,
} from '@/lib/key-lifecycle-service';

export const dynamic = 'force-dynamic';

/**
 * GET - List requests
 */
export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  
  const hasView = hasPermission(session, PERMISSIONS.COMPLIANCE_VIEW);
  const hasAdmin = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasView && !hasAdmin) {
    const err = requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, request);
    if (err) return err;
  }

  try {
    // Expire timed-out requests first
    expireTimedOutRequests();
    
    const url = new URL(request.url);
    const status = url.searchParams.get('status');
    const limit = parseInt(url.searchParams.get('limit') ?? '50', 10);
    
    const requests = listRequests({
      status: status ? (status.split(',') as RequestStatus[]) : undefined,
      limit: Math.min(limit, 100),
    });
    
    const pendingCount = getPendingCount();
    
    return NextResponse.json({
      requests,
      pending_count: pendingCount,
    });
  } catch (error) {
    console.error('[compliance/keys/requests] GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list requests' } },
      { status: 500 }
    );
  }
}

/**
 * POST - Create request
 */
export async function POST(request: Request) {
  const session = await getServerSession(authOptions);
  
  const hasManage = hasPermission(session, PERMISSIONS.COMPLIANCE_MANAGE);
  const hasAdmin = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasManage && !hasAdmin) {
    const err = requirePermission(session, PERMISSIONS.COMPLIANCE_MANAGE, request);
    if (err) return err;
  }

  try {
    const body = await request.json();
    
    const action = body.action as RequestAction;
    if (!action || !['ROTATE', 'REVOKE'].includes(action)) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Invalid action. Must be ROTATE or REVOKE.' } },
        { status: 400 }
      );
    }
    
    if (action === 'REVOKE' && !body.target_key_id) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'target_key_id required for REVOKE action' } },
        { status: 400 }
      );
    }
    
    const initiatorId = (session?.user?.id as string) ?? 'unknown';
    
    const req = createRequest({
      action,
      target_key_id: body.target_key_id,
      reason: body.reason,
      initiator_id: initiatorId,
    });
    
    return NextResponse.json({
      success: true,
      request: req,
      message: 'Request created. Awaiting approval from another user.',
    });
  } catch (error) {
    console.error('[compliance/keys/requests] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to create request';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
