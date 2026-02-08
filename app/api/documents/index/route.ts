/**
 * GET /api/documents/index
 * Возвращает индекс документов Mura Menasa, АРМАК, ПАПА с внутренними связями.
 * Источник: Новая папка/DOCUMENT_INDEX.json
 */
import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';
import { internalError } from '@/lib/api/error-response';

const DOCUMENTS_FOLDER = 'Новая папка';
const INDEX_FILE = 'DOCUMENT_INDEX.json';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.DOC_VIEW, req);
  if (err) return err;

  try {
    const root = process.cwd();
    const indexPath = join(root, DOCUMENTS_FOLDER, INDEX_FILE);

    if (!existsSync(indexPath)) {
      return NextResponse.json(
        { error: 'Document index not found', path: DOCUMENTS_FOLDER },
        { status: 404 }
      );
    }

    const content = readFileSync(indexPath, 'utf-8');
    const index = JSON.parse(content);
    return NextResponse.json(index);
  } catch (e) {
    return internalError('[documents/index]', e, req?.headers);
  }
}
