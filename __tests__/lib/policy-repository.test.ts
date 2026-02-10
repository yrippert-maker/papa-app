/**
 * T8: policy-repository tests
 * computePolicyHash, validatePolicy, loadPolicyIndex, exportPoliciesForVerification.
 */
import {
  computePolicyHash,
  validatePolicy,
  loadPolicyIndex,
  exportPoliciesForVerification,
  type ApprovalPolicy,
  type KeyClass,
} from '@/lib/policy-repository';

// Mock fs for policy index and files
const mockIndex = {
  index_version: '1.0.0',
  generated_at: '2024-01-01',
  description: 'Test',
  policies: [],
  schema_version: 'approval-policy-v1.json',
};

const mockFs = {
  existsSync: jest.fn((p: string) => {
    if (p.includes('POLICY_INDEX.json')) return true;
    if (p.includes('CHANGELOG.json')) return false;
    return false;
  }),
  readFileSync: jest.fn((p: string) => {
    if (p.includes('POLICY_INDEX.json')) return JSON.stringify(mockIndex);
    return '{}';
  }),
  writeFileSync: jest.fn(),
  readdirSync: jest.fn(() => []),
};
jest.mock('fs', () => mockFs);

function makePolicy(overrides: Partial<ApprovalPolicy> = {}): ApprovalPolicy {
  return {
    policy_id: 'policy-test',
    version: '1.0.0',
    name: 'Test Policy',
    description: 'Test',
    key_class: 'standard',
    approval_requirements: {
      min_approvers: 2,
      total_pool: 5,
      quorum_type: 'n_of_any',
    },
    timeouts: { approval_hours: 24, execution_hours: 1 },
    constraints: {
      require_different_teams: false,
      require_different_orgs: false,
      require_senior_approver: false,
      blocked_hours: [],
    },
    scope: { org_id: null, team_id: null },
    enabled: true,
    metadata: {
      created_at: '2024-01-01',
      created_by: 'u1',
      approved_at: '2024-01-01',
      approved_by: 'u1',
      effective_date: '2024-01-01',
      review_date: '2025-01-01',
      deprecated: false,
      superseded_by: null,
    },
    ...overrides,
  };
}

describe('policy-repository', () => {
  describe('computePolicyHash', () => {
    it('returns deterministic 64-char hex hash', () => {
      const policy = makePolicy();
      const h1 = computePolicyHash(policy);
      const h2 = computePolicyHash(policy);
      expect(h1).toBe(h2);
      expect(h1).toMatch(/^[a-f0-9]{64}$/);
    });

    it('excludes metadata from hash', () => {
      const p1 = makePolicy({ metadata: { ...makePolicy().metadata, created_by: 'a' } });
      const p2 = makePolicy({ metadata: { ...makePolicy().metadata, created_by: 'b' } });
      const h1 = computePolicyHash(p1);
      const h2 = computePolicyHash(p2);
      expect(h1).toBe(h2);
    });

    it('different policy content produces different hash', () => {
      const p1 = makePolicy({ policy_id: 'policy-a' });
      const p2 = makePolicy({ policy_id: 'policy-b' });
      expect(computePolicyHash(p1)).not.toBe(computePolicyHash(p2));
    });
  });

  describe('validatePolicy', () => {
    it('valid policy returns valid: true', () => {
      const policy = makePolicy();
      const result = validatePolicy(policy);
      expect(result.valid).toBe(true);
      expect(result.errors).toHaveLength(0);
    });

    it('invalid policy_id format', () => {
      const policy = makePolicy({ policy_id: 'invalid' });
      const result = validatePolicy(policy);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('policy_id'))).toBe(true);
    });

    it('invalid version format', () => {
      const policy = makePolicy({ version: 'v1' });
      const result = validatePolicy(policy);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('version'))).toBe(true);
    });

    it('invalid key_class', () => {
      const policy = makePolicy({ key_class: 'invalid' as KeyClass });
      const result = validatePolicy(policy);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('key_class'))).toBe(true);
    });

    it('min_approvers out of range', () => {
      const policy = makePolicy({
        approval_requirements: { min_approvers: 1, total_pool: 5, quorum_type: 'n_of_any' },
      });
      const result = validatePolicy(policy);
      expect(result.valid).toBe(false);
      expect(result.errors.some((e) => e.includes('min_approvers'))).toBe(true);
    });

    it('approval_hours out of range', () => {
      const policy = makePolicy({ timeouts: { approval_hours: 0, execution_hours: 1 } });
      const result = validatePolicy(policy);
      expect(result.valid).toBe(false);
    });
  });

  describe('loadPolicyIndex', () => {
    it('returns empty index when file does not exist', () => {
      mockFs.existsSync.mockImplementation(() => false);
      const index = loadPolicyIndex();
      expect(index.policies).toEqual([]);
      expect(index.index_version).toBeDefined();
      expect(index.schema_version).toBeDefined();
    });

    it('returns parsed index when file exists', () => {
      mockFs.existsSync.mockImplementation((p: string) => p.includes('POLICY_INDEX.json'));
      mockFs.readFileSync.mockImplementation((p: string) =>
        p.includes('POLICY_INDEX.json') ? JSON.stringify(mockIndex) : '{}'
      );
      const index = loadPolicyIndex();
      expect(index.policies).toEqual([]);
      expect(index.description).toBe('Test');
    });
  });

  describe('exportPoliciesForVerification', () => {
    it('returns exported_at, policies, index_hash', () => {
      mockFs.existsSync.mockImplementation((p: string) => p.includes('POLICY_INDEX.json'));
      mockFs.readFileSync.mockImplementation((p: string) =>
        p.includes('POLICY_INDEX.json') ? JSON.stringify(mockIndex) : '{}'
      );
      const result = exportPoliciesForVerification();
      expect(result).toHaveProperty('exported_at');
      expect(Array.isArray(result.policies)).toBe(true);
      expect(result.index_hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
