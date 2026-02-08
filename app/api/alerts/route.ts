/**
 * GET /api/alerts
 * Список предупреждений для Dashboard.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getAlerts } from '@/lib/alerts-service';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, req);
  if (err) return err;

  try {
    const { searchParams } = new URL(req.url);
    const limit = parseInt(searchParams.get('limit') ?? '12', 10);
    const alerts = await getAlerts(limit);
    return NextResponse.json({ alerts });
  } catch (e) {
    return internalError('[alerts]', e, req?.headers);
  }
}
