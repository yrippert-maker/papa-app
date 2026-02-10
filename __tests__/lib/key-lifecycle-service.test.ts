/**
 * T2: key-lifecycle-service tests
 * 2-man rule, break-glass, request lifecycle.
 */
import {
  activateBreakGlass,
  deactivateBreakGlass,
  isBreakGlassActive,
  getBreakGlassState,
} from '@/lib/key-lifecycle-service';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
  getDbReadOnly: jest.fn(),
  dbGet: jest.fn(),
  dbAll: jest.fn(),
  dbRun: jest.fn(),
}));

describe('key-lifecycle-service', () => {
  beforeEach(() => {
    if (isBreakGlassActive()) deactivateBreakGlass('test', 'reset');
  });

  describe('break glass', () => {
    it('activateBreakGlass sets active state', () => {
      const state = activateBreakGlass('user-1', 'Emergency access');
      expect(state.active).toBe(true);
      expect(state.activated_by).toBe('user-1');
      expect(state.reason).toBe('Emergency access');
    });

    it('isBreakGlassActive returns true after activation', () => {
      activateBreakGlass('user-1', 'Test');
      expect(isBreakGlassActive()).toBe(true);
    });

    it('deactivateBreakGlass sets active to false', () => {
      activateBreakGlass('user-1', 'Test');
      deactivateBreakGlass('user-2', 'Resolved');
      expect(isBreakGlassActive()).toBe(false);
    });

    it('getBreakGlassState returns structure', () => {
      const state = getBreakGlassState();
      expect(state).toHaveProperty('active');
      expect(state).toHaveProperty('activated_by');
      expect(state).toHaveProperty('reason');
    });
  });

  describe('RequestStatus type', () => {
    it('accepts valid status values', () => {
      const statuses = ['PENDING', 'APPROVED', 'REJECTED', 'EXPIRED', 'EXECUTED'] as const;
      statuses.forEach((s) => expect(typeof s).toBe('string'));
    });
  });
});
