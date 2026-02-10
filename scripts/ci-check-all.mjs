#!/usr/bin/env node
/**
 * Прогон lint/typecheck/build по root + workspace packages (apps/*).
 * Использует npm workspaces: npm ci только в корне, build — через -w.
 */
import { execSync } from "node:child_process";

function run(cmd, cwd = process.cwd()) {
  execSync(cmd, { cwd, stdio: "inherit" });
}

const root = process.cwd();

console.log("\n=== root ===");
run("npm run lint", root);
run("npm run typecheck", root);
run("npm run build", root);

console.log("\n=== workspaces (apps/*) ===");
run("npm run build --workspaces", root);

console.log("\n✓ check:all done");
