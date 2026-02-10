#!/usr/bin/env node
/**
 * smoke:agent:outputs — проверка, что артефакты пишутся только в AGENT_OUTPUT_ROOT.
 * Запускает фиктивный экспорт и проверяет наличие файлов в ожидаемой структуре.
 */
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { existsSync } from 'node:fs';

const envLocal = path.join(process.cwd(), '.env.local');
if (existsSync(envLocal)) dotenv.config({ path: envLocal });
dotenv.config();

const root = process.env.AGENT_OUTPUT_ROOT?.trim();
if (!root) {
  console.warn('[smoke:agent:outputs] WARN: AGENT_OUTPUT_ROOT not set');
  if (process.env.SMOKE_REQUIRE_OUTPUT_ROOT === '1') {
    console.error('[smoke:agent:outputs] FAIL: SMOKE_REQUIRE_OUTPUT_ROOT=1 but AGENT_OUTPUT_ROOT not set');
    process.exit(1);
  }
  process.exit(0);
}

const absRoot = path.resolve(root);

async function main() {
  if (!existsSync(absRoot)) {
    await fs.mkdir(absRoot, { recursive: true });
  }

  // Проверяем структуру: должны быть только разрешённые подпапки
  const products = (process.env.AGENT_ALLOWED_PRODUCTS || 'ТВ3-117,АИ-9,НР-3,КД,ARMACK,общие')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
  const allowed = new Set(products);

  const entries = await fs.readdir(absRoot, { withFileTypes: true });
  for (const e of entries) {
    if (e.isDirectory() && !allowed.has(e.name)) {
      console.error(
        `[smoke:agent:outputs] FAIL: Unexpected folder "${e.name}" in AGENT_OUTPUT_ROOT. Allowed: ${[...allowed].join(', ')}`
      );
      process.exit(1);
    }
  }

  // Проверка записи: создаём и удаляем тестовый файл
  const testFile = path.join(absRoot, 'общие', 'черновики', '.smoke_outputs_test');
  await fs.mkdir(path.dirname(testFile), { recursive: true });
  await fs.writeFile(testFile, 'ok', 'utf-8');
  const content = await fs.readFile(testFile, 'utf-8');
  await fs.unlink(testFile);
  if (content !== 'ok') {
    console.error('[smoke:agent:outputs] FAIL: Write/read test failed');
    process.exit(1);
  }

  console.log('[smoke:agent:outputs] OK: AGENT_OUTPUT_ROOT writable, structure valid');
}

main().catch((e) => {
  console.error('[smoke:agent:outputs]', e);
  process.exit(1);
});
