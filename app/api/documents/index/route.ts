/**
 * GET /api/documents/index
 * Возвращает индекс документов Mura Menasa, АРМАК, ПАПА с внутренними связями.
 * Источник: Новая папка/DOCUMENT_INDEX.json
 */
import { NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

const DOCUMENTS_FOLDER = 'Новая папка';
const INDEX_FILE = 'DOCUMENT_INDEX.json';

export const dynamic = 'force-dynamic';

export async function GET() {
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
    const message = e instanceof Error ? e.message : 'Unknown error';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
