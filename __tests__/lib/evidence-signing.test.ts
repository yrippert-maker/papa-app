/**
 * Unit tests for lib/evidence-signing — sign/verify export_hash with key_id.
 */
import { existsSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const originalEnv = { ...process.env };

describe('evidence-signing', () => {
  let tmpKeysDir: string;

  beforeEach(() => {
    tmpKeysDir = join(tmpdir(), `evidence-signing-test-${Date.now()}`);
    process.env.WORKSPACE_ROOT = join(tmpKeysDir, 'ws');
    jest.resetModules();
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it('ensureKeys generates key pair with key_id when missing', () => {
    const { ensureKeys: ensure } = require('@/lib/evidence-signing');
    const { publicKey, keyId } = ensure();
    expect(publicKey).toMatch(/-----BEGIN PUBLIC KEY-----/);
    expect(publicKey).toMatch(/-----END PUBLIC KEY-----/);
    expect(keyId).toMatch(/^[a-f0-9]{16}$/);
    const keysDir = join(process.env.WORKSPACE_ROOT!, '00_SYSTEM', 'keys', 'active');
    expect(existsSync(join(keysDir, 'evidence-signing.key'))).toBe(true);
    expect(existsSync(join(keysDir, 'evidence-signing.pub'))).toBe(true);
    expect(existsSync(join(keysDir, 'key_id.txt'))).toBe(true);
  });

  it('signExportHash returns { signature, keyId }', () => {
    const { signExportHash: sign, ensureKeys } = require('@/lib/evidence-signing');
    const { keyId: expectedKeyId } = ensureKeys();
    const hash = 'a'.repeat(64);
    const { signature, keyId } = sign(hash);
    expect(signature).toMatch(/^[a-f0-9]+$/);
    expect(signature.length).toBeGreaterThan(0);
    expect(keyId).toBe(expectedKeyId);
  });

  it('verifyExportHash returns true for valid signature with keyId', () => {
    const { signExportHash: sign, verifyExportHash: verify } = require('@/lib/evidence-signing');
    const hash = 'b'.repeat(64);
    const { signature, keyId } = sign(hash);
    expect(verify(hash, signature, keyId)).toBe(true);
  });

  it('verifyExportHash returns false for tampered hash', () => {
    const { signExportHash: sign, verifyExportHash: verify } = require('@/lib/evidence-signing');
    const hash = 'c'.repeat(64);
    const { signature, keyId } = sign(hash);
    expect(verify('d'.repeat(64), signature, keyId)).toBe(false);
  });

  it('verifyExportHash returns false for tampered signature', () => {
    const { signExportHash: sign, verifyExportHash: verify } = require('@/lib/evidence-signing');
    const hash = 'e'.repeat(64);
    const { signature, keyId } = sign(hash);
    expect(verify(hash, signature.slice(0, -2) + 'ff', keyId)).toBe(false);
  });

  it('rotateKeys archives old key and generates new', () => {
    const { ensureKeys, rotateKeys, verifyExportHash, signExportHash, listKeyIds } = require('@/lib/evidence-signing');
    const { keyId: oldKeyId, publicKey: oldPublicKey } = ensureKeys();
    const hash = 'f'.repeat(64);
    const { signature: oldSig } = signExportHash(hash);
    
    const { keyId: newKeyId, publicKey: newPublicKey } = rotateKeys();
    expect(newKeyId).not.toBe(oldKeyId);
    expect(newPublicKey).not.toBe(oldPublicKey);
    
    // Old signature should still verify with old keyId
    expect(verifyExportHash(hash, oldSig, oldKeyId)).toBe(true);
    
    // New key can sign
    const { signature: newSig, keyId: signKeyId } = signExportHash(hash);
    expect(signKeyId).toBe(newKeyId);
    expect(verifyExportHash(hash, newSig, newKeyId)).toBe(true);
    
    // List shows both
    const { active, archived } = listKeyIds();
    expect(active).toBe(newKeyId);
    expect(archived).toContain(oldKeyId);
  });

  it('revokeKey marks archived key as revoked', () => {
    const { ensureKeys, rotateKeys, revokeKey, isKeyRevoked, getKeyStatus } = require('@/lib/evidence-signing');
    const { keyId: oldKeyId } = ensureKeys();
    rotateKeys();
    
    // Revoke old key
    const result = revokeKey(oldKeyId, 'test revocation');
    expect(result).toBe(true);
    
    // Check revocation
    const revocation = isKeyRevoked(oldKeyId);
    expect(revocation).not.toBeNull();
    expect(revocation?.reason).toBe('test revocation');
    expect(revocation?.revokedAt).toBeDefined();
    
    // Check key status
    const status = getKeyStatus(oldKeyId);
    expect(status?.isRevoked).toBe(true);
    expect(status?.revocationInfo?.reason).toBe('test revocation');
  });

  it('verifyExportHash rejects revoked keys', () => {
    const { ensureKeys, rotateKeys, signExportHash, verifyExportHash, revokeKey } = require('@/lib/evidence-signing');
    const { keyId: oldKeyId } = ensureKeys();
    const hash = 'g'.repeat(64);
    const { signature: oldSig } = signExportHash(hash);
    
    rotateKeys();
    revokeKey(oldKeyId, 'compromised');
    
    // Old signature should NOT verify anymore
    expect(verifyExportHash(hash, oldSig, oldKeyId)).toBe(false);
  });

  it('verifyExportHashWithDetails returns revocation info', () => {
    const { ensureKeys, rotateKeys, signExportHash, verifyExportHashWithDetails, revokeKey } = require('@/lib/evidence-signing');
    const { keyId: oldKeyId } = ensureKeys();
    const hash = 'h'.repeat(64);
    const { signature: oldSig } = signExportHash(hash);
    
    rotateKeys();
    revokeKey(oldKeyId, 'policy rotation');
    
    const result = verifyExportHashWithDetails(hash, oldSig, oldKeyId);
    expect(result.valid).toBe(false);
    expect(result.error).toBe('KEY_REVOKED');
    expect(result.revocationReason).toBe('policy rotation');
  });

  it('cannot revoke active key', () => {
    const { ensureKeys, revokeKey } = require('@/lib/evidence-signing');
    const { keyId } = ensureKeys();
    
    expect(() => revokeKey(keyId, 'test')).toThrow('Cannot revoke active key');
  });
});
