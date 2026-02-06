#!/usr/bin/env node
/**
 * Прогон lint/typecheck/build по всем подпроектам с package.json.
 * Корень + apps/* (рекурсивно).
 */
import { execSync } from "node:child_process";
import { readdirSync, statSync, readFileSync, existsSync } from "node:fs";
import { join, relative } from "node:path";

const SKIP_DIRS = new Set(["node_modules", ".next", "dist", "build", ".git"]);

function findPackageDirs(dir, acc = []) {
  for (const name of readdirSync(dir)) {
    if (SKIP_DIRS.has(name)) continue;
    const p = join(dir, name);
    try {
      const st = statSync(p);
      if (!st.isDirectory()) continue;
    } catch {
      continue;
    }

    const pkg = join(p, "package.json");
    if (existsSync(pkg)) acc.push(p);

    findPackageDirs(p, acc);
  }
  return acc;
}

function run(cmd, cwd) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

const root = process.cwd();
const appsDir = join(root, "apps");
const appDirs = existsSync(appsDir) ? findPackageDirs(appsDir) : [];
const dirs = ["."].concat(appDirs.map((d) => relative(root, d)));
const unique = [...new Set(dirs)];

for (const rel of unique) {
  const cwd = rel === "." ? root : join(root, rel);
  const pkgPath = join(cwd, "package.json");
  const pkg = JSON.parse(readFileSync(pkgPath, "utf8"));

  console.log(`\n=== ${rel === "." ? "root" : rel} ===`);

  if (pkg.scripts?.lint) run("npm run lint", cwd);
  if (pkg.scripts?.typecheck) run("npm run typecheck", cwd);
  if (pkg.scripts?.build) {
    const hasLock = existsSync(join(cwd, "package-lock.json"));
    if (hasLock && rel !== ".") run("npm ci", cwd);
    run("npm run build", cwd);
  } else if (rel !== ".") {
    console.log("  (no build script, skip)");
  }
}

console.log("\n✓ check:all done");
