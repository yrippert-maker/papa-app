#!/usr/bin/env node
/**
 * Проверка: README и package.json не расходятся с docs/ops/DB_SEED_TLS.md.
 * CI: npm run check:docs-seed
 */
import { readFileSync, existsSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const readme = readFileSync(join(root, "README.md"), "utf8");
const pkg = JSON.parse(readFileSync(join(root, "package.json"), "utf8"));
const dbSeedTlsPath = join(root, "docs", "ops", "DB_SEED_TLS.md");

let failed = false;

if (!existsSync(dbSeedTlsPath)) {
  console.error("FAIL: docs/ops/DB_SEED_TLS.md не найден");
  failed = true;
}

if (!readme.includes("DB_SEED_TLS.md")) {
  console.error("FAIL: README.md не упоминает DB_SEED_TLS.md");
  failed = true;
}

const scripts = pkg.scripts || {};
if (!scripts["db:seed"]) {
  console.error("FAIL: package.json scripts не содержит db:seed");
  failed = true;
}
if (!scripts["db:seed:supabase"]) {
  console.error("FAIL: package.json scripts не содержит db:seed:supabase");
  failed = true;
}

if (failed) {
  process.exit(1);
}
console.log("OK: docs/README/package.json согласованы с DB_SEED_TLS");
