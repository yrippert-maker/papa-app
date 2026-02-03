/**
 * Document Store: read latest/versions, write new version, apply append (pure).
 * Layout: docs-store/{doc_id}/latest.{json|md}, docs-store/{doc_id}/versions/<timestamp>__<hash>.{json|md}
 */
import { createHash } from 'node:crypto';
import { GetObjectCommand, PutObjectCommand } from '@aws-sdk/client-s3';
import { listKeys, getJsonObject, getObjectBody, putObject, putObjectJson } from './s3.mjs';

const DOC_IDS_FALLBACK = ['finance/payments', 'mura-menasa/handbook'];

function safeDocId(docId) {
  const s = String(docId || '').trim();
  if (!s || s.includes('..') || s.startsWith('/') || s.includes('\\') || s.includes('://')) return null;
  if (!/^[a-z0-9][a-z0-9/\-]{1,128}$/i.test(s)) return null;
  return s;
}

function docToPath(docId) {
  if (docId === 'finance/payments') return { dir: 'finance/payments', ext: 'json' };
  if (docId === 'mura-menasa/handbook') return { dir: 'mura-menasa/handbook', ext: 'md' };
  return null;
}

export function docKey(prefix, docId, name) {
  const safe = safeDocId(docId);
  if (!safe) return null;
  return `${prefix}/${safe}/${name}`;
}

export function docVersionsPrefix(prefix, docId) {
  const safe = safeDocId(docId);
  if (!safe) return null;
  return `${prefix}/${safe}/versions/`;
}

export function nowStamp() {
  return new Date().toISOString().replace(/[:.]/g, '-');
}

export function sha256Hex(s) {
  if (Buffer.isBuffer(s)) return createHash('sha256').update(s).digest('hex');
  if (typeof s === 'string') return createHash('sha256').update(s, 'utf8').digest('hex');
  return createHash('sha256').update(JSON.stringify(s)).digest('hex');
}

function latestKey(prefix, docId) {
  const p = docToPath(docId);
  if (!p) return null;
  return `${prefix}/${p.dir}/latest.${p.ext}`;
}

function versionsPrefix(prefix, docId) {
  const p = docToPath(docId);
  if (!p) return null;
  return `${prefix}/${p.dir}/versions/`;
}

/** List doc_id by scanning S3 for latest.json/md; fallback to fixed list. */
export async function listDocIds(s3, { bucket, docsPrefix }) {
  const keys = await listKeys(s3, { bucket, prefix: `${docsPrefix}/`, maxKeys: 5000 });
  const set = new Set();
  const escaped = docsPrefix.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  for (const k of keys) {
    const key = k.key || '';
    const m = new RegExp(`^${escaped}/([^\\s]+?)/latest\\.(json|md)$`).exec(key);
    if (m) set.add(m[1]);
  }
  if (set.size) return Array.from(set).sort();
  return DOC_IDS_FALLBACK;
}

export async function getLatestDoc(s3, { bucket, docsPrefix, docId }) {
  const safe = safeDocId(docId);
  if (!safe) throw new Error('bad doc_id');
  const keyJson = docKey(docsPrefix, safe, 'latest.json');
  const keyMd = docKey(docsPrefix, safe, 'latest.md');
  try {
    const j = await getJsonObject(s3, { bucket, key: keyJson, maxBytes: 8_000_000 });
    return { doc_id: safe, format: 'json', key: keyJson, content: j };
  } catch {}
  try {
    const out = await s3.send(new GetObjectCommand({ Bucket: bucket, Key: keyMd }));
    const chunks = [];
    for await (const c of out.Body) chunks.push(c);
    const txt = Buffer.concat(chunks).toString('utf8');
    return { doc_id: safe, format: 'md', key: keyMd, content: txt };
  } catch (e) {
    if (e?.name === 'NoSuchKey') throw e;
    throw e;
  }
}

export async function getLatest(s3, { bucket, prefix }, docId) {
  const key = latestKey(prefix, docId);
  if (!key) return null;
  try {
    const p = docToPath(docId);
    if (p && p.ext === 'json') {
      return { doc_id: docId, content: await getJsonObject(s3, { bucket, key, maxBytes: 10_000_000 }), format: 'json', key };
    }
    const buf = await getObjectBody(s3, { bucket, key, maxBytes: 5_000_000 });
    return { doc_id: docId, content: buf.toString('utf8'), format: 'markdown', key };
  } catch (e) {
    if (e?.name === 'NoSuchKey') return null;
    throw e;
  }
}

export async function listDocVersions(s3, { bucket, docsPrefix, docId, limit = 50 }) {
  const safe = safeDocId(docId);
  if (!safe) throw new Error('bad doc_id');
  const pre = docVersionsPrefix(docsPrefix, safe);
  if (!pre) return [];
  const keys = await listKeys(s3, { bucket, prefix: pre, maxKeys: 5000 });
  return keys
    .filter((x) => x.key && (x.key.endsWith('.json') || x.key.endsWith('.md')))
    .sort((a, b) => (a.key < b.key ? 1 : -1))
    .slice(0, limit);
}

export async function listVersions(s3, { bucket, prefix }, docId, limit = 100) {
  const pre = versionsPrefix(prefix, docId);
  if (!pre) return [];
  const keys = await listKeys(s3, { bucket, prefix: pre, maxKeys: limit });
  keys.sort((a, b) => (b.key > a.key ? 1 : -1));
  return keys.slice(0, limit).map((k) => ({ key: k.key, size: k.size, last_modified: k.last_modified }));
}

export async function getVersion(s3, { bucket }, docId, versionKey) {
  const p = docToPath(docId);
  if (!p) return null;
  try {
    if (p.ext === 'json') {
      return {
        key: versionKey,
        content: await getJsonObject(s3, { bucket, key: versionKey, maxBytes: 10_000_000 }),
        format: 'json',
      };
    }
    const buf = await getObjectBody(s3, { bucket, key: versionKey, maxBytes: 5_000_000 });
    return { key: versionKey, content: buf.toString('utf8'), format: 'markdown' };
  } catch (e) {
    if (e?.name === 'NoSuchKey') return null;
    throw e;
  }
}

/** Write new immutable version + update latest pointer. */
export async function writeNewDocVersion(s3, { bucket, docsPrefix, docId, format, newContent, contentType }) {
  const safe = safeDocId(docId);
  if (!safe) throw new Error('bad doc_id');
  const txt = format === 'json' ? JSON.stringify(newContent, null, 2) : String(newContent || '');
  const hash = sha256Hex(txt).slice(0, 12);
  const stamp = nowStamp();
  const ext = format === 'json' ? 'json' : 'md';
  const versionKey = `${docVersionsPrefix(docsPrefix, safe)}${stamp}__${hash}.${ext}`;
  const latestKeyPath = docKey(docsPrefix, safe, `latest.${ext}`);
  const ct = contentType || (format === 'json' ? 'application/json' : 'text/markdown; charset=utf-8');

  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: versionKey,
      Body: txt,
      ContentType: ct,
    })
  );
  await s3.send(
    new PutObjectCommand({
      Bucket: bucket,
      Key: latestKeyPath,
      Body: txt,
      ContentType: ct,
    })
  );
  return { version_key: versionKey, latest_key: latestKeyPath, sha256: sha256Hex(txt) };
}

export async function presignDoc(s3, { bucket, key, expiresSec = 900 }) {
  const { presignGet } = await import('./s3.mjs');
  return presignGet(s3, { bucket, key, expiresSec });
}

/** Pure: append items to finance register (idempotent by payment_id). */
export function applyFinanceAppend(latestJson, appendItems) {
  const base = latestJson && typeof latestJson === 'object' ? latestJson : { version: 1, generated_at: null, items: [] };
  base.version = base.version || 1;
  base.generated_at = new Date().toISOString();
  base.items = Array.isArray(base.items) ? base.items : [];

  const existing = new Set(base.items.map((x) => x.payment_id).filter(Boolean));
  const added = [];
  for (const it of appendItems || []) {
    const pid = String(it.payment_id || '').trim();
    if (!pid) continue;
    if (existing.has(pid)) continue;
    existing.add(pid);
    added.push(it);
    base.items.push(it);
  }
  return { next: base, added_count: added.length };
}

/** Pure: append markdown block. */
export function applyMarkdownAppend(latestMd, block) {
  const cur = String(latestMd || '');
  const add = String(block || '');
  const sep = cur.endsWith('\n') ? '' : '\n';
  return cur + sep + add + '\n';
}

function versionKeyFromTimestamp(prefix, docId, timestamp, contentHash) {
  const p = docToPath(docId);
  const safe = timestamp.replace(/:/g, '-').replace(/\..*Z$/, 'Z');
  return `${prefix}/${p.dir}/versions/${safe}__${contentHash.slice(0, 16)}.${p.ext}`;
}

/** Apply approve: append only. Returns { newVersionKey, docLedgerEntry }. */
export async function applyApprove(s3, docsConfig, ledgerBucket, ledgerPrefix, proposal, approval) {
  if (approval.decision !== 'approve') throw new Error('approval.decision must be approve');
  const docId = proposal.doc_id;
  const p = docToPath(docId);
  if (!p) throw new Error(`Unknown doc_id: ${docId}`);

  const prefix = docsConfig.prefix;
  const bucket = docsConfig.bucket;
  const now = new Date().toISOString();

  if (docId === 'finance/payments') {
    const latestK = latestKey(prefix, docId);
    let current = { version: 1, generated_at: now, items: [] };
    try {
      current = await getJsonObject(s3, { bucket, key: latestK, maxBytes: 10_000_000 });
    } catch {}
    const items = [...(current.items || [])];
    const appendItems = proposal.patch?.append_items || [];
    for (const it of appendItems) {
      if (items.some((e) => e.payment_id === it.payment_id)) {
        throw new Error(`payment_id already exists: ${it.payment_id}`);
      }
      items.push(it);
    }
    const next = { version: 1, generated_at: now, items };
    const body = JSON.stringify(next, null, 2);
    const hashBefore = current.items?.length ? sha256Hex(JSON.stringify(current)) : '';
    const hashAfter = sha256Hex(body);
    const versionKey = versionKeyFromTimestamp(prefix, docId, now, hashAfter);
    let previousVersionKey = '';
    const vers = await listVersions(s3, { bucket, prefix }, docId, 1);
    if (vers.length) previousVersionKey = vers[0].key;
    await putObjectJson(s3, { bucket, key: versionKey, json: next });
    await putObjectJson(s3, { bucket, key: latestK, json: next });
    const docLedgerEntry = {
      version: 1,
      type: 'doc_update',
      doc_id: docId,
      proposal_id: proposal.proposal_id,
      operator_id: approval.operator_id,
      previous_version: previousVersionKey,
      new_version: versionKey,
      hash_before: hashBefore,
      hash_after: hashAfter,
      at: now,
    };
    return { newVersionKey: versionKey, docLedgerEntry };
  }

  if (docId === 'mura-menasa/handbook') {
    const latestK = latestKey(prefix, docId);
    let current = '';
    try {
      const buf = await getObjectBody(s3, { bucket, key: latestK, maxBytes: 5_000_000 });
      current = buf.toString('utf8');
    } catch {}
    const appendMarkdown = proposal.patch?.append_markdown || '';
    const next = current + (current && !current.endsWith('\n') ? '\n' : '') + appendMarkdown;
    const hashBefore = current ? sha256Hex(Buffer.from(current, 'utf8')) : '';
    const hashAfter = sha256Hex(Buffer.from(next, 'utf8'));
    const versionKey = versionKeyFromTimestamp(prefix, docId, now, hashAfter);
    let previousVersionKey = '';
    const vers = await listVersions(s3, { bucket, prefix }, docId, 1);
    if (vers.length) previousVersionKey = vers[0].key;
    await putObject(s3, {
      bucket,
      key: versionKey,
      body: next,
      contentType: 'text/markdown; charset=utf-8',
    });
    await putObject(s3, {
      bucket,
      key: latestK,
      body: next,
      contentType: 'text/markdown; charset=utf-8',
    });
    const docLedgerEntry = {
      version: 1,
      type: 'doc_update',
      doc_id: docId,
      proposal_id: proposal.proposal_id,
      operator_id: approval.operator_id,
      previous_version: previousVersionKey,
      new_version: versionKey,
      hash_before: hashBefore,
      hash_after: hashAfter,
      at: now,
    };
    return { newVersionKey: versionKey, docLedgerEntry };
  }

  throw new Error(`Unsupported doc_id: ${docId}`);
}
