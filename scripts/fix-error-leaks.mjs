#!/usr/bin/env node
/**
 * fix-error-leaks.mjs
 * Автоматически заменяет паттерны утечки ошибок на internalError() во всех API routes.
 *
 * Запуск: node scripts/fix-error-leaks.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';
import { execSync } from 'child_process';

const ROOT = process.cwd();
const dryRun = process.argv.includes('--dry-run');

const files = execSync(
  `find app/api -name "route.ts" -not -path "*/health/*" -not -path "*/metrics/*" -not -path "*/auth/*"`,
  { cwd: ROOT, encoding: 'utf8' }
).trim().split('\n').filter(Boolean);

let changed = 0;
let skipped = 0;

for (const file of files) {
  const fullPath = resolve(ROOT, file);
  let content = readFileSync(fullPath, 'utf8');
  const original = content;

  const tag = file.replace('app/api/', '').replace('/route.ts', '').replace(/\[([^\]]+)\]/g, ':$1');

  // Pattern: const msg = e instanceof Error ? e.message : '...'; return NextResponse.json({ error: msg }, { status: 500 });
  content = content.replace(
    /catch\s*\(\s*\w+\s*\)\s*\{\s*\n?\s*const\s+msg\s*=\s*\w+\s+instanceof\s+Error\s*\?\s*\w+\.message\s*:\s*['"][^'"]*['"]\s*;?\s*\n?\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*msg\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)\s*;?\s*\n?\s*\}/g,
    `catch (e) {\n    return internalError('[${tag}]', e, req?.headers);\n  }`
  );

  // Pattern: const message = ... same
  content = content.replace(
    /catch\s*\(\s*\w+\s*\)\s*\{\s*\n?\s*const\s+message\s*=\s*\w+\s+instanceof\s+Error\s*\?\s*\w+\.message\s*:\s*['"][^'"]*['"]\s*;?\s*\n?\s*return\s+NextResponse\.json\(\s*\{\s*error:\s*message\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)\s*;?\s*\n?\s*\}/g,
    `catch (e) {\n    return internalError('[${tag}]', e, req?.headers);\n  }`
  );

  if (content !== original) {
    // Add import if needed
    if (!content.includes("from '@/lib/api/error-response'") || !content.includes('internalError')) {
      const importLine = "import { internalError } from '@/lib/api/error-response';";
      const hasErrorResponse = content.includes("from '@/lib/api/error-response'");
      if (hasErrorResponse) {
        const m = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/api\/error-response['"]\s*;?/);
        if (m && !m[1].includes('internalError')) {
          content = content.replace(m[0], m[0].replace(m[1], m[1].trimEnd() + ', internalError'));
        }
      } else {
        const lastImport = content.lastIndexOf('\nimport ');
        if (lastImport !== -1) {
          const end = content.indexOf('\n', lastImport + 1);
          content = content.slice(0, end + 1) + importLine + '\n' + content.slice(end + 1);
        } else {
          content = importLine + '\n' + content;
        }
      }
    }

    if (dryRun) {
      console.log(`[DRY] Would update: ${file}`);
    } else {
      writeFileSync(fullPath, content);
      console.log(`  ✓ ${file}`);
    }
    changed++;
  } else {
    skipped++;
  }
}

console.log(`\nDone: ${changed} files updated, ${skipped} skipped${dryRun ? ' (dry run)' : ''}`);
