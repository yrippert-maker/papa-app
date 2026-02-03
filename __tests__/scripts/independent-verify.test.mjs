/**
 * Golden fixtures test: independent-verify on minimal (pass) and bad-receipt (fail).
 * Run with: node __tests__/scripts/independent-verify.test.mjs
 * Or: npm run test:verify:fixtures
 */
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const minimalSrc = path.join(ROOT, '__fixtures__', 'auditor-pack-minimal');
const badReceiptPack = path.join(ROOT, '__fixtures__', 'auditor-pack-bad-receipt');
const keysDir = path.join(ROOT, '__fixtures__', 'keys');

function cpDir(src, dst) {
  fs.mkdirSync(dst, { recursive: true });
  for (const ent of fs.readdirSync(src, { withFileTypes: true })) {
    const s = path.join(src, ent.name);
    const d = path.join(dst, ent.name);
    if (ent.isDirectory()) cpDir(s, d);
    else fs.copyFileSync(s, d);
  }
}

function runVerify(packPath, env = {}) {
  const r = spawnSync(
    'node',
    ['scripts/independent-verify.mjs', '--audit-pack', packPath],
    { cwd: ROOT, encoding: 'utf8', env: { ...process.env, ...env } }
  );
  return { status: r.status, stdout: r.stdout || '', stderr: r.stderr || '' };
}

// Test 1: PASS for minimal signed pack (REQUIRE_PACK_SIGNATURE=1)
const tmp1 = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-min-'));
cpDir(minimalSrc, tmp1);

const h = spawnSync('node', ['scripts/pack-hash.mjs', tmp1], { cwd: ROOT, encoding: 'utf8' });
if (h.status !== 0) {
  console.error('FAIL: pack-hash failed', h.stderr);
  process.exit(1);
}

const priv = fs.readFileSync(path.join(keysDir, 'test_ed25519_private.pem'), 'utf8');
const s = spawnSync('node', ['scripts/pack-sign.mjs', tmp1], {
  cwd: ROOT,
  encoding: 'utf8',
  env: { ...process.env, PACK_SIGN_PRIVATE_KEY_PEM: priv, PACK_SIGN_KEY_ID: 'ed25519:test' },
});
if (s.status !== 0) {
  console.error('FAIL: pack-sign failed', s.stderr);
  process.exit(1);
}

const pub = fs.readFileSync(path.join(keysDir, 'test_ed25519_public.pem'), 'utf8');
const r1 = runVerify(tmp1, {
  STRICT_VERIFY: '1',
  REQUIRE_PACK_SIGNATURE: '1',
  REQUIRE_ANCHORING_ISSUES: '1',
  VERIFY_FAIL_SEVERITY: 'critical',
  VERIFY_FAIL_TYPES: 'RECEIPT_INTEGRITY_MISMATCH,RECEIPT_MISSING_FOR_CONFIRMED,ANCHOR_FAILED',
  PACK_SIGN_PUBLIC_KEY_PEM: pub,
});

const ok1 = r1.status === 0 && r1.stdout.includes('VERIFICATION PASSED');
if (!ok1) {
  console.error('FAIL: minimal signed pack should pass', r1);
  process.exit(1);
}
if (!fs.existsSync(path.join(tmp1, 'verify-summary.json'))) {
  console.error('FAIL: verify-summary.json not created');
  process.exit(1);
}

// Test 2: FAIL on critical issue type (REQUIRE_PACK_SIGNATURE=0 to isolate issue test)
const r2 = runVerify(badReceiptPack, {
  STRICT_VERIFY: '1',
  REQUIRE_PACK_SIGNATURE: '0',
  REQUIRE_ANCHORING_ISSUES: '1',
  VERIFY_FAIL_SEVERITY: 'critical',
  VERIFY_FAIL_TYPES: 'RECEIPT_INTEGRITY_MISMATCH',
});

const ok2 = r2.status === 2 && (r2.stdout.includes('VERIFICATION FAILED') || r2.stdout.includes('disallowed'));
if (!ok2) {
  console.error('FAIL: bad-receipt pack should fail', r2);
  process.exit(1);
}

// Test 3: FAIL when REQUIRE_PACK_SIGNATURE=1 but pack unsigned
const tmp3 = fs.mkdtempSync(path.join(os.tmpdir(), 'pack-unsigned-'));
cpDir(minimalSrc, tmp3);

const r3 = runVerify(tmp3, {
  STRICT_VERIFY: '1',
  REQUIRE_PACK_SIGNATURE: '1',
  REQUIRE_ANCHORING_ISSUES: '1',
  VERIFY_FAIL_SEVERITY: 'critical',
  VERIFY_FAIL_TYPES: '',
  PACK_SIGN_PUBLIC_KEY_PEM: pub,
});

const ok3 = r3.status === 2;
if (!ok3) {
  console.error('FAIL: unsigned pack with REQUIRE_PACK_SIGNATURE=1 should fail', r3);
  process.exit(1);
}

console.log('OK: independent-verify golden fixtures (signed pass, bad fail, unsigned fail)');
