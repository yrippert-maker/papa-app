/**
 * GET /api/regulatory-documents/:id — метаданные документа
 * PUT /api/regulatory-documents/:id — обновить (admin)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, req);
  if (err) return err;

  try {
    const { id } = await params;
    const doc = await prisma.regulatoryDocument.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json(doc);
  } catch (e) {
    return internalError('[regulatory-documents/:id]', e, req?.headers);
  }
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const session = await getServerSession(authOptions);
  const hasAdmin = await hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  if (!hasAdmin) {
    const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, req);
    if (err) return err;
  }

  try {
    const { id } = await params;
    const body = await req.json();
    const update: Record<string, unknown> = {};
    const allowed = ['titleRu', 'annotationRu', 'edition', 'effectiveDate', 'languages', 'hasRussianOfficial', 'sourceUrl', 'pdfPath', 'pdfPathRu', 'fileSizeMb', 'sha256', 'tags', 'relevance', 'status', 'lastChecked', 'notes'];
    for (const k of allowed) {
      if (body[k] !== undefined) update[k] = body[k];
    }
    if (body.effectiveDate) update.effectiveDate = new Date(body.effectiveDate);
    if (body.lastChecked) update.lastChecked = new Date(body.lastChecked);

    const doc = await prisma.regulatoryDocument.update({
      where: { id },
      data: update,
    });
    return NextResponse.json(doc);
  } catch (e) {
    return internalError('[regulatory-documents/:id PUT]', e, req?.headers);
  }
}
