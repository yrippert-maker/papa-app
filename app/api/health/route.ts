import { existsSync, readdirSync, readFileSync } from 'fs';
import { join } from 'path';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const url = new URL(req.url);
  if (url.searchParams.get('diag') === '1') {
    const cwd = process.cwd();
    const apiDir = join(cwd, '.next', 'server', 'app', 'api');
    const v1Dir = join(apiDir, 'v1');
    const manifestPath = join(cwd, '.next', 'server', 'app-paths-manifest.json');
    let v1Routes: string[] = [];
    if (existsSync(manifestPath)) {
      const m = JSON.parse(readFileSync(manifestPath, 'utf-8'));
      v1Routes = Object.keys(m).filter((k: string) => k.includes('v1'));
    }
    return Response.json({
      cwd,
      apiDirExists: existsSync(apiDir),
      apiContents: existsSync(apiDir) ? readdirSync(apiDir) : null,
      v1DirExists: existsSync(v1Dir),
      v1Contents: existsSync(v1Dir) ? readdirSync(v1Dir) : null,
      v1Routes,
      buildId: existsSync(join(cwd, '.next', 'BUILD_ID')) ? readFileSync(join(cwd, '.next', 'BUILD_ID'), 'utf-8').trim() : null,
    });
  }
  return Response.json({ ok: true });
}
