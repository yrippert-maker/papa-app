/**
 * AI Agent: конфигурация источников документов из env.
 *
 * Каноничная схема (PAPA_DB_ROOT):
 *   PAPA_DB_ROOT=.../БАЗА/menasa
 *   PAPA_DOC_SOURCES=руководства,документы
 *   PAPA_PRODUCTS=ТВ3-117,АИ-9,НР-3,КД  (опционально, для документы/)
 *
 * Legacy: DOCS_ROOT_DIR — одна папка, обход целиком.
 *
 * ai-inbox: загрузки через /api/files/upload сохраняются в WORKSPACE_ROOT/ai-inbox.
 */
import { join, resolve } from 'path';
import { existsSync, readdirSync } from 'fs';
import { WORKSPACE_ROOT } from './config';

const ROOT = process.cwd();

/** Корень базы документов. Приоритет: PAPA_DB_ROOT > DOCS_ROOT_DIR > fallback. */
export function getDocsRoot(): string {
  const papa = process.env.PAPA_DB_ROOT?.trim();
  if (papa) return resolve(ROOT, papa);
  const legacy = process.env.DOCS_ROOT_DIR?.trim();
  if (legacy) return resolve(ROOT, legacy);
  return join(ROOT, 'data/mura-menasa');
}

/** Legacy: для обратной совместимости. */
export const DOCS_ROOT_DIR = getDocsRoot();

/** Корень для пути. ai-inbox/* → WORKSPACE_ROOT, иначе getDocsRoot(). */
export function getDocsRootForPath(relPath: string): string {
  if (relPath.startsWith('ai-inbox/')) return WORKSPACE_ROOT;
  return getDocsRoot();
}

/** Режим canonical: задан PAPA_DB_ROOT. */
export function isCanonicalDocsMode(): boolean {
  return Boolean(process.env.PAPA_DB_ROOT?.trim());
}

/** Источники (allowlist). По умолчанию: руководства,документы. */
function getDocSources(): string[] {
  const raw = process.env.PAPA_DOC_SOURCES?.trim();
  if (!raw) return ['руководства', 'документы'];
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/** Продукты для документы/ (опционально). Только эти подпапки индексируются. */
function getProducts(): string[] | null {
  const raw = process.env.PAPA_PRODUCTS?.trim();
  if (!raw) return null;
  return raw.split(',').map((s) => s.trim()).filter(Boolean);
}

/**
 * Возвращает пары { root, relPrefix } для обхода.
 * root — абсолютный путь к папке для сканирования.
 * relPrefix — префикс для path в doc_metadata (относительно getDocsRoot()).
 */
export function getDocsRootsForIndex(): Array<{ root: string; relPrefix: string }> {
  const base = getDocsRoot();
  if (!isCanonicalDocsMode()) {
    return [{ root: base, relPrefix: '' }];
  }

  const sources = getDocSources();
  const products = getProducts();
  const result: Array<{ root: string; relPrefix: string }> = [];

  for (const source of sources) {
    const sourceDir = resolve(base, source);
    if (!existsSync(sourceDir)) continue;

    if (source === 'документы' && products && products.length > 0) {
      const entries = readdirSync(sourceDir, { withFileTypes: true });
      for (const e of entries) {
        if (!e.isDirectory()) continue;
        const match = products.some(
          (p) => e.name.toLowerCase() === p.toLowerCase()
        );
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
