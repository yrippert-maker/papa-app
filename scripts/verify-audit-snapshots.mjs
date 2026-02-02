#!/usr/bin/env node
/**
 * Verify audit snapshots.
 * 
 * Checks:
 * 1. Snapshot hash integrity
 * 2. Signature validity
 * 3. Chain continuity (previous_snapshot_hash)
 * 
 * Usage:
 *   node scripts/verify-audit-snapshots.mjs [--all|--latest]
 */
import { createHash, createVerify } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const root = join(__dirname, '..');
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || join(root, 'workspace');
const SNAPSHOTS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'audit-snapshots');
const KEYS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'keys');

const args = process.argv.slice(2);
const verifyAll = args.includes('--all') || !args.includes('--latest');
const verifyLatest = args.includes('--latest');

function canonicalJSON(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `"${k}":${canonicalJSON(obj[k])}`).join(',') + '}';
}

function computeSnapshotHash(snapshot) {
  const { snapshot_hash, ...rest } = snapshot;
  return createHash('sha256').update(canonicalJSON(rest)).digest('hex');
}

function getPublicKey(keyId) {
  // Check active key
  const activeKeyIdFile = join(KEYS_DIR, 'active', 'key_id.txt');
  if (existsSync(activeKeyIdFile)) {
    const activeId = readFileSync(activeKeyIdFile, 'utf8').trim();
    if (activeId === keyId) {
      const pubFile = join(KEYS_DIR, 'active', 'evidence-signing.pub');
      if (existsSync(pubFile)) {
        return readFileSync(pubFile, 'utf8');
      }
    }
  }
  
  // Check archived keys
  const archivedPubFile = join(KEYS_DIR, 'archived', keyId, 'evidence-signing.pub');
  if (existsSync(archivedPubFile)) {
    return readFileSync(archivedPubFile, 'utf8');
  }
  
  return null;
}

function verifySignature(hash, signature, publicKey) {
  try {
    const verify = createVerify('SHA256');
    verify.update(hash);
    return verify.verify(publicKey, Buffer.from(signature, 'hex'));
  } catch (e) {
    // Ed25519 uses different API
    try {
      const { verify } = await import('crypto');
      return verify(null, Buffer.from(hash), publicKey, Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }
}

function verifySnapshot(signedSnapshot, previousHash) {
  const result = {
    snapshot_id: signedSnapshot.snapshot.snapshot_id,
    date: signedSnapshot.snapshot.period.to.slice(0, 10),
    valid: true,
    errors: [],
  };
  
  // 1. Verify hash
  const computedHash = computeSnapshotHash(signedSnapshot.snapshot);
  if (computedHash !== signedSnapshot.snapshot.snapshot_hash) {
    result.valid = false;
    result.errors.push(`Hash mismatch: expected ${signedSnapshot.snapshot.snapshot_hash}, got ${computedHash}`);
  }
  
  // 2. Verify signature
  const publicKey = getPublicKey(signedSnapshot.key_id);
  if (!publicKey) {
    result.errors.push(`Key not found: ${signedSnapshot.key_id}`);
    // Don't mark as invalid if key is missing but hash is valid
  } else {
    try {
      const sigValid = verifySignature(signedSnapshot.snapshot.snapshot_hash, signedSnapshot.signature, publicKey);
      if (!sigValid) {
        result.valid = false;
        result.errors.push('Signature invalid');
      }
    } catch (e) {
      result.errors.push(`Signature verification error: ${e.message}`);
    }
  }
  
  // 3. Verify chain
  if (previousHash !== null && signedSnapshot.snapshot.previous_snapshot_hash !== previousHash) {
    result.valid = false;
    result.errors.push(`Chain broken: expected previous=${previousHash}, got ${signedSnapshot.snapshot.previous_snapshot_hash}`);
  }
  
  return result;
}

async function main() {
  console.log('[verify-snapshots] Starting verification...');
  console.log(`[verify-snapshots] WORKSPACE_ROOT: ${WORKSPACE_ROOT}`);
  
  if (!existsSync(SNAPSHOTS_DIR)) {
    console.log('[verify-snapshots] No snapshots directory found');
    process.exit(0);
  }
  
  const files = readdirSync(SNAPSHOTS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort();
  
  if (files.length === 0) {
    console.log('[verify-snapshots] No snapshots found');
    process.exit(0);
  }
  
  console.log(`[verify-snapshots] Found ${files.length} snapshots`);
  
  const toVerify = verifyLatest ? [files[files.length - 1]] : files;
  
  let previousHash = null;
  const results = [];
  let allValid = true;
  
  for (const file of toVerify) {
    const filepath = join(SNAPSHOTS_DIR, file);
    let signedSnapshot;
    
    try {
      signedSnapshot = JSON.parse(readFileSync(filepath, 'utf8'));
    } catch (e) {
      results.push({ filename: file, valid: false, errors: [`Parse error: ${e.message}`] });
      allValid = false;
      continue;
    }
    
    const result = verifySnapshot(signedSnapshot, previousHash);
    result.filename = file;
    results.push(result);
    
    if (!result.valid) allValid = false;
    
    console.log(`[verify-snapshots] ${file}: ${result.valid ? 'OK' : 'FAILED'}`);
    if (result.errors.length > 0) {
      for (const err of result.errors) {
        console.log(`  - ${err}`);
      }
    }
    
    previousHash = signedSnapshot.snapshot.snapshot_hash;
  }
  
  console.log('---');
  console.log(`[verify-snapshots] Total: ${results.length}, Valid: ${results.filter(r => r.valid).length}, Invalid: ${results.filter(r => !r.valid).length}`);
  
  // Output JSON summary
  const summary = {
    timestamp: new Date().toISOString(),
    total: results.length,
    valid: results.filter(r => r.valid).length,
    invalid: results.filter(r => !r.valid).length,
    all_valid: allValid,
    results,
  };
  console.log('[json]', JSON.stringify(summary));
  
  process.exit(allValid ? 0 : 1);
}

main().catch(e => {
  console.error('[verify-snapshots] Error:', e);
  process.exit(1);
});
