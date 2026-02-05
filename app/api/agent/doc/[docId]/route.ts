/**
 * GET /api/agent/doc/:docId
 * Возвращает метаданные документа и опционально стримит файл (?download=1).
 * ?format=text&source=effective|original|override — JSON { content }.
 * ?format=text&raw=1 или Accept: text/plain — text/plain.
 * Для EvidenceMap: клик → источник.
 */
import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { getAgentDb } from '@/lib/agent/db';
import { getDocsRootForPath } from '@/lib/docs-agent-config';
import fs from 'node:fs/promises';
import path from 'node:path';

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function isValidUuid(s: string): boolean {
  return typeof s === 'string' && UUID_REGEX.test(s);
}

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.FILES_LIST, request);
  if (err) return err;

  const { docId } = await params;
  if (!isValidUuid(docId)) {
    return NextResponse.json({ error: 'Invalid docId format (expected UUID)' }, { status: 400 });
  }

  const url = new URL(request.url);
  const download = url.searchParams.get('download') === '1';
  const formatText = url.searchParams.get('format') === 'text';
  const source = (url.searchParams.get('source') || 'effective') as 'original' | 'override' | 'effective';
  const wantPlain =
    request.headers.get('accept')?.includes('text/plain') || url.searchParams.get('raw') === '1';

  try {
    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL required' }, { status: 400 });
    }

    const pool = await getAgentDb();
    const r = await pool.query(
      'SELECT id, path, filename, sha256, ext, extracted_text FROM agent_docs WHERE id = $1',
      [docId]
    );
    const doc = r.rows[0];
    if (!doc) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    const relPath = doc.path as string;
    const pathRoot = getDocsRootForPath(relPath);
    const fullPath = path.join(pathRoot, relPath);
    const resolved = path.resolve(fullPath);
    const rootResolved = path.resolve(pathRoot);
    if (!resolved.startsWith(rootResolved)) {
      return NextResponse.json({ error: 'Invalid path' }, { status: 403 });
    }

    // Override (если таблица есть)
    let override: { exists: boolean; updatedAt?: string; updatedBy?: string; contentPreview?: string } | undefined;
    let hasOverride = false;
    try {
      const ovRes = await pool.query(
        'SELECT content_text, updated_by, updated_at FROM agent_doc_override WHERE doc_id = $1',
        [docId]
      );
      const ov = ovRes.rows[0];
      hasOverride = !!ov;
      if (ov) {
        const content = String(ov.content_text ?? '');
        override = {
          exists: true,
          updatedAt: ov.updated_at,
          updatedBy: ov.updated_by,
          contentPreview: content.slice(0, 200),
        };
      } else {
        override = { exists: false };
      }
    } catch {
      override = { exists: false };
    }

    if (formatText) {
      let content = '';
      if (source === 'override') {
        if (!hasOverride) {
          return NextResponse.json({ error: 'Override not found' }, { status: 404 });
        }
        const ovRes = await pool.query('SELECT content_text FROM agent_doc_override WHERE doc_id = $1', [docId]);
        content = String(ovRes.rows[0]?.content_text ?? '');
      } else if (source === 'effective' && hasOverride) {
        const ovRes = await pool.query('SELECT content_text FROM agent_doc_override WHERE doc_id = $1', [docId]);
        content = String(ovRes.rows[0]?.content_text ?? '');
      } else {
        const ext = String(doc.ext ?? '').toLowerCase().replace(/^\./, '');
        if (['txt', 'md'].includes(ext)) {
          try {
            content = (await fs.readFile(resolved, 'utf8')).trim();
          } catch {
            content = (doc.extracted_text as string) ?? '';
          }
        } else {
          content = (doc.extracted_text as string) ?? '';
        }
      }
      if (wantPlain) {
        const docSource = source === 'override' || (source === 'effective' && hasOverride) ? 'override' : 'original';
        return new NextResponse(content, {
          status: 200,
          headers: {
            'Content-Type': 'text/plain; charset=utf-8',
            'X-Doc-Source': docSource,
          },
        });
      }
      return NextResponse.json({ content });
    }

    if (!download) {
      const chunkRes = await pool.query(
        'SELECT id, content FROM agent_doc_chunks WHERE doc_id = $1 ORDER BY idx LIMIT 3',
        [docId]
      );
      return NextResponse.json({
        docId,
        path: relPath,
        filename: doc.filename,
        sha256: doc.sha256,
        chunks: chunkRes.rows.map((row) => ({
          chunkId: row.id,
          snippet: String(row.content ?? '').slice(0, 200),
        })),
        override,
      });
    }

    const buf = await fs.readFile(resolved);
    const ext = (doc.ext as string) || 'bin';
    const mime: Record<string, string> = {
      pdf: 'application/pdf',
      docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      txt: 'text/plain',
      md: 'text/markdown',
    };

    return new NextResponse(buf, {
      headers: {
        'Content-Type': mime[ext] ?? 'application/octet-stream',
        'Content-Disposition': `inline; filename="${doc.filename}"`,
      },
    });
  } catch (e) {
    console.error('[agent/doc]', e);
    return NextResponse.json({ error: 'Failed to fetch document' }, { status: 500 });
  }
}

/**
 * PATCH /api/agent/doc/:docId
 * Сохраняет оверлей правок (agent_doc_override). RBAC: DOC.EDIT.
 */
export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ docId: string }> }
): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.DOC_EDIT, request);
  if (err) return err;

  const { docId } = await params;
  if (!isValidUuid(docId)) {
    return NextResponse.json({ error: 'Invalid docId format (expected UUID)' }, { status: 400 });
  }
  try {
    const body = await request.json();
    const content = typeof body.content === 'string' ? body.content : '';
    if (content.trim().length === 0) {
      return NextResponse.json({ error: 'Content must not be empty' }, { status: 400 });
    }
    const updatedBy = (session?.user?.email as string) ?? 'anonymous';

    if (!process.env.DATABASE_URL) {
      return NextResponse.json({ error: 'DATABASE_URL required' }, { status: 400 });
    }

    const pool = await getAgentDb();
    const docCheck = await pool.query('SELECT id FROM agent_docs WHERE id = $1', [docId]);
    if (docCheck.rows.length === 0) {
      return NextResponse.json({ error: 'Document not found' }, { status: 404 });
    }

    await pool.query(
      `INSERT INTO agent_doc_override (doc_id, content_text, updated_by, updated_at)
       VALUES ($1, $2, $3, now())
       ON CONFLICT (doc_id) DO UPDATE SET
         content_text = EXCLUDED.content_text,
         updated_by = EXCLUDED.updated_by,
         updated_at = now()`,
      [docId, content, updatedBy]
    );

    const r = await pool.query('SELECT updated_at, updated_by FROM agent_doc_override WHERE doc_id = $1', [docId]);
    const row = r.rows[0];
    const updatedAt = row?.updated_at ?? new Date().toISOString();
    const updatedByResp = row?.updated_by ?? updatedBy;

    return NextResponse.json({ ok: true, updatedAt, updatedBy: updatedByResp });
  } catch (e) {
    console.error('[agent/doc PATCH]', e);
    return NextResponse.json({ error: 'Failed to save' }, { status: 500 });
  }
}
