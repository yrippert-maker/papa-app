/**
 * GET/POST /api/compliance/anomalies
 * Anomaly detection and acknowledgment.
 * Permission: COMPLIANCE.VIEW (read), COMPLIANCE.MANAGE (acknowledge)
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import {
  detectAnomalies,
  listAnomalies,
  acknowledgeAnomaly,
  getApproverStats,
} from '@/lib/governance-resilience-service';

export const dynamic = 'force-dynamic';

/**
 * GET - List anomalies or run detection
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
    const action = url.searchParams.get('action');
    const acknowledged = url.searchParams.get('acknowledged');
    
    if (action === 'detect') {
      // Run detection
      const newAnomalies = await detectAnomalies();
      return NextResponse.json({
        new_anomalies: newAnomalies,
        new_count: newAnomalies.length,
      });
    }
    
    if (action === 'approver-stats') {
      const stats = getApproverStats();
      return NextResponse.json({ stats });
    }
    
    // List anomalies
    const ack = acknowledged === 'true' ? true : acknowledged === 'false' ? false : undefined;
    const anomalies = listAnomalies(ack);
    
    return NextResponse.json({
      anomalies,
      unacknowledged_count: anomalies.filter(a => !a.acknowledged).length,
      total_count: anomalies.length,
    });
  } catch (error) {
    console.error('[compliance/anomalies] GET error:', error);
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message: 'Failed to list anomalies' } },
      { status: 500 }
    );
  }
}

/**
 * POST - Acknowledge anomaly
 */
export async function POST(request: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  
  const hasManage = await hasPermission(session, PERMISSIONS.COMPLIANCE_MANAGE);
  const hasAdmin = await hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  
  if (!hasManage && !hasAdmin) {
    const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_MANAGE, request);
    if (err) return err;
  }

  try {
    const body = await request.json();
    const userId = (session?.user?.id as string) ?? 'unknown';
    
    if (!body.alert_id) {
      return NextResponse.json(
        { error: { code: 'BAD_REQUEST', message: 'alert_id required' } },
        { status: 400 }
      );
    }
    
    const alert = acknowledgeAnomaly(body.alert_id, userId);
    
    if (!alert) {
      return NextResponse.json(
        { error: { code: 'NOT_FOUND', message: 'Anomaly not found' } },
        { status: 404 }
      );
    }
    
    return NextResponse.json({
      success: true,
      alert,
      message: 'Anomaly acknowledged',
    });
  } catch (error) {
    console.error('[compliance/anomalies] POST error:', error);
    const message = error instanceof Error ? error.message : 'Failed to acknowledge';
    return NextResponse.json(
      { error: { code: 'INTERNAL_ERROR', message } },
      { status: 500 }
    );
  }
}
