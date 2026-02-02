/**
 * Tests for policy hash baseline check.
 */
import { existsSync, readFileSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const PROJECT_ROOT = join(__dirname, '../..');
const BASELINE_PATH = join(PROJECT_ROOT, 'docs/ops/POLICY_HASH_BASELINE.json');

// Policy manifest (must match the scripts)
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

function computePolicyHash(policy: typeof POLICY): string {
  const canonical = JSON.stringify(policy, Object.keys(policy).sort(), 0);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

describe('Policy Hash Baseline', () => {
  test('baseline file exists', () => {
    expect(existsSync(BASELINE_PATH)).toBe(true);
  });

  test('baseline file has required fields', () => {
    const content = readFileSync(BASELINE_PATH, 'utf8');
    const baseline = JSON.parse(content);
    
    expect(baseline).toHaveProperty('policy_version');
    expect(baseline).toHaveProperty('policy_hash');
    expect(baseline).toHaveProperty('generated_at');
    expect(baseline).toHaveProperty('algorithm');
  });

  test('baseline policy_hash matches current policy', () => {
    const content = readFileSync(BASELINE_PATH, 'utf8');
    const baseline = JSON.parse(content);
    const currentHash = computePolicyHash(POLICY);
    
    expect(baseline.policy_hash).toBe(currentHash);
  });

  test('baseline policy_version matches current policy', () => {
    const content = readFileSync(BASELINE_PATH, 'utf8');
    const baseline = JSON.parse(content);
    
    expect(baseline.policy_version).toBe(POLICY.version);
  });

  test('policy hash is deterministic', () => {
    const hash1 = computePolicyHash(POLICY);
    const hash2 = computePolicyHash(POLICY);
    
    expect(hash1).toBe(hash2);
    expect(hash1.length).toBe(16);
  });
});
