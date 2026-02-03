#!/usr/bin/env node
/**
 * Build a compliance package ZIP: docs + sample ledger/rollup/anchor artifacts.
 * Published as "External Trust Package". Any content change → new version.
 *
 * Usage: node scripts/compliance-package.mjs [--version compliance-v1] [--output path]
 * Env: COMPLIANCE_PACKAGE_OUTPUT, COMPLIANCE_PACKAGE_VERSION (e.g. compliance-v1)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function argVal(flag) {
  const i = process.argv.indexOf(flag);
  if (i === -1) return null;
  return process.argv[i + 1] || null;
}

const version = argVal('--version') || process.env.COMPLIANCE_PACKAGE_VERSION || null;
const defaultFilename = version
  ? `External-Trust-Package-${version}.zip`
  : 'compliance-package.zip';
const outputPath = path.resolve(
  argVal('--output') || process.env.COMPLIANCE_PACKAGE_OUTPUT || path.join(ROOT, defaultFilename)
);

const DOCS = [
  'docs/README_COMPLIANCE.md',
  'docs/AUDITOR_CHECKLIST_1DAY.md',
  'docs/AUDIT_PACK_RETENTION.md',
  'docs/AUDITOR_PORTAL.md',
  'docs/trust/HOW_WE_ENSURE_AUDIT_INTEGRITY.md',
  'docs/trust/AUDIT_INTEGRITY_EXPLAINER.md',
  'docs/compliance/INCIDENT_RESPONSE.md',
  'docs/compliance/KEY_MANAGEMENT_POLICY.md',
  'docs/compliance/ACCESS_REVIEW_CADENCE.md',
  'docs/compliance/DUE_DILIGENCE_ANSWER_SHEET.md',
  'docs/compliance/SOC2_CONTROL_MAPPING.md',
  'docs/compliance/COMPLIANCE_PACKAGE_VERSIONING.md',
  'docs/trust/PUBLIC_TRUST_EXPLAINER.md',
];

const SAMPLES = {
  'samples/ledger-entry.sample.json': {
    version: 1,
    generated_at: '2026-02-02T12:00:00.000Z',
    pack: { dir: '/path/to/pack', sha256: 'a1b2c3d4e5f6' },
    signature: { ok: true, key_id: 'default' },
    anchoring: { status: 'OK', issues_total: 0, issues_hits: 0, top: [] },
    result: { passed: true, exit_code: 0 },
    fingerprint_sha256: 'abc123',
  },
  'samples/rollup.sample.json': {
    version: 1,
    domain: 'ledger-rollup',
    date_utc: '2026-02-02',
    generated_at: '2026-02-02T02:35:00.000Z',
    entries: { count: 5, leaf_algo: 'sha256', merkle_algo: 'sha256(pairwise)', merkle_root_sha256: 'deadbeef' },
  },
  'samples/ROLLUP_ANCHORING_STATUS.sample.json': {
    version: 1,
    domain: 'ledger-rollup',
    date_utc: '2026-02-02',
    anchored: true,
    network: 'polygon',
    tx_hash: '0x1234...',
    timestamp: '2026-02-02T02:36:00.000Z',
    verifier: 'rollup-anchor-publish',
  },
};

const REDACTED_SAMPLES = {
  'samples-redacted/ledger-entry.redacted.json': {
    version: 1,
    generated_at: '[REDACTED]',
    pack: { dir: '[REDACTED]', sha256: '[REDACTED]' },
    signature: { ok: true, key_id: '[REDACTED]' },
    anchoring: { status: 'OK', issues_total: 0, issues_hits: 0, top: [] },
    result: { passed: true, exit_code: 0 },
    fingerprint_sha256: '[REDACTED]',
  },
  'samples-redacted/rollup.redacted.json': {
    version: 1,
    domain: 'ledger-rollup',
    date_utc: 'YYYY-MM-DD',
    generated_at: '[REDACTED]',
    entries: {
      count: 0,
      leaf_algo: 'sha256',
      merkle_algo: 'sha256(pairwise)',
      merkle_root_sha256: '[REDACTED]',
    },
  },
  'samples-redacted/ROLLUP_ANCHORING_STATUS.redacted.json': {
    version: 1,
    domain: 'ledger-rollup',
    date_utc: 'YYYY-MM-DD',
    anchored: true,
    network: '[REDACTED]',
    tx_hash: '[REDACTED]',
    timestamp: '[REDACTED]',
    verifier: 'rollup-anchor-publish',
  },
};

async function main() {
  const { default: JSZip } = await import('jszip');
  const zip = new JSZip();

  if (version) {
    zip.file('COMPLIANCE_PACKAGE_VERSION.txt', `External Trust Package\nVersion: ${version}\nBuilt: ${new Date().toISOString()}\n`);
  }

  for (const rel of DOCS) {
    const abs = path.join(ROOT, rel);
    if (fs.existsSync(abs)) {
      zip.file(rel, fs.readFileSync(abs, 'utf8'));
    }
  }

  for (const [rel, obj] of Object.entries(SAMPLES)) {
    zip.file(rel, JSON.stringify(obj, null, 2));
  }

  zip.file(
    'samples/README.txt',
    'Sample artifacts for auditor reference.\n' +
      'ledger-entry.sample.json — structure of a ledger entry.\n' +
      'rollup.sample.json — daily Merkle rollup.\n' +
      'ROLLUP_ANCHORING_STATUS.sample.json — anchor proof for the rollup.\n'
  );

  for (const [rel, obj] of Object.entries(REDACTED_SAMPLES)) {
    zip.file(rel, JSON.stringify(obj, null, 2));
  }

  zip.file(
    'samples-redacted/README.txt',
    'Redacted samples for public / non-confidential use (Variant C — External trust).\n' +
      'Sensitive values (hashes, paths, tx_hash, timestamps) replaced with [REDACTED].\n' +
      'Use for "How we ensure audit integrity" page or non-tech auditor explainer.\n'
  );

  const buf = await zip.generateAsync({ type: 'nodebuffer' });
  fs.mkdirSync(path.dirname(outputPath), { recursive: true });
  fs.writeFileSync(outputPath, buf);
  console.log(`Compliance package written: ${outputPath}` + (version ? ` (External Trust Package ${version})` : ''));
}

main().catch((e) => {
  console.error(e?.stack || String(e));
  process.exit(2);
});
