#!/usr/bin/env node
/**
 * fix-error-leaks-manual.mjs
 * Фиксит оставшиеся файлы с нестандартными паттернами утечки ошибок.
 * Запуск: node scripts/fix-error-leaks-manual.mjs [--dry-run]
 */
import { readFileSync, writeFileSync } from 'fs';
import { resolve } from 'path';

const ROOT = process.cwd();
const dryRun = process.argv.includes('--dry-run');

function addInternalErrorImport(content) {
  if (content.includes("internalError") && content.includes("from '@/lib/api/error-response'")) return content;
  const m = content.match(/import\s*\{([^}]+)\}\s*from\s*['"]@\/lib\/api\/error-response['"]\s*;?/);
  if (m && !m[1].includes('internalError')) {
    return content.replace(m[0], m[0].replace(m[1], m[1].trimEnd() + ', internalError'));
  }
  if (!m) {
    const lastImport = content.lastIndexOf('\nimport ');
    if (lastImport !== -1) {
      const eol = content.indexOf('\n', lastImport + 1);
      return content.slice(0, eol + 1) + "import { internalError } from '@/lib/api/error-response';\n" + content.slice(eol + 1);
    }
    return "import { internalError } from '@/lib/api/error-response';\n" + content;
  }
  return content;
}

const replacements = [
  { file: 'app/api/docs/versions/route.ts', from: /return NextResponse\.json\(\s*\{\s*ok:\s*false,\s*error:\s*String\(e instanceof Error \? e\.message : e\)\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)\s*;?/g, to: `return internalError('docs/versions', e, req?.headers);`, addImport: true },
  { file: 'app/api/docs/list/route.ts', from: /return NextResponse\.json\(\s*\{\s*ok:\s*false,\s*doc_ids:\s*\[\],\s*error:\s*String\(e instanceof Error \? e\.message : e\)\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)\s*;?/g, to: `return internalError('docs/list', e, req?.headers);`, addImport: true },
  { file: 'app/api/docs/get/route.ts', from: /return NextResponse\.json\(\s*\{\s*ok:\s*false,\s*error:\s*String\(e instanceof Error \? e\.message : e\)\s*\}\s*,\s*\{\s*status:\s*500\s*\}\s*\)\s*;?/g, to: `return internalError('docs/get', e, req?.headers);`, addImport: true },
  { file: 'app/api/ledger/verify/route.ts', from: /const msg = e instanceof Error \? e\.message : 'Ledger verification failed';/, to: `console.error('[ledger/verify] Error:', e);\n    const msg = 'Ledger verification failed';` },
  { file: 'app/api/ledger/append/route.ts', from: /error: e instanceof Error \? e\.message : 'Append failed',/, to: `error: 'Append failed',` },
  { file: 'app/api/system/verify/route.ts', from: /const raw = e instanceof Error \? e\.message : String\(e\);/, to: `console.error('[system/verify] Error:', e);\n    const raw = e instanceof Error ? e.message : String(e);` },
  { file: 'app/api/system/verify/route.ts', from: /const msg = e instanceof Error \? e\.message : 'AuthZ verification failed';/, to: `console.error('[system/verify/authz] Error:', e);\n    const msg = 'AuthZ verification failed';` },
  { file: 'app/api/system/verify/route.ts', from: /const msg = e instanceof Error \? e\.message : 'Ledger verification failed';/, to: `console.error('[system/verify/ledger] Error:', e);\n      const msg = 'Ledger verification failed';` },
  { file: 'app/api/inspection/cards/[id]/transition/route.ts', from: /return \{ invalidTransition: true, error: e instanceof Error \? e\.message : 'Invalid transition' \} as const;/, to: `console.error('[inspection/transition] Invalid transition:', e);\n        return { invalidTransition: true, error: 'Invalid transition' } as const;` },
  { file: 'app/api/inspection/cards/[id]/evidence/route.ts', from: /e instanceof Error \? e\.message : 'Failed',/, to: `'Upload failed',` },
  { file: 'app/api/inspection/cards/[id]/check-results/route.ts', from: /return badRequest\(e instanceof Error \? e\.message : 'Invalid payload', req\.headers\);/, to: `console.error('[inspection/check-results] Validation error:', e);\n      return badRequest('Invalid payload', req.headers);` },
  { file: 'app/api/authz/verify/route.ts', from: /e instanceof Error \? e\.message : 'Verification failed'/, to: `'Verification failed'` },
  { file: 'app/api/admin/users/[id]/route.ts', from: /e instanceof Error \? e\.message : 'Update failed'/, to: `'Update failed'` },
  { file: 'app/api/settings/users/[id]/route.ts', from: /e instanceof Error \? e\.message : 'Update failed'/, to: `'Update failed'`, all: true },
  { file: 'app/api/agent/search/route.ts', from: /warning: e instanceof Error \? e\.message : 'Search failed',/, to: `warning: 'Search temporarily unavailable',` },
];

let changed = 0;
for (const r of replacements) {
  const fullPath = resolve(ROOT, r.file);
  let content;
  try {
    content = readFileSync(fullPath, 'utf8');
  } catch {
    console.log(`  ✗ ${r.file} — file not found`);
    continue;
  }

  const before = content;
  content = content.replace(r.from, r.to);
  if (r.addImport && content !== before) {
    content = addInternalErrorImport(content);
  }
  if (r.all && content.includes("e instanceof Error ? e.message : 'Delete failed'")) {
    content = content.replace(/e instanceof Error \? e\.message : 'Delete failed'/g, `'Delete failed'`);
  }

  if (content !== before) {
    if (dryRun) console.log(`[DRY] Would fix: ${r.file}`);
    else {
      writeFileSync(fullPath, content);
      console.log(`  ✓ ${r.file}`);
    }
    changed++;
  }
}

console.log(`\nDone: ${changed} manual fixes applied${dryRun ? ' (dry run)' : ''}`);
