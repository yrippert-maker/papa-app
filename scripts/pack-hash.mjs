#!/usr/bin/env node
/**
 * Compute pack_hash.json — SHA-256 over all pack files (excluding pack_hash.json, pack_signature.json).
 * Schema: pack_hash.json.version = 1; files[] = { path, sha256, bytes }.
 * Excluded: pack_hash.json, pack_signature.json, .DS_Store, Thumbs.db.
 * Called by create-auditor-pack.mjs after pack is built.
 *
 * Usage: node scripts/pack-hash.mjs <packDir>
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const EXCLUDED_RELATIVE = new Set([
  'pack_hash.json',
  'pack_signature.json',
  '.DS_Store',
  'Thumbs.db',
]);

function walk(dir) {
  const out = [];
  for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, ent.name);
    if (ent.isDirectory()) out.push(...walk(p));
    else out.push(p);
  }
  return out;
}

function sha256File(filePath) {
  return crypto.createHash('sha256').update(fs.readFileSync(filePath)).digest('hex');
}

export function computePackHash(packDir) {
  const files = walk(packDir)
    .map((p) => path.relative(packDir, p).replaceAll('\\', '/'))
    .filter((rel) => !EXCLUDED_RELATIVE.has(rel) && !rel.includes('/.DS_Store') && !rel.includes('/Thumbs.db'))
    .sort();

  const entries = files.map((rel) => {
    const abs = path.join(packDir, rel);
    return { path: rel, sha256: sha256File(abs), bytes: fs.statSync(abs).size };
  });

  const canonical = JSON.stringify(
    { version: 1, files: entries.map(({ path: p, sha256: s, bytes: b }) => ({ path: p, sha256: s, bytes: b })) },
    null,
    0
  );
  const packSha = crypto.createHash('sha256').update(canonical).digest('hex');

  return {
    version: 1,
    generated_at: new Date().toISOString(),
    pack_sha256: packSha,
    files: entries,
  };
}

const packDir = process.argv[2];
if (!packDir || !fs.existsSync(packDir)) {
  console.error('Usage: node scripts/pack-hash.mjs <packDir>');
  process.exit(1);
}

const obj = computePackHash(packDir);
fs.writeFileSync(path.join(packDir, 'pack_hash.json'), JSON.stringify(obj, null, 2), 'utf8');
console.log(`[pack-hash] pack_hash.json written: sha256=${obj.pack_sha256}`);
