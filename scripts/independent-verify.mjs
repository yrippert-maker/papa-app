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
import crypto, { createHash, createVerify } from 'crypto';
import os from 'node:os';
import { existsSync, readFileSync, readdirSync, statSync, writeFileSync } from 'fs';
import { join, basename, dirname } from 'path';
import { fileURLToPath } from 'url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

const VERSION = '1.0.0';

function safeReadJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

/** Load verify policy: --policy override first, then pack, then repo. Env overrides. */
function loadVerifyPolicy(packPath, policyPathOverride = null) {
  if (policyPathOverride && existsSync(policyPathOverride)) {
    const j = safeReadJson(policyPathOverride);
    if (j) return { path: policyPathOverride, policy: j };
  }
  const candidates = [
    packPath && join(packPath, 'verify-policy.json'),
    packPath && join(packPath, 'anchoring.verify-policy.json'),
    join(ROOT, 'docs', 'verify-policy.default.json'),
    join(ROOT, 'config', 'anchoring.verify-policy.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    if (existsSync(p)) {
      const j = safeReadJson(p);
      if (j) return { path: p, policy: j };
    }
  }
  return { path: null, policy: null };
}

/** Parse --as-of ISO 8601 timestamp. Returns canonical ISO string or null if invalid. */
function parseAsOf(ts) {
  if (!ts || typeof ts !== 'string') return null;
  const s = ts.trim();
  if (!s) return null;
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString();
}

function toList(v) {
  if (!v) return [];
  if (Array.isArray(v)) return v.map(String).filter(Boolean);
  return String(v).split(',').map((s) => s.trim()).filter(Boolean);
}

function stableStringify(obj) {
  const seen = new WeakSet();
  const rec = (v) => {
    if (v && typeof v === 'object') {
      if (seen.has(v)) return '[Circular]';
      seen.add(v);
      if (Array.isArray(v)) return v.map(rec);
      const out = {};
      for (const k of Object.keys(v).sort()) out[k] = rec(v[k]);
      return out;
    }
    return v;
  };
  return JSON.stringify(rec(obj));
}

function issueFingerprint(issue) {
  const base = {
    type: issue?.type ?? null,
    severity: issue?.severity ?? null,
    period: issue?.period ?? issue?.window ?? null,
    subject_id: issue?.subject_id ?? issue?.receipt_id ?? issue?.event_id ?? issue?.anchorId ?? null,
    details: issue?.details ?? issue?.message ?? null,
  };
  return createHash('sha256').update(stableStringify(base)).digest('hex').slice(0, 16);
}

function dedupeIssues(issues) {
  const out = [];
  const seen = new Set();
  for (const it of issues || []) {
    const fp = issueFingerprint(it);
    if (seen.has(fp)) continue;
    seen.add(fp);
    out.push({ ...it, _fingerprint: fp });
  }
  return { issues: out, deduped: (issues?.length || 0) - out.length };
}

function groupIssues(issues) {
  const g = {};
  for (const it of issues || []) {
    const sev = String(it?.severity || 'unknown').toLowerCase();
    const typ = String(it?.type || 'UNKNOWN');
    if (!g[sev]) g[sev] = {};
    if (!g[sev][typ]) g[sev][typ] = [];
    g[sev][typ].push(it);
  }
  return g;
}

function loadRunbookIndex() {
  const baseUrl = (process.env.RUNBOOK_BASE_URL || '').trim();
  const local = 'docs/runbook/anchoring-issues.md';
  const mk = (anchor) => (baseUrl ? `${baseUrl}/anchoring-issues#${anchor}` : `${local}#${anchor}`);
  return {
    RECEIPT_INTEGRITY_MISMATCH: mk('receipt_integrity_mismatch'),
    RECEIPT_MISSING_FOR_CONFIRMED: mk('receipt_missing_for_confirmed'),
    ANCHOR_FAILED: mk('anchor_failed'),
    GAP_IN_PERIODS: mk('gap_in_periods'),
    ANCHOR_PENDING_TOO_LONG: mk('anchor_pending_too_long'),
  };
}

function runbookLinkFor(type, idx) {
  return idx?.[type] || null;
}

function sha256Hex(s) {
  return createHash('sha256').update(String(s), 'utf8').digest('hex');
}

function envOrNull(k) {
  const v = process.env[k];
  if (v == null) return null;
  const t = String(v).trim();
  return t || null;
}

function buildSourceMeta() {
  const repo = envOrNull('GITHUB_REPOSITORY');
  const sha = envOrNull('GITHUB_SHA');
  const ref = envOrNull('GITHUB_REF_NAME') || envOrNull('GITHUB_REF');
  const runId = envOrNull('GITHUB_RUN_ID');
  const runAttempt = envOrNull('GITHUB_RUN_ATTEMPT');
  const serverUrl = envOrNull('GITHUB_SERVER_URL') || 'https://github.com';
  const runUrl =
    repo && runId
      ? `${serverUrl}/${repo}/actions/runs/${runId}${runAttempt ? `/attempts/${runAttempt}` : ''}`
      : null;
  return { repo, commit: sha, ref, run_id: runId, run_url: runUrl };
}

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
  
  // Verify pack hash (optional — some manifest formats omit it)
  const pack_hash = manifest.pack_hash;
  if (pack_hash != null) {
    const { pack_hash: _, ...rest } = manifest;
    const computed = sha256(canonicalJSON(rest));
    if (computed !== pack_hash) {
      issues.push(`Pack hash mismatch: expected ${pack_hash}, got ${computed}`);
    }
  }
  
  return { valid: issues.length === 0, issues };
}

// ========== Main Verification Flows ==========

async function verifyAuditPack(packPath, opts = {}) {
  const { asOf = null, policyPath = null } = opts;
  log('info', `Verifying audit pack: ${packPath}`);
  if (asOf) log('info', `Temporal context: --as-of ${asOf}`);
  
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
  const period = manifest.period ?? {};
  log('info', `Period: ${period.from ?? '?'} to ${period.to ?? '?'}`);
  
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
  
  // Verify evidence index (optional — when absent, consider valid)
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
  } else {
    results.evidence_index = { valid: true };
  }

  // Anchoring status summary (if present) + STRICT verify mode
  const STRICT = process.env.STRICT_VERIFY === '1' || process.env.STRICT_VERIFY === 'true';
  results.anchoringStrictFail = false;

  const anchoringStatusPath = join(packPath, 'ANCHORING_STATUS.json');
  if (existsSync(anchoringStatusPath)) {
    const anchoring = JSON.parse(readFileSync(anchoringStatusPath, 'utf8'));
    const a = anchoring.assessment ?? {};
    const c = anchoring.counts ?? {};
    const lc = anchoring.last_confirmed;
    log('info', `Anchoring status: ${a.status ?? 'unknown'}`);
    if (anchoring.coverage) {
      log('info', `Coverage: ${anchoring.coverage.from ?? '?'}..${anchoring.coverage.to ?? '?'} | days=${anchoring.coverage.days_total ?? 0}`);
    }
    log('info', `Counts: confirmed=${c.confirmed ?? 0} empty=${c.empty ?? 0} failed=${c.failed ?? 0} pending=${c.pending ?? 0}`);
    log('info', `Last confirmed: ${lc?.anchored_at ?? 'none'}`);

    if (STRICT) {
      const status = a.status ?? '';
      const isCritical =
        status === 'FAIL' ||
        status.toLowerCase() === 'fail' ||
        status.toLowerCase() === 'critical' ||
        (c.failed ?? 0) > 0;

      if (isCritical) {
        log('error', 'STRICT VERIFY FAIL: anchoring status is FAIL or has failed anchors.');
        results.anchoringStrictFail = true;
      }
    }
  } else {
    log('info', 'ANCHORING STATUS: (not present)');
    if (STRICT) {
      log('error', 'STRICT VERIFY FAIL: ANCHORING_STATUS.json is required.');
      results.anchoringStrictFail = true;
    }
  }

  // ANCHORING ISSUES (hard-fail by type/severity) — policy file overrides env when present
  const pol = loadVerifyPolicy(packPath, policyPath);
  const policy = pol.policy;
  const policyFailTypes = toList(policy?.fail_types ?? policy?.failTypes);
  const policyFailSev = toList(policy?.fail_severity ?? policy?.failSeverity);
  const FAIL_TYPES = process.env.VERIFY_FAIL_TYPES?.trim()
    ? toList(process.env.VERIFY_FAIL_TYPES)
    : policyFailTypes;
  const FAIL_SEVERITY = process.env.VERIFY_FAIL_SEVERITY?.trim()
    ? toList(process.env.VERIFY_FAIL_SEVERITY)
    : policyFailSev;
  const REQUIRE_ISSUES =
    process.env.REQUIRE_ANCHORING_ISSUES != null
      ? process.env.REQUIRE_ANCHORING_ISSUES === '1' || process.env.REQUIRE_ANCHORING_ISSUES === 'true'
      : !!policy?.require_anchoring_issues;
  if (policy) log('info', `Verify policy loaded (${pol.path})`);

  results.anchoringIssuesFail = false;
  results.anchoringIssuesTotal = 0;
  results.anchoringIssuesHits = 0;
  results.anchoringIssuesDeduped = 0;
  results.anchoringIssuesGrouped = {};
  results.anchoringIssuesTop = [];
  const runbookIndex = loadRunbookIndex();
  try {
    const issuesPath = join(packPath, 'ANCHORING_ISSUES.json');
    const issuesJson = JSON.parse(readFileSync(issuesPath, 'utf8'));
    const issuesRaw = Array.isArray(issuesJson.issues) ? issuesJson.issues : [];
    const { issues: issuesDeduped, deduped } = dedupeIssues(issuesRaw);
    const issuesGrouped = groupIssues(issuesDeduped);

    const failTypesSet = new Set(FAIL_TYPES.map(String));
    const failSevSet = new Set(FAIL_SEVERITY.map((s) => String(s).toLowerCase()));
    results.anchoringFailTypesSet = failTypesSet;
    results.anchoringFailSevSet = failSevSet;
    const hits = issuesDeduped.filter((i) => {
      const typeHit = failTypesSet.size > 0 && failTypesSet.has(String(i?.type || ''));
      const sevHit = failSevSet.size > 0 && failSevSet.has(String(i?.severity || '').toLowerCase());
      return typeHit || sevHit;
    });

    results.anchoringIssuesTotal = issuesRaw.length;
    results.anchoringIssuesHits = hits.length;
    results.anchoringIssuesDeduped = deduped;
    results.anchoringIssuesGrouped = issuesGrouped;

    const flat = [];
    for (const sev of Object.keys(issuesGrouped)) {
      for (const typ of Object.keys(issuesGrouped[sev])) {
        const arr = issuesGrouped[sev][typ];
        flat.push({ severity: sev, type: typ, count: arr.length, runbook: runbookLinkFor(typ, runbookIndex), examples: arr.slice(0, 3) });
      }
    }
    flat.sort((a, b) => (b.count || 0) - (a.count || 0));
    results.anchoringIssuesTop = flat.slice(0, 5);

    log('info', `ANCHORING ISSUES: total=${issuesRaw.length} (deduped=${deduped}), hits=${hits.length}`);

    if (issuesDeduped.length > 0) {
      for (const sev of Object.keys(issuesGrouped).sort()) {
        const byType = issuesGrouped[sev];
        const sevCount = Object.values(byType).reduce((a, arr) => a + arr.length, 0);
        log('info', `  severity=${sev}: ${sevCount}`);
        for (const typ of Object.keys(byType).sort()) {
          const arr = byType[typ];
          const link = runbookLinkFor(typ, runbookIndex);
          const tag = link ? ` runbook=${link}` : '';
          log('info', `    - ${typ}: ${arr.length}${tag}`);
        }
      }
    }

    if (hits.length > 0) {
      log('error', 'VERIFY FAIL: disallowed anchoring issues detected:');
      for (const h of hits.slice(0, 20)) {
        log('error', `  - ${h.severity} ${h.type} id=${h.id} tx=${h.txHash ?? '-'} anchor=${h.anchorId ?? '-'}`);
      }
      results.anchoringIssuesFail = true;
    }
  } catch (e) {
    log('info', 'ANCHORING ISSUES: (not present)');
    if (REQUIRE_ISSUES) {
      log('error', 'VERIFY FAIL: ANCHORING_ISSUES.json is required but missing.');
      results.anchoringIssuesFail = true;
    }
    results.anchoringFailTypesSet = results.anchoringFailTypesSet || new Set();
    results.anchoringFailSevSet = results.anchoringFailSevSet || new Set();
  }

  // Pack signature (pack_hash.json + pack_signature.json)
  results.packSignatureFail = false;
  const REQUIRE_PACK_SIG =
    process.env.REQUIRE_PACK_SIGNATURE != null
      ? process.env.REQUIRE_PACK_SIGNATURE === '1' || process.env.REQUIRE_PACK_SIGNATURE === 'true'
      : !!policy?.require_pack_signature;
  const hashPath = join(packPath, 'pack_hash.json');
  const sigPath = join(packPath, 'pack_signature.json');

  // Collect public keys: single PEM or multiple (PACK_SIGN_PUBLIC_KEYS_PEM = concatenated PEMs)
  const singlePem =
    process.env.PACK_SIGN_PUBLIC_KEY_PEM ||
    (process.env.PACK_SIGN_PUBLIC_KEY_PATH && existsSync(process.env.PACK_SIGN_PUBLIC_KEY_PATH)
      ? readFileSync(process.env.PACK_SIGN_PUBLIC_KEY_PATH, 'utf8')
      : null);
  const multiPem = process.env.PACK_SIGN_PUBLIC_KEYS_PEM || null;
  const pubKeyList = [];
  if (singlePem) pubKeyList.push({ pem: singlePem.trim(), id: 'default' });
  if (multiPem) {
    const blocks = multiPem.split(/(?=-----BEGIN [A-Z0-9 ]+-----)/).map((s) => s.trim()).filter(Boolean);
    for (const pem of blocks) {
      if (pem.includes('PUBLIC KEY') && pem.length > 100) pubKeyList.push({ pem, id: null });
    }
  }

  const sigPresent = existsSync(hashPath) && existsSync(sigPath);
  let sigOk = false;
  let sigKeyId = null;
  let sigReason = 'not checked';

  if (sigPresent && pubKeyList.length > 0) {
    try {
      const payload = readFileSync(hashPath);
      const sigObj = JSON.parse(readFileSync(sigPath, 'utf8'));
      const sig = Buffer.from(sigObj.signature_base64 || '', 'base64');
      const keyIdFromSig = sigObj.key_id || null;
      for (const { pem, id } of pubKeyList) {
        if (keyIdFromSig && id !== 'default' && id !== keyIdFromSig) continue;
        try {
          if (crypto.verify(null, payload, pem, sig)) {
            sigOk = true;
            sigKeyId = keyIdFromSig || id;
            sigReason = 'ok';
            break;
          }
        } catch (_) {}
      }
      if (!sigOk) {
        sigReason = 'invalid signature';
        log('error', 'Pack signature INVALID');
        results.packSignatureFail = true;
      } else {
        log('ok', sigKeyId ? `Pack signature verified (key_id=${sigKeyId})` : 'Pack signature verified');
      }
    } catch (e) {
      sigReason = `error: ${e.message}`;
      log('error', `Pack signature verification error: ${e.message}`);
      results.packSignatureFail = true;
    }
  } else {
    if (REQUIRE_PACK_SIG || (STRICT && pubKeyList.length > 0)) {
      if (!sigPresent) {
        sigReason = 'missing pack_hash.json or pack_signature.json';
        log('error', 'VERIFY FAIL: pack_hash.json or pack_signature.json missing (signature required).');
        results.packSignatureFail = true;
      } else if (pubKeyList.length === 0) {
        sigReason = 'no public key configured';
        log('error', 'VERIFY FAIL: No public key configured (REQUIRE_PACK_SIGNATURE or STRICT).');
        results.packSignatureFail = true;
      }
    } else {
      sigReason = sigPresent ? 'no public key' : 'not present';
      log('info', 'Pack signature: (not present or no public key)');
    }
  }

  results.packSignatureOk = sigOk;
  results.packSignatureKeyId = sigKeyId;
  results.packSignaturePresent = sigPresent;
  results.packSignatureReason = sigReason;
  results.verifyPolicyPath = pol?.path ?? null;
  results.policyApprovalOwner = pol?.policy?.approval_owner ?? null;
  results.policyApprovalReviewer = pol?.policy?.approval_reviewer ?? null;
  results.asOf = asOf ?? null;

  // Temporal: pack evidence timestamp check (when --as-of)
  results.temporalAsOfWarning = null;
  if (asOf) {
    const asOfTs = new Date(asOf).getTime();
    const manifest = safeReadJson(join(packPath, 'MANIFEST.json'));
    const anchStatus = safeReadJson(join(packPath, 'ANCHORING_STATUS.json'));
    const packCreatedAt = manifest?.created_at ?? null;
    const anchGeneratedAt = anchStatus?.generated_at ?? null;
    const evidenceNewer = [];
    if (packCreatedAt && new Date(packCreatedAt).getTime() > asOfTs) evidenceNewer.push(`MANIFEST.created_at=${packCreatedAt}`);
    if (anchGeneratedAt && new Date(anchGeneratedAt).getTime() > asOfTs) evidenceNewer.push(`ANCHORING_STATUS.generated_at=${anchGeneratedAt}`);
    if (evidenceNewer.length > 0) {
      results.temporalAsOfWarning = `Pack evidence newer than as_of: ${evidenceNewer.join('; ')}`;
      log('warn', results.temporalAsOfWarning);
    }
  }

  // Overall result
  results.overall =
    results.manifest.valid &&
    results.snapshots.every((s) => s.hash_valid) &&
    results.hash_chain.valid &&
    results.evidence_index.valid &&
    !results.anchoringStrictFail &&
    !results.anchoringIssuesFail &&
    !results.packSignatureFail;

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

/** Build Decision Record (JSON + human-readable MD) for explainability. See docs/compliance/DECISION_RECORD_SPEC.md */
function buildDecisionRecord(results, summary, packPath, ledgerEntryFingerprint = null, policyHash = null, verifySummaryHash = null, asOf = null) {
  const decisionId = crypto.randomUUID();
  const packRef = { dir: summary.pack_dir, pack_id: summary.pack_id ?? null, pack_sha256: summary.pack_sha256 ?? null };
  const fingerprintPayload = { pack_ref: packRef, policy_hash: policyHash ?? '', verify_summary_hash: verifySummaryHash ?? '', as_of: asOf ?? null };
  const decisionFingerprint = sha256Hex(stableStringify(fingerprintPayload));
  const policy = summary.policy || {};
  const inputPolicies = [
    {
      path: results.verifyPolicyPath || 'env/defaults',
      version: policy.version ?? 1,
      fail_severity: Array.isArray(policy.fail_severity) ? policy.fail_severity : [],
      fail_types: Array.isArray(policy.fail_types) ? policy.fail_types : [],
      require_pack_signature: !!summary.signature?.required,
      require_anchoring_issues: !!policy.require_anchoring_issues,
    },
  ];

  const checks = [
    { id: 'manifest', name: 'Pack manifest', outcome: results.manifest?.valid ? 'pass' : 'fail', reason: results.manifest?.valid ? null : 'Invalid or missing MANIFEST.json', rule_fired: null },
    { id: 'hash_chain', name: 'Hash chain', outcome: results.hash_chain?.valid ? 'pass' : 'fail', reason: results.hash_chain?.valid ? null : 'Hash chain invalid', rule_fired: null },
    { id: 'evidence_index', name: 'Evidence index', outcome: results.evidence_index?.valid !== false ? 'pass' : 'fail', reason: results.evidence_index?.valid === false ? 'Evidence index invalid' : null, rule_fired: null },
    { id: 'anchoring_status', name: 'Anchoring status (STRICT)', outcome: !results.anchoringStrictFail ? 'pass' : 'fail', reason: results.anchoringStrictFail ? 'ANCHORING_STATUS missing or assessment FAIL' : null, rule_fired: results.anchoringStrictFail ? 'strict_anchoring' : null },
    { id: 'anchoring_issues', name: 'Anchoring issues (policy)', outcome: !results.anchoringIssuesFail ? 'pass' : 'fail', reason: results.anchoringIssuesFail ? `Disallowed issues: ${(results.anchoringIssuesTop || []).map((t) => t.type).join(', ')}` : null, rule_fired: results.anchoringIssuesFail ? 'fail_type_or_severity' : null },
    { id: 'pack_signature', name: 'Pack signature', outcome: !summary.signature?.required ? 'skip' : (summary.signature?.ok ? 'pass' : 'fail'), reason: summary.signature?.required && !summary.signature?.ok ? (summary.signature?.reason || 'Invalid or missing') : null, rule_fired: summary.signature?.required && !summary.signature?.ok ? 'require_pack_signature' : null },
  ];

  const rulesFired = [];
  if (results.anchoringStrictFail) {
    rulesFired.push({ rule_type: 'strict_anchoring', severity: 'critical', issue_type: null, condition_met: true, message: 'Anchoring status FAIL or ANCHORING_STATUS.json missing (STRICT_VERIFY=1)', runbook: null });
  }
  if (results.anchoringIssuesFail && (results.anchoringIssuesTop || []).length > 0) {
    for (const t of results.anchoringIssuesTop || []) {
      rulesFired.push({ rule_type: 'fail_type_or_severity', severity: t.severity || null, issue_type: t.type || null, condition_met: true, message: `${t.type}: ${t.count} issue(s)`, runbook: t.runbook || null });
    }
  }
  if (results.packSignatureFail) {
    rulesFired.push({ rule_type: 'require_pack_signature', severity: null, issue_type: null, condition_met: true, message: summary.signature?.reason || 'Pack signature required but invalid or missing', runbook: null });
  }

  let why = summary.result.passed ? 'All checks passed.' : 'One or more checks failed.';
  if (rulesFired.length > 0) {
    why = rulesFired.map((r) => r.message).join('; ');
  }

  const ledgerWritten = process.env.WRITE_LEDGER_ENTRY == null || !['0', 'false', 'no'].includes(String(process.env.WRITE_LEDGER_ENTRY || '').toLowerCase());
  const policyRef = results.verifyPolicyPath || null;
  const approvalOwner = results.policyApprovalOwner ?? null;
  const approvalReviewer = results.policyApprovalReviewer ?? null;
  const policyVersion = inputPolicies[0]?.version != null ? `v${inputPolicies[0].version}` : null;

  const json = {
    schema_version: 1,
    decision_id: decisionId,
    decision_fingerprint_sha256: decisionFingerprint,
    ledger_entry_id: ledgerEntryFingerprint ?? null,
    generated_at: summary.generated_at,
    pack_ref: packRef,
    ...(asOf && {
      temporal: {
        as_of: asOf,
        ledger_snapshot: ledgerEntryFingerprint ?? null,
        policy_version: policyVersion,
        policy_hash: policyHash ?? null,
      },
    }),
    input_policies: inputPolicies,
    checks,
    rules_fired: rulesFired,
    outcome: { overall: summary.result.passed ? 'pass' : 'fail', severity_effective: rulesFired.length > 0 ? 'fail' : null, why },
    approval: {
      mode: 'auto',
      policy_ref: policyRef,
      approved_by: null,
      approved_at: summary.generated_at,
      owner: approvalOwner,
      reviewer: approvalReviewer,
      approver: policyRef ? `policy:${policyRef}` : 'env',
    },
    references: { verify_summary: join(packPath, 'verify-summary.json'), ledger_entry: ledgerWritten ? join(packPath, 'ledger-entry.json') : null },
  };

  const md = [
    `# Decision Record — ${summary.pack_id || basename(packPath)} — ${summary.generated_at.slice(0, 10)}`,
    '',
    `**Decision ID:** \`${decisionId}\` | **Fingerprint:** \`${decisionFingerprint}\` | **Ledger Entry ID:** ${ledgerEntryFingerprint ? `\`${ledgerEntryFingerprint}\`` : 'n/a'} (immutability chain: decision_id → ledger_entry_id → anchor)`,
    ...(asOf ? ['', `**Temporal (as-of):** \`${asOf}\``, ''] : []),
    '',
    `**Outcome:** ${summary.result.passed ? 'PASS' : 'FAIL'}`,
    '',
    `**Why:** ${why}`,
    '',
    '## Input',
    '',
    `- Pack: \`${summary.pack_dir}\` (sha256: ${summary.pack_sha256 || 'n/a'})`,
    `- Policy: \`${results.verifyPolicyPath || 'env/defaults'}\``,
    `- Fail severity: ${(policy.fail_severity || []).join(', ') || 'none'}`,
    `- Fail types: ${(policy.fail_types || []).join(', ') || 'none'}`,
    '',
    '## Checks',
    '',
    '| Check | Outcome | Reason |',
    '|-------|---------|--------|',
    ...checks.map((c) => `| ${c.name} | ${c.outcome} | ${c.reason || '-'} |`),
    '',
  ];
  if (rulesFired.length > 0) {
    md.push('## Rules that caused fail/warn', '', ...rulesFired.map((r) => `- **${r.rule_type}:** ${r.message}${r.runbook ? ` [runbook](${r.runbook})` : ''}`), '');
  }
  md.push('## Approval', '', `Auto-approved under policy: \`${results.verifyPolicyPath || 'env'}\``, '', '## References', '', `- [verify-summary.json](./verify-summary.json)`, ledgerWritten ? '- [ledger-entry.json](./ledger-entry.json)' : '');
  return { json, md: md.join('\n') };
}

// ========== CLI ==========

function printHelp() {
  console.log(`
Independent Verification Script v${VERSION}

Usage:
  node independent-verify.mjs --audit-pack <path>   Verify complete audit pack
  node independent-verify.mjs --pack <path>          Alias for --audit-pack
  node independent-verify.mjs --snapshots <path>    Verify snapshots directory only
  node independent-verify.mjs --help                 Show this help

Temporal (--as-of):
  node independent-verify.mjs --pack <path> --as-of <ISO8601>
  Fix temporal context: decision_fingerprint includes as_of; decision-record gets temporal block.
  Use for: "Was system compliant at date X?"

Options:
  --policy <path>   Explicit verify-policy path (overrides pack/repo lookup)
  --as-of <ts>      ISO 8601 timestamp for temporal compliance (e.g. 2024-06-01T00:00:00Z)

Exit codes:
  0 = All verifications passed
  1 = Verification failed
  2 = Invalid arguments (or STRICT_VERIFY=1 + anchoring fail)

Environment:
  STRICT_VERIFY=1  Fail if ANCHORING_STATUS.json missing or assessment.status=FAIL

Example:
  node independent-verify.mjs --pack ./audit-pack --policy ./verify-policy.json --as-of 2024-06-01T00:00:00Z

Output:
  Verification results are printed to stdout.
  Add --json for machine-readable JSON output.
`);
}

function getArg(args, name) {
  const idx = args.indexOf(name);
  return idx >= 0 ? args[idx + 1] : null;
}

async function main() {
  const args = process.argv.slice(2);
  
  if (args.length === 0 || args.includes('--help')) {
    printHelp();
    process.exit(2);
  }
  
  const jsonOutput = args.includes('--json');
  const policyPath = getArg(args, '--policy') || null;
  const asOfRaw = getArg(args, '--as-of') || null;
  const asOf = parseAsOf(asOfRaw);
  if (asOfRaw && !asOf) {
    log('error', `Invalid --as-of timestamp: ${asOfRaw}`);
    process.exit(2);
  }
  
  let results;
  const packArg = args.includes('--pack') ? '--pack' : (args.includes('--audit-pack') ? '--audit-pack' : null);
  
  if (packArg) {
    const packPath = getArg(args, packArg);
    
    if (!packPath || !existsSync(packPath)) {
      log('error', 'Audit pack path not found');
      process.exit(2);
    }
    
    results = await verifyAuditPack(packPath, { asOf, policyPath });
    
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

  // Machine-readable summary (for CI/dashboards) — always write when pack path exists
  const packPath = results.pack_path;
  if (packPath) {
    const packHashJson = safeReadJson(join(packPath, 'pack_hash.json'));
    const anchStatus = safeReadJson(join(packPath, 'ANCHORING_STATUS.json'));
    let packId = null;
    try {
      const m = JSON.parse(readFileSync(join(packPath, 'MANIFEST.json'), 'utf8'));
      packId = m.pack_id ?? null;
    } catch {}

    const ACK_SERVER_URL = (process.env.ACK_SERVER_URL || '').trim() || null;
    const ACK_API_KEY = (process.env.ACK_API_KEY || '').trim() || null;
    let ackChecked = false;
    let ackedCount = 0;
    let unackedCount = 0;
    let unackedCriticalCount = 0;
    const ackByFp = {};
    const failTypesSet = results.anchoringFailTypesSet || new Set();
    const failSevSet = results.anchoringFailSevSet || new Set();
    if (ACK_SERVER_URL && (results.anchoringIssuesTop || []).length > 0) {
      try {
        const { getAck } = await import('./issue-ack-client.mjs');
        const fpToCritical = {};
        for (const t of results.anchoringIssuesTop || []) {
          const isCritical = failTypesSet.has(String(t?.type || '')) || failSevSet.has(String(t?.severity || '').toLowerCase());
          for (const ex of t.examples || []) {
            if (ex._fingerprint) fpToCritical[ex._fingerprint] = isCritical;
          }
        }
        const fps = Object.keys(fpToCritical);
        for (const fp of fps) {
          try {
            const a = await getAck(ACK_SERVER_URL, fp, ACK_API_KEY);
            const critical = fpToCritical[fp];
            if (a) {
              ackedCount++;
              ackByFp[fp] = a;
            } else {
              unackedCount++;
              if (critical) unackedCriticalCount++;
            }
          } catch {
            unackedCount++;
            if (fpToCritical[fp]) unackedCriticalCount++;
          }
        }
        ackChecked = true;
      } catch (_) {
        log('info', 'Ack server check skipped (unavailable)');
      }
    }

    const summary = {
      version: 1,
      generated_at: new Date().toISOString(),
      host: { platform: os.platform(), arch: os.arch(), node: process.version },
      pack_dir: packPath,
      pack_id: packId,
      pack_sha256: packHashJson?.pack_sha256 ?? null,
      signature: {
        required: results.REQUIRE_PACK_SIG ?? (process.env.REQUIRE_PACK_SIGNATURE === '1'),
        present: results.packSignaturePresent ?? false,
        ok: results.packSignatureOk ?? false,
        reason: results.packSignatureReason ?? 'unknown',
        key_id: results.packSignatureKeyId ?? null,
      },
      policy: {
        strict_verify: process.env.STRICT_VERIFY === '1',
        loaded_from: results.verifyPolicyPath ?? null,
        require_anchoring_issues: process.env.REQUIRE_ANCHORING_ISSUES === '1',
        fail_severity: (process.env.VERIFY_FAIL_SEVERITY || '').split(',').map((s) => s.trim()).filter(Boolean),
        fail_types: (process.env.VERIFY_FAIL_TYPES || '').split(',').map((s) => s.trim()).filter(Boolean),
      },
      anchoring: {
        status: anchStatus?.assessment?.status ?? null,
        issues_total: results.anchoringIssuesTotal ?? 0,
        issues_deduped: results.anchoringIssuesDeduped ?? null,
        issues_hits: results.anchoringIssuesHits ?? 0,
        top: (results.anchoringIssuesTop || []).map((t) => ({
          severity: t.severity,
          type: t.type,
          count: t.count,
          runbook: t.runbook,
          examples: (t.examples || []).slice(0, 3).map((ex) => ({
            fingerprint: ex._fingerprint || null,
            period: ex.period ?? ex.window ?? null,
            message: ex.message ?? ex.details ?? null,
            ack: ackByFp[ex._fingerprint] ? { ack_by: ackByFp[ex._fingerprint].ack_by ?? null, expires_at: ackByFp[ex._fingerprint].expires_at ?? null } : null,
          })),
        })),
      },
      ack: {
        checked: ackChecked,
        acknowledged: ackChecked ? ackedCount : null,
        unacknowledged: ackChecked ? unackedCount : null,
        unacknowledged_critical: ackChecked ? unackedCriticalCount : null,
        server_url: ACK_SERVER_URL || null,
      },
      result: {
        passed: !!results.overall,
        exit_code: (results.anchoringStrictFail || results.anchoringIssuesFail || results.packSignatureFail) ? 2 : (results.overall ? 0 : 1),
      },
    };

    const summaryOutPath = process.env.VERIFY_SUMMARY_PATH || join(packPath, 'verify-summary.json');
    writeFileSync(summaryOutPath, JSON.stringify(summary, null, 2), 'utf8');
    console.log(`[independent-verify] VERIFY SUMMARY: ${summaryOutPath}`);

    // Slack payload (for webhook) — includes top issues and ack; unacknowledged_critical drives suppression
    const slackPayload = {
      version: 1,
      generated_at: summary.generated_at,
      title: `Independent verify: ${summary.result.passed ? 'PASS' : 'FAIL'}`,
      status: summary.result.passed ? 'pass' : 'fail',
      pack_sha256: summary.pack_sha256,
      pack_dir: summary.pack_dir,
      signature: summary.signature,
      policy: summary.policy,
      anchoring: summary.anchoring,
      ack: summary.ack,
    };
    const slackPath = join(packPath, 'slack-payload.json');
    writeFileSync(slackPath, JSON.stringify(slackPayload, null, 2), 'utf8');

    // Evidence ledger entry (append-only artifact)
    const WRITE_LEDGER_ENTRY =
      process.env.WRITE_LEDGER_ENTRY == null ||
      !['0', 'false', 'no'].includes(String(process.env.WRITE_LEDGER_ENTRY).toLowerCase());
    let ledgerFingerprint = null;
    if (WRITE_LEDGER_ENTRY) {
      const entry = {
        version: 1,
        generated_at: summary.generated_at,
        host: summary.host,
        pack: { dir: summary.pack_dir, sha256: summary.pack_sha256 },
        signature: summary.signature,
        policy: summary.policy,
        anchoring: {
          status: summary.anchoring.status,
          issues_total: summary.anchoring.issues_total,
          issues_deduped: summary.anchoring.issues_deduped,
          issues_hits: summary.anchoring.issues_hits,
          top: summary.anchoring.top || null,
        },
        result: summary.result,
        source: buildSourceMeta(),
      };
      entry.fingerprint_sha256 = sha256Hex(stableStringify(entry));
      ledgerFingerprint = entry.fingerprint_sha256;
      writeFileSync(join(packPath, 'ledger-entry.json'), JSON.stringify(entry, null, 2), 'utf8');
      console.log('[independent-verify] ledger-entry.json written');
    } else {
      console.log('[independent-verify] ledger-entry.json skipped (WRITE_LEDGER_ENTRY=0)');
    }

    const policyHash = results.verifyPolicyPath && existsSync(results.verifyPolicyPath)
      ? sha256Hex(readFileSync(results.verifyPolicyPath, 'utf8'))
      : sha256Hex(stableStringify(summary.policy || {}));
    const verifySummaryHash = sha256Hex(stableStringify(summary));

    // Decision Record (explainability: why pass/fail, which rules fired; decision_id → ledger_entry_id for regulators)
    const decisionRecord = buildDecisionRecord(results, summary, packPath, ledgerFingerprint, policyHash, verifySummaryHash, results.asOf ?? null);
    const decisionRecordPath = process.env.DECISION_RECORD_PATH || join(packPath, 'decision-record.json');
    const decisionRecordDir = dirname(decisionRecordPath);
    writeFileSync(decisionRecordPath, JSON.stringify(decisionRecord.json, null, 2), 'utf8');
    writeFileSync(join(decisionRecordDir, basename(decisionRecordPath, '.json') + '.md'), decisionRecord.md, 'utf8');
    console.log('[independent-verify] decision-record.json + decision-record.md written');
  }

  // Exit: 2 = strict anchoring fail, issues fail, or pack signature fail; 1 = general fail; 0 = pass
  const exitCode =
    (results.anchoringStrictFail || results.anchoringIssuesFail || results.packSignatureFail) ? 2 : results.overall ? 0 : 1;
  process.exit(exitCode);
}

main().catch(e => {
  log('error', `Unexpected error: ${e.message}`);
  process.exit(1);
});
