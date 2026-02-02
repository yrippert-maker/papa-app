#!/usr/bin/env node
/**
 * Replay failed ledger events from dead-letter file.
 * Reads {WORKSPACE_ROOT}/00_SYSTEM/ledger-dead-letter.jsonl,
 * POSTs each event to /api/ledger/append, removes successfully replayed lines.
 *
 * Usage:
 *   node scripts/replay-ledger-dead-letter.mjs [--dry-run] [--base-url=URL]
 *
 * Env: WORKSPACE_ROOT, AUTH_EMAIL, AUTH_PASSWORD, E2E_BASE_URL (fallback for base-url)
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join, dirname } from 'path';

const WORKSPACE_ROOT = process.env.WORKSPACE_ROOT?.trim() || join(process.cwd(), 'data');
const DEAD_LETTER_FILE = join(WORKSPACE_ROOT, '00_SYSTEM', 'ledger-dead-letter.jsonl');
const BASE = process.env.E2E_BASE_URL || process.argv.find((a) => a.startsWith('--base-url='))?.split('=')[1] || 'http://localhost:3000';

const args = process.argv.slice(2);
const DRY_RUN = args.includes('--dry-run');
const baseUrlArg = args.find((a) => a.startsWith('--base-url='));
const BASE_URL = baseUrlArg ? baseUrlArg.split('=')[1] : BASE;

class CookieJar {
  constructor() {
    this.cookies = new Map();
  }

  storeFromResponse(headers) {
    const setCookies = headers.getSetCookie?.() ?? [];
    if (setCookies.length === 0 && typeof headers.get === 'function') {
      const v = headers.get('set-cookie');
      if (v) setCookies.push(...(Array.isArray(v) ? v : [v]));
    }
    for (const raw of setCookies) {
      const part = raw.split(';')[0].trim();
      const eq = part.indexOf('=');
      if (eq > 0) {
        const name = part.slice(0, eq).trim();
        const value = part.slice(eq + 1).trim();
        this.cookies.set(name, value);
      }
    }
  }

  getHeader() {
    if (this.cookies.size === 0) return null;
    return [...this.cookies.entries()].map(([k, v]) => `${k}=${v}`).join('; ');
  }
}

async function fetchWithJar(jar, url, options = {}) {
  const headers = new Headers(options.headers);
  const cookie = jar.getHeader();
  if (cookie) headers.set('Cookie', cookie);
  const res = await fetch(url, { ...options, headers });
  jar.storeFromResponse(res.headers);
  return res;
}

async function login(jar) {
  const csrfRes = await fetchWithJar(jar, `${BASE_URL}/api/auth/csrf`);
  const { csrfToken } = await csrfRes.json();
  await fetchWithJar(jar, `${BASE_URL}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      csrfToken,
      callbackUrl: `${BASE_URL}/`,
      json: 'true',
      username: process.env.AUTH_EMAIL || 'admin@local',
      password: process.env.AUTH_PASSWORD || 'admin',
    }),
    redirect: 'manual',
  });
  return !!jar.getHeader();
}

async function run() {
  if (!existsSync(DEAD_LETTER_FILE)) {
    console.log('[replay] No dead-letter file at', DEAD_LETTER_FILE);
    process.exit(0);
  }

  const raw = readFileSync(DEAD_LETTER_FILE, 'utf8');
  const entries = parseDeadLetterLines(raw);
  if (entries.length === 0) {
    console.log('[replay] No valid entries to replay');
    process.exit(0);
  }

  if (DRY_RUN) {
    console.log('[replay] --dry-run: would replay', entries.length, 'event(s)');
    for (const { entry } of entries) {
      console.log('  -', entry.event_type, entry.ts_utc || '');
    }
    process.exit(0);
  }

  const jar = new CookieJar();
  const ok = await login(jar);
  if (!ok) {
    console.error('[replay] Failed to authenticate (admin credentials required for LEDGER_APPEND)');
    process.exit(1);
  }

  const failed = [];
  let replayed = 0;

  for (const { line, entry } of entries) {
    let payloadObj;
    try {
      payloadObj = parsePayloadJson(entry.payload_json);
    } catch (e) {
      console.warn('[replay] Skip', entry.event_type, ':', e.message);
      failed.push(line);
      continue;
    }

    const res = await fetchWithJar(jar, `${BASE_URL}/api/ledger/append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: entry.event_type,
        payload_json: payloadObj,
      }),
    });

    if (res.ok) {
      const body = await res.json();
      console.log('[replay] OK', entry.event_type, body.block_hash || '');
      replayed++;
    } else {
      const text = await res.text();
      console.warn('[replay] FAIL', entry.event_type, res.status, text.slice(0, 200));
      failed.push(line);
    }
  }

  if (failed.length > 0) {
    const dir = dirname(DEAD_LETTER_FILE);
    if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
    writeFileSync(DEAD_LETTER_FILE, failed.join('\n') + (failed.length ? '\n' : ''), 'utf8');
    console.log('[replay] Kept', failed.length, 'failed line(s) in dead-letter');
  } else {
    writeFileSync(DEAD_LETTER_FILE, '', 'utf8');
    console.log('[replay] All', replayed, 'event(s) replayed; dead-letter cleared');
  }

  process.exit(failed.length > 0 ? 1 : 0);
}

run().catch((e) => {
  console.error('[replay]', e);
  process.exit(1);
});
