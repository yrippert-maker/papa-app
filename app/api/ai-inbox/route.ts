import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth-options';
import { listWorkspace } from '@/lib/workspace';
import { getDbReadOnly, dbAll } from '@/lib/db';
import { requirePermission, PERMISSIONS } from '@/lib/authz';

export const dynamic = 'force-dynamic';

/** GET /api/ai-inbox — список файлов в ai-inbox. Permission: AI_INBOX.VIEW */
export async function GET(req: Request): Promise<Response> {
  const session = await getServerSession(authOptions);
  const err = await requirePermission(session, PERMISSIONS.AI_INBOX_VIEW, req);
  if (err) return err;

  try {
    const entries = listWorkspace('ai-inbox');
    const db = await getDbReadOnly();
    const registry = (await dbAll(db, 'SELECT relative_path FROM file_registry')) as Array<{ relative_path: string }>;
    const registeredPaths = new Set(registry.map((r) => r.relative_path));
    const full = entries.map((e) => ({
      name: e.name,
      relativePath: e.relativePath,
      isDir: e.isDir,
      size: e.size,
      registered: registeredPaths.has(e.relativePath),
    }));
    return NextResponse.json({ entries: full });
  } catch (e) {
    console.error('[ai-inbox]', e);
    return NextResponse.json({ error: 'List failed' }, { status: 500 });
  }
}
