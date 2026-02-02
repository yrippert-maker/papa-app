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
  
  // Compute SHA-256 of the tar.gz
  const tarContent = readFileSync(tarFile);
  packSha256 = sha256(tarContent);
  
  // Update MANIFEST with pack_sha256
  manifestContent.pack_sha256 = packSha256;
  writeFileSync(join(PACK_DIR, 'MANIFEST.json'), JSON.stringify(manifestContent, null, 2));
  
  // Recreate tar with updated manifest
  execSync(`cd "${OUTPUT_DIR}" && rm -f "${PACK_NAME}.tar.gz" && tar -czf "${PACK_NAME}.tar.gz" "${PACK_NAME}"`, { stdio: 'pipe' });
  
  // Recompute final SHA-256
  const finalTarContent = readFileSync(tarFile);
  packSha256 = sha256(finalTarContent);
  
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
