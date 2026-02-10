#!/usr/bin/env node
/**
 * Build audit package ZIP for external auditors.
 * Copies architecture/ops docs into audit-package and creates audit-package_cloud-blockchain_v1.zip
 *
 * Usage: node scripts/build-audit-package.mjs
 */
import { cpSync, mkdirSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');
const AUDIT = join(ROOT, 'docs', 'audit-package');
const ARCH = join(AUDIT, '01_ARCHITECTURE');
const OPS = join(AUDIT, '02_OPERATIONS');

const files = {
  [ARCH]: [
    ['docs/architecture/ADR-001-cloud-blockchain-architecture.md', 'ADR-001-cloud-blockchain-architecture.md'],
    ['docs/architecture/security-architecture.md', 'security-architecture.md'],
    ['docs/architecture/data-flow-diagram.md', 'data-flow-diagram.md'],
    ['docs/architecture/regulatory-mapping.md', 'regulatory-mapping.md'],
  ],
  [OPS]: [
    ['docs/ops/compliance-operations.md', 'compliance-operations.md'],
    ['docs/runbooks/DR_FAILOVER.md', 'DR-runbook.md'],
    ['docs/ops/PLATFORM_REFERENCE.md', 'PLATFORM_REFERENCE.md'],
  ],
};

function main() {
  [ARCH, OPS].forEach((d) => {
    if (!existsSync(d)) mkdirSync(d, { recursive: true });
  });

  for (const [destDir, pairs] of Object.entries(files)) {
    for (const [src, name] of pairs) {
      const srcPath = join(ROOT, src);
      const destPath = join(destDir, name);
      if (existsSync(srcPath)) {
        cpSync(srcPath, destPath);
        console.log(`Copied ${src} -> ${destPath.replace(ROOT, '')}`);
      } else {
        console.warn(`Skip (missing): ${src}`);
      }
    }
  }

  const zipName = 'audit-package_cloud-blockchain_v1.zip';
  const zipPath = join(ROOT, zipName);
  try {
    execSync(`cd "${AUDIT}" && zip -r "${zipPath}" . -x "README.md" -x "01_ARCHITECTURE/README.md" -x "02_OPERATIONS/README.md"`, { stdio: 'inherit' });
    console.log(`\nCreated: ${zipName}`);
  } catch (e) {
    console.warn('zip failed (install with: brew install zip). Package files are in docs/audit-package/');
  }
}

main();
