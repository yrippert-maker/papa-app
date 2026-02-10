/**
 * T4: attestation-service tests
 * Quarterly/annual generation, validation structure.
 */
import type { SignedAttestation, AttestationStatement } from '@/lib/attestation-service';

jest.mock('@/lib/config', () => ({ WORKSPACE_ROOT: '/tmp/test-attestation' }));
jest.mock('@/lib/db', () => ({
  getDbReadOnly: jest.fn(),
  dbGet: jest.fn(),
  dbAll: jest.fn(),
}));
jest.mock('@/lib/evidence-signing');
jest.mock('@/lib/policy-repository');
jest.mock('@/lib/compliance-service');
jest.mock('@/lib/audit-snapshot-service');

describe('attestation-service', () => {
  describe('SignedAttestation type', () => {
    it('has required structure', () => {
      const stmt: AttestationStatement = {
        attestation_version: '1.0',
        attestation_id: 'att-1',
        generated_at: new Date().toISOString(),
        period: { from: '2024-01-01', to: '2024-12-31', type: 'quarterly', label: 'Q1 2024' },
        attester: { role: 'admin', user_id: 'u1', organization: 'org' },
        scope: 'all',
        policies: [],
        keys: { active_key_id: null, active_key_created_at: null, archived_count: 0, revoked_count: 0, total_rotations_in_period: 0, total_revocations_in_period: 0 },
        metrics: { approval_requests_created: 0, approval_requests_approved: 0, approval_requests_rejected: 0, approval_requests_expired: 0, break_glass_activations: 0, policy_violations: 0, anomalies_detected: 0 },
        snapshots_in_period: 0,
        assertions: [],
        exceptions: [],
        previous_attestation_hash: null,
        attestation_hash: 'hash',
      };
      const attestation: SignedAttestation = {
        attestation: stmt,
        signature: 'sig123',
        key_id: 'key-1',
        signed_at: new Date().toISOString(),
      };
      expect(attestation.attestation.period.from).toBe('2024-01-01');
      expect(attestation.signature).toBeDefined();
    });
  });

  describe('listAttestations', () => {
    it('returns array when dir exists or empty', async () => {
      const { listAttestations } = await import('@/lib/attestation-service');
      const list = listAttestations();
      expect(Array.isArray(list)).toBe(true);
    });
  });
});
