#!/usr/bin/env node
/**
 * Evidence Kit v1.0 — Public Bundle
 *
 * Собирает папку/архив для публичной передачи:
 *   - PDF отчёт (RU и/или EN)
 *   - demo zip + sha256
 *   - regulatory bundle zip + sha256
 *   - README "start here" (1 страница)
 *
 * Использование:
 *   npm run evidence-kit:public
 *   node scripts/build-evidence-kit-public.mjs [--tag v1.0.0] [--pdf] [--no-demo]
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2).replace(/-/g, '_');
    const next = argv[i + 1];
    if (!next || next.startsWith('--')) {
      args[key] = true;
    } else {
      args[key] = next;
      i++;
    }
  }
  return args;
}

function ensureDir(p) {
  fs.mkdirSync(p, { recursive: true });
}

function sha256File(p) {
  return crypto.createHash('sha256').update(fs.readFileSync(p)).digest('hex');
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Exit ${code}: ${cmd} ${args.join(' ')}`));
    });
    child.on('error', reject);
  });
}

function runAllowFail(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, { stdio: 'inherit', shell: false, ...opts });
    child.on('exit', (code) => resolve(code));
    child.on('error', () => resolve(1));
  });
}

async function generatePdf(mdPath, pdfPath) {
  try {
    const { default: mdToPdf } = await import('md-to-pdf');
    await mdToPdf(
      { path: mdPath },
      { dest: pdfPath, pdf_options: { format: 'A4', margin: '20mm' } }
    );
    return true;
  } catch {
    return false;
  }
}

const README_TEMPLATE = `# Evidence Kit — Start Here

**Papa App** — Independent, reproducible compliance verification infrastructure.

---

## Содержимое пакета

| Файл | Описание |
|------|----------|
| **evidence-kit-report-ru.pdf** / .md | Краткий отчёт (RU): что проверено, итог, ссылки на доказательства |
| **evidence-kit-report-en.pdf** / .md | Executive summary (EN) |
| **demo-pack.zip** | Demo Compliance Package: audit pack + compliance report + verify artifacts |
| **demo-pack.zip.sha256** | SHA-256 контрольная сумма demo-pack.zip |
| **regulatory-bundle-{{TAG}}.zip** | Regulatory submission bundle: документация, evidence, MANIFEST |
| **regulatory-bundle-{{TAG}}.zip.sha256** | SHA-256 контрольная сумма regulatory bundle |

---

## Проверка целостности

\`\`\`bash
# Demo pack
sha256sum -c demo-pack.zip.sha256

# Regulatory bundle
sha256sum -c regulatory-bundle-{{TAG}}.zip.sha256
\`\`\`

---

## Следующие шаги

1. **Регулятор / аудит:** распаковать \`regulatory-bundle-{{TAG}}.zip\` → открыть \`docs/REGULATOR_PACKAGE.md\`
2. **Due diligence / партнёры:** распаковать \`demo-pack.zip\` → \`README_REGULATOR.md\`
3. **Краткий обзор:** \`evidence-kit-report-ru.pdf\` (или .md) / \`evidence-kit-report-en.pdf\` (или .md)

---

*Generated: {{GENERATED_AT}} | Tag: {{TAG}}*
`;

const EVIDENCE_KIT_SUMMARY_RU = `# Evidence Kit — Краткий отчёт (RU)

**Дата:** {{GENERATED_AT}}  
**Версия:** {{TAG}}

---

## Что включено

- **Demo Compliance Package** — воспроизводимая верификация audit pack (decision-record, verify-summary, ledger-entry)
- **Regulatory Bundle** — полная документация для регулятора: AUTHZ, DB evidence, UI routing, security posture
- **Integrity** — все артефакты с SHA-256; MANIFEST.txt для tamper-evident проверки

---

## Итог

Система обеспечивает контролируемую, проверяемую и воспроизводимую цепочку доказательств.  
Подробности — в regulatory bundle и demo pack.
`;

const EVIDENCE_KIT_SUMMARY_EN = `# Evidence Kit — Executive Summary (EN)

**Date:** {{GENERATED_AT}}  
**Version:** {{TAG}}

---

## Contents

- **Demo Compliance Package** — reproducible verification of audit pack (decision-record, verify-summary, ledger-entry)
- **Regulatory Bundle** — full documentation for regulators: AUTHZ, DB evidence, UI routing, security posture
- **Integrity** — all artifacts with SHA-256; MANIFEST.txt for tamper-evident verification

---

## Summary

The system provides controlled, verifiable, and reproducible evidence chain.  
Details — in regulatory bundle and demo pack.
`;

async function main() {
  const args = parseArgs(process.argv);
  const tag = args.tag || 'evidence-kit-v1.0';
  const wantPdf = args.pdf !== false;
  const skipDemo = !!args.no_demo;

  // evidence-kit-v1.1 → evidence-kit-public-v1.1; v1.0.0 → evidence-kit-public-v1.0
  const dirName = tag.startsWith('evidence-kit-')
    ? tag.replace('evidence-kit-', 'evidence-kit-public-')
    : `evidence-kit-public-${tag}`;
  const outDir = path.join(ROOT, 'dist', dirName);
  const generatedAt = new Date().toISOString().replace(/\.\d{3}Z$/, 'Z');

  ensureDir(outDir);

  // 1. Demo pack
  if (!skipDemo) {
    console.log('[evidence-kit] 1/4 Building demo pack...');
    const demoCode = await runAllowFail(
      process.execPath,
      [
        path.join(ROOT, 'scripts/make-demo-from-pack.mjs'),
        '--pack', path.join(ROOT, '__fixtures__/auditor-pack-minimal'),
        '--policy', path.join(ROOT, 'docs/verify-policy.default.json'),
        '--controls', path.join(ROOT, 'config/control-definitions.example.json'),
        '--name', 'Papa-App-Demo-Compliance-Package',
        '--output-name', 'demo-pack',
        '--out', path.join(ROOT, 'dist/demo'),
        ...(wantPdf ? ['--pdf'] : []),
      ]
    );
    if (demoCode !== 0) {
      console.warn('[evidence-kit] Demo build had issues (code %d), continuing', demoCode);
    }
    const demoZip = path.join(ROOT, 'dist/demo/demo-pack.zip');
    if (fs.existsSync(demoZip)) {
      fs.copyFileSync(demoZip, path.join(outDir, 'demo-pack.zip'));
      const sha = sha256File(path.join(outDir, 'demo-pack.zip'));
      fs.writeFileSync(path.join(outDir, 'demo-pack.zip.sha256'), `${sha}  demo-pack.zip\n`, 'utf8');
      console.log('[evidence-kit] demo-pack.zip + sha256 ✓');
    }
  }

  // 2. Regulatory bundle
  console.log('[evidence-kit] 2/4 Building regulatory bundle...');
  await runAllowFail(
    'bash',
    [path.join(ROOT, 'scripts/create-regulatory-bundle.sh'), tag],
    { env: { ...process.env, ALLOW_DIRTY: '1' } }
  );
  const regZip = path.join(ROOT, 'dist', `regulatory-bundle-${tag}.zip`);
  if (fs.existsSync(regZip)) {
    fs.copyFileSync(regZip, path.join(outDir, `regulatory-bundle-${tag}.zip`));
    const sha = sha256File(path.join(outDir, `regulatory-bundle-${tag}.zip`));
    fs.writeFileSync(
      path.join(outDir, `regulatory-bundle-${tag}.zip.sha256`),
      `${sha}  regulatory-bundle-${tag}.zip\n`,
      'utf8'
    );
    console.log('[evidence-kit] regulatory-bundle-%s.zip + sha256 ✓', tag);
  } else {
    console.warn('[evidence-kit] Regulatory bundle not found, skipping');
  }

  // 3. PDF reports (from MD)
  console.log('[evidence-kit] 3/4 Generating reports...');
  const summaryRu = EVIDENCE_KIT_SUMMARY_RU.replace(/\{\{GENERATED_AT\}\}/g, generatedAt).replace(/\{\{TAG\}\}/g, tag);
  const summaryEn = EVIDENCE_KIT_SUMMARY_EN.replace(/\{\{GENERATED_AT\}\}/g, generatedAt).replace(/\{\{TAG\}\}/g, tag);

  const mdRu = path.join(outDir, 'evidence-kit-report-ru.md');
  const mdEn = path.join(outDir, 'evidence-kit-report-en.md');
  fs.writeFileSync(mdRu, summaryRu, 'utf8');
  fs.writeFileSync(mdEn, summaryEn, 'utf8');

  if (wantPdf) {
    const pdfRu = path.join(outDir, 'evidence-kit-report-ru.pdf');
    const pdfEn = path.join(outDir, 'evidence-kit-report-en.pdf');
    if (await generatePdf(mdRu, pdfRu)) {
      console.log('[evidence-kit] evidence-kit-report-ru.pdf ✓');
    } else {
      console.warn('[evidence-kit] PDF skipped (install: npm install md-to-pdf). MD included.');
    }
    if (await generatePdf(mdEn, pdfEn)) {
      console.log('[evidence-kit] evidence-kit-report-en.pdf ✓');
    }
  }

  // 4. README
  console.log('[evidence-kit] 4/4 Writing README...');
  const readme = README_TEMPLATE
    .replace(/\{\{TAG\}\}/g, tag)
    .replace(/\{\{GENERATED_AT\}\}/g, generatedAt);
  fs.writeFileSync(path.join(outDir, 'README.md'), readme, 'utf8');

  console.log('');
  console.log('[evidence-kit] DONE: %s', outDir);
  console.log('  ls -la %s', outDir);
}

main().catch((err) => {
  console.error('[evidence-kit] ERROR:', err?.message || err);
  process.exit(1);
});
