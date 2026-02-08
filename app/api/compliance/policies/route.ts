/**
 * GET/POST /api/compliance/policies
 * N-of-M approval policy management.
 * Permission: COMPLIANCE.VIEW (read), ADMIN.MANAGE_USERS (write)
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import {
  listPolicies,
  createPolicy,
  updatePolicy,
  getPolicy,
  type KeyClass,
} from '@/lib/governance-policy-service';

export const dynamic = 'force-dynamic';

/**
 * GET - List policies or get specific policy
 */
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
    const keyClass = url.searchParams.get('key_class') as KeyClass | null;
    const orgId = url.searchParams.get('org_id') ?? undefined;
    const teamId = url.searchParams.get('team_id') ?? undefined;
    
    if (keyClass) {
      const policy = getPolicy(keyClass, orgId, teamId);
      return NextResponse.json({ policy });
    }
    
    const policies = listPolicies();
    return NextResponse.json({
      policies,
      total_count: policies.length,
    });
  } catch (error) {
    console.error('[compliance/policies] GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list policies' } },
      { status: 500 }
    );
  }
}

/**
 * POST - Create or update policy
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  
  const hasAdmin = await hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  if (!hasAdmin) {
    const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, request);
    if (err) return err;
  }

  try {
    const body = await request.json();
    const action = body.action as 'create' | 'update';
    
    if (action === 'update') {
      if (!body.policy_id) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'policy_id required' } },
          { status: 400 }
        );
      }
      
      const policy = updatePolicy(body.policy_id, body.updates ?? {});
      
      if (!policy) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Policy not found' } },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        policy,
        message: 'Policy updated',
      });
    }
    
    // Create
    if (!body.name || !body.key_class || body.required_approvals === undefined) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'name, key_class, required_approvals required' } },
        { status: 400 }
      );
    }
    
    const policy = createPolicy({
      name: body.name,
      description: body.description ?? '',
      key_class: body.key_class,
      required_approvals: body.required_approvals,
      total_approvers: body.total_approvers ?? 0,
      approval_timeout_hours: body.approval_timeout_hours ?? 24,
      execution_timeout_hours: body.execution_timeout_hours ?? 1,
      org_scope: body.org_scope ?? null,
      team_scope: body.team_scope ?? null,
      require_different_teams: body.require_different_teams ?? false,
      enabled: body.enabled !== false,
    });
    
    return NextResponse.json({
      success: true,
      policy,
      message: 'Policy created',
    });
  } catch (error) {
    console.error('[compliance/policies] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
