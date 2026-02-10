/**
 * Unit tests for retention-service (exports, types).
 */
import type { RetentionPolicy, DeadLetterStatus } from '@/lib/retention-service';

describe('retention-service', () => {
  it('RetentionPolicy type has expected shape', () => {
    const policy: RetentionPolicy = {
      version: '1.0',
      updated_at: new Date().toISOString(),
      targets: {
        dead_letter: {
          retention_days: 90,
          max_size_mb: 100,
          rotation_threshold_lines: 10000,
        },
        keys: {
          archived_retention_years: 7,
          revoked_retention: 'never_delete',
        },
        ledger: {
          retention: 'permanent',
          deletion: 'prohibited',
        },
      },
    };
    expect(policy.targets.dead_letter.retention_days).toBe(90);
  });

  it('DeadLetterStatus type has expected shape', () => {
    const status: DeadLetterStatus = {
      current_file: null,
      archives: [],
      total_archives: 0,
      total_archived_lines: 0,
      violations: [],
    };
    expect(status.violations).toEqual([]);
  });
});
