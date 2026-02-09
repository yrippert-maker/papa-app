/**
 * GET /api/v1/docs/list — список doc_id из Document Store.
 * Читает DOCUMENT_INDEX.json (Новая папка/) и возвращает массив doc_ids.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const DOCUMENTS_FOLDER = 'Новая папка';
const INDEX_FILE = 'DOCUMENT_INDEX.json';

function loadIndex(): { docs: DocEntry[] } | null {
  const indexPath = join(process.cwd(), DOCUMENTS_FOLDER, INDEX_FILE);
  if (!existsSync(indexPath)) return null;
  return JSON.parse(readFileSync(indexPath, 'utf-8'));
}

interface DocEntry {
  doc_id: string;
  title: string;
  [key: string]: unknown;
}

export async function GET(_req: NextRequest) {
  const index = loadIndex();
  if (!index) {
    return NextResponse.json({ doc_ids: [], error: 'Document index not found' }, { status: 404 });
  }
  const doc_ids = (index.docs || []).map((d: DocEntry) => d.doc_id);
  return NextResponse.json({ doc_ids });
}
