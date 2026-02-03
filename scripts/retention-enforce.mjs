#!/usr/bin/env node
/**
 * Unified Retention Enforcement Script
 * 
 * Checks and enforces retention policies across compliance data:
 * - Dead-letter files (90 days default)
 * - Archived keys (report only - never auto-delete)
 * - Ledger events (report only - immutable)
 * 
 * Usage:
 *   node scripts/retention-enforce.mjs [options]
 * 
 * Options:
 *   --dry-run              Check only, no changes (default)
 *   --execute              Actually delete/rotate files
 *   --retention-days=N     Dead-letter retention (default: 90)
 *   --target=TARGET        Run specific target: dead-letter, keys, all (default: all)
 *   --json                 Output JSON only (for CI/monitoring)
 * 
 * Exit codes:
 *   0 - Success, no issues
 *   1 - Error during execution
 *   2 - Retention violations found (dry-run mode)
 */
import { readFileSync, writeFileSync, renameSync, unlinkSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { createHash } from 'crypto';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || './workspace';
const SYSTEM_DIR = join(WORKSPACE_ROOT, '00_SYSTEM');
const DEAD_LETTER_FILE = join(SYSTEM_DIR, 'ledger-dead-letter.jsonl');
const ARCHIVE_DIR = join(SYSTEM_DIR, 'dead-letter-archive');
const KEYS_DIR = join(SYSTEM_DIR, 'keys');

// Parse args
const args = process.argv.slice(2);
const DRY_RUN = !args.includes('--execute');
const JSON_OUTPUT = args.includes('--json');
const retentionArg = args.find(a => a.startsWith('--retention-days='));
const RETENTION_DAYS = retentionArg ? parseInt(retentionArg.split('=')[1], 10) : 90;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;
const targetArg = args.find(a => a.startsWith('--target='));
const TARGET = targetArg ? targetArg.split('=')[1] : 'all';

const KEY_RETENTION_YEARS = 3;
const KEY_RETENTION_MS = KEY_RETENTION_YEARS * 365 * 24 * 60 * 60 * 1000;

// Policy manifest (must match lib/retention-service.ts)
const POLICY = {
  version: '1.0.0',
  updated_at: '2026-02-02',
  targets: {
    dead_letter: {
      retention_days: RETENTION_DAYS,
      max_size_mb: 100,
      rotation_threshold_lines: 1000,
    },
    keys: {
      archived_retention_years: KEY_RETENTION_YEARS,
      revoked_retention: 'never_delete',
    },
    ledger: {
      retention: 'permanent',
      deletion: 'prohibited',
    },
  },
};

function computePolicyHash(policy) {
  const canonical = JSON.stringify(policy, Object.keys(policy).sort(), 0);
  return createHash('sha256').update(canonical).digest('hex').slice(0, 16);
}

function log(...msg) {
  if (!JSON_OUTPUT) console.log(...msg);
}

function warn(...msg) {
  if (!JSON_OUTPUT) console.warn(...msg);
}

// ========== Dead-Letter Retention ==========

function checkDeadLetter() {
  const result = {
    target: 'dead-letter',
    status: 'ok',
    current_file: null,
    archives: [],
    to_delete: [],
    to_rotate: false,
    actions_taken: [],
    warnings: [],
  };

  // Check current file
  if (existsSync(DEAD_LETTER_FILE)) {
    const content = readFileSync(DEAD_LETTER_FILE, 'utf8');
    const lines = content.split('\n').filter(l => l.trim()).length;
    const stat = statSync(DEAD_LETTER_FILE);
    result.current_file = {
      path: DEAD_LETTER_FILE,
      lines,
      size_bytes: stat.size,
      modified: new Date(stat.mtimeMs).toISOString(),
    };
    
    // Check if rotation needed (>100MB or >1000 lines)
    if (stat.size > 100 * 1024 * 1024 || lines > 1000) {
      result.to_rotate = true;
      result.warnings.push(`Current file needs rotation: ${lines} lines, ${(stat.size / 1024 / 1024).toFixed(2)} MB`);
    }
  }

  // Check archives
  if (existsSync(ARCHIVE_DIR)) {
    const now = Date.now();
    const archives = readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.jsonl'));
    
    for (const archive of archives) {
      const archivePath = join(ARCHIVE_DIR, archive);
      const archiveStat = statSync(archivePath);
      const ageMs = now - archiveStat.mtimeMs;
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      
      const info = {
        name: archive,
        age_days: ageDays,
        modified: new Date(archiveStat.mtimeMs).toISOString(),
        size_bytes: archiveStat.size,
      };
      result.archives.push(info);
      
      if (ageMs > RETENTION_MS) {
        result.to_delete.push(archive);
      }
    }
  }

  if (result.to_delete.length > 0 || result.to_rotate) {
    result.status = 'action_required';
  }

  return result;
}

function enforceDeadLetter(checkResult) {
  const actions = [];

  // Rotate if needed
  if (checkResult.to_rotate && checkResult.current_file) {
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const archiveName = `dead-letter-${timestamp}.jsonl`;
    const archivePath = join(ARCHIVE_DIR, archiveName);

    if (!DRY_RUN) {
      if (!existsSync(ARCHIVE_DIR)) {
        mkdirSync(ARCHIVE_DIR, { recursive: true });
      }
      renameSync(DEAD_LETTER_FILE, archivePath);
      writeFileSync(DEAD_LETTER_FILE, '', 'utf8');
    }
    
    actions.push({
      action: 'rotate',
      file: checkResult.current_file.path,
      archive: archiveName,
      lines: checkResult.current_file.lines,
      dry_run: DRY_RUN,
    });
    log(`[dead-letter] Rotated ${checkResult.current_file.lines} lines → ${archiveName}${DRY_RUN ? ' (dry-run)' : ''}`);
  }

  // Delete old archives
  for (const archive of checkResult.to_delete) {
    const archivePath = join(ARCHIVE_DIR, archive);
    
    if (!DRY_RUN) {
      unlinkSync(archivePath);
    }
    
    actions.push({
      action: 'delete',
      file: archive,
      dry_run: DRY_RUN,
    });
    log(`[dead-letter] Deleted old archive: ${archive}${DRY_RUN ? ' (dry-run)' : ''}`);
  }

  return actions;
}

// ========== Keys Retention ==========

function checkKeys() {
  const result = {
    target: 'keys',
    status: 'ok',
    active: null,
    archived: [],
    revoked: [],
    warnings: [],
    // Keys are never auto-deleted, but we report status
    retention_status: [],
  };

  const activeDir = join(KEYS_DIR, 'active');
  const archivedDir = join(KEYS_DIR, 'archived');

  // Check active key
  if (existsSync(activeDir)) {
    const keyIdFile = join(activeDir, 'key_id.txt');
    if (existsSync(keyIdFile)) {
      result.active = {
        key_id: readFileSync(keyIdFile, 'utf8').trim(),
        path: activeDir,
      };
    }
  }

  // Check archived keys
  if (existsSync(archivedDir)) {
    const now = Date.now();
    const keyDirs = readdirSync(archivedDir).filter(d => {
      const stat = statSync(join(archivedDir, d));
      return stat.isDirectory();
    });

    for (const keyId of keyDirs) {
      const keyDir = join(archivedDir, keyId);
      const archivedAtFile = join(keyDir, 'archived_at.txt');
      const revokedFile = join(keyDir, 'revoked.json');
      
      let archivedAt = null;
      let ageMs = 0;
      
      if (existsSync(archivedAtFile)) {
        archivedAt = readFileSync(archivedAtFile, 'utf8').trim();
        ageMs = now - new Date(archivedAt).getTime();
      }
      
      const ageDays = Math.floor(ageMs / (24 * 60 * 60 * 1000));
      const ageYears = (ageMs / (365 * 24 * 60 * 60 * 1000)).toFixed(1);
      
      const isRevoked = existsSync(revokedFile);
      let revocationInfo = null;
      
      if (isRevoked) {
        try {
          revocationInfo = JSON.parse(readFileSync(revokedFile, 'utf8'));
        } catch (e) {
          // ignore
        }
      }

      const keyInfo = {
        key_id: keyId,
        archived_at: archivedAt,
        age_days: ageDays,
        age_years: parseFloat(ageYears),
        revoked: isRevoked,
        revocation_reason: revocationInfo?.reason ?? null,
      };

      if (isRevoked) {
        result.revoked.push(keyInfo);
      } else {
        result.archived.push(keyInfo);
      }

      // Check retention status (report only)
      if (ageMs > KEY_RETENTION_MS && !isRevoked) {
        result.retention_status.push({
          key_id: keyId,
          status: 'eligible_for_review',
          reason: `Archived for ${ageYears} years (> ${KEY_RETENTION_YEARS} years)`,
        });
        result.warnings.push(`Key ${keyId} archived for ${ageYears} years - review if still needed`);
      }
    }
  }

  if (result.warnings.length > 0) {
    result.status = 'review_recommended';
  }

  return result;
}

// ========== Main ==========

function run() {
  const startTime = Date.now();
  log('');
  log('='.repeat(60));
  log('Retention Enforcement');
  log('='.repeat(60));
  log(`Mode:      ${DRY_RUN ? 'DRY-RUN (no changes)' : 'EXECUTE'}`);
  log(`Target:    ${TARGET}`);
  log(`Retention: ${RETENTION_DAYS} days (dead-letter)`);
  log(`Workspace: ${WORKSPACE_ROOT}`);
  log('='.repeat(60));
  log('');

  const report = {
    timestamp: new Date().toISOString(),
    policy_version: POLICY.version,
    policy_hash: computePolicyHash(POLICY),
    mode: DRY_RUN ? 'dry-run' : 'execute',
    targets: {},
    summary: {
      targets_checked: 0,
      actions_required: 0,
      actions_taken: 0,
      warnings: 0,
    },
    exit_code: 0,
  };

  // Dead-letter
  if (TARGET === 'all' || TARGET === 'dead-letter') {
    log('[target] dead-letter');
    log('-'.repeat(40));
    
    const check = checkDeadLetter();
    report.targets['dead-letter'] = check;
    report.summary.targets_checked++;
    
    if (check.current_file) {
      log(`  Current file: ${check.current_file.lines} lines, ${(check.current_file.size_bytes / 1024).toFixed(1)} KB`);
    } else {
      log('  Current file: none');
    }
    log(`  Archives: ${check.archives.length} files`);
    log(`  To delete: ${check.to_delete.length} (older than ${RETENTION_DAYS} days)`);
    log(`  To rotate: ${check.to_rotate}`);
    
    if (check.status === 'action_required') {
      report.summary.actions_required++;
      const actions = enforceDeadLetter(check);
      check.actions_taken = actions;
      report.summary.actions_taken += actions.length;
    }
    
    report.summary.warnings += check.warnings.length;
    for (const w of check.warnings) warn(`  ⚠ ${w}`);
    log('');
  }

  // Keys
  if (TARGET === 'all' || TARGET === 'keys') {
    log('[target] keys');
    log('-'.repeat(40));
    
    const check = checkKeys();
    report.targets['keys'] = check;
    report.summary.targets_checked++;
    
    log(`  Active key: ${check.active?.key_id ?? 'none'}`);
    log(`  Archived: ${check.archived.length}`);
    log(`  Revoked: ${check.revoked.length}`);
    log(`  Eligible for review: ${check.retention_status.length}`);
    
    report.summary.warnings += check.warnings.length;
    for (const w of check.warnings) warn(`  ⚠ ${w}`);
    log('');
  }

  // Summary
  log('='.repeat(60));
  log('Summary');
  log('='.repeat(60));
  log(`Targets checked:  ${report.summary.targets_checked}`);
  log(`Actions required: ${report.summary.actions_required}`);
  log(`Actions taken:    ${report.summary.actions_taken}${DRY_RUN ? ' (dry-run)' : ''}`);
  log(`Warnings:         ${report.summary.warnings}`);
  log(`Duration:         ${Date.now() - startTime}ms`);
  log('');

  // Exit code
  if (DRY_RUN && report.summary.actions_required > 0) {
    report.exit_code = 2;
    log('Exit code: 2 (retention violations found, run with --execute to fix)');
  } else {
    log('Exit code: 0');
  }

  // JSON output for monitoring
  if (JSON_OUTPUT) {
    console.log(JSON.stringify(report, null, 2));
  } else {
    log('');
    log('[json-report]', JSON.stringify(report));
  }

  process.exit(report.exit_code);
}

run();
