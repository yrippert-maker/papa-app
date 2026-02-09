/**
 * GET /api/v1/docs/get?doc_id=... — содержимое документа из Document Store.
 * Поддерживает doc_id=MM-01..MM-04 или doc_id=mura-menasa/handbook (возвращает индекс).
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

const DOCUMENTS_FOLDER = 'Новая папка';
const INDEX_FILE = 'DOCUMENT_INDEX.json';

interface DocEntry {
  doc_id: string;
  title: string;
  title_en?: string;
  edition?: string;
  effective_date?: string;
  category?: string;
  approved_by?: string;
  status?: string;
  has_remarks?: boolean;
  remarks?: string;
  annotation_ru?: string;
  file_path?: string;
  sections?: string[];
  [key: string]: unknown;
}

function loadIndex(): { store?: string; docs: DocEntry[] } | null {
  const indexPath = join(process.cwd(), DOCUMENTS_FOLDER, INDEX_FILE);
  if (!existsSync(indexPath)) return null;
  return JSON.parse(readFileSync(indexPath, 'utf-8'));
}

export async function GET(req: NextRequest) {
  const docId = req.nextUrl.searchParams.get('doc_id');
  if (!docId) {
    return NextResponse.json({ error: 'missing doc_id' }, { status: 400 });
  }

  const index = loadIndex();
  if (!index) {
    return NextResponse.json({ error: 'Document index not found' }, { status: 404 });
  }

  // Store view: doc_id = mura-menasa/handbook
  if (docId === 'mura-menasa/handbook' || docId === index.store) {
    return NextResponse.json({
      doc_id: docId,
      content: { store: index.store || docId, docs: index.docs || [] },
      format: 'json',
    });
  }

  const doc = (index.docs || []).find((d: DocEntry) => d.doc_id === docId);
  if (!doc) {
    return NextResponse.json({ error: `Document ${docId} not found` }, { status: 404 });
  }

  let content: string | null = null;
  let format = 'text';

  if (doc.file_path) {
    const filePath = join(process.cwd(), DOCUMENTS_FOLDER, doc.file_path);
    if (existsSync(filePath)) {
      const buf = readFileSync(filePath);
      content = buf.toString('base64');
      format = 'docx';
    }
  }

  if (!content && doc.annotation_ru) {
    content = doc.annotation_ru;
    format = 'text';
  }

  return NextResponse.json({
    doc_id: doc.doc_id,
    title: doc.title,
    title_en: doc.title_en,
    edition: doc.edition,
    effective_date: doc.effective_date,
    category: doc.category,
    approved_by: doc.approved_by,
    status: doc.status,
    has_remarks: doc.has_remarks,
    remarks: doc.remarks,
    sections: doc.sections,
    content,
    format,
  });
}
