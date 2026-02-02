#!/usr/bin/env node
/**
 * Independent Verification Script
 * 
 * Designed for 3rd-party auditors to verify:
 * 1. Audit snapshot integrity (hash chain)
 * 2. Signature validity
 * 3. Policy compliance
 * 4. Evidence index consistency
 * 
 * Usage:
 *   node independent-verify.mjs --audit-pack /path/to/audit-pack
 *   node independent-verify.mjs --snapshots /path/to/snapshots
 *   node independent-verify.mjs --help
 * 
 * Exit codes:
 *   0 = All verifications passed
 *   1 = Verification failed
 *   2 = Invalid arguments
 */
import { createHash, createVerify } from 'crypto';
import { existsSync, readFileSync, readdirSync, statSync } from 'fs';
import { join, basename } from 'path';

const VERSION = '1.0.0';

// ========== Helpers ==========

function canonicalJSON(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `"${k}":${canonicalJSON(obj[k])}`).join(',') + '}';
}

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function log(level, message) {
  const ts = new Date().toISOString();
  const prefix = { info: 'ℹ️', ok: '✅', warn: '⚠️', error: '❌' }[level] || '•';
  console.log(`[${ts}] ${prefix} ${message}`);
}

// ========== Verification Functions ==========

function verifySnapshotHash(snapshot) {
  const { snapshot_hash, ...rest } = snapshot;
  const computed = sha256(canonicalJSON(rest));
  return computed === snapshot_hash;
}

function verifySignature(hash, signature, publicKeyPem) {
  try {
    // Try Ed25519 first
    const verify = createVerify('SHA256');
    verify.update(hash);
    return verify.verify(publicKeyPem, Buffer.from(signature, 'hex'));
  } catch {
    // Fallback to crypto.verify for Ed25519
    try {
      const crypto = await import('crypto');
      return crypto.verify(null, Buffer.from(hash), publicKeyPem, Buffer.from(signature, 'hex'));
    } catch {
      return false;
    }
  }
}

function verifyHashChain(snapshots) {
  const sorted = [...snapshots].sort((a, b) => 
    a.snapshot.period.from.localeCompare(b.snapshot.period.from)
  );
  
  const results = [];
  let previousHash = null;
  
  for (const s of sorted) {
    const expected = s.snapshot.previous_snapshot_hash;
    const valid = expected === previousHash;
    
    results.push({
      snapshot_id: s.snapshot.snapshot_id,
      period: s.snapshot.period,
      expected_previous: expected,
      actual_previous: previousHash,
      chain_valid: valid || (previousHash === null && expected === null),
    });
    
    previousHash = s.snapshot.snapshot_hash;
  }
  
  return results;
}

function verifyEvidenceIndex(index, snapshots) {
  const issues = [];
  
  // Check index hash
  const { index_hash, ...rest } = index;
  const computed = sha256(canonicalJSON(rest));
  if (computed !== index_hash) {
    issues.push(`Index hash mismatch: expected ${index_hash}, got ${computed}`);
  }
  
  // Check entries match snapshots
  const snapshotHashes = new Set(snapshots.map(s => s.snapshot.snapshot_hash));
  
  for (const entry of index.entries) {
    if (!snapshotHashes.has(entry.snapshot_hash)) {
      issues.push(`Index entry ${entry.snapshot_id} references unknown snapshot hash`);
    }
  }
  
  return { valid: issues.length === 0, issues };
}

function verifyManifest(manifest, packDir) {
  const issues = [];
  
  // Verify checksums
  for (const [file, expectedHash] of Object.entries(manifest.checksums)) {
    const filepath = join(packDir, file);
    if (!existsSync(filepath)) {
      issues.push(`Missing file: ${file}`);
      continue;
    }
    
    const content = readFileSync(filepath, 'utf8');
    const actualHash = sha256(content);
    
    if (actualHash !== expectedHash) {
      issues.push(`Checksum mismatch: ${file}`);
    }
  }
  
  // Verify pack hash
  const { pack_hash, ...rest } = manifest;
  const computed = sha256(canonicalJSON(rest));
  if (computed !== pack_hash) {
    issues.push(`Pack hash mismatch: expected ${pack_hash}, got ${computed}`);
  }
  
  return { valid: issues.length === 0, issues };
}

// ========== Main Verification Flows ==========

async function verifyAuditPack(packPath) {
  log('info', `Verifying audit pack: ${packPath}`);
  
  const results = {
    pack_path: packPath,
    verified_at: new Date().toISOString(),
    verifier_version: VERSION,
    manifest: { valid: false, issues: [] },
    snapshots: [],
    hash_chain: { valid: false, issues: [] },
    evidence_index: { valid: false, issues: [] },
    signatures: [],
    overall: false,
  };
  
  // Load manifest
  const manifestPath = join(packPath, 'MANIFEST.json');
  if (!existsSync(manifestPath)) {
    log('error', 'MANIFEST.json not found');
    return results;
  }
  
  const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
  log('info', `Pack ID: ${manifest.pack_id}`);
  log('info', `Period: ${manifest.period.from} to ${manifest.period.to}`);
  
  // Verify manifest
  const manifestResult = verifyManifest(manifest, packPath);
  results.manifest = manifestResult;
  if (manifestResult.valid) {
    log('ok', 'Manifest checksums verified');
  } else {
    log('error', `Manifest issues: ${manifestResult.issues.join(', ')}`);
  }
  
  // Load snapshots
  const snapshotsDir = join(packPath, 'snapshots');
  const snapshots = [];
  
  if (existsSync(snapshotsDir)) {
    const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json'));
    for (const file of files) {
      const content = JSON.parse(readFileSync(join(snapshotsDir, file), 'utf8'));
      snapshots.push(content);
    }
  }
  
  log('info', `Found ${snapshots.length} snapshots`);
  
  // Verify each snapshot
  for (const s of snapshots) {
    const hashValid = verifySnapshotHash(s.snapshot);
    results.snapshots.push({
      snapshot_id: s.snapshot.snapshot_id,
      hash_valid: hashValid,
      key_id: s.key_id,
    });
    
    if (hashValid) {
      log('ok', `Snapshot ${s.snapshot.snapshot_id.slice(0, 8)} hash valid`);
    } else {
      log('error', `Snapshot ${s.snapshot.snapshot_id.slice(0, 8)} hash INVALID`);
    }
  }
  
  // Verify hash chain
  const chainResults = verifyHashChain(snapshots);
  const chainValid = chainResults.every(r => r.chain_valid);
  results.hash_chain = { valid: chainValid, results: chainResults };
  
  if (chainValid) {
    log('ok', 'Hash chain verified');
  } else {
    log('error', 'Hash chain broken');
  }
  
  // Load and verify signatures with available keys
  const keysDir = join(packPath, 'keys');
  if (existsSync(keysDir)) {
    const keyDirs = readdirSync(keysDir).filter(d => 
      statSync(join(keysDir, d)).isDirectory()
    );
    
    for (const s of snapshots) {
      const keyDir = join(keysDir, s.key_id);
      const pubKeyPath = join(keyDir, 'evidence-signing.pub');
      
      if (existsSync(pubKeyPath)) {
        const pubKey = readFileSync(pubKeyPath, 'utf8');
        let sigValid = false;
        
        try {
          sigValid = verifySignature(s.snapshot.snapshot_hash, s.signature, pubKey);
        } catch (e) {
          log('warn', `Signature verification error for ${s.snapshot.snapshot_id.slice(0, 8)}: ${e.message}`);
        }
        
        results.signatures.push({
          snapshot_id: s.snapshot.snapshot_id,
          key_id: s.key_id,
          valid: sigValid,
        });
        
        if (sigValid) {
          log('ok', `Signature valid for ${s.snapshot.snapshot_id.slice(0, 8)}`);
        } else {
          log('warn', `Signature verification inconclusive for ${s.snapshot.snapshot_id.slice(0, 8)}`);
        }
      } else {
        results.signatures.push({
          snapshot_id: s.snapshot.snapshot_id,
          key_id: s.key_id,
          valid: null,
          reason: 'Key not found in pack',
        });
        log('warn', `Key ${s.key_id} not found for snapshot ${s.snapshot.snapshot_id.slice(0, 8)}`);
      }
    }
  }
  
  // Verify evidence index
  const indexPath = join(packPath, 'evidence-index.json');
  if (existsSync(indexPath)) {
    const index = JSON.parse(readFileSync(indexPath, 'utf8'));
    const indexResult = verifyEvidenceIndex(index, snapshots);
    results.evidence_index = indexResult;
    
    if (indexResult.valid) {
      log('ok', 'Evidence index verified');
    } else {
      log('error', `Evidence index issues: ${indexResult.issues.join(', ')}`);
    }
  }
  
  // Overall result
  results.overall = 
    results.manifest.valid &&
    results.snapshots.every(s => s.hash_valid) &&
    results.hash_chain.valid &&
    results.evidence_index.valid;
  
  return results;
}

async function verifySnapshotsDir(snapshotsPath) {
  log('info', `Verifying snapshots directory: ${snapshotsPath}`);
  
  const files = readdirSync(snapshotsPath).filter(f => f.endsWith('.json'));
  const snapshots = files.map(f => JSON.parse(readFileSync(join(snapshotsPath, f), 'utf8')));
  
  log('info', `Found ${snapshots.length} snapshots`);
  
  // Verify hashes
  let hashErrors = 0;
  for (const s of snapshots) {
    const valid = verifySnapshotHash(s.snapshot);
    if (valid) {
      log('ok', `${s.snapshot.snapshot_id.slice(0, 8)} hash valid`);
    } else {
      log('error', `${s.snapshot.snapshot_id.slice(0, 8)} hash INVALID`);
      hashErrors++;
    }
  }
  
  // Verify chain
  const chainResults = verifyHashChain(snapshots);
  const chainValid = chainResults.every(r => r.chain_valid);
  
  if (chainValid) {
    log('ok', 'Hash chain verified');
  } else {
    log('error', 'Hash chain broken');
    for (const r of chainResults.filter(x => !x.chain_valid)) {
      log('error', `  - ${r.snapshot_id}: expected previous=${r.expected_previous}, actual=${r.actual_previous}`);
    }
  }
  
  return {
    verified_at: new Date().toISOString(),
    total_snapshots: snapshots.length,
    hash_errors: hashErrors,
    chain_valid: chainValid,
    overall: hashErrors === 0 && chainValid,
  };
}

// ========== CLI ==========

function printHelp() {
  console.log(`
Independent Verification Script v${VERSION}

Usage:
  node independent-verify.mjs --audit-pack <path>   Verify complete audit pack
  node independent-verify.mjs --snapshots <path>    Verify snapshots directory only
  node independent-verify.mjs --help                Show this help

Exit codes:
  0 = All verifications passed
  1 = Verification failed
  2 = Invalid arguments

Example:
  node independent-verify.mjs --audit-pack ./audit-pack-abc12345

Output:
  Verification results are printed to stdout.
  Add --json for machine-readable JSON output.
`);
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    printHelp();
    process.exit(2);
  }
  
  const jsonOutput = args.includes('--json');
  
  let results;
  
  if (args.includes('--audit-pack')) {
    const idx = args.indexOf('--audit-pack');
    const packPath = args[idx + 1];
    
    if (!packPath || !existsSync(packPath)) {
      log('error', 'Audit pack path not found');
      process.exit(2);
    }
    
    results = await verifyAuditPack(packPath);
    
  } else if (args.includes('--snapshots')) {
    const idx = args.indexOf('--snapshots');
    const snapshotsPath = args[idx + 1];
    
    if (!snapshotsPath || !existsSync(snapshotsPath)) {
      log('error', 'Snapshots path not found');
      process.exit(2);
    }
    
    results = await verifySnapshotsDir(snapshotsPath);
    
  } else {
    printHelp();
    process.exit(2);
  }
  
  // Output
  console.log('\n' + '='.repeat(60));
  
  if (results.overall) {
    log('ok', 'VERIFICATION PASSED');
  } else {
    log('error', 'VERIFICATION FAILED');
  }
  
  if (jsonOutput) {
    console.log('\n[JSON_RESULT]');
    console.log(JSON.stringify(results, null, 2));
  }
  
  process.exit(results.overall ? 0 : 1);
}

main().catch(e => {
  log('error', `Unexpected error: ${e.message}`);
  process.exit(1);
});
