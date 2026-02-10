#!/usr/bin/env node
/**
 * build-demo-compliance-package.mjs
 *
 * Собирает один демонстрационный ZIP-пакет (регулятор/партнёры/инвесторы)
 * из уже сгенерированных артефактов (report/decision/verify/ledger/pack/diff).
 *
 * Требования:
 *   - Node.js 18+
 *   - npm i -D archiver fast-glob
 *
 * Пример:
 *   node scripts/build-demo-compliance-package.mjs \
 *     --name "Papa-App-Demo-Compliance-Package-v1" \
 *     --from ./out/report \
 *     --pack ./out/audit-pack.zip \
 *     --ledger ./out/ledger-entry.json \
 *     --anchor ./out/anchor-receipt.json \
 *     --policy ./docs/verify-policy.default.json \
 *     --controls ./config/control-definitions.json \
 *     --asof ./out/temporal \
 *     --out ./dist/demo
 *
 * Или, если вы используете генератор отчёта:
 *   npm run compliance:report -- --pack ./__fixtures__/auditor-pack-minimal --output ./out/report --pdf
 *   node scripts/build-demo-compliance-package.mjs --from ./out/report --pack ./__fixtures__/auditor-pack-minimal/audit-pack.zip --out ./dist/demo
 */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import process from 'node:process';
import { execSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import archiver from 'archiver';
import fg from 'fast-glob';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

function getToolVersions() {
  const versions = { node: process.version.replace(/^v/, '') };
  try {
    const pkg = JSON.parse(fs.readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
    versions.package_version = pkg?.version ?? null;
  } catch {
    versions.package_version = null;
  }
  try {
    versions.git_commit = execSync('git rev-parse --short HEAD', { cwd: ROOT, encoding: 'utf8' }).trim();
  } catch {
    versions.git_commit = null;
  }
  return versions;
}

function parseArgs(argv) {
  const args = {};
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) continue;
    const key = a.slice(2);
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

function readFileIfExists(p) {
  if (!p) return null;
  if (!fs.existsSync(p)) return null;
  return fs.readFileSync(p);
}

function sha256File(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

function writeText(p, s) {
  ensureDir(path.dirname(p));
  fs.writeFileSync(p, s, 'utf8');
}

function copyFileStrict(src, dst) {
  if (!src) throw new Error(`Missing src path for copy: ${src}`);
  if (!fs.existsSync(src)) throw new Error(`File not found: ${src}`);
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
}

function maybeCopy(src, dst, missingOk = true) {
  if (!src) return false;
  if (!fs.existsSync(src)) {
    if (!missingOk) throw new Error(`Required file not found: ${src}`);
    return false;
  }
  ensureDir(path.dirname(dst));
  fs.copyFileSync(src, dst);
  return true;
}

function guessFromDir(fromDir) {
  const g = (name) => path.join(fromDir, name);
  return {
    reportMd: g('compliance-report.md'),
    reportPdf: g('compliance-report.pdf'),
    reportManifest: g('report-manifest.json'),
    reportSignature: g('report-signature.json'),
    decisionRecordJson: g('decision-record.json'),
    decisionRecordMd: g('decision-record.md'),
    decisionDiffJson: g('decision-diff.json'),
    decisionDiffMd: g('decision-diff.md'),
    verifySummary: g('verify-summary.json'),
    verifyPolicy: g('verify-policy.json'),
    controlMatrix: g('control-coverage-matrix.csv'),
    ledgerEntry: g('ledger-entry.json'),
    anchorReceipt: g('anchor-receipt.json'),
  };
}

function deriveStatus(fromDir, statusOverride) {
  if (statusOverride) return statusOverride;
  try {
    const vs = JSON.parse(fs.readFileSync(path.join(fromDir, 'verify-summary.json'), 'utf8'));
    const passed = vs?.result?.passed;
    if (passed === true) return 'PASS';
    if (passed === false) return 'FAIL';
  } catch {}
  return 'UNKNOWN';
}

function defaultReadme(status, statusNotes) {
  const statusLine = status ? `**STATUS: ${status}**${statusNotes ? ` (${statusNotes})` : ''}\n\n` : '';
  return `# Papa-App Demo Compliance Package

${statusLine}Этот ZIP — демонстрационный регуляторный/партнёрский пакет.

**Status vocabulary:** \`PASS\` = верификация пройдена; \`WARN\` = предупреждения; \`FAIL\` = верификация не пройдена; \`ERROR\` = ошибка при верификации.

## Быстрый обзор
- 01_EXECUTIVE/ — отчёт (MD/PDF) + manifest + подпись manifest
- 02_DECISION/  — decision record + объяснение изменения (decision-diff)
- 03_VERIFICATION/ — verify-summary/policy + control coverage + diff (json)
- 04_LEDGER/ — ledger entry + anchor receipt (если предоставлены)
- 05_PACK/ — исходный audit-pack.zip для независимой верификации
- 06_TEMPORAL/ — решения на разные даты (если предоставлены)
- 99_HASHES/ — sha256 для всех файлов пакета

## Integrity self-check

\`\`\`bash
sha256sum -c demo-pack.zip.sha256
unzip -o demo-pack.zip && cd <распакованная папка>/
sha256sum -c 99_HASHES/checksums.sha256
\`\`\`

(Замените \`demo-pack\` на имя вашего ZIP, если использовали другой --output-name.)

## Верификация (если есть tooling)
Ориентир:
- independent-verify.mjs (в вашем репозитории) + verify-policy.json

## Контакты
- (заполните при необходимости)
`;
}

async function zipDir(srcDir, zipPath) {
  ensureDir(path.dirname(zipPath));
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });

  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('warning', (err) => {
      if (err.code === 'ENOENT') console.warn(err);
      else reject(err);
    });
    archive.on('error', reject);
  });

  archive.pipe(output);
  archive.directory(srcDir, false);
  await archive.finalize();
  await done;
}

function buildChecksums(rootDir) {
  const files = fg
    .sync(['**/*'], {
      cwd: rootDir,
      onlyFiles: true,
      dot: true,
    })
    .sort((a, b) => a.localeCompare(b, 'en'));
  const lines = [];
  for (const rel of files) {
    const abs = path.join(rootDir, rel);
    const hex = sha256File(abs);
    lines.push(`${hex}  ${rel}`);
  }
  return lines.join('\n') + '\n';
}

function requireAny(paths, label) {
  const ok = paths.some((p) => p && fs.existsSync(p));
  if (!ok) {
    throw new Error(
      `Не найден ни один из обязательных файлов для "${label}". Проверено: ${paths.filter(Boolean).join(', ')}`
    );
  }
}

async function main() {
  const args = parseArgs(process.argv);

  const name = args.name || 'Papa-App-Demo-Compliance-Package-v1';
  const fromDir = args.from ? path.resolve(args.from) : null;
  const outDir = path.resolve(args.out || './dist/demo');
  const tempRoot = path.join(outDir, `${name}.work`);
  const pkgRoot = path.join(tempRoot, name);

  const auditPackZip = args.pack ? path.resolve(args.pack) : null;
  const ledgerEntry = args.ledger ? path.resolve(args.ledger) : null;
  const anchorReceipt = args.anchor ? path.resolve(args.anchor) : null;
  const policyFile = args.policy ? path.resolve(args.policy) : null;
  const controlsFile = args.controls ? path.resolve(args.controls) : null;
  const asofDir = args.asof ? path.resolve(args.asof) : null;
  const readmePath = args.readme ? path.resolve(args.readme) : null;
  const statusOverride = args.status || null;
  const statusNotes = args['status-notes'] || null;
  const outputName = args['output-name'] || null;

  if (!fromDir) {
    throw new Error(`Нужно указать --from <dir> (каталог с report/decision/verify артефактами).`);
  }
  if (!fs.existsSync(fromDir)) throw new Error(`Каталог --from не найден: ${fromDir}`);

  const g = guessFromDir(fromDir);

  requireAny([g.reportMd, g.reportManifest], 'report (compliance-report.md / report-manifest.json)');
  requireAny([g.decisionRecordJson], 'decision record (decision-record.json)');
  requireAny([g.verifySummary], 'verify summary (verify-summary.json)');

  fs.rmSync(tempRoot, { recursive: true, force: true });
  ensureDir(pkgRoot);

  const verificationStatus = deriveStatus(fromDir, statusOverride);
  const notes = statusNotes || (verificationStatus !== 'PASS' && verificationStatus !== 'UNKNOWN' ? 'build continued after failure to preserve artifacts' : null);

  const readmeDst = path.join(pkgRoot, '00_README_REGULATOR.md');
  if (readmePath && fs.existsSync(readmePath)) copyFileStrict(readmePath, readmeDst);
  else writeText(readmeDst, defaultReadme(verificationStatus, notes));

  const verifySummary = (() => {
    try {
      return JSON.parse(fs.readFileSync(g.verifySummary, 'utf8'));
    } catch {
      return null;
    }
  })();
  const packRef = verifySummary?.pack_dir || verifySummary?.pack_ref?.dir || null;
  let packSha = verifySummary?.pack_sha256 ?? verifySummary?.pack_ref?.pack_sha256 ?? null;
  if (!packSha && auditPackZip && fs.existsSync(auditPackZip)) {
    packSha = sha256File(auditPackZip);
  }

  const packageStatus = {
    verification_status: verificationStatus,
    built_at: new Date().toISOString(),
    source: { pack_path: packRef, pack_sha256: packSha },
    tool_versions: getToolVersions(),
    notes: notes || null,
  };
  writeText(path.join(pkgRoot, '00_PACKAGE_STATUS.json'), JSON.stringify(packageStatus, null, 2));

  writeText(
    path.join(pkgRoot, '00_TOOLCHAIN.md'),
    `# Minimal Toolchain (для внешних аудиторов)

## Требования
- **Node.js** 18+ (рекомендуется 20 LTS)

## Команды верификации

\`\`\`bash
# 1. Independent verify (проверка audit-pack)
node scripts/independent-verify.mjs --pack ./05_PACK/audit-pack.zip
# Ожидаемый вывод: VERIFICATION PASSED или FAIL с деталями

# 2. Compliance report (генерация отчёта из pack)
node scripts/generate-compliance-report.mjs --pack ./05_PACK/audit-pack.zip --output ./report

# 3. Decision diff (сравнение двух решений)
node scripts/decision-diff.mjs --from ./T1/decision-record.json --to ./T2/decision-record.json
\`\`\`

## Ожидаемые артефакты
- \`verify-summary.json\` — результат independent-verify
- \`decision-record.json\` — решение с обоснованием
- \`ledger-entry.json\` — запись в immutable ledger
- \`compliance-report.md\` — executive report
`
  );

  const execDir = path.join(pkgRoot, '01_EXECUTIVE');
  ensureDir(execDir);
  maybeCopy(g.reportMd, path.join(execDir, 'compliance-report.md'), true);
  maybeCopy(g.reportPdf, path.join(execDir, 'compliance-report.pdf'), true);
  maybeCopy(g.reportManifest, path.join(execDir, 'report-manifest.json'), true);
  maybeCopy(g.reportSignature, path.join(execDir, 'report-signature.json'), true);

  const execSummary = `# Executive Summary (one-pager)

## Что делает система
Papa-App — платформа compliance-верификации с immutable ledger и anchoring. Система собирает аудит-снапшоты, проверяет целостность (hash chain, подписи), оценивает anchoring status и формирует decision record для регуляторов.

## Что доказано в этом пакете
- **Manifest checksums** — все артефакты pack верифицированы по sha256
- **Hash chain** — снапшоты связаны криптографической цепочкой
- **Decision record** — обоснование pass/fail с reference на ledger entry
- **Ledger entry** — fingerprint для immutable chain (decision_id → ledger_entry_id → anchor)

## Что не входит в scope
- Полная production-конфигурация (policy, keys) — см. документацию
- Реальные anchoring-провайдеры — demo использует fixture/mock
- Юридическая оценка — пакет носит технический характер
`;
  writeText(path.join(execDir, 'EXEC_SUMMARY.md'), execSummary);

  const decDir = path.join(pkgRoot, '02_DECISION');
  ensureDir(decDir);
  copyFileStrict(g.decisionRecordJson, path.join(decDir, 'decision-record.json'));
  maybeCopy(g.decisionRecordMd, path.join(decDir, 'decision-record.md'), true);
  maybeCopy(g.decisionDiffMd, path.join(decDir, 'decision-diff.md'), true);

  const verDir = path.join(pkgRoot, '03_VERIFICATION');
  ensureDir(verDir);
  copyFileStrict(g.verifySummary, path.join(verDir, 'verify-summary.json'));

  if (fs.existsSync(g.verifyPolicy)) {
    copyFileStrict(g.verifyPolicy, path.join(verDir, 'verify-policy.json'));
  } else if (policyFile) {
    copyFileStrict(policyFile, path.join(verDir, 'verify-policy.json'));
  }

  if (fs.existsSync(g.controlMatrix)) {
    copyFileStrict(g.controlMatrix, path.join(verDir, 'control-coverage-matrix.csv'));
  }
  if (controlsFile && fs.existsSync(controlsFile)) {
    copyFileStrict(controlsFile, path.join(verDir, 'control-definitions.json'));
  }

  maybeCopy(g.decisionDiffJson, path.join(verDir, 'decision-diff.json'), true);

  const ledDir = path.join(pkgRoot, '04_LEDGER');
  ensureDir(ledDir);
  if (fs.existsSync(g.ledgerEntry)) copyFileStrict(g.ledgerEntry, path.join(ledDir, 'ledger-entry.json'));
  else if (ledgerEntry) maybeCopy(ledgerEntry, path.join(ledDir, 'ledger-entry.json'), true);

  if (fs.existsSync(g.anchorReceipt)) copyFileStrict(g.anchorReceipt, path.join(ledDir, 'anchor-receipt.json'));
  else if (anchorReceipt) maybeCopy(anchorReceipt, path.join(ledDir, 'anchor-receipt.json'), true);

  const packDir = path.join(pkgRoot, '05_PACK');
  ensureDir(packDir);
  if (auditPackZip && fs.existsSync(auditPackZip)) {
    copyFileStrict(auditPackZip, path.join(packDir, 'audit-pack.zip'));
  }

  const temporalDir = path.join(pkgRoot, '06_TEMPORAL');
  ensureDir(temporalDir);
  if (asofDir && fs.existsSync(asofDir)) {
    const candidates = fg.sync(['**/*.json', '**/*.md'], { cwd: asofDir, onlyFiles: true, dot: true });
    for (const rel of candidates) {
      const src = path.join(asofDir, rel);
      const dst = path.join(temporalDir, rel);
      ensureDir(path.dirname(dst));
      fs.copyFileSync(src, dst);
    }
  }

  const hashesDir = path.join(pkgRoot, '99_HASHES');
  ensureDir(hashesDir);

  const sums = buildChecksums(pkgRoot);
  writeText(path.join(hashesDir, 'checksums.sha256'), sums);

  const indexEntries = [];
  for (const line of sums.trim().split('\n')) {
    const idx = line.indexOf('  ');
    if (idx > 0) indexEntries.push({ path: line.slice(idx + 2), sha256: line.slice(0, idx) });
  }
  indexEntries.sort((a, b) => a.path.localeCompare(b.path, 'en'));
  writeText(path.join(hashesDir, 'index.json'), JSON.stringify({ schema_version: 1, generated_at: new Date().toISOString(), artifacts: indexEntries }, null, 2));

  writeText(
    path.join(hashesDir, 'SIGNING_KEYS_INFO.md'),
    `# Signing keys info

Этот пакет содержит:
- report-manifest.json (и опционально report-signature.json)

Проверьте:
- sha256 каждого файла по checksums.sha256
- подпись manifest (если присутствует) по вашему доверенному ключу/процедуре.
`
  );

  const zipBaseName = outputName || name;
  const zipPath = path.join(outDir, `${zipBaseName}.zip`);
  await zipDir(pkgRoot, zipPath);

  const zipSha = sha256File(zipPath);
  writeText(path.join(outDir, `${zipBaseName}.zip.sha256`), `${zipSha}  ${path.basename(zipPath)}\n`);

  if (!args.keepWork) fs.rmSync(tempRoot, { recursive: true, force: true });

  console.log(`[demo] built: ${zipPath}`);
  console.log(`[demo] sha256: ${zipSha}`);
}

main().catch((err) => {
  console.error(`[demo] ERROR: ${err?.stack || err}`);
  process.exit(1);
});
