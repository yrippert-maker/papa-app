/**
 * GET/POST /api/compliance/break-glass
 * Emergency override for key operations (bypasses 2-man rule).
 * Requires ADMIN.MANAGE_USERS permission.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import {
  activateBreakGlass,
  deactivateBreakGlass,
  getBreakGlassState,
  isBreakGlassActive,
} from '@/lib/key-lifecycle-service';

export const dynamic = 'force-dynamic';

/**
 * GET - Get break-glass status
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
    const active = await isBreakGlassActive();
    
    if (!active) {
      return NextResponse.json({ active: false, state: null });
    }
    
    const state = await getBreakGlassState();
    if (!state) {
      return NextResponse.json({ active: false, state: null });
    }
    
    return NextResponse.json({
      active: true,
      state: {
        activated_by: state.activated_by,
        activated_at: state.activated_at,
        expires_at: state.expires_at,
        reason: state.reason,
        actions_count: state.actions_taken.length,
      },
    });
  } catch (error) {
    console.error('[compliance/break-glass] GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to get status' } },
      { status: 500 }
    );
  }
}

/**
 * POST - Activate or deactivate break-glass
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  
  // Only ADMIN can activate break-glass
  const hasAdmin = await hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasAdmin) {
    const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, request);
    if (err) return err;
  }

  try {
    const body = await request.json();
    const action = body.action as 'activate' | 'deactivate';
    const userId = (session?.user?.id as string) ?? 'unknown';
    
    if (action === 'activate') {
      const reason = body.reason;
      if (!reason || typeof reason !== 'string' || reason.length < 10) {
        return NextResponse.json(
          { error: { code: 'BAD_REQUEST', message: 'Reason required (min 10 chars)' } },
          { status: 400 }
        );
      }
      
      const state = await activateBreakGlass(userId, reason);
      
      return NextResponse.json({
        success: true,
        message: 'Break-glass activated. 2-man rule bypassed for 4 hours.',
        state: {
          activated_at: state?.activated_at,
          expires_at: state?.expires_at,
          reason: state?.reason,
        },
      });
      
    } else if (action === 'deactivate') {
      await deactivateBreakGlass(userId, body.reason);
      
      return NextResponse.json({
        success: true,
        message: 'Break-glass deactivated.',
      });
      
    } else {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'Invalid action. Use activate or deactivate.' } },
        { status: 400 }
      );
    }
  } catch (error) {
    console.error('[compliance/break-glass] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
