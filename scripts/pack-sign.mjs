#!/usr/bin/env node
/**
 * Sign pack_hash.json with Ed25519. Writes pack_signature.json.
 * Requires PACK_SIGN_PRIVATE_KEY_PEM.
 *
 * Usage: node scripts/pack-sign.mjs <packDir>
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

const packDir = process.argv[2];

if (!packDir || !fs.existsSync(packDir)) {
  console.error('Usage: node scripts/pack-sign.mjs <packDir>');
  process.exit(1);
}

const hashPath = path.join(packDir, 'pack_hash.json');
if (!fs.existsSync(hashPath)) {
  console.error('[pack-sign] pack_hash.json missing; run pack-hash first.');
  process.exit(1);
}

const privateKeyPem = process.env.PACK_SIGN_PRIVATE_KEY_PEM || null;

if (!privateKeyPem) {
  console.error('[pack-sign] Missing private key. Provide PACK_SIGN_PRIVATE_KEY_PEM.');
  process.exit(1);
}

const keyId = process.env.PACK_SIGN_KEY_ID || null;

const payload = fs.readFileSync(hashPath);
const sig = crypto.sign(null, payload, privateKeyPem).toString('base64');

const sigObj = {
  version: 1,
  generated_at: new Date().toISOString(),
  algorithm: 'ed25519',
  signed_file: 'pack_hash.json',
  signature_base64: sig,
  ...(keyId ? { key_id: keyId } : {}),
};

fs.writeFileSync(path.join(packDir, 'pack_signature.json'), JSON.stringify(sigObj, null, 2), 'utf8');
console.log('[pack-sign] pack_signature.json written');
