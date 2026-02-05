#!/usr/bin/env node
/**
 * Smoke-check: DB-level last-admin invariant.
 * Создаёт 2 temp admin, удаляет одного, пытается удалить последнего — триггер должен выбросить ошибку.
 *
 * Postgres: DATABASE_URL (всегда изолированно в транзакции)
 * SQLite: DB_PATH или WORKSPACE_ROOT/00_SYSTEM/db/papa.sqlite
 *   Для SQLite нужна БД с 0 админов. Пример: DB_PATH=/tmp/smoke.sqlite WORKSPACE_ROOT=/tmp/smoke npm run migrate && DATABASE_URL= DB_PATH=/tmp/smoke.sqlite npm run smoke:last-admin-invariant
 */
import "dotenv/config";
import { join } from "path";
import { fileURLToPath } from "url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const root = join(__dirname, "..");
const workspaceRoot = process.env.WORKSPACE_ROOT?.trim() || join(root, "data");
const defaultDbPath = join(workspaceRoot, "00_SYSTEM", "db", "papa.sqlite");
const dbPath = process.env.DB_PATH || defaultDbPath;

const EXPECTED_ERROR = "Cannot remove last admin";

async function runPostgres() {
  const pg = await import("pg");
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.error("DATABASE_URL required for Postgres smoke");
    process.exit(1);
  }
  const client = new pg.default.Client({
    connectionString: url,
    ...(url.includes("pooler.supabase.com") && { ssl: { rejectUnauthorized: false } }),
  });
  await client.connect();

  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO users (email, password_hash, role_code) VALUES 
       ('smoke-last-admin-1@test.local', 'x', 'ADMIN'),
       ('smoke-last-admin-2@test.local', 'x', 'ADMIN')`
    );
    await client.query("DELETE FROM users WHERE email = 'smoke-last-admin-2@test.local'");
    try {
      await client.query("DELETE FROM users WHERE email = 'smoke-last-admin-1@test.local'");
      await client.query("ROLLBACK");
      console.error("FAIL: триггер не сработал — DELETE последнего admin прошёл");
      process.exit(1);
    } catch (e) {
      if (e.message?.includes(EXPECTED_ERROR)) {
        await client.query("ROLLBACK");
        console.log("OK: last-admin invariant (Postgres) — триггер блокирует delete");
        return;
      }
      await client.query("ROLLBACK");
      console.error("FAIL: неожиданная ошибка:", e.message);
      process.exit(1);
    }
  } finally {
    await client.end();
  }
}

async function runSqlite() {
  const Database = (await import("better-sqlite3")).default;
  const { existsSync } = await import("fs");
  if (!existsSync(dbPath)) {
    console.error("SQLite DB not found:", dbPath, "- run npm run migrate first");
    process.exit(1);
  }
  const db = new Database(dbPath);

  try {
    db.transaction(() => {
      db.prepare(
        "INSERT INTO users (email, password_hash, role_code) VALUES (?, ?, ?), (?, ?, ?)"
      ).run("smoke-last-admin-1@test.local", "x", "ADMIN", "smoke-last-admin-2@test.local", "x", "ADMIN");
      db.prepare("DELETE FROM users WHERE email = ?").run("smoke-last-admin-2@test.local");
      db.prepare("DELETE FROM users WHERE email = ?").run("smoke-last-admin-1@test.local");
    })();
    console.error("FAIL: триггер не сработал — DELETE последнего admin прошёл");
    process.exit(1);
  } catch (e) {
    if (e.message?.includes(EXPECTED_ERROR)) {
      console.log("OK: last-admin invariant (SQLite) — триггер блокирует delete");
      return;
    }
    console.error("FAIL: неожиданная ошибка:", e.message);
    process.exit(1);
  } finally {
    db.close();
  }
}

async function main() {
  if (process.env.DATABASE_URL) {
    await runPostgres();
  } else {
    await runSqlite();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
