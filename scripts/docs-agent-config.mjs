/**
 * AI Agent: конфигурация источников документов (Node/ESM, для scripts/).
 * Дублирует логику lib/docs-agent-config.ts. Next.js использует .ts, скрипты — этот .mjs.
 */
import { join, resolve } from 'path';
import { existsSync, readdirSync } from 'fs';
import { fileURLToPath } from 'url';

const __dirname = fileURLToPath(new URL('.', import.meta.url));
const ROOT = join(__dirname, '..');

export function getDocsRoot() {
  const papa = process.env.PAPA_DB_ROOT?.trim();
  if (papa) return resolve(ROOT, papa);
  const legacy = process.env.DOCS_ROOT_DIR?.trim();
  if (legacy) return resolve(ROOT, legacy);
  return join(ROOT, 'Новая папка');
}

export function isCanonicalDocsMode() {
  return Boolean(process.env.PAPA_DB_ROOT?.trim());
}

function getDocSources() {
  const raw = process.env.PAPA_DOC_SOURCES?.trim();
  if (!raw) return ['руководства', 'документы'];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

function getProducts() {
  const raw = process.env.PAPA_PRODUCTS?.trim();
  if (!raw) return null;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

export function getDocsRootsForIndex() {
  const base = getDocsRoot();
  if (!isCanonicalDocsMode()) {
    return [{ root: base, relPrefix: '' }];
  }

  const sources = getDocSources();
  const products = getProducts();
  const result = [];

  for (const source of sources) {
    const sourceDir = resolve(base, source);
    if (!existsSync(sourceDir)) continue;

    if (source === 'документы' && products?.length > 0) {
      const entries = readdirSync(sourceDir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const match = products.some((p) => e.name.toLowerCase() === p.toLowerCase());
        if (!match) continue;
        const subRoot = resolve(sourceDir, e.name);
        result.push({ root: subRoot, relPrefix: `${source}/${e.name}/` });
      }
    } else {
      result.push({ root: sourceDir, relPrefix: `${source}/` });
    }
  }

  return result;
}
