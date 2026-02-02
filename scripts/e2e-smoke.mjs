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
    if (res1.status === 401) {
      const body = await res1.json();
      if (!body?.error?.code || !body?.error?.request_id) {
        console.error('[FAIL] Unauthenticated 401: expected { error: { code, request_id } }, got', JSON.stringify(body));
        failed = true;
      } else {
        console.log('[OK] Unauthenticated 401 → standardized payload (code, request_id)');
      }
    }
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
    if (rTmc.status !== 200) {
      console.error('[FAIL] Auditor: /api/tmc/items expected 200 (TMC.VIEW), got', rTmc.status);
      failed = true;
    } else {
      console.log('[OK] Auditor: /api/tmc/items → 200 (read-only TMC.VIEW)');
    }
    const rTmcRequests = await fetchWithJar(auditorJar, `${BASE}/api/tmc/requests`);
    if (rTmcRequests.status !== 200) {
      console.error('[FAIL] Auditor: /api/tmc/requests expected 200 (TMC.VIEW alias), got', rTmcRequests.status);
      failed = true;
    } else {
      console.log('[OK] Auditor: /api/tmc/requests → 200 (TMC.VIEW alias for TMC.REQUEST.VIEW)');
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
      const body = await rLedger.json();
      if (!body?.error?.code || body.error.code !== 'FORBIDDEN' || !body?.error?.request_id) {
        console.error('[FAIL] Auditor: /api/ledger/append 403 expected { error: { code: FORBIDDEN, request_id } }, got', JSON.stringify(body));
        failed = true;
      } else {
        console.log('[OK] Auditor: /api/ledger/append → 403 (standardized payload)');
      }
    }
    const rInspection = await fetchWithJar(auditorJar, `${BASE}/api/inspection/cards`);
    if (rInspection.status !== 200) {
      console.error('[FAIL] Auditor: /api/inspection/cards expected 200 (INSPECTION.VIEW), got', rInspection.status);
      failed = true;
    } else {
      const inspBody = await rInspection.json();
      if (!Array.isArray(inspBody.cards)) {
        console.error('[FAIL] Auditor: /api/inspection/cards response must have cards array');
        failed = true;
      } else {
        console.log('[OK] Auditor: /api/inspection/cards → 200 (INSPECTION.VIEW)');
      }
    }
    const rReport = await fetchWithJar(auditorJar, `${BASE}/api/inspection/report`);
    if (rReport.status !== 200) {
      console.error('[FAIL] Auditor: /api/inspection/report expected 200 (INSPECTION.VIEW), got', rReport.status);
      failed = true;
    } else {
      const reportBody = await rReport.json();
      if (typeof reportBody.total_cards !== 'number' || !reportBody.by_status || !reportBody.breakdown_by_check_code) {
        console.error('[FAIL] Auditor: /api/inspection/report response must have total_cards, by_status, breakdown_by_check_code');
        failed = true;
      } else {
        console.log('[OK] Auditor: /api/inspection/report → 200 (INSPECTION.VIEW)');
      }
    }
    const rAudit = await fetchWithJar(auditorJar, `${BASE}/api/inspection/cards/CARD-SEED-001/audit`);
    if (rAudit.status !== 200) {
      console.error('[FAIL] Auditor: /api/inspection/cards/:id/audit expected 200 (INSPECTION.VIEW), got', rAudit.status);
      failed = true;
    } else {
      const auditBody = await rAudit.json();
      if (!Array.isArray(auditBody.events)) {
        console.error('[FAIL] Auditor: /api/inspection/cards/:id/audit response must have events array');
        failed = true;
      } else {
        console.log('[OK] Auditor: /api/inspection/cards/:id/audit → 200 (INSPECTION.VIEW)');
      }
    }
    const rEvidence = await fetchWithJar(auditorJar, `${BASE}/api/inspection/cards/CARD-SEED-001/evidence`);
    if (rEvidence.status !== 200) {
      console.error('[FAIL] Auditor: /api/inspection/cards/:id/evidence expected 200 (INSPECTION.VIEW), got', rEvidence.status);
      failed = true;
    } else {
      const evBody = await rEvidence.json();
      if (!evBody.card || !Array.isArray(evBody.check_results) || !Array.isArray(evBody.audit_events) || !evBody.export_hash) {
        console.error('[FAIL] Auditor: /api/inspection/cards/:id/evidence must have card, check_results, audit_events, export_hash');
        failed = true;
      } else {
        console.log('[OK] Auditor: /api/inspection/cards/:id/evidence → 200 (INSPECTION.VIEW)');
      }
    }
    const rEvidenceSigned = await fetchWithJar(auditorJar, `${BASE}/api/inspection/cards/CARD-SEED-001/evidence?signed=1`);
    let signedExportBody = null;
    if (rEvidenceSigned.status !== 200) {
      console.error('[FAIL] Auditor: /api/inspection/cards/:id/evidence?signed=1 expected 200, got', rEvidenceSigned.status);
      failed = true;
    } else {
      signedExportBody = await rEvidenceSigned.json();
      if (!signedExportBody.export_signature || !signedExportBody.export_public_key || !signedExportBody.export_key_id) {
        console.error('[FAIL] Auditor: evidence?signed=1 must have export_signature, export_public_key, export_key_id');
        failed = true;
      } else {
        console.log('[OK] Auditor: /api/inspection/cards/:id/evidence?signed=1 → 200 (signed export with key_id)');
      }
    }
    // Verify signed export
    if (signedExportBody) {
      const rVerify = await fetchWithJar(auditorJar, `${BASE}/api/inspection/evidence/verify`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ export_json: signedExportBody }),
      });
      if (rVerify.status !== 200) {
        console.error('[FAIL] Auditor: /api/inspection/evidence/verify expected 200, got', rVerify.status);
        failed = true;
      } else {
        const verifyBody = await rVerify.json();
        if (!verifyBody.ok || !verifyBody.content?.valid || !verifyBody.signature?.valid) {
          console.error('[FAIL] Auditor: evidence/verify must return ok:true, content.valid:true, signature.valid:true');
          failed = true;
        } else {
          console.log('[OK] Auditor: /api/inspection/evidence/verify → 200 (verified signed export)');
        }
      }
    }
    const rCheckResults = await fetchWithJar(auditorJar, `${BASE}/api/inspection/cards/CARD-SEED-001/check-results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [{ check_code: 'DOCS', result: 'PASS', comment: '' }] }),
    });
    if (rCheckResults.status !== 403) {
      console.error('[FAIL] Auditor: POST /api/inspection/cards/:id/check-results expected 403 (no INSPECTION.MANAGE), got', rCheckResults.status);
      failed = true;
    } else {
      const body = await rCheckResults.json();
      if (!body?.error?.code || body.error.code !== 'FORBIDDEN' || !body?.error?.request_id) {
        console.error('[FAIL] Auditor: check-results 403 expected { error: { code: FORBIDDEN, request_id } }, got', JSON.stringify(body));
        failed = true;
      } else {
        console.log('[OK] Auditor: POST /api/inspection/cards/:id/check-results → 403 (standardized payload)');
      }
    }
    const rTransition = await fetchWithJar(auditorJar, `${BASE}/api/inspection/cards/CARD-SEED-001/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    if (rTransition.status !== 403) {
      console.error('[FAIL] Auditor: POST /api/inspection/cards/:id/transition expected 403 (no INSPECTION.MANAGE), got', rTransition.status);
      failed = true;
    } else {
      const body = await rTransition.json();
      if (!body?.error?.code || body.error.code !== 'FORBIDDEN' || !body?.error?.request_id) {
        console.error('[FAIL] Auditor: transition 403 expected { error: { code: FORBIDDEN, request_id } }, got', JSON.stringify(body));
        failed = true;
      } else {
        console.log('[OK] Auditor: POST /api/inspection/cards/:id/transition → 403 (standardized payload)');
      }
    }
    const rAdminUsers = await fetchWithJar(auditorJar, `${BASE}/api/admin/users`);
    if (rAdminUsers.status !== 403) {
      console.error('[FAIL] Auditor: /api/admin/users expected 403, got', rAdminUsers.status);
      failed = true;
    } else {
      const body = await rAdminUsers.json();
      if (!body?.error?.code || body.error.code !== 'FORBIDDEN' || !body?.error?.request_id) {
        console.error('[FAIL] Auditor: /api/admin/users 403 expected { error: { code: FORBIDDEN, request_id } }, got', JSON.stringify(body));
        failed = true;
      } else {
        console.log('[OK] Auditor: /api/admin/users → 403 (standardized payload)');
      }
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
    const rTransitionAdmin = await fetchWithJar(adminJar, `${BASE}/api/inspection/cards/CARD-SEED-001/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    if (rTransitionAdmin.status !== 200) {
      const body = await rTransitionAdmin.text();
      console.error('[FAIL] Admin: POST /api/inspection/cards/:id/transition expected 200 (INSPECTION.MANAGE), got', rTransitionAdmin.status, body);
      failed = true;
    } else {
      const tBody = await rTransitionAdmin.json();
      if (tBody.status !== 'IN_PROGRESS' || tBody.from_status !== 'DRAFT') {
        console.error('[FAIL] Admin: transition response expected status:IN_PROGRESS, from_status:DRAFT, got', JSON.stringify(tBody));
        failed = true;
      } else {
        console.log('[OK] Admin: POST /api/inspection/cards/:id/transition → 200 (DRAFT→IN_PROGRESS)');
      }
    }
    const rCheckAdmin = await fetchWithJar(adminJar, `${BASE}/api/inspection/cards/CARD-SEED-001/check-results`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [{ check_code: 'DOCS', result: 'PASS', comment: 'E2E test' }] }),
    });
    if (rCheckAdmin.status !== 200) {
      const body = await rCheckAdmin.text();
      console.error('[FAIL] Admin: POST /api/inspection/cards/:id/check-results expected 200, got', rCheckAdmin.status, body);
      failed = true;
    } else {
      const cBody = await rCheckAdmin.json();
      if (!Array.isArray(cBody.check_results)) {
        console.error('[FAIL] Admin: check-results response must have check_results array');
        failed = true;
      } else {
        console.log('[OK] Admin: POST /api/inspection/cards/:id/check-results → 200');
      }
    }
  }

  // 4. Verify aggregator (auditor has WORKSPACE.READ + LEDGER.READ)
  const rVerifyAgg = await fetchWithJar(auditorJar, `${BASE}/api/system/verify`);
  if (rVerifyAgg.status !== 200) {
    console.error('[FAIL] Auditor: /api/system/verify expected 200, got', rVerifyAgg.status);
    failed = true;
  } else {
    const vBody = await rVerifyAgg.json();
    if (!vBody.authz_verification || vBody.ledger_verification?.skipped) {
      console.error('[FAIL] Auditor: /api/system/verify expected ledger included (not skipped), got', vBody);
      failed = true;
    } else if (!vBody.ledger_verification || !('ok' in vBody.ledger_verification)) {
      console.error('[FAIL] Auditor: /api/system/verify expected ledger_verification.ok field, got', vBody);
      failed = true;
    } else if (!vBody.inspection_verification || vBody.inspection_verification.skipped) {
      console.error('[FAIL] Auditor: /api/system/verify expected inspection included (INSPECTION.VIEW), got', vBody.inspection_verification);
      failed = true;
    } else if (!vBody.inspection_verification.ok) {
      console.error('[FAIL] Auditor: /api/system/verify inspection_verification.ok expected true, got', vBody.inspection_verification);
      failed = true;
    } else {
      console.log('[OK] Auditor: /api/system/verify → 200 (AuthZ + Inspection + Ledger included)');
    }
  }

  // 5. Metrics endpoint (no auth)
  const rMetrics = await fetch(`${BASE}/api/metrics`);
  if (rMetrics.status !== 200) {
    console.error('[FAIL] /api/metrics expected 200, got', rMetrics.status);
    failed = true;
  } else {
    const text = await rMetrics.text();
    if (!text.includes('verify_aggregator_requests_total')) {
      console.error('[FAIL] /api/metrics missing verify_aggregator metrics');
      failed = true;
    } else {
      console.log('[OK] /api/metrics → 200 (Prometheus format)');
    }
  }

  if (failed) process.exit(1);
  console.log('E2E smoke: all passed');
}

run().catch((e) => {
  console.error(e);
  process.exit(1);
});
