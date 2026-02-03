/**
 * POST /api/compliance/keys/requests/:id/execute
 * Executes an approved request (rotate or revoke).
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { getRequest, markExecuted } from '@/lib/key-lifecycle-service';
import { rotateKeys, revokeKey, logKeyAction } from '@/lib/compliance-service';
import { getActiveKeyId } from '@/lib/evidence-signing';

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
    const req = getRequest(id);
    if (!req) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Request not found' } },
        { status: 404 }
      );
    }
    
    if (req.status !== 'APPROVED') {
      return NextResponse.json(
        { error: { code: 'CONFLICT', message: `Cannot execute request with status: ${req.status}` } },
        { status: 409 }
      );
    }
    
    // Check expiration
    if (new Date(req.expires_at) < new Date()) {
      return NextResponse.json(
        { error: { code: 'GONE', message: 'Approval has expired' } },
        { status: 410 }
      );
    }
    
    const executorId = (session?.user?.id as string) ?? 'unknown';
    let result: string;
    
    // Execute the action
    if (req.action === 'ROTATE') {
      const oldKeyId = getActiveKeyId();
      const newKey = rotateKeys();
      
      // Log to ledger
      logKeyAction('KEY_ROTATED', {
        key_id: oldKeyId ?? 'none',
        new_key_id: newKey.key_id,
        approval_request_id: id,
      }, executorId);
      
      result = JSON.stringify({ old_key_id: oldKeyId, new_key_id: newKey.key_id });
      
    } else if (req.action === 'REVOKE') {
      const targetKeyId = req.target_key_id!;
      const reason = req.reason ?? 'Approved revocation';
      
      const success = revokeKey(targetKeyId, reason);
      if (!success) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Target key not found in archive' } },
          { status: 404 }
        );
      }
      
      // Log to ledger
      logKeyAction('KEY_REVOKED', {
        key_id: targetKeyId,
        reason,
        approval_request_id: id,
      }, executorId);
      
      result = JSON.stringify({ key_id: targetKeyId, reason });
      
    } else {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: `Unknown action: ${req.action}` } },
        { status: 400 }
      );
    }
    
    // Mark as executed
    const executed = markExecuted(id, executorId, result);
    
    return NextResponse.json({
      success: true,
      request: executed,
      result: JSON.parse(result),
      message: `${req.action} executed successfully via approved request.`,
    });
  } catch (error) {
    console.error('[compliance/keys/requests/execute] error:', error);
    const message = error instanceof Error ? error.message : 'Failed to execute request';
    
    if (message.includes('expired')) {
      return NextResponse.json(
        { error: { code: 'GONE', message } },
        { status: 410 }
      );
    }
    
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
