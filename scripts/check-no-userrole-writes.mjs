#!/usr/bin/env node
/**
 * Проверка: Admin API не должен менять роли через Prisma UserRole/Role.
 * Истина ролей для админки = users.role_code (getDb).
 *
 * Ищет в app/api/**:
 *   prisma.userRole.create|update|delete|upsert
 *   prisma.role.create|update|delete|upsert
 *
 * Разрешённые пути (allowlist): []
 */
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const API_ROOT = join(process.cwd(), "app", "api");
const ALLOWLIST = [
  // Пример: "app/api/some/special/route.ts"
];

const PATTERNS = [
  /prisma\.userRole\.(create|update|delete|upsert)\s*\(/,
  /prisma\.role\.(create|update|delete|upsert)\s*\(/,
];

function findTsFiles(dir, files = []) {
  if (!existsSync(dir)) return files;
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      findTsFiles(p, files);
    } else if (e.name.endsWith(".ts") || e.name.endsWith(".tsx")) {
      files.push(p);
    }
  }
  return files;
}

function relPath(abs) {
  return abs.replace(process.cwd() + "/", "");
}

let failed = 0;
const files = findTsFiles(API_ROOT);
for (const file of files) {
  const rel = relPath(file);
  if (ALLOWLIST.includes(rel)) continue;
  const content = readFileSync(file, "utf8");
  for (const re of PATTERNS) {
    const m = content.match(re);
    if (m) {
      console.error(`FAIL: ${rel} — запрещённая мутация: ${m[0]}`);
      failed++;
      break;
    }
  }
}

if (failed > 0) {
  console.error("\nРоли для Admin API меняются только через users.role_code (getDb).");
  console.error("Prisma UserRole/Role — только для NextAuth, не для админки.");
  process.exit(1);
}
console.log(`OK: в app/api/** нет мутаций UserRole/Role (${files.length} файлов проверено).`);
