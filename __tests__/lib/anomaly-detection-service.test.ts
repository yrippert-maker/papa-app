/**
 * T3: anomaly-detection-service tests
 * STRIDE mapping, threshold/pattern detection.
 */
import {
  detectThresholdAnomaly,
  detectPatternAnomaly,
  ANOMALY_CONFIGS,
} from '@/lib/anomaly-detection-service';

jest.mock('@/lib/ledger-hash', () => ({
  appendLedgerEvent: jest.fn().mockResolvedValue(undefined),
}));

describe('anomaly-detection-service', () => {
  describe('ANOMALY_CONFIGS', () => {
    it('has AUTH-001 config with threshold detection', () => {
      const cfg = ANOMALY_CONFIGS.find((c) => c.id === 'AUTH-001');
      expect(cfg).toBeDefined();
      expect(cfg?.detection.type).toBe('threshold');
      expect((cfg?.detection.params as { count: number }).count).toBe(5);
    });

    it('has AUTH-005 config with pattern detection', () => {
      const cfg = ANOMALY_CONFIGS.find((c) => c.id === 'AUTH-005');
      expect(cfg).toBeDefined();
      expect(cfg?.detection.type).toBe('pattern');
    });
  });

  describe('detectPatternAnomaly', () => {
    it('returns anomaly for valid pattern config', () => {
      const result = detectPatternAnomaly('AUTH-005', { ip: '1.2.3.4' }, { pattern: 'default_credentials_detected' });
      expect(result).not.toBeNull();
      expect(result?.anomaly_type).toBe('AUTH-005');
      expect(result?.severity).toBe('critical');
      expect(result?.category).toBe('AUTH');
    });

    it('returns null for unknown config', () => {
      const result = detectPatternAnomaly('UNKNOWN', { ip: '1.2.3.4' }, {});
      expect(result).toBeNull();
    });
  });

  describe('detectThresholdAnomaly', () => {
    it('returns null when under threshold', () => {
      const result = detectThresholdAnomaly('AUTH-001', { ip: '1.2.3.4' }, 'ip-1');
      expect(result).toBeNull();
    });

    it('returns anomaly after exceeding threshold', () => {
      for (let i = 0; i < 5; i++) {
        detectThresholdAnomaly('AUTH-001', { ip: '1.2.3.4' }, 'group-x');
      }
      const result = detectThresholdAnomaly('AUTH-001', { ip: '1.2.3.4' }, 'group-x');
      expect(result).not.toBeNull();
      expect(result?.anomaly_type).toBe('AUTH-001');
    });
  });
});
