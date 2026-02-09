/**
 * POST /api/v1/docs/upload — загрузка новой версии документа в Document Store.
 */
import { NextRequest, NextResponse } from 'next/server';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

export const dynamic = 'force-dynamic';

const DOCUMENTS_FOLDER = 'Новая папка';
const INDEX_FILE = 'DOCUMENT_INDEX.json';
const MAX_FILE_SIZE = 50 * 1024 * 1024; // 50 MB

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

function loadIndex(): { docs: DocEntry[] } {
  const indexPath = join(process.cwd(), DOCUMENTS_FOLDER, INDEX_FILE);
  if (!existsSync(indexPath)) return { docs: [] };
  return JSON.parse(readFileSync(indexPath, 'utf-8'));
}

function saveIndex(data: { docs: DocEntry[] }) {
  const dir = join(process.cwd(), DOCUMENTS_FOLDER);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  const indexPath = join(dir, INDEX_FILE);
  writeFileSync(indexPath, JSON.stringify(data, null, 2), 'utf-8');
}

export async function POST(req: NextRequest) {
  const apiKey = req.headers.get('x-api-key');
  const expectedKey = (process.env.PORTAL_API_KEY || '').trim();
  if (expectedKey && apiKey !== expectedKey) {
    return NextResponse.json({ error: 'Invalid API key' }, { status: 401 });
  }

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    const docId = formData.get('doc_id') as string | null;
    const title = formData.get('title') as string | null;

    if (!docId || !title) {
      return NextResponse.json({ error: 'Missing doc_id or title' }, { status: 400 });
    }

    const dir = join(process.cwd(), DOCUMENTS_FOLDER);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    let filePath: string | undefined;
    let sha256: string | undefined;
    let fileSizeBytes: number | undefined;

    if (file) {
      if (file.size > MAX_FILE_SIZE) {
        return NextResponse.json({ error: 'File too large (max 50MB)' }, { status: 400 });
      }
      const safeName = file.name.replace(/[^a-zA-Z0-9._\-\u0400-\u04FF]/g, '_');
      const fileName = `${docId}_${safeName}`;
      filePath = fileName;
      const absPath = join(dir, fileName);
      const buf = Buffer.from(await file.arrayBuffer());
      writeFileSync(absPath, buf);
      sha256 = createHash('sha256').update(buf).digest('hex');
      fileSizeBytes = buf.length;
    }

    const index = loadIndex();
    const existing = index.docs.findIndex((d) => d.doc_id === docId);

    const entry: DocEntry = {
      doc_id: docId,
      title,
      title_en: (formData.get('title_en') as string) || undefined,
      edition: (formData.get('edition') as string) || undefined,
      effective_date: (formData.get('effective_date') as string) || new Date().toISOString().split('T')[0],
      category: (formData.get('category') as string) || undefined,
      approved_by: (formData.get('approved_by') as string) || undefined,
      status: (formData.get('status') as string) || 'active',
      has_remarks: formData.get('has_remarks') === 'true',
      remarks: (formData.get('remarks') as string) || undefined,
      annotation_ru: (formData.get('annotation_ru') as string) || undefined,
      file_path: filePath,
      sections: formData.get('sections') ? JSON.parse(formData.get('sections') as string) : undefined,
    };

    if (existing >= 0) {
      index.docs[existing] = { ...index.docs[existing], ...entry };
    } else {
      index.docs.push(entry);
    }

    saveIndex(index);

    return NextResponse.json({
      ok: true,
      doc_id: docId,
      file_path: filePath,
      sha256,
      file_size_bytes: fileSizeBytes,
    });
  } catch (e) {
    console.error('[v1/docs/upload]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 },
    );
  }
}
