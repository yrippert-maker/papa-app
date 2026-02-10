#!/usr/bin/env node
/**
 * Smoke-check: NextAuth tables (User, Account, Session).
 * Usage: node scripts/smoke-nextauth-db.mjs
 * Requires: DATABASE_URL in .env
 */
import "dotenv/config";
import pg from "pg";

const url = process.env.DATABASE_URL;
if (!url) {
  console.error("DATABASE_URL is required");
  process.exit(1);
}

const client = new pg.Client({
  connectionString: url,
  ...(url.includes("pooler.supabase.com") && { ssl: { rejectUnauthorized: false } }),
});

async function main() {
  await client.connect();
  const users = (await client.query('SELECT COUNT(*) as c FROM "User"')).rows[0].c;
  const accounts = (await client.query('SELECT COUNT(*) as c FROM "Account"')).rows[0].c;
  const sessions = (await client.query('SELECT COUNT(*) as c FROM "Session"')).rows[0].c;
  console.log("NextAuth DB smoke:");
  console.log("  User:", users);
  console.log("  Account:", accounts);
  console.log("  Session:", sessions);
  await client.end();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
