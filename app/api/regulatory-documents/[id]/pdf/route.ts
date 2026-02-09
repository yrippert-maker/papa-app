/**
 * GET /api/regulatory-documents/:id/pdf — отдача PDF или редирект на источник
 * Параметр ?lang=en|ru — выбор версии (если доступна pdfPathRu)
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { readFile } from 'fs/promises';
import { join } from 'path';
import { existsSync } from 'fs';

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
    const { searchParams } = new URL(req.url);
    const lang = searchParams.get('lang') ?? 'en';

    const doc = await prisma.regulatoryDocument.findUnique({ where: { id } });
    if (!doc) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const pdfPath = lang === 'ru' && doc.pdfPathRu ? doc.pdfPathRu : doc.pdfPath;

    if (pdfPath) {
      // Локальный файл: относительный путь от data/regulatory-docs/
      const baseDir = process.env.REGULATORY_DOCS_PATH ?? join(process.cwd(), 'data', 'regulatory-docs');
      const fullPath = join(baseDir, pdfPath.startsWith('/') ? pdfPath.slice(1) : pdfPath);
      if (existsSync(fullPath)) {
        const buf = await readFile(fullPath);
        return new NextResponse(buf, {
          headers: {
            'Content-Type': 'application/pdf',
            'Content-Disposition': `inline; filename="${encodeURIComponent(doc.titleEn.slice(0, 50))}.pdf"`,
          },
        });
      }
    }

    // Файла нет — редирект на официальный источник
    return NextResponse.redirect(doc.sourceUrl, { status: 302 });
  } catch (e) {
    console.error('[regulatory-documents/pdf]', e);
    return NextResponse.json({ error: 'Internal error' }, { status: 500 });
  }
}
