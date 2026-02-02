/**
 * Unit tests for lib/inspection/transitions — state machine.
 */
import { isValidTransition, isImmutable, validateTransition, canWriteCheckResults } from '@/lib/inspection/transitions';

describe('inspection transitions', () => {
  describe('isValidTransition', () => {
    it('allows DRAFT → IN_PROGRESS', () => {
      expect(isValidTransition('DRAFT', 'IN_PROGRESS')).toBe(true);
    });

    it('allows DRAFT → CANCELLED', () => {
      expect(isValidTransition('DRAFT', 'CANCELLED')).toBe(true);
    });

    it('allows IN_PROGRESS → COMPLETED', () => {
      expect(isValidTransition('IN_PROGRESS', 'COMPLETED')).toBe(true);
    });

    it('allows IN_PROGRESS → CANCELLED', () => {
      expect(isValidTransition('IN_PROGRESS', 'CANCELLED')).toBe(true);
    });

    it('rejects COMPLETED → IN_PROGRESS', () => {
      expect(isValidTransition('COMPLETED', 'IN_PROGRESS')).toBe(false);
    });

    it('rejects DRAFT → COMPLETED', () => {
      expect(isValidTransition('DRAFT', 'COMPLETED')).toBe(false);
    });

    it('rejects CANCELLED → IN_PROGRESS', () => {
      expect(isValidTransition('CANCELLED', 'IN_PROGRESS')).toBe(false);
    });
  });

  describe('isImmutable', () => {
    it('returns true for COMPLETED', () => {
      expect(isImmutable('COMPLETED')).toBe(true);
    });

    it('returns false for DRAFT', () => {
      expect(isImmutable('DRAFT')).toBe(false);
    });

    it('returns false for IN_PROGRESS', () => {
      expect(isImmutable('IN_PROGRESS')).toBe(false);
    });

    it('returns false for CANCELLED', () => {
      expect(isImmutable('CANCELLED')).toBe(false);
    });
  });

  describe('validateTransition', () => {
    it('passes for valid transition DRAFT → IN_PROGRESS', () => {
      expect(() => validateTransition('DRAFT', 'IN_PROGRESS')).not.toThrow();
    });

    it('throws for invalid transition DRAFT → COMPLETED', () => {
      expect(() => validateTransition('DRAFT', 'COMPLETED')).toThrow('Invalid transition');
    });

    it('throws when current status is COMPLETED', () => {
      expect(() => validateTransition('COMPLETED', 'IN_PROGRESS')).toThrow('Card is COMPLETED');
    });

    it('throws for invalid transition COMPLETED → CANCELLED', () => {
      expect(() => validateTransition('COMPLETED', 'CANCELLED')).toThrow('Card is COMPLETED');
    });
  });

  describe('canWriteCheckResults', () => {
    it('returns true for DRAFT', () => {
      expect(canWriteCheckResults('DRAFT')).toBe(true);
    });
    it('returns true for IN_PROGRESS', () => {
      expect(canWriteCheckResults('IN_PROGRESS')).toBe(true);
    });
    it('returns false for COMPLETED', () => {
      expect(canWriteCheckResults('COMPLETED')).toBe(false);
    });
    it('returns false for CANCELLED', () => {
      expect(canWriteCheckResults('CANCELLED')).toBe(false);
    });
  });
});
