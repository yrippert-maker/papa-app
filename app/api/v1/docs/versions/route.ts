/**
 * GET /api/v1/docs/versions?doc_id=...&limit=100 — история версий документа.
 * Поддерживает doc_id=mura-menasa/handbook (возвращает versions для всех docs).
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, existsSync, statSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

const DOCUMENTS_FOLDER = 'Новая папка';
const INDEX_FILE = 'DOCUMENT_INDEX.json';

interface DocEntry {
  doc_id: string;
  title: string;
  edition?: string;
  effective_date?: string;
  file_path?: string;
  [key: string]: unknown;
}

interface DocVersion {
  key: string;
  version?: number;
  edition?: string;
  effective_date?: string;
  sha256?: string | null;
  file_size_bytes?: number | null;
  last_modified?: string;
  uploaded_at?: string;
}

function loadIndex(): { docs: DocEntry[] } | null {
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

  const versions: DocVersion[] = [];

  // Store view: aggregate versions from all docs
  if (docId === 'mura-menasa/handbook') {
    for (const doc of index.docs || []) {
      if (doc.file_path) {
        const filePath = join(process.cwd(), DOCUMENTS_FOLDER, doc.file_path);
        if (existsSync(filePath)) {
          const buf = readFileSync(filePath);
          const stat = statSync(filePath);
          versions.push({
            key: doc.file_path as string,
            version: 1,
            edition: doc.edition as string,
            effective_date: doc.effective_date as string,
            sha256: createHash('sha256').update(buf).digest('hex'),
            file_size_bytes: stat.size,
            last_modified: stat.mtime.toISOString(),
            uploaded_at: stat.mtime.toISOString(),
          });
        }
      }
    }
    return NextResponse.json({ doc_id: docId, versions });
  }

  const doc = (index.docs || []).find((d: DocEntry) => d.doc_id === docId);
  if (!doc) {
    return NextResponse.json({ error: `Document ${docId} not found` }, { status: 404 });
  }

  if (doc.file_path) {
    const filePath = join(process.cwd(), DOCUMENTS_FOLDER, doc.file_path);
    if (existsSync(filePath)) {
      const buf = readFileSync(filePath);
      const stat = statSync(filePath);
      versions.push({
        key: doc.file_path as string,
        version: 1,
        edition: doc.edition as string,
        effective_date: doc.effective_date as string,
        sha256: createHash('sha256').update(buf).digest('hex'),
        file_size_bytes: stat.size,
        last_modified: stat.mtime.toISOString(),
        uploaded_at: stat.mtime.toISOString(),
      });
    }
  }

  return NextResponse.json({ doc_id: docId, versions });
}
