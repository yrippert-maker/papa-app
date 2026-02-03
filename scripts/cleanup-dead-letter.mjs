#!/usr/bin/env node
/**
 * Dead-letter retention/cleanup script.
 * - Rotates old dead-letter files (archive with timestamp)
 * - Removes archives older than retention period
 * - Prints stats for alerting integration
 * 
 * Usage:
 *   node scripts/cleanup-dead-letter.mjs [--dry-run] [--retention-days=30]
 * 
 * Environment:
 *   WORKSPACE_ROOT - workspace root (default: ./workspace)
 */
import { readFileSync, writeFileSync, renameSync, unlinkSync, readdirSync, statSync, existsSync, mkdirSync } from 'fs';
import { join, basename } from 'path';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || './workspace';
const SYSTEM_DIR = join(WORKSPACE_ROOT, '00_SYSTEM');
const DEAD_LETTER_FILE = join(SYSTEM_DIR, 'ledger-dead-letter.jsonl');
const ARCHIVE_DIR = join(SYSTEM_DIR, 'dead-letter-archive');

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const retentionArg = args.find(a => a.startsWith('--retention-days='));
const RETENTION_DAYS = retentionArg ? parseInt(retentionArg.split('=')[1], 10) : 30;
const RETENTION_MS = RETENTION_DAYS * 24 * 60 * 60 * 1000;

function getStats() {
  const stats = {
    current_file_exists: false,
    current_line_count: 0,
    current_size_bytes: 0,
    archive_count: 0,
    total_archived_lines: 0,
    oldest_archive: null,
    archives_to_delete: 0,
  };

  // Check current file
  if (existsSync(DEAD_LETTER_FILE)) {
    stats.current_file_exists = true;
    const content = readFileSync(DEAD_LETTER_FILE, 'utf8');
    stats.current_line_count = content.split('\n').filter(l => l.trim()).length;
    stats.current_size_bytes = statSync(DEAD_LETTER_FILE).size;
  }

  // Check archives
  if (existsSync(ARCHIVE_DIR)) {
    const archives = readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.jsonl'));
    stats.archive_count = archives.length;
    
    const now = Date.now();
    for (const archive of archives) {
      const archivePath = join(ARCHIVE_DIR, archive);
      const content = readFileSync(archivePath, 'utf8');
      stats.total_archived_lines += content.split('\n').filter(l => l.trim()).length;
      
      const archiveStat = statSync(archivePath);
      if (!stats.oldest_archive || archiveStat.mtimeMs < stats.oldest_archive) {
        stats.oldest_archive = archiveStat.mtimeMs;
      }
      
      if (now - archiveStat.mtimeMs > RETENTION_MS) {
        stats.archives_to_delete++;
      }
    }
  }

  return stats;
}

function rotateCurrentFile() {
  if (!existsSync(DEAD_LETTER_FILE)) {
    console.log('[cleanup] No current dead-letter file to rotate');
    return null;
  }

  const content = readFileSync(DEAD_LETTER_FILE, 'utf8');
  const lineCount = content.split('\n').filter(l => l.trim()).length;
  
  if (lineCount === 0) {
    console.log('[cleanup] Current file is empty, skipping rotation');
    return null;
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
  const archiveName = `dead-letter-${timestamp}.jsonl`;
  const archivePath = join(ARCHIVE_DIR, archiveName);

  if (!DRY_RUN) {
    if (!existsSync(ARCHIVE_DIR)) {
      mkdirSync(ARCHIVE_DIR, { recursive: true });
    }
    renameSync(DEAD_LETTER_FILE, archivePath);
    // Create empty file for new entries
    writeFileSync(DEAD_LETTER_FILE, '', 'utf8');
  }

  console.log(`[cleanup] Rotated ${lineCount} entries to ${archiveName}${DRY_RUN ? ' (dry-run)' : ''}`);
  return { archiveName, lineCount };
}

function deleteOldArchives() {
  if (!existsSync(ARCHIVE_DIR)) {
    return [];
  }

  const archives = readdirSync(ARCHIVE_DIR).filter(f => f.endsWith('.jsonl'));
  const now = Date.now();
  const deleted = [];

  for (const archive of archives) {
    const archivePath = join(ARCHIVE_DIR, archive);
    const archiveStat = statSync(archivePath);
    
    if (now - archiveStat.mtimeMs > RETENTION_MS) {
      if (!DRY_RUN) {
        unlinkSync(archivePath);
      }
      deleted.push(archive);
      console.log(`[cleanup] Deleted old archive: ${archive}${DRY_RUN ? ' (dry-run)' : ''}`);
    }
  }

  return deleted;
}

function run() {
  console.log(`[cleanup] Dead-letter cleanup started`);
  console.log(`[cleanup] WORKSPACE_ROOT: ${WORKSPACE_ROOT}`);
  console.log(`[cleanup] Retention: ${RETENTION_DAYS} days`);
  console.log(`[cleanup] Mode: ${DRY_RUN ? 'DRY-RUN' : 'LIVE'}`);
  console.log('---');

  // Get stats before
  const statsBefore = getStats();
  console.log('[stats] Before cleanup:');
  console.log(`  current_file: ${statsBefore.current_file_exists ? `${statsBefore.current_line_count} lines, ${statsBefore.current_size_bytes} bytes` : 'none'}`);
  console.log(`  archives: ${statsBefore.archive_count} files, ${statsBefore.total_archived_lines} total lines`);
  console.log(`  archives_to_delete: ${statsBefore.archives_to_delete}`);
  console.log('---');

  // Rotate current file
  const rotated = rotateCurrentFile();

  // Delete old archives
  const deleted = deleteOldArchives();

  // Get stats after
  const statsAfter = getStats();
  console.log('---');
  console.log('[stats] After cleanup:');
  console.log(`  current_file: ${statsAfter.current_file_exists ? `${statsAfter.current_line_count} lines` : 'none'}`);
  console.log(`  archives: ${statsAfter.archive_count} files`);
  console.log('---');

  // Output for alerting (JSON for easy parsing)
  const alertData = {
    timestamp: new Date().toISOString(),
    dry_run: DRY_RUN,
    retention_days: RETENTION_DAYS,
    before: statsBefore,
    rotated: rotated,
    deleted_archives: deleted.length,
    after: statsAfter,
    // Alert thresholds
    alert_high_volume: statsBefore.current_line_count > 100,
    alert_growing: statsBefore.current_line_count > 50 && statsBefore.archive_count > 5,
  };

  console.log('[alert-data]', JSON.stringify(alertData));

  if (alertData.alert_high_volume) {
    console.warn('[ALERT] High dead-letter volume detected! Consider investigating ledger issues.');
  }
  if (alertData.alert_growing) {
    console.warn('[ALERT] Dead-letter queue is growing! Check replay runbook.');
  }

  console.log('[cleanup] Done');
}

run();
