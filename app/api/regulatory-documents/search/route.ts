/**
 * GET /api/regulatory-documents/search?q=... — полнотекстовый поиск
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
    const { searchParams } = new URL(req.url);
    const q = searchParams.get('q')?.trim();
    const regulator = searchParams.get('regulator');
    const category = searchParams.get('category');
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '20', 10) || 20, 50);

    const where: Record<string, unknown> = { status: 'active' };
    if (regulator) where.regulator = regulator;
    if (category) where.category = category;
    if (tags?.length) where.tags = { hasSome: tags };

    if (q && q.length >= 2) {
      where.OR = [
        { titleEn: { contains: q, mode: 'insensitive' } },
        { titleRu: { contains: q, mode: 'insensitive' } },
        { annotationRu: { contains: q, mode: 'insensitive' } },
      ];
    }

    const documents = await prisma.regulatoryDocument.findMany({
      where,
      orderBy: [{ regulator: 'asc' }, { titleEn: 'asc' }],
      take: limit,
      select: {
        id: true,
        regulator: true,
        category: true,
        titleEn: true,
        titleRu: true,
        annotationRu: true,
        edition: true,
        languages: true,
        hasRussianOfficial: true,
        sourceUrl: true,
        tags: true,
        status: true,
      },
    });

    return NextResponse.json({ documents });
  } catch (e) {
    return internalError('[regulatory-documents/search]', e, req?.headers);
  }
}
