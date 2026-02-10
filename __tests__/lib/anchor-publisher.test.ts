/**
 * T7: anchor-publisher tests
 * publishAnchor, publishRollupAnchor, confirmAnchor early returns when env not set.
 */
import { publishAnchor, publishRollupAnchor, confirmAnchor } from '@/lib/anchor-publisher';

jest.mock('@/lib/db', () => ({
  getDb: jest.fn(),
  dbGet: jest.fn(),
  dbRun: jest.fn(),
}));

const originalEnv = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...originalEnv };
});

afterAll(() => {
  process.env = originalEnv;
});

describe('anchor-publisher', () => {
  describe('publishAnchor', () => {
    it('returns error when ANCHORING_PUBLISH_ENABLED is not set', async () => {
      delete process.env.ANCHORING_PUBLISH_ENABLED;
      const result = await publishAnchor('anchor-123');
      expect(result.ok).toBe(false);
      expect(result.anchor_id).toBe('anchor-123');
      expect(result.error).toContain('ANCHORING_PUBLISH_ENABLED');
    });

    it('returns error when ANCHORING_PUBLISH_ENABLED is not "true"', async () => {
      process.env.ANCHORING_PUBLISH_ENABLED = 'false';
      const result = await publishAnchor('anchor-123');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('ANCHORING_PUBLISH_ENABLED');
    });

    it('returns error when ANCHOR_* env not set', async () => {
      process.env.ANCHORING_PUBLISH_ENABLED = 'true';
      delete process.env.ANCHOR_RPC_URL;
      delete process.env.ANCHOR_CHAIN_ID;
      delete process.env.ANCHOR_CONTRACT_ADDRESS;
      delete process.env.ANCHOR_PUBLISHER_PRIVATE_KEY;
      const result = await publishAnchor('anchor-123');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('ANCHOR_*');
    });
  });

  describe('publishRollupAnchor', () => {
    it('returns error when ANCHORING_PUBLISH_ENABLED is not set', async () => {
      delete process.env.ANCHORING_PUBLISH_ENABLED;
      const result = await publishRollupAnchor({
        date_utc: '2024-01-15',
        merkle_root_sha256: 'abc123',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('ANCHORING_PUBLISH_ENABLED');
    });

    it('returns error when ANCHOR_* env not set', async () => {
      process.env.ANCHORING_PUBLISH_ENABLED = 'true';
      delete process.env.ANCHOR_RPC_URL;
      const result = await publishRollupAnchor({
        date_utc: '2024-01-15',
        merkle_root_sha256: 'abc123',
      });
      expect(result.ok).toBe(false);
      expect(result.error).toContain('ANCHOR_*');
    });
  });

  describe('confirmAnchor', () => {
    it('returns error when ANCHORING_CONFIRM_ENABLED is not set', async () => {
      delete process.env.ANCHORING_CONFIRM_ENABLED;
      const result = await confirmAnchor('anchor-123');
      expect(result.ok).toBe(false);
      expect(result.anchor_id).toBe('anchor-123');
      expect(result.error).toContain('ANCHORING_CONFIRM_ENABLED');
    });

    it('returns error when ANCHORING_CONFIRM_ENABLED is not "true"', async () => {
      process.env.ANCHORING_CONFIRM_ENABLED = 'false';
      const result = await confirmAnchor('anchor-123');
      expect(result.ok).toBe(false);
      expect(result.error).toContain('ANCHORING_CONFIRM_ENABLED');
    });
  });
});
