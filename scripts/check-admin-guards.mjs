#!/usr/bin/env node
/**
 * Проверка: все route.ts в app/api/admin/** и app/api/audit/** защищены guard'ом.
 * Ожидается requirePermission( или requireRoleForApi( в каждом handler.
 */
import { readdirSync, readFileSync, existsSync } from "fs";
import { join } from "path";

const roots = ["app/api/admin", "app/api/audit"].filter((r) =>
  existsSync(join(process.cwd(), r))
);
const GUARD_PATTERNS = [
  /requirePermission\s*\(/,
  /requireRoleForApi\s*\(/,
];

function findRouteFiles(dir, files = []) {
  const entries = readdirSync(dir, { withFileTypes: true });
  for (const e of entries) {
    const p = join(dir, e.name);
    if (e.isDirectory()) {
      findRouteFiles(p, files);
    } else if (e.name === "route.ts" || e.name === "route.tsx") {
      files.push(p);
    }
  }
  return files;
}

let failed = 0;
let routes = [];
for (const root of roots) {
  routes = routes.concat(findRouteFiles(join(process.cwd(), root)));
}
for (const file of routes) {
  const content = readFileSync(file, "utf8");
  const hasGuard = GUARD_PATTERNS.some((re) => re.test(content));
  const rel = file.replace(process.cwd() + "/", "");
  if (!hasGuard) {
    console.error(`FAIL: ${rel} — нет requirePermission/requireRoleForApi`);
    failed++;
  } else {
    console.log(`OK: ${rel}`);
  }
}

if (failed > 0) {
  console.error(`\n${failed} route(s) без guard. Добавь requirePermission или requireRoleForApi.`);
  process.exit(1);
}
console.log(`\nВсе ${routes.length} route(s) защищены.`);
