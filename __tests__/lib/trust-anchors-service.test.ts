/**
 * T6: trust-anchors-service tests
 * Types, bundle generation, export, list.
 */
import type {
  PublicKeyAnchor,
  PolicyAnchor,
  AttestationAnchor,
  TrustAnchorsBundle,
} from '@/lib/trust-anchors-service';

jest.mock('@/lib/config', () => ({ WORKSPACE_ROOT: '/tmp/test-trust-anchors' }));
jest.mock('@/lib/policy-repository', () => ({
  exportPoliciesForVerification: jest.fn(() => ({
    policies: [
      { policy_id: 'policy-1', version: '1.0.0', key_class: 'standard', policy_hash: 'abc123', file: 'policy-1.json' },
    ],
  })),
}));
jest.mock('@/lib/attestation-service', () => ({
  listAttestations: jest.fn(() => []),
  readAttestation: jest.fn(() => null),
}));

// Mock fs to avoid real filesystem
const mockFs = {
  existsSync: jest.fn(() => false),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(() => []),
  statSync: jest.fn(),
};
jest.mock('fs', () => mockFs);

describe('trust-anchors-service', () => {
  describe('type shapes', () => {
    it('PublicKeyAnchor has required fields', () => {
      const key: PublicKeyAnchor = {
        key_id: 'key-1',
        algorithm: 'Ed25519',
        public_key_pem: '-----BEGIN PUBLIC KEY-----',
        fingerprint: 'fp123',
        status: 'active',
        created_at: null,
        revoked_at: null,
        revocation_reason: null,
      };
      expect(key.status).toBe('active');
      expect(key.algorithm).toBe('Ed25519');
    });

    it('PolicyAnchor has required fields', () => {
      const policy: PolicyAnchor = {
        policy_id: 'policy-1',
        version: '1.0.0',
        key_class: 'standard',
        policy_hash: 'hash',
      };
      expect(policy.key_class).toBe('standard');
    });

    it('AttestationAnchor has required fields', () => {
      const att: AttestationAnchor = {
        attestation_id: 'att-1',
        period_label: 'Q1 2024',
        attestation_hash: 'hash',
        signed_at: '2024-01-01T00:00:00Z',
        key_id: 'key-1',
      };
      expect(att.period_label).toBe('Q1 2024');
    });

    it('TrustAnchorsBundle has required structure', () => {
      const bundle: TrustAnchorsBundle = {
        bundle_version: '1.0.0',
        bundle_id: 'id',
        generated_at: '2024-01-01',
        organization: 'org',
        keys: [],
        policies: [],
        attestations: [],
        chain_root: {
          first_attestation_hash: null,
          latest_attestation_hash: null,
          total_attestations: 0,
        },
        bundle_hash: 'hash',
      };
      expect(bundle.chain_root.total_attestations).toBe(0);
      expect(bundle.bundle_version).toBe('1.0.0');
    });
  });

  describe('exportPublicKeysOnly', () => {
    it('returns exported_at and keys array', () => {
      const { exportPublicKeysOnly } = require('@/lib/trust-anchors-service');
      const result = exportPublicKeysOnly();
      expect(result).toHaveProperty('exported_at');
      expect(Array.isArray(result.keys)).toBe(true);
    });
  });

  describe('listTrustAnchorsBundles', () => {
    it('returns array', () => {
      mockFs.readdirSync.mockReturnValue([]);
      const { listTrustAnchorsBundles } = require('@/lib/trust-anchors-service');
      const list = listTrustAnchorsBundles();
      expect(Array.isArray(list)).toBe(true);
    });
  });

  describe('generateTrustAnchorsBundle', () => {
    it('produces bundle with hashes and chain_root', () => {
      const { generateTrustAnchorsBundle } = require('@/lib/trust-anchors-service');
      const bundle = generateTrustAnchorsBundle('TestOrg');
      expect(bundle.organization).toBe('TestOrg');
      expect(bundle.bundle_version).toBe('1.0.0');
      expect(bundle.bundle_id).toBeDefined();
      expect(bundle.bundle_hash).toMatch(/^[a-f0-9]{64}$/);
      expect(bundle.chain_root).toEqual({
        first_attestation_hash: null,
        latest_attestation_hash: null,
        total_attestations: 0,
      });
      expect(Array.isArray(bundle.policies)).toBe(true);
      expect(Array.isArray(bundle.keys)).toBe(true);
    });
  });

  describe('exportTrustAnchors', () => {
    it('returns filepath and bundle', () => {
      const { exportTrustAnchors } = require('@/lib/trust-anchors-service');
      const { filepath, bundle } = exportTrustAnchors('Org');
      expect(filepath).toContain('trust-anchors-');
      expect(filepath).toContain('.json');
      expect(bundle.organization).toBe('Org');
    });
  });
});
