#!/usr/bin/env node
/**
 * E2E smoke: защищённый API без auth → 401/307, с auth → 200.
 * Auditor: 200 на read, 403 на write (cookie jar для стабильности).
 */
const BASE = process.env.E2E_BASE_URL ?? 'http://localhost:3000';

/**
 * Минимальный cookie jar — изоляция сессий auditor vs admin.
 * Собирает ВСЕ Set-Cookie, передаёт их в следующих запросах.
 */
class CookieJar {
  constructor() {
    this.cookies = new Map(); // name -> value
  }

  /** Обновить jar из response headers (все Set-Cookie). */
  storeFromResponse(headers, url) {
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

  /** Cookie header для запроса. */
  getHeader() {
    if (this.cookies.size === 0) return null;
    return [...this.cookies.entries()]
      .map(([k, v]) => `${k}=${v}`)
      .join('; ');
  }
}

async function fetchWithJar(jar, url, options = {}) {
  const headers = new Headers(options.headers);
  const cookie = jar.getHeader();
  if (cookie) headers.set('Cookie', cookie);
  const res = await fetch(url, { ...options, headers });
  jar.storeFromResponse(res.headers, url);
  return res;
}

async function run() {
  let failed = false;

  // 1. Неавторизованный запрос → 401 или 307
  const res1 = await fetch(`${BASE}/api/workspace/status`, { redirect: 'manual' });
  const blocked = res1.status === 401 || res1.status === 307;
  if (!blocked) {
    console.error('[FAIL] Unauthenticated /api/workspace/status: expected 401 or 307, got', res1.status);
    failed = true;
  } else {
    console.log('[OK] Unauthenticated request →', res1.status);
  }

  // 2. Auditor: cookie jar, 200 на read, 403 на write
  const auditorJar = new CookieJar();
  const csrfA = await fetchWithJar(auditorJar, `${BASE}/api/auth/csrf`);
  const { csrfToken: csrfAToken } = await csrfA.json();
  await fetchWithJar(auditorJar, `${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      csrfToken: csrfAToken,
      callbackUrl: `${BASE}/`,
      json: 'true',
      username: 'auditor@local',
      password: 'auditor',
    }),
    redirect: 'manual',
  });
  if (!auditorJar.getHeader()) {
    console.error('[FAIL] No cookies after auditor login');
    failed = true;
  } else {
    const rStatusBefore = await fetchWithJar(auditorJar, `${BASE}/api/workspace/status`);
    if (rStatusBefore.status !== 200) {
      console.error('[FAIL] Auditor: /api/workspace/status (before init) expected 200, got', rStatusBefore.status);
      failed = true;
    } else {
      const bodyBefore = await rStatusBefore.json();
      if (bodyBefore.ok !== true) {
        console.error('[FAIL] Auditor: /api/workspace/status body must have ok: true, got', bodyBefore);
        failed = true;
      } else {
        console.log('[OK] Auditor: /api/workspace/status (before init) → 200, ok: true');
      }
    }
    await fetchWithJar(auditorJar, `${BASE}/api/workspace/init`, { method: 'POST' });
    const rStatus = await fetchWithJar(auditorJar, `${BASE}/api/workspace/status`);
    if (rStatus.status !== 200) {
      console.error('[FAIL] Auditor: /api/workspace/status (after init) expected 200, got', rStatus.status);
      failed = true;
    } else {
      const body = await rStatus.json();
      if (body.ok !== true || body.dbExists !== true) {
        console.error('[FAIL] Auditor: /api/workspace/status (after init) expected ok:true, dbExists:true, got', body);
        failed = true;
      } else {
        console.log('[OK] Auditor: /api/workspace/status (after init) → 200, ok: true, dbExists: true');
      }
    }
    const rTmc = await fetchWithJar(auditorJar, `${BASE}/api/tmc/items`);
    if (rTmc.status !== 403) {
      console.error('[FAIL] Auditor: /api/tmc/items expected 403, got', rTmc.status);
      failed = true;
    } else {
      console.log('[OK] Auditor: /api/tmc/items → 403 (Forbidden)');
    }
    const rLedger = await fetchWithJar(auditorJar, `${BASE}/api/ledger/append`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        event_type: 'FILE_REGISTERED',
        payload_json: { action: 'FILE_REGISTERED', relative_path: 'x', checksum_sha256: 'a'.repeat(64) },
      }),
    });
    if (rLedger.status !== 403) {
      console.error('[FAIL] Auditor: /api/ledger/append expected 403, got', rLedger.status);
      failed = true;
    } else {
      console.log('[OK] Auditor: /api/ledger/append → 403 (Forbidden)');
    }
    const rAdminUsers = await fetchWithJar(auditorJar, `${BASE}/api/admin/users`);
    if (rAdminUsers.status !== 403) {
      console.error('[FAIL] Auditor: /api/admin/users expected 403, got', rAdminUsers.status);
      failed = true;
    } else {
      console.log('[OK] Auditor: /api/admin/users → 403 (Forbidden)');
    }
  }

  // 3. Admin: отдельный jar (чистая сессия)
  const adminJar = new CookieJar();
  const csrfAd = await fetchWithJar(adminJar, `${BASE}/api/auth/csrf`);
  const { csrfToken: csrfAdToken } = await csrfAd.json();
  await fetchWithJar(adminJar, `${BASE}/api/auth/callback/credentials`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      csrfToken: csrfAdToken,
      callbackUrl: `${BASE}/`,
      json: 'true',
      username: process.env.AUTH_EMAIL ?? 'admin@local',
      password: process.env.AUTH_PASSWORD ?? 'admin',
    }),
    redirect: 'manual',
  });
  if (!adminJar.getHeader()) {
    console.error('[FAIL] No cookies after admin login');
    failed = true;
  } else {
    const res2 = await fetchWithJar(adminJar, `${BASE}/api/workspace/status`);
    if (res2.status !== 200) {
      console.error('[FAIL] Admin: /api/workspace/status expected 200, got', res2.status);
      failed = true;
    } else {
      console.log('[OK] Admin: /api/workspace/status → 200');
    }
    const rAdminUsers = await fetchWithJar(adminJar, `${BASE}/api/admin/users?limit=2`);
    if (rAdminUsers.status !== 200) {
      console.error('[FAIL] Admin: /api/admin/users expected 200, got', rAdminUsers.status);
      failed = true;
    } else {
      const data = await rAdminUsers.json();
      if (!Array.isArray(data.users)) {
        console.error('[FAIL] Admin: /api/admin/users response must have users array');
        failed = true;
      } else {
        console.log('[OK] Admin: /api/admin/users → 200 (pagination)');
        if (data.nextCursor && data.users.length >= 2) {
          const r2 = await fetchWithJar(adminJar, `${BASE}/api/admin/users?limit=2&cursor=${encodeURIComponent(data.nextCursor)}`);
          if (r2.status !== 200) {
            console.error('[FAIL] Admin: /api/admin/users page 2 expected 200, got', r2.status);
            failed = true;
          } else {
            const data2 = await r2.json();
            const ids1 = new Set(data.users.map((u) => u.id));
            const ids2 = new Set(data2.users.map((u) => u.id));
            const overlap = [...ids1].filter((id) => ids2.has(id));
            if (overlap.length > 0) {
              console.error('[FAIL] Pagination: page 1 and 2 must not have duplicate ids');
              failed = true;
            } else {
              console.log('[OK] Pagination: page 2 no duplicates');
            }
          }
        }
      }
    }
    const uniqueEmail = 'e2e-test-' + Date.now() + '@example.com';
    const createRes = await fetchWithJar(adminJar, `${BASE}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'testpass123',
        role_code: 'AUDITOR',
      }),
    });
    if (createRes.status !== 200) {
      const body = await createRes.text();
      console.error('[FAIL] Admin: POST /api/admin/users expected 200, got', createRes.status, body);
      failed = true;
    } else {
      console.log('[OK] Admin: POST /api/admin/users (create) → 200');
    }
    const dupRes = await fetchWithJar(adminJar, `${BASE}/api/admin/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        email: uniqueEmail,
        password: 'otherpass456',
        role_code: 'MANAGER',
      }),
    });
    if (dupRes.status !== 409) {
      console.error('[FAIL] Admin: POST duplicate email expected 409, got', dupRes.status);
      failed = true;
    } else {
      console.log('[OK] Admin: POST duplicate email → 409');
    }
  }

  if (failed) process.exit(1);
  console.log('E2E smoke: all passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
