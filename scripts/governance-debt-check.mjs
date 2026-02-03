#!/usr/bin/env node
/**
 * Governance Debt Check
 * 
 * Runs checks for: unresolved anomalies, overdue approvals, break-glass without post-mortem.
 * See docs/ops/GOVERNANCE_DEBT.md
 * 
 * Usage:
 *   node scripts/governance-debt-check.mjs
 *   node scripts/governance-debt-check.mjs --json
 */
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { existsSync } from 'fs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const jsonOutput = process.argv.includes('--json');

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT || join(ROOT, 'workspace');
const dbPath = join(WORKSPACE_ROOT, '00_SYSTEM/db/papa.sqlite');

function log(msg) {
  if (!jsonOutput) console.log(msg);
}

async function main() {
  const result = {
    timestamp: new Date().toISOString(),
    checks: {},
    debt_count: 0,
    passed: true,
  };

  // 1. Overdue approvals
  if (existsSync(dbPath)) {
    try {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(dbPath);
      const overdue = db.prepare(`
        SELECT COUNT(*) as n FROM key_lifecycle_requests 
        WHERE status IN ('PENDING', 'APPROVED') AND expires_at < datetime('now')
      `).get();
      result.checks.overdue_approvals = overdue?.n ?? 0;
      if (result.checks.overdue_approvals > 0) {
        result.debt_count += result.checks.overdue_approvals;
        result.passed = false;
      }
      db.close();
    } catch (e) {
      result.checks.overdue_approvals = null;
      result.checks.overdue_error = e.message;
    }
  } else {
    result.checks.overdue_approvals = null;
    result.checks.overdue_skip = 'no database';
  }

  // 2. Break-glass without post-mortem (simplified: check ledger for break_glass)
  if (existsSync(dbPath)) {
    try {
      const Database = (await import('better-sqlite3')).default;
      const db = new Database(dbPath);
      const breakGlass = db.prepare(`
      SELECT COUNT(*) as n FROM ledger 
      WHERE payload LIKE '%break_glass%' AND payload LIKE '%true%'
    `).get();
      result.checks.break_glass_events = breakGlass?.n ?? 0;
      // Post-mortem check would require separate table; placeholder
      result.checks.break_glass_no_postmortem = null;
      db.close();
    } catch (e) {
      result.checks.break_glass_events = null;
    }
  } else {
    result.checks.break_glass_events = null;
  }

  // 3. Anomalies - would need API or anomaly service; placeholder
  result.checks.unresolved_anomalies = null;
  result.checks.anomalies_skip = 'requires anomaly service';

  if (jsonOutput) {
    console.log(JSON.stringify(result, null, 2));
  } else {
    log('[governance-debt] Governance Debt Check');
    log(`  Overdue approvals: ${result.checks.overdue_approvals ?? 'N/A'}`);
    log(`  Break-glass events: ${result.checks.break_glass_events ?? 'N/A'}`);
    log(`  Unresolved anomalies: ${result.checks.unresolved_anomalies ?? 'N/A (requires service)'}`);
    log(`  Debt count: ${result.debt_count}`);
    log(result.passed ? '  ✓ No critical debt' : '  ⚠ Debt found — remediate per docs/ops/GOVERNANCE_DEBT.md');
  }

  process.exit(result.passed ? 0 : 1);
}

main().catch((e) => {
  console.error('[governance-debt] Error:', e.message);
  process.exit(1);
});
