/**
 * Anchoring health service — computes OK | DELAYED | FAILED.
 * Source: ledger_anchors.
 */
import { getDbReadOnly, dbGet } from './db';
import { join } from 'path';
import { existsSync } from 'fs';
import { createHash } from 'crypto';
import { readFileSync } from 'fs';
import { WORKSPACE_ROOT } from './config';
import type { AnchoringHealth, AnchoringStatus } from './types/anchoring';

const OK_HOURS = 36;
const DELAYED_HOURS = 72;
const WINDOW_DAYS = 30;
const PENDING_THRESHOLD_HOURS = 72;

const RECEIPTS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'anchor-receipts');

export async function getAnchoringHealth(): Promise<AnchoringHealth> {
  const db = await getDbReadOnly();

  const tableExists = await dbGet(db, "SELECT name FROM sqlite_master WHERE type='table' AND name='ledger_anchors'");
  if (!tableExists) {
    return {
      network: 'polygon',
      chainId: 137,
      status: 'OK',
      lastConfirmedAt: null,
      daysSinceLastConfirmed: null,
      windowDays: WINDOW_DAYS,
      confirmedInWindow: 0,
      emptyInWindow: 0,
      failedInWindow: 0,
      pendingOlderThanHours: 0,
    };
  }

  const now = new Date();
  const windowStart = new Date(now);
  windowStart.setUTCDate(windowStart.getUTCDate() - WINDOW_DAYS);
  const windowStartStr = windowStart.toISOString().slice(0, 10) + 'T00:00:00.000Z';
  const pendingThreshold = new Date(now.getTime() - PENDING_THRESHOLD_HOURS * 60 * 60 * 1000);
  const pendingThresholdStr = pendingThreshold.toISOString();

  const lastConfirmed = (await dbGet(db, `SELECT anchored_at FROM ledger_anchors 
       WHERE status = 'confirmed' AND anchored_at IS NOT NULL 
       ORDER BY anchored_at DESC LIMIT 1`)) as { anchored_at: string } | undefined;

  const counts = (await dbGet(db, `SELECT 
        SUM(CASE WHEN status = 'confirmed' THEN 1 ELSE 0 END) as confirmed,
        SUM(CASE WHEN status = 'empty' THEN 1 ELSE 0 END) as empty,
        SUM(CASE WHEN status = 'failed' THEN 1 ELSE 0 END) as failed
       FROM ledger_anchors 
       WHERE period_start >= ?`, windowStartStr)) as { confirmed: number; empty: number; failed: number };

  const pendingOld = (await dbGet(db, `SELECT COUNT(*) as c FROM ledger_anchors 
       WHERE status IN ('pending') AND created_at < ?`, pendingThresholdStr)) as { c: number };

  const confirmedInWindow = counts?.confirmed ?? 0;
  const emptyInWindow = counts?.empty ?? 0;
  const failedInWindow = counts?.failed ?? 0;
  const pendingOlderThanHours = pendingOld?.c ?? 0;

  let status: AnchoringStatus = 'OK';
  let daysSinceLastConfirmed: number | null = null;

  if (failedInWindow > 0 || pendingOlderThanHours > 0) {
    status = 'FAILED';
  } else if (!lastConfirmed?.anchored_at) {
    status = 'OK'; // no anchoring yet — not a failure
  } else {
    const lastTs = new Date(lastConfirmed.anchored_at).getTime();
    const hoursSince = (Date.now() - lastTs) / (1000 * 60 * 60);
    daysSinceLastConfirmed = Math.floor((Date.now() - lastTs) / (1000 * 60 * 60 * 24));

    if (hoursSince > DELAYED_HOURS) {
      status = 'FAILED';
    } else if (hoursSince > OK_HOURS) {
      status = 'DELAYED';
    }
  }

  return {
    network: 'polygon',
    chainId: 137,
    status,
    lastConfirmedAt: lastConfirmed?.anchored_at ?? null,
    daysSinceLastConfirmed,
    windowDays: WINDOW_DAYS,
    confirmedInWindow,
    emptyInWindow,
    failedInWindow,
    pendingOlderThanHours,
  };
}

export function getReceiptSha256(txHash: string): string | null {
  if (!txHash) return null;
  const hex = txHash.replace(/^0x/, '');
  const path = join(RECEIPTS_DIR, `${hex}.json`);
  if (!existsSync(path)) return null;
  try {
    const content = readFileSync(path, 'utf8');
    return createHash('sha256').update(content).digest('hex');
  } catch {
    return null;
  }
}
