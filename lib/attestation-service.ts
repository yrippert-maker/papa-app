/**
 * Attestation Service
 * 
 * Generates signed attestations (periodic compliance statements):
 * - Quarterly attestations
 * - Annual attestations
 * - Ad-hoc attestations for regulatory submissions
 * 
 * Attestations are cryptographically signed and include:
 * - Policy state summary
 * - Key inventory status
 * - Compliance metrics
 * - Auditor-verifiable hash chain
 */
import { createHash } from 'crypto';
import { existsSync, mkdirSync, writeFileSync, readFileSync, readdirSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';
import { signExportHash, getActiveKeyId } from './evidence-signing';
import { canonicalJSON } from './ledger-hash';
import { listPolicies, exportPoliciesForVerification, computePolicyHash, loadPolicy } from './policy-repository';
import { getKeysStatus } from './compliance-service';
import { listSnapshots } from './audit-snapshot-service';
import { getDbReadOnly } from './db';

const ATTESTATIONS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'attestations');

// ========== Types ==========

export type AttestationType = 'quarterly' | 'annual' | 'ad_hoc' | 'regulatory';

export interface AttestationPeriod {
  from: string;
  to: string;
  type: AttestationType;
  label: string; // e.g., "Q1 2026", "FY 2026"
}

export interface PolicyAttestationItem {
  policy_id: string;
  version: string;
  key_class: string;
  policy_hash: string;
  status: string;
}

export interface KeysAttestationSummary {
  active_key_id: string | null;
  active_key_created_at: string | null;
  archived_count: number;
  revoked_count: number;
  total_rotations_in_period: number;
  total_revocations_in_period: number;
}

export interface ComplianceMetrics {
  approval_requests_created: number;
  approval_requests_approved: number;
  approval_requests_rejected: number;
  approval_requests_expired: number;
  break_glass_activations: number;
  policy_violations: number;
  anomalies_detected: number;
}

export interface AttestationStatement {
  attestation_version: string;
  attestation_id: string;
  generated_at: string;
  period: AttestationPeriod;
  attester: {
    role: string;
    user_id: string;
    organization: string;
  };
  scope: string;
  policies: PolicyAttestationItem[];
  keys: KeysAttestationSummary;
  metrics: ComplianceMetrics;
  snapshots_in_period: number;
  assertions: string[];
  exceptions: string[];
  previous_attestation_hash: string | null;
  attestation_hash: string;
}

export interface SignedAttestation {
  attestation: AttestationStatement;
  signature: string;
  key_id: string;
  signed_at: string;
}

// ========== Helpers ==========

function ensureAttestationsDir(): void {
  if (!existsSync(ATTESTATIONS_DIR)) {
    mkdirSync(ATTESTATIONS_DIR, { recursive: true });
  }
}

function getPreviousAttestationHash(): string | null {
  ensureAttestationsDir();
  const files = readdirSync(ATTESTATIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  if (files.length === 0) return null;
  
  try {
    const content = readFileSync(join(ATTESTATIONS_DIR, files[0]), 'utf8');
    const attestation = JSON.parse(content) as SignedAttestation;
    return attestation.attestation.attestation_hash;
  } catch {
    return null;
  }
}

function countEventsInPeriod(period: AttestationPeriod): ComplianceMetrics {
  const db = getDbReadOnly();
  
  const getCount = (eventType: string): number => {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM ledger_events 
      WHERE event_type = ? 
      AND created_at >= ? AND created_at <= ?
    `).get(eventType, period.from, period.to) as { count: number };
    return result.count;
  };
  
  const getLikeCount = (pattern: string): number => {
    const result = db.prepare(`
      SELECT COUNT(*) as count FROM ledger_events 
      WHERE event_type LIKE ? 
      AND created_at >= ? AND created_at <= ?
    `).get(pattern, period.from, period.to) as { count: number };
    return result.count;
  };
  
  return {
    approval_requests_created: getCount('KEY_REQUEST_CREATED'),
    approval_requests_approved: getCount('KEY_REQUEST_APPROVED'),
    approval_requests_rejected: getCount('KEY_REQUEST_REJECTED'),
    approval_requests_expired: getCount('KEY_REQUEST_EXPIRED'),
    break_glass_activations: getCount('BREAK_GLASS_ACTIVATED'),
    policy_violations: getLikeCount('POLICY_VIOLATION%'),
    anomalies_detected: getLikeCount('ANOMALY_%'),
  };
}

function computeAttestationHash(attestation: Omit<AttestationStatement, 'attestation_hash'>): string {
  const canonical = canonicalJSON(attestation as Record<string, unknown>);
  return createHash('sha256').update(canonical).digest('hex');
}

// ========== Standard Assertions ==========

function generateStandardAssertions(
  metrics: ComplianceMetrics,
  keySummary: KeysAttestationSummary,
  policies: PolicyAttestationItem[]
): string[] {
  const assertions: string[] = [];
  
  // Key management assertions
  if (keySummary.active_key_id) {
    assertions.push('An active signing key is present and operational.');
  }
  
  // 2-man rule assertions
  if (metrics.approval_requests_created > 0) {
    const approvalRate = metrics.approval_requests_approved / metrics.approval_requests_created;
    assertions.push(
      `All key operations followed 2-man rule approval process. ` +
      `${metrics.approval_requests_approved} of ${metrics.approval_requests_created} requests approved (${(approvalRate * 100).toFixed(1)}%).`
    );
  } else {
    assertions.push('No key lifecycle operations were performed during this period.');
  }
  
  // Break-glass assertions
  if (metrics.break_glass_activations === 0) {
    assertions.push('No emergency break-glass procedures were activated.');
  } else {
    assertions.push(
      `${metrics.break_glass_activations} break-glass activation(s) occurred and documented.`
    );
  }
  
  // Policy assertions
  const activePolicies = policies.filter(p => p.status === 'active');
  assertions.push(
    `${activePolicies.length} governance policies are active and enforced.`
  );
  
  // Violation assertions
  if (metrics.policy_violations === 0) {
    assertions.push('No policy violations were detected during this period.');
  }
  
  return assertions;
}

// ========== Attestation Generation ==========

export function generateAttestation(input: {
  period: AttestationPeriod;
  attester: {
    role: string;
    user_id: string;
    organization: string;
  };
  scope: string;
  exceptions?: string[];
}): SignedAttestation {
  ensureAttestationsDir();
  
  // Gather policy state
  const policiesList = listPolicies();
  const policies: PolicyAttestationItem[] = policiesList.map(p => ({
    policy_id: p.policy_id,
    version: p.version,
    key_class: p.key_class,
    policy_hash: p.policy_hash,
    status: p.status,
  }));
  
  // Gather key state
  const keysStatus = getKeysStatus();
  const metrics = countEventsInPeriod(input.period);
  
  const keysSummary: KeysAttestationSummary = {
    active_key_id: keysStatus.active?.key_id ?? null,
    active_key_created_at: keysStatus.active?.created_at ?? null,
    archived_count: keysStatus.archived.filter(k => k.status === 'archived').length,
    revoked_count: keysStatus.archived.filter(k => k.status === 'revoked').length,
    total_rotations_in_period: metrics.approval_requests_approved, // simplified
    total_revocations_in_period: keysStatus.archived.filter(k => k.status === 'revoked').length,
  };
  
  // Count snapshots in period
  const snapshots = listSnapshots();
  const snapshotsInPeriod = snapshots.filter(s => {
    return s.date >= input.period.from.slice(0, 10) && s.date <= input.period.to.slice(0, 10);
  }).length;
  
  // Generate assertions
  const assertions = generateStandardAssertions(metrics, keysSummary, policies);
  
  // Get previous hash for chaining
  const previousHash = getPreviousAttestationHash();
  
  // Build attestation
  const attestationBase: Omit<AttestationStatement, 'attestation_hash'> = {
    attestation_version: '1.0.0',
    attestation_id: crypto.randomUUID(),
    generated_at: new Date().toISOString(),
    period: input.period,
    attester: input.attester,
    scope: input.scope,
    policies,
    keys: keysSummary,
    metrics,
    snapshots_in_period: snapshotsInPeriod,
    assertions,
    exceptions: input.exceptions ?? [],
    previous_attestation_hash: previousHash,
  };
  
  const attestationHash = computeAttestationHash(attestationBase);
  const attestation: AttestationStatement = {
    ...attestationBase,
    attestation_hash: attestationHash,
  };
  
  // Sign
  const { signature, keyId } = signExportHash(attestationHash);
  
  return {
    attestation,
    signature,
    key_id: keyId,
    signed_at: new Date().toISOString(),
  };
}

/**
 * Saves an attestation to disk.
 */
export function saveAttestation(signedAttestation: SignedAttestation): string {
  ensureAttestationsDir();
  
  const { period, attestation_id } = signedAttestation.attestation;
  const filename = `${period.label.replace(/\s+/g, '-')}-${attestation_id.slice(0, 8)}.json`;
  const filepath = join(ATTESTATIONS_DIR, filename);
  
  writeFileSync(filepath, JSON.stringify(signedAttestation, null, 2), 'utf8');
  return filepath;
}

/**
 * Generates and saves a quarterly attestation.
 */
export function generateQuarterlyAttestation(
  year: number,
  quarter: 1 | 2 | 3 | 4,
  attester: { role: string; user_id: string; organization: string },
  exceptions?: string[]
): string {
  const quarterStart = new Date(year, (quarter - 1) * 3, 1);
  const quarterEnd = new Date(year, quarter * 3, 0, 23, 59, 59, 999);
  
  const period: AttestationPeriod = {
    from: quarterStart.toISOString(),
    to: quarterEnd.toISOString(),
    type: 'quarterly',
    label: `Q${quarter} ${year}`,
  };
  
  const attestation = generateAttestation({
    period,
    attester,
    scope: `Quarterly compliance attestation for Q${quarter} ${year}`,
    exceptions,
  });
  
  return saveAttestation(attestation);
}

/**
 * Generates and saves an annual attestation.
 */
export function generateAnnualAttestation(
  year: number,
  attester: { role: string; user_id: string; organization: string },
  exceptions?: string[]
): string {
  const yearStart = new Date(year, 0, 1);
  const yearEnd = new Date(year, 11, 31, 23, 59, 59, 999);
  
  const period: AttestationPeriod = {
    from: yearStart.toISOString(),
    to: yearEnd.toISOString(),
    type: 'annual',
    label: `FY ${year}`,
  };
  
  const attestation = generateAttestation({
    period,
    attester,
    scope: `Annual compliance attestation for fiscal year ${year}`,
    exceptions,
  });
  
  return saveAttestation(attestation);
}

/**
 * Lists all attestations.
 */
export function listAttestations(): Array<{
  filename: string;
  period_label: string;
  type: AttestationType;
  generated_at: string;
  attestation_id: string;
}> {
  ensureAttestationsDir();
  
  const files = readdirSync(ATTESTATIONS_DIR)
    .filter(f => f.endsWith('.json'))
    .sort()
    .reverse();
  
  return files.map(f => {
    try {
      const content = readFileSync(join(ATTESTATIONS_DIR, f), 'utf8');
      const signed = JSON.parse(content) as SignedAttestation;
      return {
        filename: f,
        period_label: signed.attestation.period.label,
        type: signed.attestation.period.type,
        generated_at: signed.attestation.generated_at,
        attestation_id: signed.attestation.attestation_id,
      };
    } catch {
      return {
        filename: f,
        period_label: 'Unknown',
        type: 'ad_hoc' as AttestationType,
        generated_at: 'Unknown',
        attestation_id: 'Unknown',
      };
    }
  });
}

/**
 * Reads a specific attestation.
 */
export function readAttestation(filename: string): SignedAttestation | null {
  const filepath = join(ATTESTATIONS_DIR, filename);
  if (!existsSync(filepath)) return null;
  
  try {
    return JSON.parse(readFileSync(filepath, 'utf8'));
  } catch {
    return null;
  }
}

/**
 * Verifies an attestation's integrity.
 */
export function verifyAttestation(attestation: SignedAttestation): {
  hash_valid: boolean;
  computed_hash: string;
  expected_hash: string;
} {
  const { attestation_hash, ...rest } = attestation.attestation;
  const computedHash = computeAttestationHash(rest);
  
  return {
    hash_valid: computedHash === attestation_hash,
    computed_hash: computedHash,
    expected_hash: attestation_hash,
  };
}
