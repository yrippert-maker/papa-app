import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { listWorkspace } from '@/lib/workspace';
import { getDbReadOnly } from '@/lib/db';
import { requirePermission, PERMISSIONS } from '@/lib/authz';
import { badRequest } from '@/lib/api/error-response';
import { sanitizeForLog } from '@/lib/log-sanitize';
import { parsePaginationParams } from '@/lib/pagination';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const session = await getServerSession(authOptions);
  const err = requirePermission(session, PERMISSIONS.FILES_LIST, request);
  if (err) return err;

  try {
    const url = new URL(request.url);
    const { searchParams } = url;
    const dir = searchParams.get('dir') || '';
    if (dir.includes('..')) {
      console.warn('[files/list] Path traversal blocked, dir=', sanitizeForLog(dir));
      return badRequest('Invalid path', request.headers);
    }
    const { limit, offset } = parsePaginationParams(searchParams);

    const entries = listWorkspace(dir);
    const db = getDbReadOnly();
    const registry = db.prepare('SELECT relative_path FROM file_registry').all() as Array<{ relative_path: string }>;
    const registeredPaths = new Set(registry.map(r => r.relative_path));
    const full = entries.map(e => ({
      ...e,
      registered: registeredPaths.has(e.relativePath),
    }));
    const result = full.slice(offset, offset + limit);
    return NextResponse.json({
      entries: result,
      hasMore: full.length > offset + limit,
    });
  } catch (e) {
    if (e instanceof Error && /^Invalid (limit|cursor|offset)$/.test(e.message)) {
      return badRequest(e.message, request.headers);
    }
    if (e instanceof Error && e.message === 'Path traversal blocked') {
      console.warn('[files/list] Path traversal blocked (resolve)');
      return badRequest('Invalid path', request.headers);
    }
    console.error('[files/list]', e);
    return NextResponse.json(
      { error: 'List failed' },
      { status: 500 }
    );
  }
}
