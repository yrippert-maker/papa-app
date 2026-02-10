/**
 * Policy assert: standalone/.next/cache must not exist in the release bundle.
 * Run after electron:prep (e.g. in CI or before electron:build).
 * Exit 1 if cache is present.
 */
import fs from "fs";
import path from "path";

const ROOT = process.cwd();
const cacheDir = path.join(ROOT, "electron", "bundle", "standalone", ".next", "cache");

if (fs.existsSync(cacheDir)) {
  console.error("[next-cache-check] POLICY FAIL: standalone/.next/cache must not be present.");
  console.error("[next-cache-check] Path:", cacheDir);
  process.exit(1);
}

console.log("[next-cache-check] OK: no .next/cache in bundle");
