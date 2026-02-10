#!/usr/bin/env node
/**
 * Compliance Report Generator
 *
 * Input: decision-record.json, verify-summary.json, ledger-entry.json (from audit pack)
 * Output: compliance-report.md, compliance-report.pdf (optional), report-manifest.json, control-coverage-matrix.csv (optional)
 *
 * Usage:
 *   node generate-compliance-report.mjs --pack ./audit-pack
 *   node generate-compliance-report.mjs --decision-record ./dr.json --verify-summary ./vs.json --ledger-entry ./le.json --output ./report
 */
import crypto from 'crypto';
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'fs';
import { join, dirname, basename } from 'path';
import { fileURLToPath } from 'url';
import { computeDiff, buildDiffMd } from './decision-diff.mjs';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

function sha256Hex(s) {
  return crypto.createHash('sha256').update(String(s), 'utf8').digest('hex');
}

function stableStringify(obj) {
  if (obj == null || typeof obj !== 'object') return JSON.stringify(obj);
  if (Array.isArray(obj)) return '[' + obj.map(stableStringify).join(',') + ']';
  const keys = Object.keys(obj).sort();
  return '{' + keys.map((k) => JSON.stringify(k) + ':' + stableStringify(obj[k])).join(',') + '}';
}

function safeReadJson(p) {
  try {
    return JSON.parse(readFileSync(p, 'utf8'));
  } catch {
    return null;
  }
}

function loadControlDefinitions(packPath, root) {
  const candidates = [
    packPath && join(packPath, 'control-definitions.json'),
    packPath && join(packPath, 'control-definitions.yaml'),
    join(root, 'config', 'control-definitions.json'),
    join(root, 'config', 'control-definitions.example.json'),
  ].filter(Boolean);
  for (const p of candidates) {
    if (!existsSync(p)) continue;
    const content = readFileSync(p, 'utf8');
    if (p.endsWith('.json')) {
      try {
        return JSON.parse(content);
      } catch {
        continue;
      }
    }
  }
  return null;
}

function buildReportMd(decisionRecord, verifySummary, ledgerEntry, diffSection = null) {
  const dr = decisionRecord || {};
  const vs = verifySummary || {};
  const le = ledgerEntry || {};
  const packRef = dr.pack_ref || {};
  const outcome = dr.outcome || {};
  const approval = dr.approval || {};

  const lines = [
    '# Compliance Verification Report',
    '',
    `**Report ID:** ${dr.decision_id || 'n/a'}`,
    `**Generated:** ${dr.generated_at || 'n/a'}`,
    `**Decision ID:** \`${dr.decision_id || 'n/a'}\``,
    `**Ledger Entry ID:** ${dr.ledger_entry_id ? `\`${dr.ledger_entry_id}\`` : 'n/a'}`,
    '',
    '> Immutability chain: decision_id → ledger_entry_id → anchor',
    '',
    '## Outcome',
    '',
    `**Result:** ${(outcome.overall || 'unknown').toUpperCase()}`,
    '',
    `**Explanation:** ${outcome.why || 'n/a'}`,
    '',
    '## Scope',
    '',
    `- **Pack:** ${packRef.dir || 'n/a'} (ID: ${packRef.pack_id || 'n/a'}, SHA-256: ${packRef.pack_sha256 || 'n/a'})`,
    `- **Policy:** ${(dr.input_policies || [])[0]?.path || 'n/a'}`,
    `- **Verification date:** ${dr.generated_at || 'n/a'}`,
    '',
    '## Checks',
    '',
    '| Check | Outcome | Reason |',
    '|-------|---------|--------|',
    ...(dr.checks || []).map((c) => `| ${c.name} | ${c.outcome} | ${c.reason || '-'} |`),
    '',
  ];

  if ((dr.rules_fired || []).length > 0) {
    lines.push('## Rules that caused fail/warn', '', ...(dr.rules_fired || []).map((r) => `- ${r.message}`), '');
  }

  lines.push(
    '## Approval',
    '',
    `- **Mode:** ${approval.mode || 'n/a'}`,
    `- **Policy:** ${approval.policy_ref || 'n/a'}`,
    `- **Approver:** ${approval.approver || 'n/a'}`,
    `- **Approved at:** ${approval.approved_at || 'n/a'}`,
    '',
    '## Evidence references',
    '',
    `- decision-record.json (Decision ID: \`${dr.decision_id || 'n/a'}\`)`,
    `- verify-summary.json`,
    `- ledger-entry.json (Ledger Entry ID: \`${dr.ledger_entry_id || 'n/a'}\`)`,
    ''
  );

  if (diffSection) {
    lines.push('---', '', '## Appendix: Historical Compliance Changes', '', diffSection, '');
  }

  return lines.join('\n');
}

const EVIDENCE_TO_CHECK = {
  ledger_hash: 'hash_chain',
  anchor_receipt: 'anchoring_status',
  pack_signature: 'pack_signature',
  anchoring_status: 'anchoring_status',
  anchoring_issues: 'anchoring_issues',
};

function buildControlCoverageMatrix(controlDefs, decisionRecord) {
  if (!controlDefs?.controls?.length || !decisionRecord?.checks) return null;

  const checkById = {};
  for (const c of decisionRecord.checks || []) {
    checkById[c.id] = c;
  }

  const rows = [
    [
      'Control ID',
      'Name',
      'Objective',
      'Covered by policies',
      'Covered by checks',
      'Evidence present',
      'Evidence missing',
      'Rules fired',
      'Status',
    ],
  ];

  for (const ctrl of controlDefs.controls) {
    const policyRef = ctrl.policy_ref || {};
    const policies = [];
    if (policyRef.fail_types?.length) policies.push(`fail_types: ${policyRef.fail_types.join(', ')}`);
    if (policyRef.fail_severity?.length) policies.push(`fail_severity: ${policyRef.fail_severity.join(', ')}`);
    if (policyRef.require_pack_signature) policies.push('require_pack_signature');
    if (policyRef.strict_anchoring) policies.push('strict_anchoring');

    const evidence = ctrl.evidence || [];
    if (evidence.length === 0 || ctrl.not_applicable === true) {
      rows.push([
        ctrl.id || '',
        ctrl.name || '',
        (ctrl.objective || '').slice(0, 60),
        policies.join('; ') || 'n/a',
        '-',
        '-',
        '-',
        '-',
        'NOT_APPLICABLE',
      ]);
      continue;
    }

    const coveredByChecks = [];
    const evidencePresent = [];
    const evidenceMissing = [];
    const rulesFiredForControl = new Set();

    for (const ev of evidence) {
      const checkId = EVIDENCE_TO_CHECK[ev] || ev;
      const ch = checkById[checkId];
      if (ch) {
        coveredByChecks.push(ch.name || ch.id);
        if (ch.outcome === 'pass' || ch.outcome === 'skip') {
          evidencePresent.push(ev);
        } else {
          evidenceMissing.push(ev);
          if (ch.rule_fired) rulesFiredForControl.add(ch.rule_fired);
        }
      } else {
        evidenceMissing.push(ev);
        coveredByChecks.push(checkId);
      }
    }

    let status = 'PASS';
    if (evidenceMissing.length > 0) {
      const hasFail = evidence.some((ev) => {
        const checkId = EVIDENCE_TO_CHECK[ev] || ev;
        const ch = checkById[checkId];
        return ch && ch.outcome === 'fail';
      });
      const hasWarn = evidence.some((ev) => {
        const checkId = EVIDENCE_TO_CHECK[ev] || ev;
        const ch = checkById[checkId];
        return ch && ch.outcome === 'warn';
      });
      status = hasFail ? 'FAIL' : hasWarn ? 'WARN' : 'FAIL';
    }

    const rulesFiredStr = [...rulesFiredForControl].join('; ') || '-';

    rows.push([
      ctrl.id || '',
      ctrl.name || '',
      (ctrl.objective || '').slice(0, 60),
      policies.join('; ') || 'n/a',
      [...new Set(coveredByChecks)].join(', ') || '-',
      evidencePresent.join(', ') || '-',
      evidenceMissing.join(', ') || '-',
      rulesFiredStr,
      status,
    ]);
  }

  return rows.map((r) => r.map((c) => `"${String(c).replace(/"/g, '""')}"`).join(',')).join('\n');
}

function printHelp() {
  console.log(`
Compliance Report Generator

Usage:
  node generate-compliance-report.mjs --pack <path>              Use audit pack directory
  node generate-compliance-report.mjs --decision-record <path>   Explicit paths
                --verify-summary <path> --ledger-entry <path>
  node generate-compliance-report.mjs --pack <path> --output <dir>  Output directory
  node generate-compliance-report.mjs --pack <path> --pdf       Generate PDF (requires md-to-pdf)

Historical Compliance:
  node generate-compliance-report.mjs --pack <path> --diff-from <path> --diff-to <path>
  Adds "Appendix: Historical Compliance Changes" when comparing two decisions.

Output:
  compliance-report.md
  compliance-report.pdf (if --pdf and md-to-pdf available)
  report-manifest.json
  control-coverage-matrix.csv (if control-definitions found)
  decision-diff.json, decision-diff.md (if --diff-from and --diff-to)
`);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes('--help') || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  const getArg = (name) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : null; };
  let decisionRecordPath, verifySummaryPath, ledgerEntryPath, packPath, outputDir, wantPdf, diffFromPath, diffToPath;

  if (args.includes('--pack')) {
    packPath = args[args.indexOf('--pack') + 1];
    if (!packPath || !existsSync(packPath)) {
      console.error('--pack path not found');
      process.exit(2);
    }
    decisionRecordPath = join(packPath, 'decision-record.json');
    verifySummaryPath = join(packPath, 'verify-summary.json');
    ledgerEntryPath = join(packPath, 'ledger-entry.json');
    outputDir = args.includes('--output') ? args[args.indexOf('--output') + 1] : packPath;
  } else {
    decisionRecordPath = args.includes('--decision-record') ? args[args.indexOf('--decision-record') + 1] : null;
    verifySummaryPath = args.includes('--verify-summary') ? args[args.indexOf('--verify-summary') + 1] : null;
    ledgerEntryPath = args.includes('--ledger-entry') ? args[args.indexOf('--ledger-entry') + 1] : null;
    outputDir = args.includes('--output') ? args[args.indexOf('--output') + 1] : dirname(decisionRecordPath || '.');
  }

  wantPdf = args.includes('--pdf');
  diffFromPath = getArg('--diff-from') || null;
  diffToPath = getArg('--diff-to') || null;

  const decisionRecord = decisionRecordPath ? safeReadJson(decisionRecordPath) : null;
  const verifySummary = verifySummaryPath ? safeReadJson(verifySummaryPath) : null;
  const ledgerEntry = ledgerEntryPath ? safeReadJson(ledgerEntryPath) : null;

  if (!decisionRecord) {
    console.error('decision-record.json not found or invalid. Run independent-verify first.');
    process.exit(2);
  }

  let diffSection = null;
  let diff = null;
  if (diffFromPath && diffToPath && existsSync(diffFromPath) && existsSync(diffToPath)) {
    const fromDr = safeReadJson(diffFromPath);
    const toDr = safeReadJson(diffToPath);
    diff = computeDiff(fromDr, toDr);
    const fullDiffMd = buildDiffMd(diff);
    diffSection = fullDiffMd.replace(/^# Decision Diff\n\n/, '');
    console.log('[compliance-report] Historical diff: --diff-from vs --diff-to');
  } else if (diffFromPath || diffToPath) {
    console.warn('[compliance-report] --diff-from and --diff-to both required; skipping Historical Compliance Changes.');
  }

  const reportMd = buildReportMd(decisionRecord, verifySummary, ledgerEntry, diffSection);
  const reportMdHash = sha256Hex(reportMd);

  mkdirSync(outputDir, { recursive: true });
  const reportMdPath = join(outputDir, 'compliance-report.md');
  writeFileSync(reportMdPath, reportMd, 'utf8');
  console.log(`[compliance-report] ${reportMdPath}`);

  const verifySummarySha256 = verifySummaryPath && existsSync(verifySummaryPath) ? sha256Hex(readFileSync(verifySummaryPath, 'utf8')) : null;
  const policyPath = (decisionRecord.input_policies || [])[0]?.path;
  const policySha256 = policyPath && existsSync(policyPath) ? sha256Hex(readFileSync(policyPath, 'utf8')) : null;
  const decisionRecordSha256 = decisionRecordPath && existsSync(decisionRecordPath) ? sha256Hex(readFileSync(decisionRecordPath, 'utf8')) : null;
  const ledgerEntrySha256 = ledgerEntryPath && existsSync(ledgerEntryPath) ? sha256Hex(readFileSync(ledgerEntryPath, 'utf8')) : null;

  const controlDefs = loadControlDefinitions(packPath || null, ROOT);
  let controlDefsPath = null;
  if (controlDefs?.controls?.length) {
    const candidates = [packPath && join(packPath, 'control-definitions.json'), join(ROOT, 'config', 'control-definitions.json'), join(ROOT, 'config', 'control-definitions.example.json')].filter(Boolean);
    for (const p of candidates) {
      if (existsSync(p)) {
        controlDefsPath = p;
        break;
      }
    }
  }
  const controlDefsSha256 = controlDefsPath ? sha256Hex(readFileSync(controlDefsPath, 'utf8')) : null;

  const manifest = {
    schema_version: 1,
    report_id: decisionRecord.decision_id || crypto.randomUUID(),
    generated_at: new Date().toISOString(),
    report_type: 'executive_compliance_report',
    report_md_hash_sha256: reportMdHash,
    report_pdf_hash_sha256: null,
    pack_ref: decisionRecord.pack_ref || null,
    ledger_entry_id: decisionRecord.ledger_entry_id || null,
    decision_record_ref: decisionRecordPath ? { path: decisionRecordPath, sha256: decisionRecordSha256 } : null,
    verify_summary_ref: verifySummaryPath ? { path: verifySummaryPath, sha256: verifySummarySha256 } : null,
    policy_ref: policyPath ? { path: policyPath, sha256: policySha256 } : null,
    control_definitions_ref: controlDefsPath ? { path: controlDefsPath, sha256: controlDefsSha256 } : null,
    ledger_entry_ref: ledgerEntryPath ? { path: ledgerEntryPath, sha256: ledgerEntrySha256 } : null,
    decision_diff_ref: null,
  };

  const manifestPath = join(outputDir, 'report-manifest.json');
  writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
  console.log(`[compliance-report] ${manifestPath}`);

  let pdfPath = null;
  if (wantPdf) {
    try {
      const mdToPdf = (await import('md-to-pdf')).default;
      pdfPath = join(outputDir, 'compliance-report.pdf');
      await mdToPdf({ content: reportMd }, { dest: pdfPath });
      manifest.report_pdf_hash_sha256 = sha256Hex(readFileSync(pdfPath));
      writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
      console.log(`[compliance-report] ${pdfPath}`);
    } catch (e) {
      console.warn('[compliance-report] PDF skipped. Install: npm install md-to-pdf');
    }
  }

  const reportSignKeyPath = process.env.REPORT_SIGN_PRIVATE_KEY_PATH || null;
  const reportSignKeyPem = process.env.REPORT_SIGN_PRIVATE_KEY_PEM || (reportSignKeyPath && existsSync(reportSignKeyPath) ? readFileSync(reportSignKeyPath, 'utf8') : null);
  if (reportSignKeyPem) {
    try {
      const manifestCanonical = stableStringify(manifest);
      const sig = crypto.sign(null, Buffer.from(manifestCanonical, 'utf8'), reportSignKeyPem);
      const sigObj = { manifest_hash_sha256: sha256Hex(manifestCanonical), signature_base64: sig.toString('base64'), key_id: process.env.REPORT_SIGN_KEY_ID || 'report' };
      writeFileSync(join(outputDir, 'report-signature.json'), JSON.stringify(sigObj, null, 2), 'utf8');
      console.log(`[compliance-report] report-signature.json (signed)`);
    } catch (e) {
      console.warn('[compliance-report] Signing skipped:', e.message);
    }
  }

  if (controlDefs?.controls?.length) {
    const csv = buildControlCoverageMatrix(controlDefs, decisionRecord);
    if (csv) {
      const csvPath = join(outputDir, 'control-coverage-matrix.csv');
      writeFileSync(csvPath, csv, 'utf8');
      console.log(`[compliance-report] ${csvPath}`);
    }
  }

  if (diff) {
    const diffJsonPath = join(outputDir, 'decision-diff.json');
    const diffMdPath = join(outputDir, 'decision-diff.md');
    writeFileSync(diffJsonPath, JSON.stringify(diff, null, 2), 'utf8');
    writeFileSync(diffMdPath, buildDiffMd(diff), 'utf8');
    manifest.decision_diff_ref = { path: diffJsonPath, sha256: sha256Hex(JSON.stringify(diff, null, 2)) };
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2), 'utf8');
    console.log(`[compliance-report] ${diffJsonPath}`);
    console.log(`[compliance-report] ${diffMdPath}`);
  }

  console.log('[compliance-report] Done.');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
