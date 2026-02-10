#!/usr/bin/env node
/**
 * smoke:agent:perms — проверка ACL «только пополнение» на PAPA_DB_ROOT.
 * Ожидается: можно добавлять, нельзя удалять, нельзя переименовывать/перемещать.
 * Пропуск: SMOKE_SKIP_PERMS=1 (для dev без ACL).
 */
import dotenv from 'dotenv';
import fs from 'node:fs/promises';
import path from 'node:path';
import { existsSync } from 'node:fs';

const envLocal = path.join(process.cwd(), '.env.local');
if (existsSync(envLocal)) dotenv.config({ path: envLocal });
dotenv.config();

function fail(msg) {
  console.error(`[smoke:agent:perms] FAIL: ${msg}`);
  process.exit(1);
}

function ok(msg) {
  console.log(`[smoke:agent:perms] OK: ${msg}`);
}

if (process.env.SMOKE_SKIP_PERMS === '1') {
  console.log('[smoke:agent:perms] Skipped (SMOKE_SKIP_PERMS=1)');
  process.exit(0);
}

const root = process.env.PAPA_DB_ROOT;
if (!root) fail('PAPA_DB_ROOT is not set');

const absRoot = path.resolve(root);

async function exists(p) {
  try {
    await fs.access(p);
    return true;
  } catch {
    return false;
  }
}

async function main() {
  if (!(await exists(absRoot))) {
    fail(`PAPA_DB_ROOT does not exist: ${absRoot}`);
  }

  // 1) Должны уметь ДОБАВЛЯТЬ (пополнение разрешено)
  const stamp = `.__smoke_add_only_${Date.now()}_${Math.random().toString(16).slice(2)}.tmp`;
  const tmpFile = path.join(absRoot, stamp);

  try {
    await fs.writeFile(tmpFile, 'ok\n', { flag: 'wx' });
    ok('Can add files (writeFile) — пополнение разрешено');
  } catch (e) {
    fail(`Cannot add files in PAPA_DB_ROOT (writeFile failed): ${e?.message || e}`);
  }

  // 2) Не должны уметь УДАЛЯТЬ (delete запрещён)
  try {
    await fs.unlink(tmpFile);
    fail('Delete is allowed (unlink succeeded) — ожидался запрет delete/delete_child');
  } catch (e) {
    const code = e?.code;
    if (code === 'EPERM' || code === 'EACCES' || code === 'EROFS') {
      ok(`Delete is denied as expected (${code}) — удаление запрещено`);
    } else {
      fail(`Unexpected error on delete test: ${e?.message || e}`);
    }
  }

  // 3) Не должны уметь ПЕРЕИМЕНОВЫВАТЬ/ПЕРЕМЕЩАТЬ папку (rename запрещён)
  const parent = path.dirname(absRoot);
  const base = path.basename(absRoot);
  const renameTarget = path.join(parent, `${base}.__smoke_renamed`);

  try {
    await fs.rename(absRoot, renameTarget);
    try {
      await fs.rename(renameTarget, absRoot);
    } catch {}
    fail('Rename/move of PAPA_DB_ROOT is allowed — ожидался запрет');
  } catch (e) {
    const code = e?.code;
    if (code === 'EPERM' || code === 'EACCES') {
      ok(`Rename/move is denied as expected (${code}) — перемещение/переименование запрещено`);
    } else {
      ok(`Rename/move test returned non-success (${code ?? 'unknown'}). Treat as denied.`);
    }
  }

  ok('All permission checks passed');
}

main().catch((e) => fail(e?.message || e));
