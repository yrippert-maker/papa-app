#!/usr/bin/env node
/**
 * Guard: проверяет, что критичные файлы есть в git (build context).
 * Запускать перед push / в CI. Предотвращает "Module not found" на Railway.
 */
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';
import { join } from 'node:path';

const ROOT = process.cwd();
const CRITICAL = [
  'lib/db.ts',
  'lib/system/health/s3-health.ts',
  'lib/authz/permissions.ts',
  'tsconfig.json',
  'next.config.mjs',
];

let failed = 0;
for (const rel of CRITICAL) {
  const abs = join(ROOT, rel);
  if (!existsSync(abs)) {
    console.error(`[check-build-context] MISSING: ${rel}`);
    failed++;
    continue;
  }
  try {
    execSync(`git ls-files --error-unmatch "${rel}"`, { cwd: ROOT, stdio: 'pipe' });
  } catch {
    console.error(`[check-build-context] NOT IN GIT: ${rel}`);
    failed++;
  }
}

const count = execSync('git ls-files lib | wc -l', { cwd: ROOT, encoding: 'utf8' }).trim();
if (parseInt(count, 10) < 10) {
  console.error(`[check-build-context] SUSPICIOUS: only ${count} lib files in git`);
  failed++;
}

if (failed > 0) {
  process.exit(1);
}
console.log('[check-build-context] OK');
