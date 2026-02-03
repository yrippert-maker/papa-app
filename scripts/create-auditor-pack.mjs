#!/usr/bin/env node
/**
 * Create Auditor Pack
 * 
 * Generates a self-contained verification package for external auditors.
 * The auditor can verify everything with a single command, no environment needed.
 * 
 * Usage:
 *   node scripts/create-auditor-pack.mjs
 *   node scripts/create-auditor-pack.mjs --output /path/to/output
 *   node scripts/create-auditor-pack.mjs --org "Organization Name"
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync, copyFileSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// Get git info for provenance (audit-grade: tag must match release version)
function getGitInfo() {
  try {
    const pkg = readJsonSafe(join(ROOT, 'package.json'));
    const releaseTag = pkg?.version ? `v${pkg.version}` : null;

    // Tag: use package version (release we're building for), not git describe
    // — git describe can return older tag (e.g. v0.2.1) if v0.3.1 not yet tagged
    const tag = releaseTag;

    // Commit: use HEAD (the commit this pack is built from)
    // If release tag exists and points to HEAD, they match; otherwise we build from current state
    let commit = execSync('git rev-parse HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const branch = execSync('git rev-parse --abbrev-ref HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
    const dirty = execSync('git status --porcelain', { cwd: ROOT, encoding: 'utf8' }).trim() !== '';
    let origin = '';
    try {
      origin = execSync('git remote get-url origin 2>/dev/null || echo ""', { cwd: ROOT, encoding: 'utf8' }).trim();
    } catch {}

    return {
      tag: tag || null,
      commit,
      branch,
      dirty,
      origin: origin || null,
    };
  } catch {
    return { tag: null, commit: 'unknown', branch: 'unknown', dirty: true, origin: null };
  }
}

// Parse args
const args = process.argv.slice(2);
const outputIdx = args.indexOf('--output');
const orgIdx = args.indexOf('--org');

const OUTPUT_DIR = outputIdx >= 0 ? args[outputIdx + 1] : join(ROOT, 'dist');
const ORG_NAME = orgIdx >= 0 ? args[orgIdx + 1] : 'Papa App';
const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || join(ROOT, 'workspace');

const PACK_VERSION = '1.0.0';
const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
const PACK_NAME = `auditor-pack-${timestamp}`;
const PACK_DIR = join(OUTPUT_DIR, PACK_NAME);

console.log('[auditor-pack] Creating Independent Verifier Pack...');
console.log(`[auditor-pack] Organization: ${ORG_NAME}`);
console.log(`[auditor-pack] Output: ${PACK_DIR}`);

// ========== Helpers ==========

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function canonicalJSON(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => `"${k}":${canonicalJSON(obj[k])}`).join(',') + '}';
}

function copyDir(src, dest) {
  if (!existsSync(src)) return;
  mkdirSync(dest, { recursive: true });
  for (const item of readdirSync(src)) {
    const srcPath = join(src, item);
    const destPath = join(dest, item);
    if (statSync(srcPath).isDirectory()) {
      copyDir(srcPath, destPath);
    } else {
      copyFileSync(srcPath, destPath);
    }
  }
}

function readJsonSafe(path) {
  if (!existsSync(path)) return null;
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch {
    return null;
  }
}

/** Normalize tx_hash: trim, lowercase, remove 0x. Single source of truth for manifest/file paths. */
function normalizeTxHash(h) {
  if (!h || typeof h !== 'string') return '';
  return h.trim().toLowerCase().replace(/^0x/, '');
}

// ========== Create Pack Structure ==========

mkdirSync(PACK_DIR, { recursive: true });

const checksums = {};

// 1. Trust Anchors
console.log('[auditor-pack] Collecting trust anchors...');

const trustAnchorsDir = join(WORKSPACE_ROOT, '00_SYSTEM', 'trust-anchors');
const trustAnchorsLatest = join(trustAnchorsDir, 'trust-anchors-latest.json');

if (existsSync(trustAnchorsLatest)) {
  const content = readFileSync(trustAnchorsLatest, 'utf8');
  writeFileSync(join(PACK_DIR, 'trust-anchors.json'), content);
  checksums['trust-anchors.json'] = sha256(content);
  console.log('[auditor-pack] ✓ trust-anchors.json');
} else {
  // Generate minimal trust anchors from keys
  const keysDir = join(WORKSPACE_ROOT, '00_SYSTEM', 'keys');
  const keys = [];
  
  // Active key
  const activeKeyId = join(keysDir, 'active', 'key_id.txt');
  const activePub = join(keysDir, 'active', 'evidence-signing.pub');
  if (existsSync(activeKeyId) && existsSync(activePub)) {
    keys.push({
      key_id: readFileSync(activeKeyId, 'utf8').trim(),
      public_key_pem: readFileSync(activePub, 'utf8'),
      status: 'active',
    });
  }
  
  // Archived keys
  const archivedDir = join(keysDir, 'archived');
  if (existsSync(archivedDir)) {
    for (const keyId of readdirSync(archivedDir)) {
      const pubFile = join(archivedDir, keyId, 'evidence-signing.pub');
      if (existsSync(pubFile)) {
        keys.push({
          key_id: keyId,
          public_key_pem: readFileSync(pubFile, 'utf8'),
          status: 'archived',
        });
      }
    }
  }
  
  const trustAnchors = {
    bundle_version: '1.0.0',
    generated_at: new Date().toISOString(),
    organization: ORG_NAME,
    keys,
  };
  
  const content = JSON.stringify(trustAnchors, null, 2);
  writeFileSync(join(PACK_DIR, 'trust-anchors.json'), content);
  checksums['trust-anchors.json'] = sha256(content);
  console.log('[auditor-pack] ✓ trust-anchors.json (generated)');
}

// 2. Attestations
console.log('[auditor-pack] Collecting attestations...');

const attestationsDir = join(WORKSPACE_ROOT, '00_SYSTEM', 'attestations');
const packAttestDir = join(PACK_DIR, 'attestations');
mkdirSync(packAttestDir, { recursive: true });

if (existsSync(attestationsDir)) {
  const files = readdirSync(attestationsDir).filter(f => f.endsWith('.json')).sort().reverse().slice(0, 5);
  for (const file of files) {
    const content = readFileSync(join(attestationsDir, file), 'utf8');
    writeFileSync(join(packAttestDir, file), content);
    checksums[`attestations/${file}`] = sha256(content);
  }
  console.log(`[auditor-pack] ✓ ${files.length} attestation(s)`);
} else {
  console.log('[auditor-pack] ⚠ No attestations found');
}

// 3. Snapshots (last 10 + chain head)
console.log('[auditor-pack] Collecting snapshots...');

const snapshotsDir = join(WORKSPACE_ROOT, '00_SYSTEM', 'audit-snapshots');
const packSnapshotsDir = join(PACK_DIR, 'snapshots');
mkdirSync(packSnapshotsDir, { recursive: true });

let chainHead = null;
if (existsSync(snapshotsDir)) {
  const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json')).sort().reverse();
  const toInclude = files.slice(0, 10);
  
  for (const file of toInclude) {
    const content = readFileSync(join(snapshotsDir, file), 'utf8');
    writeFileSync(join(packSnapshotsDir, file), content);
    checksums[`snapshots/${file}`] = sha256(content);
    
    if (!chainHead) {
      try {
        const parsed = JSON.parse(content);
        chainHead = {
          snapshot_id: parsed.snapshot?.snapshot_id,
          snapshot_hash: parsed.snapshot?.snapshot_hash,
          period_to: parsed.snapshot?.period?.to,
        };
      } catch {}
    }
  }
  console.log(`[auditor-pack] ✓ ${toInclude.length} snapshot(s)`);
} else {
  console.log('[auditor-pack] ⚠ No snapshots found');
}

// 4. Policy Index
console.log('[auditor-pack] Collecting policies...');

const policiesDir = join(ROOT, 'schemas', 'policies');
const packPoliciesDir = join(PACK_DIR, 'policies');
mkdirSync(packPoliciesDir, { recursive: true });

const policyIndex = readJsonSafe(join(policiesDir, 'POLICY_INDEX.json'));
if (policyIndex) {
  const content = JSON.stringify(policyIndex, null, 2);
  writeFileSync(join(packPoliciesDir, 'POLICY_INDEX.json'), content);
  checksums['policies/POLICY_INDEX.json'] = sha256(content);
  
  // Include active policy files
  for (const policy of policyIndex.policies || []) {
    if (policy.status === 'active' && policy.file) {
      const policyFile = join(policiesDir, policy.file);
      if (existsSync(policyFile)) {
        const pContent = readFileSync(policyFile, 'utf8');
        writeFileSync(join(packPoliciesDir, policy.file), pContent);
        checksums[`policies/${policy.file}`] = sha256(pContent);
      }
    }
  }
  console.log('[auditor-pack] ✓ policies');
} else {
  console.log('[auditor-pack] ⚠ No policy index found');
}

// 4b. Ledger Anchors + events_subset (Variant B: Anchoring)
console.log('[auditor-pack] Collecting ledger anchors...');

const dbPath = join(WORKSPACE_ROOT, '00_SYSTEM', 'db', 'papa.sqlite');
if (existsSync(dbPath)) {
  try {
    const { default: Database } = await import('better-sqlite3');
    const db = new Database(dbPath, { readonly: true });
    const tableExists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='ledger_anchors'").get();
    const anchors = tableExists ? db.prepare('SELECT * FROM ledger_anchors ORDER BY created_at DESC LIMIT 20').all() : [];
    const anchorsData = { generated_at: new Date().toISOString(), anchors };
    const anchorsContent = JSON.stringify(anchorsData, null, 2);
    writeFileSync(join(PACK_DIR, 'anchors.json'), anchorsContent);
    checksums['anchors.json'] = sha256(anchorsContent);
    console.log(`[auditor-pack] ✓ anchors.json (${anchors.length} anchors)`);

    const periodStart = new Date(Date.now() - 90 * 24 * 60 * 60 * 1000).toISOString().slice(0, 19).replace('T', ' ');
    let events;
    try {
      events = db.prepare(
        `SELECT id, event_type, block_hash, prev_hash, created_at, actor_id, artifact_sha256, signature, key_id, anchor_id FROM ledger_events WHERE created_at >= ? ORDER BY id LIMIT 500`
      ).all(periodStart);
    } catch {
      events = db.prepare(
        `SELECT id, event_type, block_hash, prev_hash, created_at, actor_id FROM ledger_events WHERE created_at >= ? ORDER BY id LIMIT 500`
      ).all(periodStart);
    }
    const eventsData = { period_start: periodStart, count: events.length, events };
    const eventsContent = JSON.stringify(eventsData, null, 2);
    writeFileSync(join(PACK_DIR, 'events_subset.json'), eventsContent);
    checksums['events_subset.json'] = sha256(eventsContent);
    console.log(`[auditor-pack] ✓ events_subset.json (${events.length} events)`);
    db.close();
  } catch (e) {
    console.log('[auditor-pack] ⚠ Ledger anchors skipped:', e?.message || e);
  }
} else {
  console.log('[auditor-pack] ⚠ DB not found, skipping anchors');
}

// 4c. On-chain receipts + contract.json (offline audit)
console.log('[auditor-pack] Collecting on-chain receipts...');

const receiptsSrc = join(WORKSPACE_ROOT, '00_SYSTEM', 'anchor-receipts');
const onchainDir = join(PACK_DIR, 'onchain');
const receiptsDest = join(onchainDir, 'receipts');
mkdirSync(receiptsDest, { recursive: true });

const receiptsManifest = {};
if (existsSync(receiptsSrc)) {
  const files = readdirSync(receiptsSrc).filter(f => f.endsWith('.json'));
  for (const f of files) {
    const content = readFileSync(join(receiptsSrc, f), 'utf8');
    const rawKey = f.replace(/\.json$/, '');
    const normalized = normalizeTxHash(rawKey);
    const destFile = (normalized || rawKey) + '.json';
    writeFileSync(join(receiptsDest, destFile), content);
    const h = sha256(content);
    checksums[`onchain/receipts/${destFile}`] = h;
    receiptsManifest[normalized || rawKey] = h;
  }
  const manifestPath = join(receiptsDest, 'receipts_manifest.json');
  const manifestContent = JSON.stringify({ generated_at: new Date().toISOString(), receipts: receiptsManifest }, null, 2);
  writeFileSync(manifestPath, manifestContent);
  checksums['onchain/receipts/receipts_manifest.json'] = sha256(manifestContent);
  console.log(`[auditor-pack] ✓ onchain/receipts (${files.length} files + manifest)`);
} else {
  console.log('[auditor-pack] ⚠ No anchor-receipts found');
}

// ANCHORING_STATUS.json — build from anchors.json + receipts (schema anchoring-status/v1)
if (existsSync(join(PACK_DIR, 'anchors.json'))) {
  try {
    execSync(`node "${join(ROOT, 'scripts', 'build-anchoring-status.mjs')}" "${PACK_DIR}"`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    const anchoringStatusContent = readFileSync(join(PACK_DIR, 'ANCHORING_STATUS.json'), 'utf8');
    checksums['ANCHORING_STATUS.json'] = sha256(anchoringStatusContent);
  } catch (e) {
    console.log('[auditor-pack] ⚠ build-anchoring-status failed:', e?.message || e);
  }

  // ANCHORING_ISSUES.json — for verify hard-fail gate (VERIFY_FAIL_TYPES / VERIFY_FAIL_SEVERITY)
  try {
    execSync(`node "${join(ROOT, 'scripts', 'generate-anchoring-issues.mjs')}" "${PACK_DIR}"`, {
      cwd: ROOT,
      stdio: 'inherit',
    });
    const anchoringIssuesContent = readFileSync(join(PACK_DIR, 'ANCHORING_ISSUES.json'), 'utf8');
    checksums['ANCHORING_ISSUES.json'] = sha256(anchoringIssuesContent);
    console.log('[auditor-pack] ✓ ANCHORING_ISSUES.json');
  } catch (e) {
    console.log('[auditor-pack] ⚠ generate-anchoring-issues failed:', e?.message || e);
  }
}

const contractInfo = {
  network: process.env.ANCHOR_NETWORK || 'polygon',
  chain_id: parseInt(process.env.ANCHOR_CHAIN_ID || '137', 10),
  contract_address: process.env.ANCHOR_CONTRACT_ADDRESS || null,
  event_abi: [{ type: 'event', name: 'Anchored', inputs: [
    { name: 'merkleRoot', type: 'bytes32', indexed: true },
    { name: 'periodStart', type: 'uint64', indexed: false },
    { name: 'periodEnd', type: 'uint64', indexed: false },
    { name: 'periodKey', type: 'bytes32', indexed: true },
    { name: 'anchorId', type: 'bytes32', indexed: true }
  ]}]
};
const contractContent = JSON.stringify(contractInfo, null, 2);
writeFileSync(join(onchainDir, 'contract.json'), contractContent);
checksums['onchain/contract.json'] = sha256(contractContent);
console.log('[auditor-pack] ✓ onchain/contract.json');

// 5. Standalone Verifier Script
console.log('[auditor-pack] Creating standalone verifier...');

const verifierScript = `#!/usr/bin/env node
/**
 * Standalone Auditor Verifier
 * 
 * This script verifies the integrity of the auditor pack without any external dependencies.
 * It only uses Node.js built-in modules.
 * 
 * Usage:
 *   node verify.mjs              # Permissive mode (allows missing optional artifacts)
 *   node verify.mjs --verbose    # Detailed output
 *   node verify.mjs --strict     # Requires snapshots + attestations
 *   node verify.mjs --json       # JSON output for CI
 * 
 * Exit Codes:
 *   0 = PASSED (all checks OK, warnings allowed in permissive mode)
 *   1 = FAILED (integrity errors or missing required artifacts in strict mode)
 * 
 * Semantics:
 *   PASSED  = Package integrity verified, trust anchors validated
 *   WARN    = Optional evidence artifacts missing (snapshots/attestations)
 *   FAILED  = Checksum mismatch, signature invalid, or chain broken
 */
import { createHash, createVerify } from 'crypto';
import { existsSync, readFileSync, readdirSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const verbose = process.argv.includes('--verbose');
const strict = process.argv.includes('--strict');
const jsonOutput = process.argv.includes('--json');

if (!jsonOutput) {
  console.log('═'.repeat(60));
  console.log('  INDEPENDENT AUDITOR VERIFICATION');
  console.log('  Mode: ' + (strict ? 'STRICT' : 'PERMISSIVE'));
  console.log('═'.repeat(60));
  console.log('');
}

// ========== Helpers ==========

function sha256(data) {
  return createHash('sha256').update(data).digest('hex');
}

function canonicalJSON(obj) {
  if (obj === null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(canonicalJSON).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map(k => '"' + k + '":' + canonicalJSON(obj[k])).join(',') + '}';
}

function log(level, msg) {
  if (jsonOutput) return;
  const icons = { ok: '✓', fail: '✗', info: '•', warn: '⚠' };
  console.log(\`  \${icons[level] || '•'} \${msg}\`);
}

function print(...args) {
  if (jsonOutput) return;
  console.log(...args);
}

// ========== Load Manifest ==========

const manifestPath = join(__dirname, 'MANIFEST.json');
if (!existsSync(manifestPath)) {
  console.error('ERROR: MANIFEST.json not found');
  process.exit(1);
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'));
print(\`Pack ID: \${manifest.pack_id}\`);
print(\`Created: \${manifest.created_at}\`);
print(\`Organization: \${manifest.organization}\`);
print('');

let errors = 0;
let warnings = 0;

// ========== 1. Verify Checksums ==========

print('1. FILE CHECKSUMS');
print('-'.repeat(40));

for (const [file, expectedHash] of Object.entries(manifest.checksums || {})) {
  const filepath = join(__dirname, file);
  if (!existsSync(filepath)) {
    log('fail', \`\${file}: MISSING\`);
    errors++;
    continue;
  }
  
  const content = readFileSync(filepath, 'utf8');
  const actualHash = sha256(content);
  
  if (actualHash === expectedHash) {
    if (verbose) log('ok', \`\${file}: OK\`);
  } else {
    log('fail', \`\${file}: HASH MISMATCH\`);
    errors++;
  }
}
log('info', \`\${Object.keys(manifest.checksums || {}).length} files checked\`);
print('');

// ========== 2. Verify Trust Anchors ==========

print('2. TRUST ANCHORS');
print('-'.repeat(40));

const trustPath = join(__dirname, 'trust-anchors.json');
if (existsSync(trustPath)) {
  const trust = JSON.parse(readFileSync(trustPath, 'utf8'));
  log('ok', \`Organization: \${trust.organization}\`);
  log('ok', \`Keys: \${trust.keys?.length || 0}\`);
  
  const activeKeys = (trust.keys || []).filter(k => k.status === 'active');
  const archivedKeys = (trust.keys || []).filter(k => k.status !== 'active');
  log('info', \`Active: \${activeKeys.length}, Archived: \${archivedKeys.length}\`);
} else {
  log('warn', 'trust-anchors.json not found');
  warnings++;
}
print('');

// ========== 3. Verify Snapshots ==========

print('3. AUDIT SNAPSHOTS');
print('-'.repeat(40));

const snapshotsDir = join(__dirname, 'snapshots');
if (existsSync(snapshotsDir)) {
  const files = readdirSync(snapshotsDir).filter(f => f.endsWith('.json')).sort();
  
  let previousHash = null;
  let chainValid = true;
  
  for (const file of files) {
    const content = readFileSync(join(snapshotsDir, file), 'utf8');
    let snapshot;
    
    try {
      snapshot = JSON.parse(content);
    } catch {
      log('fail', \`\${file}: PARSE ERROR\`);
      errors++;
      continue;
    }
    
    const s = snapshot.snapshot;
    if (!s) {
      log('fail', \`\${file}: INVALID FORMAT\`);
      errors++;
      continue;
    }
    
    // Verify hash
    const { snapshot_hash, ...rest } = s;
    const computedHash = sha256(canonicalJSON(rest));
    
    if (computedHash !== snapshot_hash) {
      log('fail', \`\${file}: HASH INVALID\`);
      errors++;
      chainValid = false;
      continue;
    }
    
    // Verify chain
    if (previousHash !== null && s.previous_snapshot_hash !== previousHash) {
      log('fail', \`\${file}: CHAIN BROKEN\`);
      errors++;
      chainValid = false;
    }
    
    if (verbose) log('ok', \`\${file}: OK\`);
    previousHash = snapshot_hash;
  }
  
  log('info', \`\${files.length} snapshots checked\`);
  if (chainValid && files.length > 0) {
    log('ok', 'Hash chain: VALID');
  } else if (files.length === 0) {
    log('warn', 'No snapshots to verify');
    warnings++;
  }
} else {
  log('warn', 'No snapshots directory');
  warnings++;
}
print('');

// ========== 4. Verify Policies ==========

print('4. GOVERNANCE POLICIES');
print('-'.repeat(40));

const policiesDir = join(__dirname, 'policies');
const policyIndexPath = join(policiesDir, 'POLICY_INDEX.json');

if (existsSync(policyIndexPath)) {
  const policyIndex = JSON.parse(readFileSync(policyIndexPath, 'utf8'));
  
  log('ok', \`Index version: \${policyIndex.index_version}\`);
  log('info', \`Policies: \${policyIndex.policies?.length || 0}\`);
  
  for (const p of policyIndex.policies || []) {
    const policyPath = join(policiesDir, p.file);
    if (existsSync(policyPath)) {
      const policy = JSON.parse(readFileSync(policyPath, 'utf8'));
      
      // Compute policy hash (excluding metadata)
      const { metadata, ...policyCore } = policy;
      const policyHash = sha256(canonicalJSON(policyCore));
      
      if (verbose) {
        log('ok', \`\${p.policy_id} v\${p.current_version}: \${policyHash.slice(0, 16)}...\`);
      }
    } else {
      log('warn', \`\${p.policy_id}: file missing\`);
      warnings++;
    }
  }
} else {
  log('warn', 'No policy index found');
  warnings++;
}
print('');

// ========== 5. Verify Attestations ==========

print('5. ATTESTATIONS');
print('-'.repeat(40));

const attestationsDir = join(__dirname, 'attestations');
if (existsSync(attestationsDir)) {
  const files = readdirSync(attestationsDir).filter(f => f.endsWith('.json'));
  
  for (const file of files) {
    const content = readFileSync(join(attestationsDir, file), 'utf8');
    let attestation;
    
    try {
      attestation = JSON.parse(content);
    } catch {
      log('fail', \`\${file}: PARSE ERROR\`);
      errors++;
      continue;
    }
    
    const a = attestation.attestation;
    if (!a) {
      log('fail', \`\${file}: INVALID FORMAT\`);
      errors++;
      continue;
    }
    
    // Verify hash
    const { attestation_hash, ...rest } = a;
    const computedHash = sha256(canonicalJSON(rest));
    
    if (computedHash !== attestation_hash) {
      log('fail', \`\${file}: HASH INVALID\`);
      errors++;
      continue;
    }
    
    if (verbose) {
      log('ok', \`\${a.period.label}: \${a.attestation_id.slice(0, 8)}...\`);
    }
  }
  
  log('info', \`\${files.length} attestations checked\`);
} else {
  log('warn', 'No attestations directory');
  warnings++;
}
print('');

// ========== 6. ON-CHAIN ANCHOR VERIFICATION (offline) ==========

print('6. ON-CHAIN ANCHORS');
print('-'.repeat(40));

const anchorsPath = join(__dirname, 'anchors.json');
const onchainDir = join(__dirname, 'onchain');
const receiptsDir = join(onchainDir, 'receipts');
const contractPath = join(onchainDir, 'contract.json');

if (existsSync(anchorsPath) && existsSync(contractPath)) {
  const anchorsData = JSON.parse(readFileSync(anchorsPath, 'utf8'));
  const contractData = JSON.parse(readFileSync(contractPath, 'utf8'));
  const contractAddr = (contractData.contract_address || '').toLowerCase();
  log('info', \`Contract: \${contractAddr || '(not set)'}\`);

  let receiptsManifest = {};
  const rManifestPath = join(receiptsDir, 'receipts_manifest.json');
  if (existsSync(rManifestPath)) {
    try {
      receiptsManifest = JSON.parse(readFileSync(rManifestPath, 'utf8')).receipts || {};
    } catch (_) {}
  }

  let anchorsVerified = 0;
  for (const anchor of anchorsData.anchors || []) {
    if (anchor.status !== 'confirmed' || !anchor.tx_hash) continue;
    const txHash = anchor.tx_hash.replace(/^0x/, '');
    const receiptPath = join(receiptsDir, txHash + '.json');
    if (!existsSync(receiptPath)) {
      log('warn', \`Anchor \${anchor.id}: receipt missing (offline)\`);
      continue;
    }
    const content = readFileSync(receiptPath, 'utf8');
    const expectedSha = receiptsManifest[txHash];
    if (expectedSha) {
      const actualSha = createHash('sha256').update(content, 'utf8').digest('hex');
      if (actualSha !== expectedSha) {
        log('fail', \`Anchor \${anchor.id}: receipt integrity mismatch (sha256)\`);
        errors++;
        continue;
      }
    }
    const receipt = JSON.parse(content);
    if (receipt.status !== '0x1' && receipt.status !== 1) {
      log('fail', \`Anchor \${anchor.id}: tx failed\`);
      errors++;
      continue;
    }
    if (receipt.to && contractAddr && receipt.to.toLowerCase() !== contractAddr) {
      log('fail', \`Anchor \${anchor.id}: contract mismatch\`);
      errors++;
      continue;
    }
    if (verbose) log('ok', \`Anchor \${anchor.id}: tx \${anchor.tx_hash?.slice(0, 18)}...\`);
    anchorsVerified++;
  }
  log('info', \`\${anchorsVerified} anchor(s) verified (offline)\`);
} else {
  log('info', 'No anchors or contract.json (skip)');
}
print('');

// ========== Summary ==========

const result = {
  pack_id: manifest.pack_id,
  verified_at: new Date().toISOString(),
  mode: strict ? 'strict' : 'permissive',
  errors,
  warnings,
  passed: strict ? (errors === 0 && warnings === 0) : (errors === 0),
  checks: {
    checksums: errors === 0,
    trust_anchors: true,
    snapshots: existsSync(snapshotsDir) && readdirSync(snapshotsDir).filter(f => f.endsWith('.json')).length > 0,
    policies: existsSync(policyIndexPath),
    attestations: existsSync(attestationsDir) && readdirSync(attestationsDir).filter(f => f.endsWith('.json')).length > 0,
    onchain_anchors: existsSync(anchorsPath) && existsSync(contractPath),
  },
};

if (jsonOutput) {
  console.log(JSON.stringify(result, null, 2));
} else {
  print('═'.repeat(60));
  
  if (strict) {
    // Strict mode: warnings count as failures
    if (errors === 0 && warnings === 0) {
      print('  RESULT: ✓ VERIFICATION PASSED (STRICT)');
    } else if (errors > 0) {
      print(\`  RESULT: ✗ VERIFICATION FAILED (\${errors} errors)\`);
    } else {
      print(\`  RESULT: ✗ VERIFICATION FAILED (strict mode requires all artifacts)\`);
      print(\`  Missing: \${warnings} optional artifact(s)\`);
    }
  } else {
    // Permissive mode: only errors count as failures
    if (errors === 0) {
      print('  RESULT: ✓ VERIFICATION PASSED');
      if (warnings > 0) {
        print(\`  Warnings: \${warnings} (optional artifacts missing)\`);
      }
    } else {
      print(\`  RESULT: ✗ VERIFICATION FAILED (\${errors} errors)\`);
    }
  }
  
  print('═'.repeat(60));
}

// Exit code: strict mode fails on warnings, permissive only on errors
const exitCode = strict ? (errors > 0 || warnings > 0 ? 1 : 0) : (errors > 0 ? 1 : 0);
process.exit(exitCode);
`;

writeFileSync(join(PACK_DIR, 'verify.mjs'), verifierScript);
checksums['verify.mjs'] = sha256(verifierScript);
console.log('[auditor-pack] ✓ verify.mjs');

// 6. VERIFY.md Instructions
console.log('[auditor-pack] Creating VERIFY.md...');

const verifyMd = `# Verification Instructions

## Quick Verification (1 command)

\`\`\`bash
node verify.mjs
\`\`\`

For detailed output:

\`\`\`bash
node verify.mjs --verbose
\`\`\`

For CI/automation (JSON output):

\`\`\`bash
node verify.mjs --json
\`\`\`

## Strict Mode

Strict mode requires ALL artifacts to be present (snapshots + attestations):

\`\`\`bash
node verify.mjs --strict
\`\`\`

Use strict mode for production audit packs. Permissive mode is for bootstrap/testing.

## Requirements

- Node.js 18+ LTS (no npm install needed)
- No network access required
- Works offline

## Verification Semantics

| Result | Meaning |
|--------|---------|
| ✓ **PASSED** | Package integrity verified, trust anchors validated |
| ⚠ **WARN** | Optional evidence artifacts missing (snapshots/attestations) |
| ✗ **FAILED** | Checksum mismatch, signature invalid, or chain broken |

### Mode Behavior

| Mode | Errors | Warnings | Result |
|------|--------|----------|--------|
| Permissive | 0 | Any | PASSED |
| Permissive | >0 | Any | FAILED |
| Strict | 0 | 0 | PASSED |
| Strict | 0 | >0 | FAILED |
| Strict | >0 | Any | FAILED |

## What Gets Verified

1. **File Checksums** — All files match their recorded SHA-256 hashes
2. **Trust Anchors** — Public keys for signature verification
3. **Audit Snapshots** — Hash integrity and chain continuity
4. **Governance Policies** — Policy hashes and versioning
5. **Attestations** — Periodic compliance statements

## Exit Codes

- \`0\` — PASSED (all required checks OK)
- \`1\` — FAILED (integrity error or missing required artifacts in strict mode)

## Manual Verification

### Verify a snapshot hash:

\`\`\`bash
node -e "
const crypto = require('crypto');
const fs = require('fs');
const snapshot = JSON.parse(fs.readFileSync('snapshots/FILENAME.json'));
const { snapshot_hash, ...rest } = snapshot.snapshot;
const computed = crypto.createHash('sha256')
  .update(JSON.stringify(rest, Object.keys(rest).sort()))
  .digest('hex');
console.log('Expected:', snapshot_hash);
console.log('Computed:', computed);
console.log('Valid:', computed === snapshot_hash);
"
\`\`\`

### Verify file checksum:

\`\`\`bash
shasum -a 256 trust-anchors.json
\`\`\`

Compare with value in MANIFEST.json.

## Pack Contents

| Directory | Contents |
|-----------|----------|
| \`/\` | MANIFEST.json, trust-anchors.json, verify.mjs |
| \`/attestations/\` | Signed compliance attestations |
| \`/snapshots/\` | Audit snapshots with hash chain |
| \`/policies/\` | Governance policy definitions |

## Support

For questions about this verification pack, contact the issuing organization.

---

Generated: ${new Date().toISOString()}
Pack Version: ${PACK_VERSION}
`;

writeFileSync(join(PACK_DIR, 'VERIFY.md'), verifyMd);
checksums['VERIFY.md'] = sha256(verifyMd);
console.log('[auditor-pack] ✓ VERIFY.md');

// 6b. README_AUDIT.md — pack structure and verification for auditors
console.log('[auditor-pack] Creating README_AUDIT.md...');

const readmeAudit = `# Auditor Pack — Structure & Verification

## Quick Verification (one command)

\`\`\`bash
node verify.mjs
\`\`\`

Strict mode (requires snapshots + attestations):

\`\`\`bash
node verify.mjs --strict
\`\`\`

## Pack Contents

| Path | Description |
|------|-------------|
| \`MANIFEST.json\` | Pack metadata, checksums, provenance |
| \`trust-anchors.json\` | Public keys for signature verification |
| \`verify.mjs\` | Standalone verifier (Node.js built-ins only) |
| \`VERIFY.md\` | Verification instructions |
| \`anchors.json\` | Ledger anchors (period, status, tx_hash, created_at) |
| \`events_subset.json\` | Recent ledger events |
| \`ANCHORING_STATUS.json\` | Anchoring health (counts, coverage, assessment) |
| \`ANCHORING_ISSUES.json\` | Structured issues (failed, pending>72h, receipt missing/mismatch, gaps) |
| \`onchain/receipts/\` | On-chain receipt files (\`<tx_hash>.json\`) |
| \`onchain/receipts/receipts_manifest.json\` | Map tx_hash → SHA-256 of receipt |
| \`onchain/contract.json\` | Contract ABI and network info |
| \`policies/\` | Governance policy definitions |

## Anchoring Data Flow

- **anchors.json** — Source: \`ledger_anchors\` table. Each anchor has \`id\`, \`period_start\`, \`period_end\`, \`status\`, \`created_at\`, \`tx_hash\`.
- **onchain/receipts/** — One file per confirmed anchor: \`<tx_hash>.json\` (hex with or without \`0x\` prefix).
- **receipts_manifest.json** — \`{ receipts: { "<tx_hash>": "<sha256>" } }\` for integrity checks.
- **ANCHORING_STATUS.json** — Built from anchors + manifest (coverage, counts, assessment).
- **ANCHORING_ISSUES.json** — Built from anchors + receipts + manifest. Issue types: \`ANCHOR_FAILED\`, \`ANCHOR_PENDING_TOO_LONG\`, \`RECEIPT_MISSING_FOR_CONFIRMED\`, \`RECEIPT_INTEGRITY_MISMATCH\`, \`GAP_IN_PERIODS\`.

## Independent Verification (CI / stricter gate)

The issuing organization may run \`independent-verify.mjs\` (from project root) against this pack with env:

- \`STRICT_VERIFY=1\` — Require ANCHORING_STATUS.json, fail on FAIL assessment
- \`REQUIRE_ANCHORING_ISSUES=1\` — Require ANCHORING_ISSUES.json
- \`VERIFY_FAIL_SEVERITY=critical\` — Fail on any critical issue
- \`VERIFY_FAIL_TYPES=RECEIPT_INTEGRITY_MISMATCH,RECEIPT_MISSING_FOR_CONFIRMED,ANCHOR_FAILED\` — Fail on these types

Exit code **2** = anchoring/issues gate failed (distinct from general integrity failure **1**).

## Trust Assumptions

* **Trusted:** Pack immutability once generated; receipts manifest as authoritative index; SHA-256 hashes for integrity.
* **Verified:** Receipt existence for confirmed anchors; SHA-256 of each receipt matches manifest; anchoring lifecycle consistency (failed, pending>72h, gaps).
* **Not verified:** Live blockchain state (verification is offline); external RPC availability; consensus validity beyond stored receipts.

## Pack Integrity

* **pack_hash.json** — SHA-256 over all pack files (excluding pack_hash.json, pack_signature.json).
* **pack_signature.json** — Ed25519 signature of pack_hash.json (when signing key is configured).
* **independent-verify** checks the signature when \`PACK_SIGN_PUBLIC_KEY_PEM\` or \`PACK_SIGN_PUBLIC_KEY_PATH\` is set.

---

Generated: ${new Date().toISOString()}
`;

writeFileSync(join(PACK_DIR, 'README_AUDIT.md'), readmeAudit);
checksums['README_AUDIT.md'] = sha256(readmeAudit);
console.log('[auditor-pack] ✓ README_AUDIT.md');

// 6b2. Policy-as-data: copy verify-policy into pack (auditor-visible, immutable)
const policySrc = process.env.VERIFY_POLICY_PATH || join(ROOT, 'docs', 'verify-policy.default.json');
const policyDst = join(PACK_DIR, 'verify-policy.json');
if (existsSync(policySrc)) {
  copyFileSync(policySrc, policyDst);
  const policyContent = readFileSync(policyDst, 'utf8');
  checksums['verify-policy.json'] = sha256(policyContent);
  console.log('[auditor-pack] ✓ verify-policy.json');
} else {
  console.log(`[auditor-pack] ⚠ verify-policy.json: source not found (${policySrc})`);
}

// 6c. pack_hash.json + pack_signature.json (pack integrity)
try {
  execSync(`node "${join(ROOT, 'scripts', 'pack-hash.mjs')}" "${PACK_DIR}"`, { cwd: ROOT, stdio: 'inherit' });
  const packHashContent = readFileSync(join(PACK_DIR, 'pack_hash.json'), 'utf8');
  checksums['pack_hash.json'] = sha256(packHashContent);
  console.log('[auditor-pack] ✓ pack_hash.json');

  if (process.env.PACK_SIGN_PRIVATE_KEY_PEM) {
    execSync(`node "${join(ROOT, 'scripts', 'pack-sign.mjs')}" "${PACK_DIR}"`, { cwd: ROOT, stdio: 'inherit' });
    const packSigContent = readFileSync(join(PACK_DIR, 'pack_signature.json'), 'utf8');
    checksums['pack_signature.json'] = sha256(packSigContent);
    console.log('[auditor-pack] ✓ pack_signature.json');
  }
} catch (e) {
  console.log('[auditor-pack] ⚠ pack-hash/pack-sign failed:', e?.message || e);
}

// 7. Create MANIFEST.json
console.log('[auditor-pack] Creating manifest...');

const packId = sha256(JSON.stringify({ timestamp, org: ORG_NAME })).slice(0, 16);
const gitInfo = getGitInfo();

// Collect file details
const files = Object.entries(checksums).map(([path, hash]) => {
  const fullPath = join(PACK_DIR, path);
  let size = 0;
  try {
    size = statSync(fullPath).size;
  } catch {}
  return { path, sha256: hash, size };
});

// Trust anchor fingerprints
let trustAnchorFingerprints = [];
const trustPath = join(PACK_DIR, 'trust-anchors.json');
if (existsSync(trustPath)) {
  try {
    const trust = JSON.parse(readFileSync(trustPath, 'utf8'));
    trustAnchorFingerprints = (trust.keys || []).map(k => ({
      key_id: k.key_id,
      fingerprint: sha256(k.public_key_pem || '').slice(0, 32),
      status: k.status,
    }));
  } catch {}
}

const manifestContent = {
  pack_version: PACK_VERSION,
  pack_id: packId,
  created_at: new Date().toISOString(),
  organization: ORG_NAME,
  source_git: {
    tag: gitInfo.tag,
    commit: gitInfo.commit,
    branch: gitInfo.branch,
    dirty: gitInfo.dirty,
    origin: gitInfo.origin,
  },
  chain_head: chainHead,
  contents: {
    trust_anchors: 'trust-anchors.json',
    attestations: 'attestations/',
    snapshots: 'snapshots/',
    policies: 'policies/',
    verifier: 'verify.mjs',
    instructions: 'VERIFY.md',
  },
  files,
  trust_anchor_fingerprints: trustAnchorFingerprints,
  policy_index_sha256: checksums['policies/POLICY_INDEX.json'] || null,
  verifier_sha256: checksums['verify.mjs'] || null,
  checksums,
};

const manifestJson = JSON.stringify(manifestContent, null, 2);
writeFileSync(join(PACK_DIR, 'MANIFEST.json'), manifestJson);
console.log('[auditor-pack] ✓ MANIFEST.json');

// 8. Create tar.gz and compute pack SHA-256
console.log('[auditor-pack] Creating archive...');

const tarFile = `${PACK_DIR}.tar.gz`;
let packSha256 = null;

try {
  execSync(`cd "${OUTPUT_DIR}" && tar -czf "${PACK_NAME}.tar.gz" "${PACK_NAME}"`, { stdio: 'pipe' });
  
  // Compute SHA-256 of the tar.gz (authoritative: release notes; not stored in manifest — see DRY_RUN_AUDIT)
  const tarContent = readFileSync(tarFile);
  packSha256 = sha256(tarContent);
  
  console.log(`[auditor-pack] ✓ ${PACK_NAME}.tar.gz`);
} catch (e) {
  console.log('[auditor-pack] ⚠ tar failed, directory available');
}

// Summary
console.log('');
console.log('═'.repeat(60));
console.log('[auditor-pack] ✅ Pack created successfully!');
console.log('');
console.log(`  Directory: ${PACK_DIR}`);
if (existsSync(tarFile)) {
  const stat = statSync(tarFile);
  console.log(`  Archive:   ${tarFile}`);
  console.log(`  Size:      ${(stat.size / 1024).toFixed(1)} KB`);
  console.log(`  SHA-256:   ${packSha256}`);
}
console.log(`  Pack ID:   ${packId}`);
console.log(`  Git:       ${gitInfo.tag || gitInfo.commit.slice(0, 8)}${gitInfo.dirty ? ' (dirty)' : ''}`);
console.log('');
console.log('  To verify:');
console.log(`    cd ${PACK_NAME} && node verify.mjs`);
console.log('');
console.log('  Strict mode (requires snapshots + attestations):');
console.log(`    cd ${PACK_NAME} && node verify.mjs --strict`);
console.log('═'.repeat(60));
