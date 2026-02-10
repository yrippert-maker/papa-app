#!/usr/bin/env node
/**
 * mro:monitor — ежемесячная проверка обновлений MRO (EASA/FAA/ICAO).
 * Сравнивает с предыдущим snapshot, при изменениях создаёт review_packet и уведомляет.
 *
 * Запуск: npm run mro:monitor
 * Для launchd: ежемесячно 1-го числа в 09:00
 */
import dotenv from 'dotenv';
import path from 'node:path';
import fs from 'node:fs/promises';
import { execSync } from 'node:child_process';
import { existsSync } from 'node:fs';

const envLocal = path.join(process.cwd(), '.env.local');
if (existsSync(envLocal)) dotenv.config({ path: envLocal });
dotenv.config();

const SNAPSHOT_FILE = 'mro_snapshot.json';
const REVIEW_PACKET = 'review_packet.md';

async function loadSources() {
  const p = path.join(process.cwd(), 'config', 'mro-sources.json');
  const raw = await fs.readFile(p, 'utf-8');
  return JSON.parse(raw);
}

function getSnapshotDir() {
  const ws = process.env.WORKSPACE_ROOT?.trim();
  if (ws) return path.join(path.resolve(ws), '00_SYSTEM', 'mro');
  return path.join(process.cwd(), 'data', '00_SYSTEM', 'mro');
}

function getSnapshotPath() {
  return path.join(getSnapshotDir(), SNAPSHOT_FILE);
}

function getOutputBase() {
  const out = process.env.AGENT_OUTPUT_ROOT?.trim();
  if (out) return path.join(path.resolve(out), 'MRO_UPDATES');
  const papa = process.env.PAPA_DB_ROOT?.trim();
  if (papa) return path.join(path.resolve(papa), 'выгрузки', 'MRO_UPDATES');
  return path.join(process.cwd(), 'data', '00_SYSTEM', 'mro', 'MRO_UPDATES');
}

async function fetchMeta(url) {
  try {
    const res = await fetch(url, { method: 'HEAD', redirect: 'follow' });
    const etag = res.headers.get('etag') || '';
    const lastMod = res.headers.get('last-modified') || '';
    const contentLength = res.headers.get('content-length') || '0';
    return { url, etag, lastMod, contentLength, status: res.status };
  } catch (e) {
    return { url, error: e?.message || String(e) };
  }
}

async function takeSnapshot(sources) {
  const snapshot = { takenAt: new Date().toISOString(), sources: {} };
  for (const s of sources.sources) {
    const meta = await fetchMeta(s.url);
    snapshot.sources[s.id] = {
      ...meta,
      authority: s.authority,
      kind: s.kind,
      title: s.title,
    };
  }
  return snapshot;
}

function diffSnapshots(prev, curr) {
  const changes = [];
  for (const [id, cur] of Object.entries(curr.sources)) {
    const p = prev?.sources?.[id];
    if (!p) {
      changes.push({ id, type: 'new', cur });
      continue;
    }
    if (cur.etag && p.etag && cur.etag !== p.etag) {
      changes.push({ id, type: 'etag', prev: p.etag, cur: cur.etag, meta: cur });
      continue;
    }
    if (cur.lastMod && p.lastMod && cur.lastMod !== p.lastMod) {
      changes.push({ id, type: 'lastMod', prev: p.lastMod, cur: cur.lastMod, meta: cur });
    }
  }
  return changes;
}

function renderReviewPacket(changes, snapshot) {
  const lines = [
    '# MRO Regulatory Update — Review Packet',
    '',
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Summary',
    '',
    `${changes.length} source(s) have changed.`,
    '',
    '## Changes',
    '',
  ];
  for (const c of changes) {
    const m = c.meta || c.cur;
    lines.push(`### ${m?.title || c.id}`);
    lines.push('');
    lines.push(`- **Authority:** ${m?.authority || '-'}`);
    lines.push(`- **Kind:** ${m?.kind || '-'}`);
    lines.push(`- **URL:** ${m?.url || '-'}`);
    if (c.type === 'etag') lines.push(`- **ETag:** ${c.prev} → ${c.cur}`);
    if (c.type === 'lastMod') lines.push(`- **Last-Modified:** ${c.prev} → ${c.cur}`);
    lines.push('');
    lines.push('**Action:** Review and update working documentation. Apply only after operator approval.');
    lines.push('');
  }
  lines.push('---');
  lines.push('');
  lines.push('*Patch proposal — do not auto-apply. Approve in UI/CLI before updating documents.*');
  return lines.join('\n');
}

function notifyMac(title, body) {
  const safe = (s) => (s || '').replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const script = `display notification "${safe(body)}" with title "${safe(title || 'MRO Monitor')}"`;
  try {
    execSync(`osascript -e '${script}'`, { stdio: 'ignore' });
  } catch {}
}

async function main() {
  const args = process.argv.slice(2);
  const dryRun = args.includes('--dry-run');
  const noNotify = args.includes('--no-notify');

  const { sources } = await loadSources();
  const snapshot = await takeSnapshot({ sources });

  const snapshotPath = getSnapshotPath();
  await fs.mkdir(path.dirname(snapshotPath), { recursive: true });

  let prev = null;
  try {
    const raw = await fs.readFile(snapshotPath, 'utf-8');
    prev = JSON.parse(raw);
  } catch {}

  const changes = diffSnapshots(prev, snapshot);

  if (changes.length === 0) {
    console.log('[mro:monitor] No changes detected');
    if (!dryRun) await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    return;
  }

  console.log('[mro:monitor] Changes detected:', changes.length);

  const yyyyMm = new Date().toISOString().slice(0, 7);
  const outBase = getOutputBase();
  const packetDir = path.join(outBase, yyyyMm, 'review_packet');
  await fs.mkdir(packetDir, { recursive: true });

  const packetMd = renderReviewPacket(changes, snapshot);
  const packetPath = path.join(packetDir, REVIEW_PACKET);

  if (!dryRun) {
    await fs.writeFile(packetPath, packetMd, 'utf-8');
    await fs.writeFile(snapshotPath, JSON.stringify(snapshot, null, 2), 'utf-8');
    console.log('[mro:monitor] Review packet:', packetPath);
  } else {
    console.log('[mro:monitor] (dry-run) Would write:', packetPath);
  }

  if (!noNotify && process.platform === 'darwin') {
    notifyMac(
      'MRO Regulatory Update',
      `Found ${changes.length} update(s) — review packet ready`
    );
  }
}

main().catch((e) => {
  console.error('[mro:monitor]', e);
  process.exit(1);
});
