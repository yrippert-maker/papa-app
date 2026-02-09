/**
 * GET /api/v1/docs/download?doc_id=MM-01 — скачать DOCX файл.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const DOCUMENTS_FOLDER = 'Новая папка';
const INDEX_FILE = 'DOCUMENT_INDEX.json';

function loadIndex(): { docs: Array<{ doc_id: string; file_path?: string }> } | null {
  const indexPath = join(process.cwd(), DOCUMENTS_FOLDER, INDEX_FILE);
  if (!existsSync(indexPath)) return null;
  return JSON.parse(readFileSync(indexPath, 'utf-8'));
}

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get('doc_id');
  if (!docId) return NextResponse.json({ error: 'missing doc_id' }, { status: 400 });

  const index = loadIndex();
  if (!index) return NextResponse.json({ error: 'Document index not found' }, { status: 404 });

  const doc = (index.docs || []).find((d) => d.doc_id === docId);
  if (!doc?.file_path) return NextResponse.json({ error: 'Document file not found' }, { status: 404 });

  const filePath = join(process.cwd(), DOCUMENTS_FOLDER, doc.file_path);
  if (!existsSync(filePath)) return NextResponse.json({ error: 'File not found' }, { status: 404 });

  const buf = readFileSync(filePath);
  return new NextResponse(buf, {
    headers: {
      'Content-Type': 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'Content-Disposition': `attachment; filename="${docId}.docx"`,
    },
  });
}
