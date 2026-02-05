/**
 * POST /api/compliance/keys/requests/:id/approve
 * Approves a pending request (must be different user from initiator).
 * Includes rate limiting per approver.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { approveRequest, getRequest } from '@/lib/key-lifecycle-service';
import { checkApproverRateLimit, recordApproval } from '@/lib/governance-resilience-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  
  const hasManage = await hasPermission(session, PERMISSIONS.COMPLIANCE_MANAGE);
  const hasAdmin = await hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasManage && !hasAdmin) {
    const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_MANAGE, request);
    if (err) return err;
  }

  const { id } = await params;
  
  if (!id) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Request ID required' } },
      { status: 400 }
    );
  }

  const approverId = (session?.user?.id as string) ?? 'unknown';
  
  // Check rate limit
  const rateLimit = checkApproverRateLimit(approverId);
  if (!rateLimit.allowed) {
    return NextResponse.json(
      {
        error: {
          code: 'RATE_LIMITED',
          message: `Approval rate limit exceeded (${rateLimit.current}/${rateLimit.max} in 24h). Blocked until ${rateLimit.blocked_until}`,
        },
      },
      { status: 429 }
    );
  }

  try {
    const existing = getRequest(id);
    if (!existing) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404 }
      );
    }
    
    const req = await approveRequest({
      request_id: id,
      approver_id: approverId,
    });
    
    // Record approval for rate limiting
    recordApproval(approverId);
    
    return NextResponse.json({
      success: true,
      request: req,
      message: 'Request approved. Ready for execution.',
      rate_limit: {
        current: rateLimit.current + 1,
        max: rateLimit.max,
      },
    });
  } catch (error) {
    console.error('[compliance/keys/requests/approve] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to approve request';
    
    // Handle specific errors
    if (message.includes('2-man rule')) {
      return NextResponse.json(
        { error: { code: 'FORBIDDEN', message } },
        { status: 403 }
      );
    }
    if (message.includes('expired')) {
      return NextResponse.json(
        { error: { code: 'GONE', message } },
        { status: 410 }
      );
    }
    if (message.includes('status')) {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message } },
        { status: 409 }
      );
    }
    
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
