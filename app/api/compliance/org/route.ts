/**
 * GET/POST /api/compliance/org
 * Organization and team management for scoped governance.
 * Permission: COMPLIANCE.VIEW (read), ADMIN.MANAGE_USERS (write)
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import {
  listOrgs,
  createOrg,
  listTeams,
  createTeam,
  assignUserToOrg,
  getUserAssignments,
} from '@/lib/governance-policy-service';

export const dynamic = 'force-dynamic';

/**
 * GET - List orgs, teams, or user assignments
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
    const type = url.searchParams.get('type') ?? 'orgs';
    
    if (type === 'orgs') {
      const orgs = listOrgs();
      return NextResponse.json({ orgs });
    }
    
    if (type === 'teams') {
      const orgId = url.searchParams.get('org_id') ?? undefined;
      const teams = listTeams(orgId);
      return NextResponse.json({ teams });
    }
    
    if (type === 'assignments') {
      const userId = url.searchParams.get('user_id') ?? (session?.user?.id as string);
      const assignments = getUserAssignments(userId);
      return NextResponse.json({ assignments });
    }
    
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid type. Use orgs, teams, or assignments.' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[compliance/org] GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list data' } },
      { status: 500 }
    );
  }
}

/**
 * POST - Create org, team, or assignment
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
    const action = body.action as 'create_org' | 'create_team' | 'assign_user';
    
    if (action === 'create_org') {
      if (!body.name) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'name required' } },
          { status: 400 }
        );
      }
      
      const org = createOrg(body.name, body.parent_org_id);
      return NextResponse.json({ success: true, org });
    }
    
    if (action === 'create_team') {
      if (!body.org_id || !body.name) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'org_id and name required' } },
          { status: 400 }
        );
      }
      
      const team = createTeam(body.org_id, body.name);
      return NextResponse.json({ success: true, team });
    }
    
    if (action === 'assign_user') {
      if (!body.user_id || !body.org_id) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'user_id and org_id required' } },
          { status: 400 }
        );
      }
      
      const assignment = assignUserToOrg(body.user_id, body.org_id, body.team_id, body.role);
      return NextResponse.json({ success: true, assignment });
    }
    
    return NextResponse.json(
      { error: { code: 'BAD_REQUEST', message: 'Invalid action' } },
      { status: 400 }
    );
  } catch (error) {
    console.error('[compliance/org] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
