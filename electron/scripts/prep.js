/* eslint-disable no-console */
const fs = require("fs");
const path = require("path");

/* ---------------- utils ---------------- */

function rmIfExists(p) {
  if (fs.existsSync(p)) {
    fs.rmSync(p, { recursive: true, force: true });
  }
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function copyDir(src, dst) {
  ensureDir(dst);
  fs.cpSync(src, dst, { recursive: true });
}

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

function dirSizeBytes(dir) {
  let total = 0;
  walk(dir, (p) => {
    try {
      total += fs.statSync(p).size;
    } catch (_) {}
  });
  return total;
}

function norm(p) {
  return p.replace(/\\/g, "/");
}

/* ---------------- paths ---------------- */

const repoRoot = path.join(__dirname, "..", "..");
const out = path.join(repoRoot, "electron", "bundle");
const standaloneRoot = path.join(out, "standalone");

/* ---------------- start ---------------- */

console.log("[prep] start");

rmIfExists(out);
ensureDir(out);

/* ---------------- copy Next standalone ---------------- */

const standaloneSrc = path.join(repoRoot, ".next", "standalone");
if (!fs.existsSync(standaloneSrc)) {
  console.error("[prep] Run 'npm run build' first. Missing:", standaloneSrc);
  process.exit(1);
}

copyDir(standaloneSrc, standaloneRoot);

// Next expects static at standalone/.next/static
copyDir(
  path.join(repoRoot, ".next", "static"),
  path.join(standaloneRoot, ".next", "static")
);

// .next/cache is build cache, not runtime — safe to remove from standalone (often saves tens/hundreds MB)
rmIfExists(path.join(standaloneRoot, ".next", "cache"));

// public (optional)
const publicDir = path.join(repoRoot, "public");
if (fs.existsSync(publicDir)) {
  copyDir(publicDir, path.join(standaloneRoot, "public"));
}

/* ---------------- safety-net helpers ---------------- */

function isProtected(p) {
  const n = norm(p);
  return (
    n.includes("/.next/") ||
    n.includes("/public/")
  );
}

/* ---------------- remove sourcemaps ---------------- */

walk(standaloneRoot, (p) => {
  if (p.endsWith(".map") && !isProtected(p)) {
    fs.rmSync(p, { force: true });
  }
});

/* ---------------- generic cleanup ---------------- */

// folders known to be non-runtime (if traced in)
const TRASH_DIRS = [
  "docs",
  "data",
  "dist",
  "scripts",
  "apps",
  "services",
  "tests",
  "fixtures",
  "__tests__",
  "__fixtures__",
  "migrations",
  "config",
  "schemas",
  "contracts",
  "types",
  "electron",
  "00_SYSTEM",
  "Новая папка"
];

for (const d of TRASH_DIRS) {
  rmIfExists(path.join(standaloneRoot, d));
}

// files
const TRASH_FILES = [
  "package-lock.json",
  "tsconfig.tsbuildinfo",
  "env.example",
  "verify-summary.json"
];

for (const f of TRASH_FILES) {
  rmIfExists(path.join(standaloneRoot, f));
}

// binary/doc trash (only outside protected paths)
walk(standaloneRoot, (p) => {
  if (isProtected(p)) return;
  if (
    p.endsWith(".zip") ||
    p.endsWith(".docx") ||
    p.endsWith(".pdf") ||
    path.basename(p).startsWith("~$")
  ) {
    fs.rmSync(p, { force: true });
  }
});

/* ---------------- PRUNE SQLITE (hard guarantee) ---------------- */

function pruneSqlite() {
  console.log("[prep] DATABASE_URL set → pruning sqlite / better-sqlite3");

  // node_modules package
  rmIfExists(path.join(standaloneRoot, "node_modules", "better-sqlite3"));

  // project sqlite layer + native bindings if traced in (skip .next/public)
  walk(standaloneRoot, (p) => {
    if (isProtected(p)) return;
    const n = norm(p);
    if (
      n.includes("/better-sqlite3/") ||
      n.endsWith("/better_sqlite3.node") ||
      n.includes("/sqlite-adapter.") ||
      n.includes("/lib/db/sqlite.")
    ) {
      fs.rmSync(p, { force: true });
    }
  });
}

/* ---------------- PRUNE AWS SDK (hard guarantee) ---------------- */

function pruneAws() {
  console.log("[prep] S3_HEALTH_ENABLED!=1 → pruning @aws-sdk / @smithy");

  const nm = path.join(standaloneRoot, "node_modules");
  rmIfExists(path.join(nm, "@aws-sdk"));
  rmIfExists(path.join(nm, "@smithy"));

  walk(standaloneRoot, (p) => {
    if (isProtected(p)) return;
    const n = norm(p);
    if (n.includes("/@aws-sdk/") || n.includes("/@smithy/")) {
      fs.rmSync(p, { force: true });
    }
  });
}

/* ---------------- PRUNE GCS / googleapis (hard guarantee) ---------------- */

function pruneGcs() {
  console.log("[prep] GCS_HEALTH_ENABLED!=1 → pruning @google-cloud / googleapis");

  const nm = path.join(standaloneRoot, "node_modules");
  rmIfExists(path.join(nm, "@google-cloud"));
  rmIfExists(path.join(nm, "googleapis"));

  walk(standaloneRoot, (p) => {
    if (isProtected(p)) return;
    const n = norm(p);
    if (n.includes("/@google-cloud/") || n.includes("/googleapis/")) {
      fs.rmSync(p, { force: true });
    }
  });
}

/* ---------------- conditional prunes ---------------- */

if (process.env.DATABASE_URL) {
  pruneSqlite();
}

if (process.env.S3_HEALTH_ENABLED !== "1") {
  pruneAws();
}

if (process.env.GCS_HEALTH_ENABLED !== "1") {
  pruneGcs();
}

/* ---------------- policy assert: bundle must not contain pruned deps ---------------- */

function findInStandalone(segment) {
  const found = [];
  walk(standaloneRoot, (p) => {
    if (norm(p).includes(segment)) found.push(p);
  });
  return found;
}

let failed = false;

if (process.env.DATABASE_URL) {
  const sqlite = findInStandalone("better-sqlite3");
  if (sqlite.length > 0) {
    console.error("[prep] POLICY FAIL: DATABASE_URL set but better-sqlite3 still in bundle:", sqlite.slice(0, 5));
    failed = true;
  }
}

if (process.env.S3_HEALTH_ENABLED !== "1") {
  const aws = findInStandalone("@aws-sdk");
  if (aws.length > 0) {
    console.error("[prep] POLICY FAIL: S3_HEALTH_ENABLED!=1 but @aws-sdk still in bundle:", aws.slice(0, 5));
    failed = true;
  }
}

if (process.env.GCS_HEALTH_ENABLED !== "1") {
  const gcs = findInStandalone("@google-cloud");
  if (gcs.length > 0) {
    console.error("[prep] POLICY FAIL: GCS_HEALTH_ENABLED!=1 but @google-cloud still in bundle:", gcs.slice(0, 5));
    failed = true;
  }
  const googleapis = findInStandalone("googleapis");
  if (googleapis.length > 0) {
    console.error("[prep] POLICY FAIL: GCS_HEALTH_ENABLED!=1 but googleapis still in bundle:", googleapis.slice(0, 5));
    failed = true;
  }
}

if (fs.existsSync(path.join(standaloneRoot, ".next", "cache"))) {
  console.error("[prep] POLICY FAIL: standalone/.next/cache must not be present in release bundle.");
  failed = true;
}

const NEXT_SIZE_MB_LIMIT = 50;
const nextDir = path.join(standaloneRoot, ".next");
if (fs.existsSync(nextDir)) {
  const nextBytes = dirSizeBytes(nextDir);
  const nextMB = (nextBytes / (1024 * 1024)).toFixed(1);
  console.log("[prep] .next size:", nextMB, "MB");
  if (nextBytes > NEXT_SIZE_MB_LIMIT * 1024 * 1024) {
    console.error("[prep] POLICY FAIL: standalone/.next size", nextMB, "MB exceeds limit", NEXT_SIZE_MB_LIMIT, "MB (regression).");
    failed = true;
  }
}

if (failed) {
  console.error("[prep] Fix prune logic or pass correct env (DATABASE_URL / S3_HEALTH_ENABLED / GCS_HEALTH_ENABLED) and re-run.");
  process.exit(1);
}

/* ---------------- done ---------------- */

console.log("[prep] done");
