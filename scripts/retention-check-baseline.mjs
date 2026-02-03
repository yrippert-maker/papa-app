#!/usr/bin/env node
/**
 * Policy Hash Baseline Check
 * 
 * Compares current policy hash against repo-backed baseline.
 * Used in CI to detect policy drift.
 * 
 * Usage:
 *   node scripts/retention-check-baseline.mjs           # Check
 *   node scripts/retention-check-baseline.mjs --update  # Update baseline
 * 
 * Exit codes:
 *   0 - OK (hashes match)
 *   1 - Error (file not found, parse error, dirty git tree for --update)
 *   2 - Drift detected (hashes differ)
 */
import { readFileSync, writeFileSync, existsSync } from 'fs';
import { execSync } from 'child_process';
import { createHash } from 'crypto';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const PROJECT_ROOT = join(__dirname, '..');

const BASELINE_PATH = join(PROJECT_ROOT, 'docs/ops/POLICY_HASH_BASELINE.json');

// Policy manifest (must match lib/retention-service.ts and scripts/retention-enforce.mjs)
const POLICY = {
  version: '1.0.0',
  updated_at: '2026-02-02',
  targets: {
    dead_letter: {
      retention_days: 90,
      max_size_mb: 100,
      rotation_threshold_lines: 1000,
    },
    keys: {
      archived_retention_years: 3,
      revoked_retention: 'never_delete',
    },
    ledger: {
      retention: 'permanent',
      deletion: 'prohibited',
    },
  },
};

function computePolicyHash(policy) {
  const canonical = JSON.stringify(policy, Object.keys(policy).sort(), 0);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function readBaseline() {
  if (!existsSync(BASELINE_PATH)) {
    return null;
  }
  try {
    const content = readFileSync(BASELINE_PATH, 'utf8');
    return JSON.parse(content);
  } catch (e) {
    console.error(`[baseline] Error reading ${BASELINE_PATH}:`, e.message);
    return null;
  }
}

function isGitClean() {
  try {
    const status = execSync('git status --porcelain', { encoding: 'utf8' });
    return status.trim() === '';
  } catch (e) {
    console.error('[baseline] Error checking git status:', e.message);
    return false;
  }
}

function updateBaseline() {
  // Check for clean git tree
  if (!isGitClean()) {
    console.error('[baseline] ERROR: Git tree is not clean');
    console.error('[baseline] Commit or stash changes before updating baseline');
    process.exit(1);
  }

  const currentHash = computePolicyHash(POLICY);
  const newBaseline = {
    policy_version: POLICY.version,
    policy_hash: currentHash,
    generated_at: new Date().toISOString(),
    algorithm: 'sha256(canonical json), truncated 16 hex',
  };

  try {
    writeFileSync(BASELINE_PATH, JSON.stringify(newBaseline, null, 2) + '\n', 'utf8');
    console.log('[baseline] Updated successfully');
    console.log(`[baseline] policy_version: ${newBaseline.policy_version}`);
    console.log(`[baseline] policy_hash: ${newBaseline.policy_hash}`);
    console.log(`[baseline] File: ${BASELINE_PATH}`);
    console.log('[baseline] Remember to commit this change!');
    process.exit(0);
  } catch (e) {
    console.error('[baseline] Error writing baseline:', e.message);
    process.exit(1);
  }
}

function checkBaseline() {
  const baseline = readBaseline();
  
  if (!baseline) {
    console.error('[baseline] ERROR: Baseline file not found or invalid');
    console.error(`[baseline] Expected at: ${BASELINE_PATH}`);
    console.error('[baseline] Run: npm run retention:baseline:update');
    process.exit(1);
  }

  const currentHash = computePolicyHash(POLICY);
  const baselineHash = baseline.policy_hash;

  if (currentHash === baselineHash) {
    console.log(`[baseline] OK: policy hash matches baseline (${currentHash})`);
    console.log(`[baseline] policy_version: ${POLICY.version}`);
    process.exit(0);
  } else {
    console.error('[baseline] DRIFT DETECTED!');
    console.error(`[baseline] baseline=${baselineHash}`);
    console.error(`[baseline] current=${currentHash}`);
    console.error('[baseline] ');
    console.error('[baseline] If this is intentional, update the baseline:');
    console.error('[baseline]   npm run retention:baseline:update');
    console.error('[baseline] Then commit POLICY_HASH_BASELINE.json');
    process.exit(2);
  }
}

// Main
const args = process.argv.slice(2);

if (args.includes('--update')) {
  updateBaseline();
} else {
  checkBaseline();
}
