#!/usr/bin/env node
/**
 * Импорт документов из ~/Documents/papa-import в базу.
 * Требует временного снятия immutable (sudo) или ACL add-only.
 *
 * Использование:
 *   PAPA_IMPORT_SOURCE=~/Documents/papa-import node scripts/import-docs.mjs [product]
 *   product — подпапка в import (например ТВ3-117), или все при отсутствии.
 *
 * При immutable: сначала db:immutable:off, затем import, затем db:immutable:on.
 */
import fs from 'node:fs/promises';
import path from 'node:path';

const papaRoot = process.env.PAPA_DB_ROOT?.trim();
const importSource = process.env.PAPA_IMPORT_SOURCE?.trim() || path.join(process.env.HOME || '', 'Documents', 'papa-import');
const product = process.argv[2]; // e.g. ТВ3-117

if (!papaRoot) {
  console.error('PAPA_DB_ROOT is not set');
  process.exit(1);
}

const menasaRoot = path.resolve(papaRoot);
const docsDir = path.join(menasaRoot, 'документы');
const srcDir = path.resolve(importSource.replace(/^~/, process.env.HOME || ''));

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function copyDir(src, dest) {
  const entries = await fs.readdir(src, { withFileTypes: true });
  await fs.mkdir(dest, { recursive: true });
  let count = 0;
  for (const e of entries) {
    const srcPath = path.join(src, e.name);
    const destPath = path.join(dest, e.name);
    if (e.isDirectory()) {
      count += await copyDir(srcPath, destPath);
    } else {
      await fs.copyFile(srcPath, destPath);
      count++;
    }
  }
  return count;
}

async function main() {
  if (!(await exists(srcDir))) {
    console.error('Import source does not exist:', srcDir);
    console.error('Create: mkdir -p', srcDir);
    process.exit(1);
  }

  if (product) {
    const srcProduct = path.join(srcDir, product);
    const destProduct = path.join(docsDir, product);
    if (!(await exists(srcProduct))) {
      console.error('Product folder not found:', srcProduct);
      process.exit(1);
    }
    const n = await copyDir(srcProduct, destProduct);
    console.log(`Imported ${n} files: ${product} -> ${destProduct}`);
  } else {
    const entries = await fs.readdir(srcDir, { withFileTypes: true });
    let total = 0;
    for (const e of entries) {
      if (!e.isDirectory()) continue;
      const n = await copyDir(path.join(srcDir, e.name), path.join(docsDir, e.name));
      total += n;
      console.log(`  ${e.name}: ${n} files`);
    }
    console.log(`Total imported: ${total} files`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
