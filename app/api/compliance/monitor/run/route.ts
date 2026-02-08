/**
 * POST /api/compliance/monitor/run
 * Запускает сбор/дифф compliance monitor.
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { createTestChangeEvent } from '@/lib/compliance-inbox-service';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_MANAGE, req);
  if (err) return err;

  try {
    const event = await createTestChangeEvent();
    return NextResponse.json({
      ok: true,
      created: event.id,
      message: 'Monitor run complete (test event). Real source parsing — next iteration.',
    });
  } catch (e) {
    return internalError('[compliance/monitor/run]', e, req?.headers);
  }
}
