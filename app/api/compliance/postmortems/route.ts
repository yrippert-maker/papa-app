/**
 * GET/POST /api/compliance/postmortems
 * Break-glass post-mortem management.
 * Permission: COMPLIANCE.VIEW (read), COMPLIANCE.MANAGE (write)
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import {
  listPostMortems,
  updatePostMortem,
  approvePostMortem,
  type PostMortemStatus,
} from '@/lib/governance-resilience-service';

export const dynamic = 'force-dynamic';

/**
 * GET - List post-mortems
 */
export async function GET(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  
  const hasView = await hasPermission(session, PERMISSIONS.COMPLIANCE_VIEW);
  const hasAdmin = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasView && !hasAdmin) {
    const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, request);
    if (err) return err;
  }

  try {
    const url = new URL(request.url);
    const status = url.searchParams.get('status') as PostMortemStatus | null;
    
    const postmortems = listPostMortems(status ?? undefined);
    
    return NextResponse.json({
      postmortems,
      pending_count: postmortems.filter(p => p.status === 'pending').length,
      overdue_count: postmortems.filter(p => p.status === 'overdue').length,
      total_count: postmortems.length,
    });
  } catch (error) {
    console.error('[compliance/postmortems] GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list post-mortems' } },
      { status: 500 }
    );
  }
}

/**
 * POST - Update or approve post-mortem
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  
  const hasManage = await hasPermission(session, PERMISSIONS.COMPLIANCE_MANAGE);
  const hasAdmin = hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasManage && !hasAdmin) {
    const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_MANAGE, request);
    if (err) return err;
  }

  try {
    const body = await request.json();
    const action = body.action as 'update' | 'approve';
    const userId = (session?.user?.id as string) ?? 'unknown';
    
    if (!body.postmortem_id) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'postmortem_id required' } },
        { status: 400 }
      );
    }
    
    if (action === 'update') {
      const pm = updatePostMortem(body.postmortem_id, {
        assigned_to: body.assigned_to,
        findings: body.findings,
        root_cause: body.root_cause,
        remediation: body.remediation,
        status: body.status,
      }, userId);
      
      if (!pm) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Post-mortem not found' } },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        postmortem: pm,
        message: 'Post-mortem updated',
      });
      
    } else if (action === 'approve') {
      const pm = approvePostMortem(body.postmortem_id, userId);
      
      if (!pm) {
        return NextResponse.json(
          { error: { code: 'NOT_FOUND', message: 'Post-mortem not found' } },
          { status: 404 }
        );
      }
      
      return NextResponse.json({
        success: true,
        postmortem: pm,
        message: 'Post-mortem approved',
      });
      
    } else {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Invalid action. Use update or approve.' } },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[compliance/postmortems] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
