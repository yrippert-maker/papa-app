import { existsSync, mkdirSync, readdirSync, statSync } from 'fs';
import { join, resolve } from 'path';
import { WORKSPACE_ROOT } from './config';

const SYSTEM_DIR = '00_SYSTEM';
const DB_DIR = '00_SYSTEM/db';

/**
 * Проверяет, что resolvedPath находится внутри WORKSPACE_ROOT (защита от Path Traversal).
 */
export function isPathInsideWorkspace(resolvedPath: string): boolean {
  const workspaceResolved = resolve(WORKSPACE_ROOT);
  const targetResolved = resolve(resolvedPath);
  return targetResolved === workspaceResolved || targetResolved.startsWith(workspaceResolved + '/');
}

/**
 * Безопасное получение абсолютного пути внутри workspace. Выбрасывает при выходе за границы.
 */
export function resolveWorkspacePath(relativeDir: string): string {
  const absPath = resolve(WORKSPACE_ROOT, relativeDir || '.');
  if (!isPathInsideWorkspace(absPath)) {
    throw new Error('Path traversal blocked');
  }
  return absPath;
}

export function ensureWorkspaceStructure(): { created: string[] } {
  const created: string[] = [];
  const systemPath = join(WORKSPACE_ROOT, SYSTEM_DIR);
  const dbPath = join(WORKSPACE_ROOT, DB_DIR);

  if (!existsSync(WORKSPACE_ROOT)) {
    mkdirSync(WORKSPACE_ROOT, { recursive: true });
    created.push(WORKSPACE_ROOT);
  }
  if (!existsSync(systemPath)) {
    mkdirSync(systemPath, { recursive: true });
    created.push(systemPath);
  }
  if (!existsSync(dbPath)) {
    mkdirSync(dbPath, { recursive: true });
    created.push(dbPath);
  }
  return { created };
}

export type WorkspaceEntry = {
  name: string;
  path: string;
  relativePath: string;
  isDir: boolean;
  size?: number;
};

export function listWorkspace(relativeDir = ''): WorkspaceEntry[] {
  const absPath = resolveWorkspacePath(relativeDir);
  if (!existsSync(absPath)) return [];
  const entries = readdirSync(absPath, { withFileTypes: true });
  const result: WorkspaceEntry[] = [];
  for (const e of entries) {
    if (e.name.startsWith('.') || e.name.includes('..')) continue;
    const rel = relativeDir ? `${relativeDir}/${e.name}` : e.name;
    const full = resolve(WORKSPACE_ROOT, rel);
    if (!isPathInsideWorkspace(full)) continue;
    const stat = statSync(full);
    result.push({
      name: e.name,
      path: full,
      relativePath: rel,
      isDir: stat.isDirectory(),
      size: stat.isFile() ? stat.size : undefined,
    });
  }
  result.sort((a, b) => (a.isDir === b.isDir ? a.name.localeCompare(b.name) : a.isDir ? -1 : 1));
  return result;
}
