/**
 * Tests for compliance-service.
 */
import { getVerifyStats, getDeadLetterStats } from '@/lib/compliance-service';

// Mock the metrics modules
jest.mock('@/lib/metrics/evidence-verify', () => ({
  getEvidenceVerifyMetrics: jest.fn(() => ({
    ok: 100,
    content_invalid: 5,
    key_revoked: 10,
    key_not_found: 3,
    signature_invalid: 2,
    other_error: 1,
    rate_limited: 15,
    unauthorized: 4,
  })),
}));

jest.mock('@/lib/metrics/dead-letter', () => ({
  getDeadLetterMetrics: jest.fn(() => ({
    events_total: 5,
    replay_dry_run_ok: 2,
    replay_dry_run_failed: 1,
    replay_live_ok: 3,
    replay_live_failed: 0,
  })),
}));

describe('compliance-service', () => {
  describe('getVerifyStats', () => {
    it('returns aggregated verify statistics', () => {
      const stats = getVerifyStats();
      
      expect(stats.total).toBe(140); // sum of all
      expect(stats.ok).toBe(100);
      expect(stats.errors.content_invalid).toBe(5);
      expect(stats.errors.key_revoked).toBe(10);
      expect(stats.errors.key_not_found).toBe(3);
      expect(stats.errors.signature_invalid).toBe(2);
      expect(stats.errors.other_error).toBe(1);
      expect(stats.rate_limited).toBe(15);
      expect(stats.unauthorized).toBe(4);
    });
  });

  describe('getDeadLetterStats', () => {
    it('returns dead-letter statistics', () => {
      const stats = getDeadLetterStats();
      
      expect(stats.events_total).toBe(5);
      expect(stats.replay.dry_run_ok).toBe(2);
      expect(stats.replay.dry_run_failed).toBe(1);
      expect(stats.replay.live_ok).toBe(3);
      expect(stats.replay.live_failed).toBe(0);
    });
  });
});
