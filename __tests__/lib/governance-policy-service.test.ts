/**
 * T1: governance-policy-service tests
 * N-of-M approval, policy CRUD, delegation logic.
 */
import { getPolicy, listPolicies } from '@/lib/governance-policy-service';
import type { KeyClass } from '@/lib/governance-policy-service';

// Mock db and fs - governance-policy uses WORKSPACE_ROOT and loadPolicies from file
jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
  getDbReadOnly: jest.fn(),
  dbGet: jest.fn(),
  dbAll: jest.fn(),
  dbRun: jest.fn(),
}));

jest.mock('@/lib/config', () => ({
  WORKSPACE_ROOT: '/tmp/test-governance',
}));

describe('governance-policy-service', () => {
  describe('getPolicy', () => {
    it('returns policy for standard key class', () => {
      const policy = getPolicy('standard');
      expect(policy).toBeDefined();
      expect(policy.key_class).toBe('standard');
      expect(policy.required_approvals).toBe(2);
      expect(policy.enabled).toBe(true);
    });

    it('returns policy for critical key class', () => {
      const policy = getPolicy('critical');
      expect(policy.key_class).toBe('critical');
      expect(policy.required_approvals).toBe(3);
      expect(policy.require_different_teams).toBe(true);
    });

    it('returns policy for root key class', () => {
      const policy = getPolicy('root');
      expect(policy.key_class).toBe('root');
      expect(policy.required_approvals).toBe(4);
      expect(policy.total_approvers).toBe(5);
    });
  });

  describe('listPolicies', () => {
    it('returns array of policies', () => {
      const policies = listPolicies();
      expect(Array.isArray(policies)).toBe(true);
    });
  });

  describe('policy structure', () => {
    it('policy has required fields', () => {
      const policy = getPolicy('standard');
      expect(policy).toHaveProperty('policy_id');
      expect(policy).toHaveProperty('name');
      expect(policy).toHaveProperty('description');
      expect(policy).toHaveProperty('key_class');
      expect(policy).toHaveProperty('required_approvals');
      expect(policy).toHaveProperty('total_approvers');
      expect(policy).toHaveProperty('approval_timeout_hours');
      expect(policy).toHaveProperty('execution_timeout_hours');
      expect(policy).toHaveProperty('enabled');
    });
  });
});
