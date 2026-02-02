/**
 * POST /api/compliance/keys/requests/:id/reject
 * Rejects a pending request.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { rejectRequest, getRequest } from '@/lib/key-lifecycle-service';

export const dynamic = 'force-dynamic';

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  
  const hasManage = hasPermission(session, PERMISSIONS.COMPLIANCE_MANAGE);
  const hasAdmin = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasManage && !hasAdmin) {
    const err = requirePermission(session, PERMISSIONS.COMPLIANCE_MANAGE, request);
    if (err) return err;
  }

  const { id } = await params;
  
  if (!id) {
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Request ID required' } },
      { status: 400 }
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
    
    let body: { reason?: string } = {};
    try {
      body = await request.json();
    } catch {
      // Empty body is ok
    }
    
    const rejectorId = (session?.user?.id as string) ?? 'unknown';
    
    const req = rejectRequest({
      request_id: id,
      rejector_id: rejectorId,
      reason: body.reason,
    });
    
    return NextResponse.json({
      success: true,
      request: req,
      message: 'Request rejected.',
    });
  } catch (error) {
    console.error('[compliance/keys/requests/reject] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to reject request';
    
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
