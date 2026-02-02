/**
 * Unit tests for lib/evidence-signing — sign/verify export_hash.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const originalEnv = process.env;

describe('evidence-signing', () => {
  let tmpKeysDir: string;

  beforeEach(() => {
    tmpKeysDir = join(tmpdir(), `evidence-signing-test-${Date.now()}`);
    process.env.WORKSPACE_ROOT = join(tmpKeysDir, 'ws');
    jest.resetModules();
  });

  afterEach(() => {
    process.env = originalEnv;
  });

  it('ensureKeys generates key pair when missing', () => {
    const { ensureKeys: ensure } = require('@/lib/evidence-signing');
    const { publicKey } = ensure();
    expect(publicKey).toMatch(/-----BEGIN PUBLIC KEY-----/);
    expect(publicKey).toMatch(/-----END PUBLIC KEY-----/);
    const keysDir = join(process.env.WORKSPACE_ROOT!, '00_SYSTEM', 'keys');
    expect(existsSync(join(keysDir, 'evidence-signing.key'))).toBe(true);
    expect(existsSync(join(keysDir, 'evidence-signing.pub'))).toBe(true);
  });

  it('signExportHash returns hex string', () => {
    const { signExportHash: sign } = require('@/lib/evidence-signing');
    const hash = 'a'.repeat(64);
    const sig = sign(hash);
    expect(sig).toMatch(/^[a-f0-9]+$/);
    expect(sig.length).toBeGreaterThan(0);
  });

  it('verifyExportHash returns true for valid signature', () => {
    const { signExportHash: sign, verifyExportHash: verify } = require('@/lib/evidence-signing');
    const hash = 'b'.repeat(64);
    const sig = sign(hash);
    expect(verify(hash, sig)).toBe(true);
  });

  it('verifyExportHash returns false for tampered hash', () => {
    const { signExportHash: sign, verifyExportHash: verify } = require('@/lib/evidence-signing');
    const hash = 'c'.repeat(64);
    const sig = sign(hash);
    expect(verify('d'.repeat(64), sig)).toBe(false);
  });

  it('verifyExportHash returns false for tampered signature', () => {
    const { signExportHash: sign, verifyExportHash: verify } = require('@/lib/evidence-signing');
    const hash = 'e'.repeat(64);
    const sig = sign(hash);
    expect(verify(hash, sig.slice(0, -2) + 'ff')).toBe(false);
  });
});
