#!/usr/bin/env node
/**
 * Build ANCHORING_STATUS.json from anchors.json (inside auditor pack).
 * Called by create-auditor-pack.mjs after anchors.json and receipts are ready.
 *
 * Usage: node scripts/build-anchoring-status.mjs <packRoot>
 *   packRoot defaults to current dir.
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

function daysBetweenUTC(from, to) {
  const a = new Date(from);
  const b = new Date(to);
  const ms = b.getTime() - a.getTime();
  return Math.max(0, Math.round(ms / (24 * 3600 * 1000)));
}

function main() {
  const packRoot = process.argv[2] || '.';
  const anchorsPath = path.join(packRoot, 'anchors.json');
  const receiptsManifestPath = path.join(packRoot, 'onchain', 'receipts', 'receipts_manifest.json');

  if (!fs.existsSync(anchorsPath)) {
    console.error('[build-anchoring-status] anchors.json not found');
    process.exit(2);
  }

  const anchorsJsonSha = sha256File(anchorsPath);
  const receiptsManifestPresent = fs.existsSync(receiptsManifestPath);
  const receiptsManifestSha = receiptsManifestPresent ? sha256File(receiptsManifestPath) : null;

  const anchors = JSON.parse(fs.readFileSync(anchorsPath, 'utf8'));
  const items = Array.isArray(anchors) ? anchors : (anchors.anchors ?? anchors.items ?? []);
  if (!Array.isArray(items)) {
    console.error('[build-anchoring-status] anchors.json has unexpected shape');
    process.exit(2);
  }

  const byStart = items
    .filter((a) => a.period_start || a.periodStart)
    .map((a) => ({
      id: a.anchor_id ?? a.anchorId ?? a.id,
      periodStart: a.period_start ?? a.periodStart,
      periodEnd: a.period_end ?? a.periodEnd,
      status: a.status,
      anchoredAt: a.anchored_at ?? a.anchoredAt ?? null,
      txHash: a.tx_hash ?? a.txHash ?? null,
      contractAddress: a.contract_address ?? a.contractAddress ?? null,
      chainId: a.chain_id ?? a.chainId ?? 137,
      network: a.network ?? 'polygon',
    }))
    .sort((x, y) => parseISO(x.periodStart) - parseISO(y.periodStart));

  const from = byStart.length ? iso(byStart[0].periodStart) : null;
  const to = byStart.length ? iso(byStart[byStart.length - 1].periodEnd) : null;

  const counts = { confirmed: 0, empty: 0, failed: 0, pending: 0 };
  for (const a of byStart) {
    if (a.status in counts) counts[a.status] += 1;
  }

  const lastConfirmed = [...byStart]
    .filter((a) => a.status === 'confirmed' && a.anchoredAt)
    .sort((a, b) => parseISO(b.anchoredAt) - parseISO(a.anchoredAt))[0] ?? null;

  const networkName = byStart[0]?.network ?? 'polygon';
  const chainId = Number(byStart[0]?.chainId ?? 137);
  const contractAddress = byStart.find((a) => a.contractAddress)?.contractAddress ?? null;

  const notes = [];
  let assessment = 'OK';

  if (counts.failed > 0 || counts.pending > 0) assessment = 'FAIL';
  if (counts.empty > 0 && assessment === 'OK') assessment = 'WARN';

  if (counts.confirmed > 0 && !receiptsManifestPresent) {
    assessment = 'FAIL';
    notes.push('receipts_manifest_missing');
  }

  const days_total = from && to ? daysBetweenUTC(from, to) : 0;

  const pkg = (() => {
    try {
      return JSON.parse(fs.readFileSync(path.join(path.dirname(path.dirname(packRoot)), 'package.json'), 'utf8'));
    } catch {
      return {};
    }
  })();

  const out = {
    schema: 'anchoring-status/v1',
    generated_at: new Date().toISOString(),
    tool: {
      name: 'auditor-pack',
      version: process.env.npm_package_version ?? pkg.version ?? 'unknown',
    },
    network: {
      name: networkName,
      chain_id: chainId,
      contract_address: contractAddress,
    },
    coverage: {
      period_type: 'daily',
      from,
      to,
      days_total,
    },
    counts,
    last_confirmed: lastConfirmed
      ? {
          anchor_id: lastConfirmed.id,
          anchored_at: lastConfirmed.anchoredAt,
          tx_hash: lastConfirmed.txHash,
        }
      : null,
    integrity: {
      receipts_manifest_present: receiptsManifestPresent,
      receipts_manifest_sha256: receiptsManifestSha,
      anchors_json_sha256: anchorsJsonSha,
    },
    assessment: {
      status: assessment,
      notes,
    },
  };

  fs.writeFileSync(path.join(packRoot, 'ANCHORING_STATUS.json'), JSON.stringify(out, null, 2));
  console.log('[build-anchoring-status] Wrote ANCHORING_STATUS.json');
}

main();
