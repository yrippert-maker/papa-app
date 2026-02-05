#!/usr/bin/env node
/**
 * Pre-flight перед сменой домена / go-live.
 * Требует DATABASE_URL (Postgres).
 *
 * Запускает:
 *   1. db:status
 *   2. db:migrate:prod
 *   3. audit:prune:dry
 *   4. smoke:nextauth-db
 *   5. smoke:last-admin-invariant
 *
 * Ручные проверки после скрипта: login/logout, /audit, /admin
 */
import "dotenv/config";
import { spawnSync } from "child_process";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");

if (!process.env.DATABASE_URL) {
  console.error("DATABASE_URL required for preflight");
  process.exit(1);
}

const steps = [
  { name: "db:status", cmd: "npx", args: ["prisma", "migrate", "status"] },
  { name: "db:migrate:prod", cmd: "npm", args: ["run", "db:migrate:prod"] },
  { name: "audit:prune:dry", cmd: "npm", args: ["run", "audit:prune:dry"] },
  { name: "smoke:nextauth-db", cmd: "npm", args: ["run", "smoke:nextauth-db"] },
  { name: "smoke:last-admin-invariant", cmd: "npm", args: ["run", "smoke:last-admin-invariant"] },
];

const env = { ...process.env };
if (process.env.DATABASE_URL?.includes("pooler.supabase.com")) {
  env.NODE_TLS_REJECT_UNAUTHORIZED = "0";
}

for (const { name, cmd, args } of steps) {
  console.log(`\n--- ${name} ---`);
  const r = spawnSync(cmd, args, { cwd: root, env, stdio: "inherit" });
  if (r.status !== 0) {
    console.error(`\nPreflight FAILED at: ${name}`);
    process.exit(1);
  }
}

console.log("\n--- Preflight OK ---");
console.log("Ручные проверки: login/logout, /audit, /admin");
