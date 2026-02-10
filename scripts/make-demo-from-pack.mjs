#!/usr/bin/env node
/**
 * make-demo-from-pack.mjs
 *
 * Одна команда → из audit-pack.zip или каталога pack получить полный demo ZIP:
 * 1) independent-verify (decision-record + verify-summary + ledger-entry + (опц) decision-diff / as-of)
 * 2) generate-compliance-report (MD/PDF + report-manifest + control matrix)
 * 3) build-demo-compliance-package (готовый ZIP для регулятора/партнёров)
 *
 * Требования: Node 18+
 *
 * Пример:
 *   node scripts/make-demo-from-pack.mjs \
 *     --pack ./__fixtures__/auditor-pack-minimal \
 *     --policy ./docs/verify-policy.default.json \
 *     --controls ./config/control-definitions.json \
 *     --name Papa-App-Demo-Compliance-Package-v1 \
 *     --out ./dist/demo \
 *     --pdf
 *
 * Temporal (опционально):
 *   node scripts/make-demo-from-pack.mjs --pack ... --as-of 2024-06-01T00:00:00Z --as-of2 2024-07-01T00:00:00Z --pdf
 */
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import process from 'node:process';

function parseArgs(argv) {
  const args = { _: [] };
  for (let i = 2; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) {
      args._.push(a);
      continue;
    }
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

function rmrf(p) {
  if (fs.existsSync(p)) fs.rmSync(p, { recursive: true, force: true });
}

function exists(p) {
  return !!p && fs.existsSync(p);
}

function requireFile(p, label) {
  if (!p) throw new Error(`Missing ${label}`);
  if (!exists(p)) throw new Error(`File not found for ${label}: ${p}`);
}

function run(cmd, args, opts = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: false,
      ...opts,
    });
    child.on('exit', (code) => {
      if (code === 0) resolve();
      else reject(new Error(`Command failed (${code}): ${cmd} ${args.join(' ')}`));
    });
    child.on('error', reject);
  });
}

function runAllowFail(cmd, args, opts = {}) {
  return new Promise((resolve) => {
    const child = spawn(cmd, args, {
      stdio: 'inherit',
      shell: false,
      ...opts,
    });
    child.on('exit', (code) => resolve(code));
    child.on('error', () => resolve(1));
  });
}

function scriptPath(rel) {
  return path.resolve(process.cwd(), rel);
}

async function extractZip(zipPath, outDir) {
  const { default: JSZip } = await import('jszip');
  const buf = fs.readFileSync(zipPath);
  const zip = await JSZip.loadAsync(buf);
  ensureDir(outDir);
  for (const [name, entry] of Object.entries(zip.files)) {
    if (entry.dir) {
      ensureDir(path.join(outDir, name));
      continue;
    }
    const content = await entry.async('nodebuffer');
    const dst = path.join(outDir, name);
    ensureDir(path.dirname(dst));
    fs.writeFileSync(dst, content);
  }
}

async function zipDir(srcDir, zipPath) {
  const { default: archiver } = await import('archiver');
  ensureDir(path.dirname(zipPath));
  const output = fs.createWriteStream(zipPath);
  const archive = archiver('zip', { zlib: { level: 9 } });
  const done = new Promise((resolve, reject) => {
    output.on('close', resolve);
    archive.on('error', reject);
  });
  archive.pipe(output);
  archive.directory(srcDir, false);
  await archive.finalize();
  await done;
}

function help() {
  return `
make-demo-from-pack.mjs

Обязательные:
  --pack <path>              Путь к audit-pack.zip или каталогу pack

Опциональные:
  --policy <path>            verify-policy.json
  --controls <path>          control-definitions.json
  --name <string>            Имя выходного demo zip (по умолчанию Papa-App-Demo-Compliance-Package-v1)
  --out <dir>                Куда положить финальный ZIP (по умолчанию ./dist/demo)
  --pdf                      Сгенерировать compliance-report.pdf
  --keep                     Не удалять рабочую папку
  --as-of <ts>               Сгенерировать temporal решение на дату T1
  --as-of2 <ts>              Сгенерировать temporal решение на дату T2 и diff
  --readme <path>            Кастомный README_REGULATOR.md
  --output-name <name>       Имя ZIP-файла (напр. demo-pack → demo-pack.zip)

Пример:
  node scripts/make-demo-from-pack.mjs --pack ./audit-pack.zip --policy ./verify-policy.json --pdf
`.trim();
}

async function main() {
  const args = parseArgs(process.argv);

  if (args.help || args.h) {
    console.log(help());
    process.exit(0);
  }

  const packInput = args.pack ? path.resolve(args.pack) : null;
  const policy = args.policy ? path.resolve(args.policy) : null;
  const controls = args.controls ? path.resolve(args.controls) : null;
  const outDir = path.resolve(args.out || './dist/demo');
  const name = args.name || 'Papa-App-Demo-Compliance-Package-v1';
  const wantPdf = !!args.pdf;
  const keep = !!args.keep;
  const readme = args.readme ? path.resolve(args.readme) : null;
  const outputName = args.output_name ? String(args.output_name) : null;
  const asOf1 = args.as_of ? String(args.as_of) : null;
  const asOf2 = args.as_of2 ? String(args.as_of2) : null;

  requireFile(packInput, '--pack');

  ensureDir(outDir);
  const workRoot = path.join(outDir, `${name}.make-demo-work`);
  rmrf(workRoot);
  ensureDir(workRoot);

  let packPath;
  let auditPackZipForDemo = null;
  const isZip = packInput.toLowerCase().endsWith('.zip');

  if (isZip) {
    packPath = path.join(workRoot, 'unpacked');
    await extractZip(packInput, packPath);
    auditPackZipForDemo = packInput;
  } else {
    packPath = packInput;
    auditPackZipForDemo = path.join(workRoot, 'audit-pack.zip');
    await zipDir(packPath, auditPackZipForDemo);
  }

  const reportOut = path.join(workRoot, 'report');
  const temporalOut = path.join(workRoot, 'temporal');
  ensureDir(reportOut);
  ensureDir(temporalOut);

  if (controls && exists(controls)) {
    fs.copyFileSync(controls, path.join(packPath, 'control-definitions.json'));
  }

  const independentVerify = scriptPath('scripts/independent-verify.mjs');
  const reportGen = scriptPath('scripts/generate-compliance-report.mjs');
  const demoBuilder = scriptPath('scripts/build-demo-compliance-package.mjs');

  requireFile(independentVerify, 'scripts/independent-verify.mjs');
  requireFile(reportGen, 'scripts/generate-compliance-report.mjs');
  requireFile(demoBuilder, 'scripts/build-demo-compliance-package.mjs');

  const verifyArgs = [independentVerify, '--pack', packPath];
  if (policy) verifyArgs.push('--policy', policy);
  if (asOf1) verifyArgs.push('--as-of', asOf1);

  console.log(`[make-demo] 1/3 independent-verify → ${packPath}`);
  const verifyCode = await runAllowFail(process.execPath, verifyArgs);
  if (verifyCode !== 0) {
    console.warn(`[make-demo] verify exited ${verifyCode} (artifacts may still be present, continuing)`);
  }

  if (asOf2) {
    const verifyOut2 = path.join(temporalOut, 'T2');
    ensureDir(verifyOut2);
    ensureDir(path.join(temporalOut, 'T1'));

    process.env.VERIFY_SUMMARY_PATH = path.join(verifyOut2, 'verify-summary.json');
    process.env.DECISION_RECORD_PATH = path.join(verifyOut2, 'decision-record.json');
    process.env.WRITE_LEDGER_ENTRY = '0';

    const v2Args = [
      independentVerify,
      '--pack',
      packPath,
      ...(policy ? ['--policy', policy] : []),
      '--as-of',
      asOf2,
    ];
    console.log(`[make-demo] (temporal) independent-verify T2 → ${verifyOut2}`);
    await runAllowFail(process.execPath, v2Args);

    delete process.env.VERIFY_SUMMARY_PATH;
    delete process.env.DECISION_RECORD_PATH;
    delete process.env.WRITE_LEDGER_ENTRY;

    for (const f of ['decision-record.json', 'decision-record.md', 'verify-summary.json']) {
      const src = path.join(packPath, f);
      if (exists(src)) {
        fs.copyFileSync(src, path.join(temporalOut, 'T1', f));
      }
    }
  }

  const reportArgs = [reportGen, '--pack', packPath, '--output', reportOut];
  if (wantPdf) reportArgs.push('--pdf');
  if (asOf1 && asOf2) {
    const dr1 = path.join(packPath, 'decision-record.json');
    const dr2 = path.join(temporalOut, 'T2', 'decision-record.json');
    if (exists(dr1) && exists(dr2)) {
      reportArgs.push('--diff-from', dr1, '--diff-to', dr2);
    }
  }

  console.log(`[make-demo] 2/3 compliance report → ${reportOut}`);
  await run(process.execPath, reportArgs);

  for (const f of fs.readdirSync(packPath)) {
    const src = path.join(packPath, f);
    const dst = path.join(reportOut, f);
    if (fs.statSync(src).isFile() && !exists(dst)) {
      fs.copyFileSync(src, dst);
    }
  }

  const demoArgs = [
    demoBuilder,
    '--name',
    name,
    '--from',
    reportOut,
    '--pack',
    auditPackZipForDemo,
    '--out',
    outDir,
  ];
  if (policy) demoArgs.push('--policy', policy);
  if (controls) demoArgs.push('--controls', controls);
  if (readme) demoArgs.push('--readme', readme);
  if (outputName) demoArgs.push('--output-name', outputName);
  if (verifyCode !== 0) {
    demoArgs.push('--status', 'FAIL');
    demoArgs.push('--status-notes', 'build continued after failure to preserve artifacts');
  }
  if (exists(temporalOut) && fs.readdirSync(temporalOut).length > 0) {
    demoArgs.push('--asof', temporalOut);
  }

  console.log(`[make-demo] 3/3 demo zip → ${outDir}`);
  await run(process.execPath, demoArgs);

  const zipBaseName = outputName || name;
  console.log(`[make-demo] DONE: ${path.join(outDir, `${zipBaseName}.zip`)}`);

  if (!keep) rmrf(workRoot);
  else console.log(`[make-demo] kept work dir: ${workRoot}`);
}

main().catch((err) => {
  console.error(`[make-demo] ERROR: ${err?.stack || err}`);
  process.exit(1);
});
