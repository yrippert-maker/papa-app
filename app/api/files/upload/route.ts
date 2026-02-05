import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';
import { authOptions } from '@/lib/auth-options';
import { WORKSPACE_ROOT } from '@/lib/config';
import { getDb, withRetry, dbGet, dbRun } from '@/lib/db';
import { computeEventHash, canonicalJSON } from '@/lib/ledger-hash';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest, rateLimitError } from '@/lib/api/error-response';
import { checkRateLimit, getClientKey } from '@/lib/rate-limit';
import { queueAgentIngest } from '@/lib/agent/ingest-queue';

const AI_INBOX_DIR = 'ai-inbox';
const MAX_FILE_SIZE_BYTES = 50 * 1024 * 1024; // 50 MB
const ALLOWED_EXTENSIONS = new Set([
  'pdf', 'doc', 'docx', 'xls', 'xlsx', 'png', 'jpg', 'jpeg', 'txt', 'json', 'xml',
]);
const DANGEROUS_EXTENSIONS = new Set([
  'exe', 'bat', 'cmd', 'sh', 'ps1', 'vbs', 'scr', 'msi', 'com', 'pif',
]);

export const dynamic = 'force-dynamic';

const WRITE_RATE_LIMIT = { windowMs: 60_000, max: 30 };

function isAllowedFile(name: string, size: number): { ok: true } | { ok: false; error: string } {
  if (size > MAX_FILE_SIZE_BYTES) {
    return { ok: false, error: `File too large (max ${MAX_FILE_SIZE_BYTES / 1024 / 1024} MB)` };
  }
  const parts = name.split('.');
  const ext = parts.pop()?.toLowerCase();
  if (ext && !ALLOWED_EXTENSIONS.has(ext)) {
    return { ok: false, error: `File type .${ext} not allowed` };
  }
  if (parts.length >= 1) {
    for (const p of parts) {
      if (DANGEROUS_EXTENSIONS.has(p.toLowerCase())) {
        return { ok: false, error: 'Double extension or dangerous filename not allowed' };
      }
    }
  }
  return { ok: true };
}

export async function POST(req: Request): Promise<Response> {
  const key = `files-upload:${getClientKey(req)}`;
  const { allowed, retryAfterMs } = checkRateLimit(key, WRITE_RATE_LIMIT);
  if (!allowed) {
    return rateLimitError(
      'Too many requests',
      req.headers,
      retryAfterMs ? Math.ceil(retryAfterMs / 1000) : undefined
    );
  }

  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.FILES_UPLOAD, req);
  if (err) return err;

  try {
    const formData = await req.formData();
    const file = formData.get('file') as File | null;
    if (!file) return badRequest('Missing file', req.headers);

    const check = isAllowedFile(file.name, file.size);
    if (!check.ok) return badRequest(check.error, req.headers);

    const dir = join(WORKSPACE_ROOT, AI_INBOX_DIR);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });

    const base = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
    const relPath = `${AI_INBOX_DIR}/${Date.now()}_${base}`;
    const absPath = join(WORKSPACE_ROOT, relPath);
    const buf = Buffer.from(await file.arrayBuffer());
    writeFileSync(absPath, buf);
    const checksumSha256 = createHash('sha256').update(buf).digest('hex');

    const actorId = (session?.user?.id as string) ?? '';
    const tsUtc = new Date().toISOString();
    const payload = canonicalJSON({ action: 'FILE_REGISTERED', relative_path: relPath, checksum_sha256: checksumSha256 });
    const row = await withRetry(async () => {
      const db = await getDb();
      await dbRun(db, 'INSERT INTO file_registry (relative_path, checksum_sha256, uploaded_by) VALUES (?, ?, ?)', relPath, checksumSha256, 'user');

      const lastLedger = (await dbGet(db, 'SELECT block_hash FROM ledger_events ORDER BY id DESC LIMIT 1')) as { block_hash: string } | undefined;
      const prevHash = lastLedger?.block_hash ?? null;
      const blockHash = computeEventHash({
        prev_hash: prevHash,
        event_type: 'FILE_REGISTERED',
        ts_utc: tsUtc,
        actor_id: actorId,
        canonical_payload_json: payload,
      });
      await dbRun(db, 'INSERT INTO ledger_events (event_type, payload_json, prev_hash, block_hash, created_at, actor_id) VALUES (?, ?, ?, ?, ?, ?)', 'FILE_REGISTERED', payload, prevHash, blockHash, tsUtc, actorId || null);

      return (await dbGet(db, 'SELECT id, created_at FROM file_registry WHERE relative_path = ?', relPath)) as {
        id: number;
        created_at: string;
      };
    });

    if (process.env.DATABASE_URL) {
      const ext = (base.includes('.') ? '.' + base.split('.').pop()!.toLowerCase() : '').replace(/^\./, '') || '';
      const allowedForAgent = ['pdf', 'docx', 'txt', 'md'].includes(ext);
      if (allowedForAgent) {
        const stat = await import('fs').then((fs) => fs.promises.stat(absPath));
        queueAgentIngest({
          path: relPath,
          filename: base,
          ext: ext ? `.${ext}` : '.bin',
          sha256: checksumSha256,
          sizeBytes: buf.length,
          modifiedAt: stat.mtime,
        }).catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      id: row.id,
      relative_path: relPath,
      checksum_sha256: checksumSha256,
      created_at: row.created_at,
    });
  } catch (e) {
    console.error('[files/upload]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Upload failed' },
      { status: 500 }
    );
  }
}
