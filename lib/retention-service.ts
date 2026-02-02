/**
 * Retention Service
 * Provides retention status data for dashboard/API.
 */
import { existsSync, readdirSync, statSync, readFileSync } from 'fs';
import { join } from 'path';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || './workspace';
const SYSTEM_DIR = join(WORKSPACE_ROOT, '00_SYSTEM');
const DEAD_LETTER_FILE = join(SYSTEM_DIR, 'ledger-dead-letter.jsonl');
const ARCHIVE_DIR = join(SYSTEM_DIR, 'dead-letter-archive');
const KEYS_DIR = join(SYSTEM_DIR, 'keys');

export type RetentionPolicy = {
  version: string;
  updated_at: string;
  targets: {
    dead_letter: {
      retention_days: number;
      max_size_mb: number;
      rotation_threshold_lines: number;
    };
    keys: {
      archived_retention_years: number;
      revoked_retention: 'never_delete';
    };
    ledger: {
      retention: 'permanent';
      deletion: 'prohibited';
    };
  };
};

export type DeadLetterStatus = {
  current_file: {
    exists: boolean;
    lines: number;
    size_bytes: number;
    modified: string | null;
  } | null;
  archives: Array<{
    name: string;
    age_days: number;
    size_bytes: number;
    modified: string;
    exceeds_retention: boolean;
  }>;
  total_archives: number;
  total_archived_lines: number;
  violations: string[];
};

export type KeysStatus = {
  active: { key_id: string; created_at: string | null } | null;
  archived_count: number;
  revoked_count: number;
  oldest_archived: {
    key_id: string;
    age_years: number;
    eligible_for_review: boolean;
  } | null;
  violations: string[];
};

export type RetentionReport = {
  generated_at: string;
  policy: RetentionPolicy;
  status: {
    dead_letter: DeadLetterStatus;
    keys: KeysStatus;
  };
  summary: {
    total_violations: number;
    action_required: boolean;
  };
};

// Current policy manifest
export const RETENTION_POLICY: RetentionPolicy = {
  version: '1.0.0',
  updated_at: '2026-02-02',
  targets: {
    dead_letter: {
      retention_days: 90,
      max_size_mb: 100,
      rotation_threshold_lines: 1000,
    },
    keys: {
      archived_retention_years: 3,
      revoked_retention: 'never_delete',
    },
    ledger: {
      retention: 'permanent',
      deletion: 'prohibited',
    },
  },
};

export function getDeadLetterStatus(): DeadLetterStatus {
  const policy = RETENTION_POLICY.targets.dead_letter;
  const retentionMs = policy.retention_days * 24 * 60 * 60 * 1000;
  const violations: string[] = [];

  let currentFile = null;
  if (existsSync(DEAD_LETTER_FILE)) {
    const content = readFileSync(DEAD_LETTER_FILE, 'utf8');
    const lines = content.split('\n').filter(l => l.trim()).length;
    const stat = statSync(DEAD_LETTER_FILE);
    const sizeMb = stat.size / (1024 * 1024);

    currentFile = {
      exists: true,
      lines,
      size_bytes: stat.size,
      modified: new Date(stat.mtimeMs).toISOString(),
    };

    if (sizeMb > policy.max_size_mb) {
      violations.push(`Current file exceeds ${policy.max_size_mb}MB limit (${sizeMb.toFixed(2)}MB)`);
    }
    if (lines > policy.rotation_threshold_lines) {
      violations.push(`Current file exceeds ${policy.rotation_threshold_lines} lines (${lines} lines)`);
    }
  }

  const archives: DeadLetterStatus['archives'] = [];
  let totalArchivedLines = 0;

  if (existsSync(ARCHIVE_DIR)) {
    const now = Date.now();
    const archiveFiles = readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.jsonl'));

    for (const archive of archiveFiles) {
      const archivePath = join(ARCHIVE_DIR, archive);
      const stat = statSync(archivePath);
      const content = readFileSync(archivePath, 'utf8');
      const lines = content.split('\n').filter(l => l.trim()).length;
      totalArchivedLines += lines;

      const ageMs = now - stat.mtimeMs;
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      const exceedsRetention = ageMs > retentionMs;

      archives.push({
        name: archive,
        age_days: ageDays,
        size_bytes: stat.size,
        modified: new Date(stat.mtimeMs).toISOString(),
        exceeds_retention: exceedsRetention,
      });

      if (exceedsRetention) {
        violations.push(`Archive ${archive} exceeds ${policy.retention_days} day retention (${ageDays} days old)`);
      }
    }
  }

  return {
    current_file: currentFile,
    archives,
    total_archives: archives.length,
    total_archived_lines: totalArchivedLines,
    violations,
  };
}

export function getKeysStatus(): KeysStatus {
  const policy = RETENTION_POLICY.targets.keys;
  const retentionMs = policy.archived_retention_years * 365 * 24 * 60 * 60 * 1000;
  const violations: string[] = [];

  let active = null;
  const activeDir = join(KEYS_DIR, 'active');
  if (existsSync(activeDir)) {
    const keyIdFile = join(activeDir, 'key_id.txt');
    if (existsSync(keyIdFile)) {
      const keyId = readFileSync(keyIdFile, 'utf8').trim();
      const pubFile = join(activeDir, 'evidence-signing.pub');
      let createdAt = null;
      if (existsSync(pubFile)) {
        createdAt = new Date(statSync(pubFile).mtimeMs).toISOString();
      }
      active = { key_id: keyId, created_at: createdAt };
    }
  }

  let archivedCount = 0;
  let revokedCount = 0;
  let oldestArchived: KeysStatus['oldest_archived'] = null;

  const archivedDir = join(KEYS_DIR, 'archived');
  if (existsSync(archivedDir)) {
    const now = Date.now();
    const keyDirs = readdirSync(archivedDir).filter(d => {
      const stat = statSync(join(archivedDir, d));
      return stat.isDirectory();
    });

    for (const keyId of keyDirs) {
      const keyDir = join(archivedDir, keyId);
      const revokedFile = join(keyDir, 'revoked.json');
      const archivedAtFile = join(keyDir, 'archived_at.txt');

      const isRevoked = existsSync(revokedFile);
      if (isRevoked) {
        revokedCount++;
      } else {
        archivedCount++;

        let ageMs = 0;
        if (existsSync(archivedAtFile)) {
          const archivedAt = readFileSync(archivedAtFile, 'utf8').trim();
          ageMs = now - new Date(archivedAt).getTime();
        }

        const ageYears = ageMs / (365 * 24 * 60 * 60 * 1000);
        const eligibleForReview = ageMs > retentionMs;

        if (!oldestArchived || ageYears > oldestArchived.age_years) {
          oldestArchived = {
            key_id: keyId,
            age_years: parseFloat(ageYears.toFixed(2)),
            eligible_for_review: eligibleForReview,
          };
        }

        if (eligibleForReview) {
          violations.push(`Key ${keyId} archived for ${ageYears.toFixed(1)} years (> ${policy.archived_retention_years} years) - review recommended`);
        }
      }
    }
  }

  return {
    active,
    archived_count: archivedCount,
    revoked_count: revokedCount,
    oldest_archived: oldestArchived,
    violations,
  };
}

export function getRetentionReport(): RetentionReport {
  const deadLetter = getDeadLetterStatus();
  const keys = getKeysStatus();

  const totalViolations = deadLetter.violations.length + keys.violations.length;

  return {
    generated_at: new Date().toISOString(),
    policy: RETENTION_POLICY,
    status: {
      dead_letter: deadLetter,
      keys,
    },
    summary: {
      total_violations: totalViolations,
      action_required: totalViolations > 0,
    },
  };
}
