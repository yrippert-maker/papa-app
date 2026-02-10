import { NextResponse } from 'next/server';
import { readdirSync, existsSync, readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

export async function GET() {
  const cwd = process.cwd();
  const serverDir = join(cwd, '.next', 'server', 'app', 'api');
  const v1Dir = join(cwd, '.next', 'server', 'app', 'api', 'v1');
  const manifestPath = join(cwd, '.next', 'server', 'app-paths-manifest.json');

  const result: Record<string, unknown> = {
    cwd,
    serverDirExists: existsSync(serverDir),
    v1DirExists: existsSync(v1Dir),
    serverDirContents: existsSync(serverDir) ? readdirSync(serverDir) : null,
    v1DirContents: existsSync(v1Dir) ? readdirSync(v1Dir) : null,
  };

  if (existsSync(manifestPath)) {
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf-8'));
    result.v1Routes = Object.keys(manifest).filter((k: string) => k.includes('v1'));
    result.totalRoutes = Object.keys(manifest).length;
  }

  return NextResponse.json(result);
}
