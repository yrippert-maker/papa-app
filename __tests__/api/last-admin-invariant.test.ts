/**
 * Integration test: DB-level last-admin invariant.
 * Сценарий: два админа → удалить одного → попытка удалить последнего — триггер блокирует.
 *
 * Использует migrate.mjs для создания БД с полным набором миграций.
 */
import Database from "better-sqlite3";
import { spawnSync } from "child_process";
import { existsSync, mkdirSync } from "fs";
import { join } from "path";
import { tmpdir } from "os";

const EXPECTED_ERROR = "Cannot remove last admin";

const root = join(__dirname, "..", "..");

function prepareTestDb(): string {
  const workspace = join(tmpdir(), `last-admin-test-${Date.now()}`);
  mkdirSync(workspace, { recursive: true });
  const dbPath = join(workspace, "00_SYSTEM", "db", "papa.sqlite");
  mkdirSync(join(workspace, "00_SYSTEM", "db"), { recursive: true });

  const r = spawnSync(process.execPath, [join(root, "scripts", "migrate.mjs"), "up"], {
    cwd: root,
    env: { ...process.env, WORKSPACE_ROOT: workspace, DB_PATH: dbPath },
    stdio: "pipe",
  });
  if (r.status !== 0) {
    throw new Error(`migrate failed: ${r.stderr?.toString() || r.stdout?.toString()}`);
  }
  if (!existsSync(dbPath)) {
    throw new Error("DB not created");
  }
  return dbPath;
}

function withFreshDb(
  fn: (db: Database.Database) => void
): void {
  const dbPath = prepareTestDb();
  const db = new Database(dbPath);
  try {
    fn(db);
  } finally {
    db.close();
  }
}

describe("Last-admin invariant (SQLite)", () => {
  it("blocks DELETE of last ADMIN", () => {
    withFreshDb((db) => {
      db.exec(`
        INSERT INTO users (email, password_hash, role_code) VALUES
          ('last-admin-1@test.local', 'x', 'ADMIN'),
          ('last-admin-2@test.local', 'x', 'ADMIN')
      `);
      db.prepare("DELETE FROM users WHERE email = ?").run("last-admin-2@test.local");

      expect(() => {
        db.prepare("DELETE FROM users WHERE email = ?").run("last-admin-1@test.local");
      }).toThrow(EXPECTED_ERROR);
    });
  });

  it("blocks UPDATE (demote) of last ADMIN", () => {
    withFreshDb((db) => {
      db.exec(`
        INSERT INTO users (email, password_hash, role_code) VALUES
          ('last-admin-a@test.local', 'x', 'ADMIN'),
          ('last-admin-b@test.local', 'x', 'ADMIN')
      `);
      db.prepare("DELETE FROM users WHERE email = ?").run("last-admin-b@test.local");

      expect(() => {
        db.prepare(
          "UPDATE users SET role_code = ? WHERE email = ?"
        ).run("MANAGER", "last-admin-a@test.local");
      }).toThrow(EXPECTED_ERROR);
    });
  });

  it("allows DELETE when another ADMIN exists", () => {
    withFreshDb((db) => {
      db.exec(`
        INSERT INTO users (email, password_hash, role_code) VALUES
          ('last-admin-x@test.local', 'x', 'ADMIN'),
          ('last-admin-y@test.local', 'x', 'ADMIN')
      `);
      db.prepare("DELETE FROM users WHERE email = ?").run("last-admin-x@test.local");
      const count = db.prepare(
        "SELECT COUNT(*) as c FROM users WHERE role_code = 'ADMIN'"
      ).get() as { c: number };
      expect(count.c).toBe(1);
    });
  });
});
