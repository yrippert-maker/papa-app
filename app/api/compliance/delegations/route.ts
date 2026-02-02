/**
 * GET/POST /api/compliance/delegations
 * Delegated approver management.
 * Permission: COMPLIANCE.VIEW (read), COMPLIANCE.MANAGE (delegate own)
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import {
  createDelegation,
  revokeDelegation,
  getActiveDelegations,
  type KeyClass,
} from '@/lib/governance-policy-service';

export const dynamic = 'force-dynamic';

/**
 * GET - List delegations
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
    const url = new URL(request.url);
    const userId = url.searchParams.get('user_id') ?? (session?.user?.id as string);
    
    const delegations = getActiveDelegations(userId);
    
    return NextResponse.json({
      delegations,
      count: delegations.length,
    });
  } catch (error) {
    console.error('[compliance/delegations] GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list delegations' } },
      { status: 500 }
    );
  }
}

/**
 * POST - Create or revoke delegation
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
    const action = body.action as 'create' | 'revoke';
    const userId = (session?.user?.id as string) ?? 'unknown';
    
    if (action === 'revoke') {
      if (!body.delegation_id) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'delegation_id required' } },
          { status: 400 }
        );
      }
      
      const delegation = revokeDelegation(body.delegation_id, userId);
      
      if (!delegation) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Delegation not found or already revoked' } },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        delegation,
        message: 'Delegation revoked',
      });
    }
    
    // Create
    if (!body.delegate_id || !body.key_classes || !body.max_approvals) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'delegate_id, key_classes, max_approvals required' } },
        { status: 400 }
      );
    }
    
    const delegation = createDelegation({
      delegator_id: userId,
      delegate_id: body.delegate_id,
      key_classes: body.key_classes as KeyClass[],
      org_scope: body.org_scope,
      team_scope: body.team_scope,
      max_approvals: body.max_approvals,
      period_hours: body.period_hours ?? 24,
      valid_until: body.valid_until,
      reason: body.reason ?? 'Delegation',
    });
    
    return NextResponse.json({
      success: true,
      delegation,
      message: 'Delegation created',
    });
  } catch (error) {
    console.error('[compliance/delegations] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
