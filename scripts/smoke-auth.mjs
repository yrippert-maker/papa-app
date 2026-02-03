#!/usr/bin/env node
/**
 * Smoke-check: Auth endpoints (providers, session).
 * Usage: BASE_URL=http://localhost:3000 node scripts/smoke-auth.mjs
 */
const base = process.env.BASE_URL || 'http://localhost:3000';

async function check(name, url) {
  try {
    const res = await fetch(url);
    const ok = res.ok || res.status === 401;
    const text = await res.text();
    if (!ok) {
      console.error(`FAIL ${name}: ${res.status} ${text.slice(0, 100)}`);
      process.exitCode = 1;
      return false;
    }
    if (text.includes('error=Configuration')) {
      console.error(`FAIL ${name}: Configuration error in response`);
      process.exitCode = 1;
      return false;
    }
    console.log(`OK ${name}: ${res.status}`);
    return true;
  } catch (e) {
    console.error(`FAIL ${name}:`, e.message);
    process.exitCode = 1;
    return false;
  }
}

(async () => {
  await check('providers', `${base}/api/auth/providers`);
  await check('session', `${base}/api/auth/session`);
})();
