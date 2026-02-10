#!/usr/bin/env node
/**
 * Validate all package.json files (except node_modules and build artifacts).
 * Fails CI if any have invalid JSON.
 */
import { readFileSync } from "fs";
import { join } from "path";
import fg from "fast-glob";

const files = fg.sync("**/package.json", {
  cwd: process.cwd(),
  ignore: [
    "**/node_modules/**",
    "**/dist/**",
    "**/.next/**",
    "**/out/**",
    "**/.turbo/**",
    "**/.output/**",
    "**/.vercel/**",
  ],
});

let failed = 0;

for (const f of files) {
  const abs = join(process.cwd(), f);
  try {
    JSON.parse(readFileSync(abs, "utf8"));
  } catch (err) {
    console.error(`Invalid JSON: ${abs}`);
    console.error(`  ${err?.message ?? String(err)}`);
    failed++;
  }
}

if (failed > 0) {
  console.error(`Found ${failed} invalid package.json file(s).`);
  process.exit(1);
}

console.log(`OK: ${files.length} package.json`);
process.exit(0);
