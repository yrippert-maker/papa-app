/**
 * Политика путей для артефактов агента.
 * Все записи — только в AGENT_OUTPUT_ROOT по allowlist.
 */
import path from 'node:path';
import { existsSync, mkdirSync } from 'node:fs';

const DEFAULT_PRODUCTS = ['ТВ3-117', 'АИ-9', 'НР-3', 'КД', 'ARMACK', 'общие'];
const DEFAULT_KINDS = ['docx', 'evidencemap', 'hashes', 'evidence_kit', 'эталоны', 'черновики', 'логи'];
const MRO_AUTHORITIES = ['ICAO', 'EASA', 'FAA', 'ARMAK'];
const MRO_KINDS = ['regulation', 'amc_gm', 'guidance', 'advisory', 'circular', 'easy_access', 'memo', 'letters'];

function getAllowedProducts(): Set<string> {
  const raw = process.env.AGENT_ALLOWED_PRODUCTS?.trim();
  const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_PRODUCTS;
  return new Set(list);
}

function getAllowedKinds(): Set<string> {
  const raw = process.env.AGENT_ALLOWED_KINDS?.trim();
  const list = raw ? raw.split(',').map((s) => s.trim()).filter(Boolean) : DEFAULT_KINDS;
  return new Set(list);
}

/** Нормализует product/kind — fallback в общие/черновики при неизвестном. */
export function normalizeOutputRoute(
  product: string | undefined,
  kind: string | undefined
): { product: string; kind: string } {
  const products = getAllowedProducts();
  const kinds = getAllowedKinds();
  const p = product?.trim() || 'общие';
  const k = kind?.trim() || 'черновики';
  return {
    product: products.has(p) ? p : 'общие',
    kind: kinds.has(k) ? k : 'черновики',
  };
}

/** Проверка: запись в kind=эталоны разрешена только при ALLOW_ETALONS_WRITE. Бросает ETALONS_WRITE_DISABLED. */
export function assertEtalonsWriteAllowed(kind: string | undefined): void {
  const k = kind?.trim();
  if (k === 'эталоны' && !process.env.ALLOW_ETALONS_WRITE) {
    const e = new Error('ETALONS_WRITE_DISABLED') as Error & { code?: string };
    e.code = 'ETALONS_WRITE_DISABLED';
    throw e;
  }
}

/** Безопасный slug для имени файла/папки (без path traversal). */
export function slugify(name: string): string {
  return name
    .replace(/[^a-zA-Zа-яА-ЯёЁ0-9_-]/g, '_')
    .replace(/_+/g, '_')
    .replace(/^_|_$/g, '')
    .slice(0, 120) || 'unnamed';
}

/** Корень для записи артефактов. Null = запись отключена. */
export function getAgentOutputRoot(): string | null {
  const root = process.env.AGENT_OUTPUT_ROOT?.trim();
  if (!root) return null;
  return path.resolve(root);
}

/**
 * Возвращает абсолютный путь к папке пакета:
 * <AGENT_OUTPUT_ROOT>/<product>/<kind>/<YYYY-MM-DD>/<slug>/
 * Создаёт папки при необходимости.
 */
export function resolveOutputDir(
  product: string,
  kind: string,
  date: string,
  slug: string
): string | null {
  assertEtalonsWriteAllowed(kind);
  const root = getAgentOutputRoot();
  if (!root) return null;

  const { product: p, kind: k } = normalizeOutputRoute(product, kind);
  const safeDate = /^\d{4}-\d{2}-\d{2}$/.test(date) ? date : new Date().toISOString().slice(0, 10);
  const safeSlug = slugify(slug);

  const rel = path.join(p, k, safeDate, safeSlug);
  const full = path.join(root, rel);

  // Проверка: rel не должен содержать .. или абсолютные пути
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(root))) {
    return null;
  }

  if (!existsSync(full)) {
    mkdirSync(full, { recursive: true });
  }
  return full;
}

/** Корень библиотеки MRO (регуляторика). */
export function getMroLibraryRoot(): string | null {
  const root = process.env.MRO_LIBRARY_ROOT?.trim();
  if (!root) return null;
  return path.resolve(root);
}

/** Нормализует authority/kind для MRO — fallback в общие при неизвестном. */
export function normalizeMroRoute(
  authority: string | undefined,
  kind: string | undefined
): { authority: string; kind: string } {
  const authSet = new Set(MRO_AUTHORITIES);
  const kindSet = new Set(MRO_KINDS);
  const a = (authority ?? '').trim().toUpperCase() || 'EASA';
  const k = (kind ?? '').trim().toLowerCase() || 'guidance';
  return {
    authority: authSet.has(a) ? a : 'EASA',
    kind: kindSet.has(k) ? k : 'guidance',
  };
}

/**
 * Путь в библиотеке MRO: <MRO_LIBRARY_ROOT>/<authority>/<kind>/<slug>/
 * Или в выгрузках: <AGENT_OUTPUT_ROOT>/MRO_UPDATES/<YYYY-MM>/<slug>/
 */
export function resolveMroOutputDir(
  authority: string,
  kind: string,
  slug: string,
  mode: 'library' | 'update_packet' = 'library'
): string | null {
  const { authority: a, kind: k } = normalizeMroRoute(authority, kind);
  const safeSlug = slugify(slug);

  if (mode === 'update_packet') {
    const outRoot = getAgentOutputRoot();
    if (!outRoot) return null;
    const yyyyMm = new Date().toISOString().slice(0, 7);
    const full = path.join(outRoot, 'MRO_UPDATES', yyyyMm, safeSlug);
    const resolved = path.resolve(full);
    if (!resolved.startsWith(path.resolve(outRoot))) return null;
    if (!existsSync(full)) mkdirSync(full, { recursive: true });
    return full;
  }

  const libRoot = getMroLibraryRoot();
  if (!libRoot) return null;
  // ARMAK: regulation→AP-145, guidance→Guidance, letters→Letters
  const sub =
    a === 'ARMAK'
      ? { regulation: 'AP-145', guidance: 'Guidance', letters: 'Letters' }[k] ?? k
      : k;
  const full = path.join(libRoot, a, sub, safeSlug);
  const resolved = path.resolve(full);
  if (!resolved.startsWith(path.resolve(libRoot))) return null;
  if (!existsSync(full)) mkdirSync(full, { recursive: true });
  return full;
}
