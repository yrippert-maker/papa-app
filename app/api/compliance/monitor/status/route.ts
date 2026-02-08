/**
 * GET /api/compliance/monitor/status
 * Когда последний run, сколько новых items.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getMonitorStatus } from '@/lib/compliance-inbox-service';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, req);
  if (err) return err;

  try {
    const status = await getMonitorStatus();
    return NextResponse.json(status);
  } catch (e) {
    return internalError('[compliance/monitor/status]', e, req?.headers);
  }
}
