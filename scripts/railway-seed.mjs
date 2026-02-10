#!/usr/bin/env node
/**
 * Seed admin в Railway prod.
 *
 * railway run — запускает команду ЛОКАЛЬНО, но подставляет DATABASE_URL и др.
 * из Railway Variables. Т.е. seed идёт в prod-БД.
 *
 * Использование (один из вариантов):
 *
 * A) Интерактивно (в своём терминале):
 *    1. npx @railway/cli login   (откроет браузер)
 *    2. npx @railway/cli link    (выбрать project/env/service)
 *    3. npm run railway:seed
 *
 * B) С токеном (CI / без браузера):
 *    1. Railway → Project → Settings → Tokens → Create Project Token
 *    2. Добавить RAILWAY_TOKEN в .env.local
 *    3. railway link (один раз, интерактивно) или указать -p / -e
 *    4. npm run railway:seed
 */
import "dotenv/config";
import { execSync } from "child_process";

const env = {
  ...process.env,
  SEED_ADMIN_EMAIL: process.env.SEED_ADMIN_EMAIL || "admin@company.com",
  SEED_ADMIN_PASSWORD: process.env.SEED_ADMIN_PASSWORD || "PapaApp2026_OK",
  SEED_ADMIN_FORCE_RESET: "1",
};

console.log("[railway-seed] railway run → seed с DATABASE_URL из Railway prod...");
execSync("npx @railway/cli run npm run db:seed", {
  stdio: "inherit",
  env,
});
console.log("[railway-seed] Done.");
