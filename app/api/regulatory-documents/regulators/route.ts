/**
 * GET /api/regulatory-documents/regulators — список регуляторов с количеством документов
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, req);
  if (err) return err;

  try {
    const result = await prisma.regulatoryDocument.groupBy({
      by: ['regulator'],
      where: { status: 'active' },
      _count: { id: true },
    });
    const regulators = result.map((r) => ({ regulator: r.regulator, count: r._count.id }));
    return NextResponse.json({ regulators });
  } catch (e) {
    return internalError('[regulatory-documents/regulators]', e, req?.headers);
  }
}
