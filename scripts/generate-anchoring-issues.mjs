#!/usr/bin/env node
/**
 * Generate ANCHORING_ISSUES.json from pack contents (anchors.json + onchain/receipts).
 * Called by create-auditor-pack.mjs after build-anchoring-status.mjs.
 * Works offline — no DB/HTTP, uses only pack files.
 *
 * Usage: node scripts/generate-anchoring-issues.mjs <packRoot>
 *   packRoot defaults to current dir.
 *
 * Env: WINDOW_DAYS (default 30), CHECK_GAPS (default true), OUTPUT_PATH (overrides packRoot)
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';

function sha256File(p) {
  const b = fs.readFileSync(p);
  return crypto.createHash('sha256').update(b).digest('hex');
}

function iso(d) {
  return new Date(d).toISOString();
}

function parseISO(s) {
  return new Date(s).getTime();
}

function issueId(prefix, parts) {
  return `${prefix}:${parts.filter(Boolean).join(':')}`;
}

/** Normalize tx_hash: trim, lowercase, remove 0x. Single source of truth for manifest/file lookup. */
function normalizeTxHash(h) {
  if (!h || typeof h !== 'string') return '';
  const s = h.trim().toLowerCase().replace(/^0x/, '');
  return /^[0-9a-f]{64}$/.test(s) ? s : s; // return as-is if not 64 hex (still use for lookup)
}

function main() {
  const packRoot = process.argv[2] || '.';
  const outputPath = process.env.OUTPUT_PATH || path.join(packRoot, 'ANCHORING_ISSUES.json');
  const windowDays = Math.min(365, Math.max(1, parseInt(process.env.WINDOW_DAYS || '30', 10)));
  const checkGaps = String(process.env.CHECK_GAPS ?? 'true') === 'true';

  const anchorsPath = path.join(packRoot, 'anchors.json');
  const receiptsDir = path.join(packRoot, 'onchain', 'receipts');
  const manifestPath = path.join(receiptsDir, 'receipts_manifest.json');

  if (!fs.existsSync(anchorsPath)) {
    console.log('[generate-anchoring-issues] anchors.json not found, skipping');
    fs.writeFileSync(outputPath, JSON.stringify({ windowDays, generatedAt: new Date().toISOString(), issues: [] }, null, 2));
    return;
  }

  const anchors = JSON.parse(fs.readFileSync(anchorsPath, 'utf8'));
  const items = Array.isArray(anchors) ? anchors : (anchors.anchors ?? anchors.items ?? []);
  if (!Array.isArray(items)) {
    console.error('[generate-anchoring-issues] anchors.json has unexpected shape');
    process.exit(2);
  }

  const now = new Date();
  const windowStart = new Date(now.getTime() - windowDays * 24 * 60 * 60 * 1000);
  const tooOld = new Date(now.getTime() - 72 * 60 * 60 * 1000);

  const byStart = items
    .filter((a) => a.period_start || a.periodStart)
    .map((a) => ({
      id: a.anchor_id ?? a.anchorId ?? a.id,
      periodStart: a.period_start ?? a.periodStart,
      periodEnd: a.period_end ?? a.periodEnd,
      status: a.status,
      txHash: a.tx_hash ?? a.txHash ?? null,
      createdAt: a.created_at ?? a.createdAt ?? null,
    }))
    .filter((a) => parseISO(a.periodStart) >= windowStart.getTime())
    .sort((x, y) => parseISO(x.periodStart) - parseISO(y.periodStart));

  let manifest = null;
  if (fs.existsSync(manifestPath)) {
    const raw = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    manifest = raw.receipts ?? raw;
  }

  const runbook = {
    ANCHOR_FAILED: { runbookHref: '/docs/runbooks/anchoring/anchor-failed.md', suggestedAction: 'Check anchor job logs and retry or escalate.' },
    ANCHOR_PENDING_TOO_LONG: { runbookHref: '/docs/runbooks/anchoring/pending-too-long.md', suggestedAction: 'Confirm tx on-chain or retry publish.' },
    RECEIPT_MISSING_FOR_CONFIRMED: { runbookHref: '/docs/runbooks/anchoring/receipt-missing.md', suggestedAction: 'Fetch receipt from RPC and add to storage.' },
    RECEIPT_INTEGRITY_MISMATCH: { runbookHref: '/docs/runbooks/anchoring/receipt-mismatch.md', suggestedAction: 'Re-fetch receipt and update manifest.' },
    GAP_IN_PERIODS: { runbookHref: '/docs/runbooks/anchoring/gap-periods.md', suggestedAction: 'Review anchoring schedule and backfill if needed.' },
  };

  const issues = [];

  // 1) failed anchors
  for (const a of byStart.filter((x) => x.status === 'failed')) {
    const r = runbook.ANCHOR_FAILED;
    issues.push({
      id: issueId('failed', [a.id]),
      type: 'ANCHOR_FAILED',
      severity: 'critical',
      anchorId: a.id,
      periodStart: iso(a.periodStart),
      periodEnd: iso(a.periodEnd),
      message: `Anchor FAILED for period ${iso(a.periodStart).slice(0, 10)}.`,
      actionHref: `/governance/anchoring?status=failed&anchorId=${encodeURIComponent(a.id)}`,
      runbookHref: r.runbookHref,
      suggestedAction: r.suggestedAction,
    });
  }

  // 2) pending too long (>72h)
  for (const a of byStart.filter((x) => x.status === 'pending' && x.createdAt && parseISO(x.createdAt) < tooOld.getTime())) {
    const r = runbook.ANCHOR_PENDING_TOO_LONG;
    issues.push({
      id: issueId('pendingTooLong', [a.id]),
      type: 'ANCHOR_PENDING_TOO_LONG',
      severity: 'major',
      anchorId: a.id,
      txHash: a.txHash ?? undefined,
      periodStart: iso(a.periodStart),
      periodEnd: iso(a.periodEnd),
      message: `Anchor pending >72h for period ${iso(a.periodStart).slice(0, 10)}.`,
      actionHref: `/governance/anchoring?status=pending&anchorId=${encodeURIComponent(a.id)}`,
      runbookHref: r.runbookHref,
      suggestedAction: r.suggestedAction,
    });
  }

  // 3) receipt checks for confirmed anchors
  for (const a of byStart.filter((x) => x.status === 'confirmed')) {
    if (!a.txHash) {
      const r = runbook.RECEIPT_MISSING_FOR_CONFIRMED;
      issues.push({
        id: issueId('receiptMissingNoTx', [a.id]),
        type: 'RECEIPT_MISSING_FOR_CONFIRMED',
        severity: 'major',
        anchorId: a.id,
        periodStart: iso(a.periodStart),
        periodEnd: iso(a.periodEnd),
        message: 'Confirmed anchor has no tx_hash recorded.',
        actionHref: `/governance/anchoring?anchorId=${encodeURIComponent(a.id)}`,
        runbookHref: r.runbookHref,
        suggestedAction: r.suggestedAction,
      });
      continue;
    }

    const normalized = normalizeTxHash(a.txHash);
    const receiptFile = normalized + '.json';
    const receiptPath = path.join(receiptsDir, receiptFile);

    if (!fs.existsSync(receiptPath)) {
      const r = runbook.RECEIPT_MISSING_FOR_CONFIRMED;
      issues.push({
        id: issueId('receiptMissing', [a.id]),
        type: 'RECEIPT_MISSING_FOR_CONFIRMED',
        severity: 'major',
        anchorId: a.id,
        txHash: a.txHash,
        periodStart: iso(a.periodStart),
        periodEnd: iso(a.periodEnd),
        message: `Receipt missing in storage for confirmed anchor (tx ${a.txHash.slice(0, 10)}…).`,
        actionHref: `/governance/anchoring?anchorId=${encodeURIComponent(a.id)}`,
        runbookHref: r.runbookHref,
        suggestedAction: r.suggestedAction,
      });
      continue;
    }

    const actualSha = sha256File(receiptPath);

    if (!manifest) {
      const r = runbook.RECEIPT_INTEGRITY_MISMATCH;
      issues.push({
        id: issueId('manifestMissing', [a.id]),
        type: 'RECEIPT_INTEGRITY_MISMATCH',
        severity: 'major',
        anchorId: a.id,
        txHash: a.txHash,
        periodStart: iso(a.periodStart),
        periodEnd: iso(a.periodEnd),
        message: 'receipts_manifest.json not available; cannot validate receipt integrity.',
        actionHref: `/governance/anchoring?anchorId=${encodeURIComponent(a.id)}`,
        runbookHref: r.runbookHref,
        suggestedAction: r.suggestedAction,
      });
      continue;
    }

    const expected = manifest[normalized] ?? manifest[a.txHash] ?? manifest[a.txHash?.replace(/^0x/i, '')];
    if (!expected) {
      const r = runbook.RECEIPT_INTEGRITY_MISMATCH;
      issues.push({
        id: issueId('manifestNoEntry', [a.id]),
        type: 'RECEIPT_INTEGRITY_MISMATCH',
        severity: 'major',
        anchorId: a.id,
        txHash: a.txHash,
        periodStart: iso(a.periodStart),
        periodEnd: iso(a.periodEnd),
        message: `Receipt not listed in receipts_manifest.json (tx ${a.txHash.slice(0, 10)}…).`,
        actionHref: `/governance/anchoring?anchorId=${encodeURIComponent(a.id)}`,
        runbookHref: r.runbookHref,
        suggestedAction: r.suggestedAction,
      });
      continue;
    }

    if (expected !== actualSha) {
      const r = runbook.RECEIPT_INTEGRITY_MISMATCH;
      issues.push({
        id: issueId('manifestMismatch', [a.id]),
        type: 'RECEIPT_INTEGRITY_MISMATCH',
        severity: 'critical',
        anchorId: a.id,
        txHash: a.txHash,
        periodStart: iso(a.periodStart),
        periodEnd: iso(a.periodEnd),
        message: `Receipt integrity mismatch (expected ${expected.slice(0, 12)}…, got ${actualSha.slice(0, 12)}…).`,
        actionHref: `/governance/anchoring?anchorId=${encodeURIComponent(a.id)}`,
        runbookHref: r.runbookHref,
        suggestedAction: r.suggestedAction,
      });
    }
  }

  // 4) gaps (optional)
  if (checkGaps && byStart.length > 1) {
    for (let i = 1; i < byStart.length; i++) {
      const prev = byStart[i - 1];
      const cur = byStart[i];
      const prevEnd = iso(prev.periodEnd);
      const curStart = iso(cur.periodStart);
      if (prevEnd !== curStart) {
        const r = runbook.GAP_IN_PERIODS;
        issues.push({
          id: issueId('gap', [prev.id, cur.id]),
          type: 'GAP_IN_PERIODS',
          severity: 'major',
          periodStart: prevEnd,
          periodEnd: curStart,
          message: `Gap detected between periods: ${prevEnd.slice(0, 10)} → ${curStart.slice(0, 10)}.`,
          actionHref: '/governance/anchoring',
          runbookHref: r.runbookHref,
          suggestedAction: r.suggestedAction,
        });
      }
    }
  }

  const resp = {
    windowDays,
    generatedAt: new Date().toISOString(),
    issues,
  };

  fs.writeFileSync(outputPath, JSON.stringify(resp, null, 2), 'utf8');
  console.log(`[generate-anchoring-issues] Wrote ${issues.length} issues to ${outputPath}`);
}

main();
