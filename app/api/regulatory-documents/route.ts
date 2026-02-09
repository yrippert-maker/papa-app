/**
 * GET /api/regulatory-documents — список регуляторных документов МРО
 * POST /api/regulatory-documents — добавить документ (admin)
 * ТЗ: Модуль «Документы» — Библиотека регуляторных документов МРО
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS, hasPermission } from '@/lib/authz';
import { prisma } from '@/lib/prisma';
import { internalError } from '@/lib/api/error-response';

export const dynamic = 'force-dynamic';

const REGULATORS = ['ICAO', 'EASA', 'FAA', 'ARMAK', 'GCAA'] as const;
const CATEGORIES = ['annex', 'part', 'cfr', 'ac', 'car', 'caap', 'manual', 'guide', 'concept', 'rules', 'pans'] as const;

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.COMPLIANCE_VIEW, req);
  if (err) return err;

  try {
    const { searchParams } = new URL(req.url);
    const regulator = searchParams.get('regulator') as (typeof REGULATORS)[number] | null;
    const category = searchParams.get('category') as (typeof CATEGORIES)[number] | null;
    const tags = searchParams.get('tags')?.split(',').filter(Boolean);
    const language = searchParams.get('language');
    const status = searchParams.get('status') ?? 'active';
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '50', 10) || 50, 100);
    const offset = parseInt(searchParams.get('offset') ?? '0', 10) || 0;

    const where: Record<string, unknown> = {};
    if (regulator && REGULATORS.includes(regulator)) where.regulator = regulator;
    if (category && CATEGORIES.includes(category)) where.category = category;
    if (status) where.status = status;
    if (tags?.length) where.tags = { hasSome: tags };
    if (language) where.languages = { has: language.toUpperCase() };

    const [documents, total] = await Promise.all([
      prisma.regulatoryDocument.findMany({
        where,
        orderBy: [{ regulator: 'asc' }, { titleEn: 'asc' }],
        take: limit,
        skip: offset,
        select: {
          id: true,
          regulator: true,
          category: true,
          titleEn: true,
          titleRu: true,
          annotationRu: true,
          edition: true,
          effectiveDate: true,
          languages: true,
          hasRussianOfficial: true,
          sourceUrl: true,
          pdfPath: true,
          pdfPathRu: true,
          fileSizeMb: true,
          sha256: true,
          tags: true,
          relevance: true,
          status: true,
          lastChecked: true,
        },
      }),
      prisma.regulatoryDocument.count({ where }),
    ]);

    return NextResponse.json({ total, documents });
  } catch (e) {
    return internalError('[regulatory-documents]', e, req?.headers);
  }
}

export async function POST(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const hasAdmin = await hasPermission(session, PERMISSIONS.ADMIN_MANAGE_USERS);
  if (!hasAdmin) {
    const err = await requirePermission(session, PERMISSIONS.ADMIN_MANAGE_USERS, req);
    if (err) return err;
  }

  try {
    const body = await req.json();
    const doc = await prisma.regulatoryDocument.create({
      data: {
        regulator: body.regulator,
        category: body.category,
        titleEn: body.titleEn,
        titleRu: body.titleRu ?? null,
        annotationRu: body.annotationRu ?? '',
        edition: body.edition ?? 'current',
        effectiveDate: body.effectiveDate ? new Date(body.effectiveDate) : null,
        languages: body.languages ?? ['EN'],
        hasRussianOfficial: body.hasRussianOfficial ?? false,
        sourceUrl: body.sourceUrl,
        tags: body.tags ?? [],
        relevance: body.relevance ?? 'important',
        status: body.status ?? 'active',
      },
    });
    return NextResponse.json(doc);
  } catch (e) {
    return internalError('[regulatory-documents POST]', e, req?.headers);
  }
}
