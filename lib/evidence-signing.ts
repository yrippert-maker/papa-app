/**
 * Evidence signing — ed25519 sign/verify for export_hash.
 * Keys stored in {WORKSPACE_ROOT}/00_SYSTEM/keys/
 * Supports key rotation via key_id (SHA-256 fingerprint of public key).
 */
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync, readdirSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';

const KEYS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'keys');
const ACTIVE_DIR = join(KEYS_DIR, 'active');
const ARCHIVED_DIR = join(KEYS_DIR, 'archived');
const PRIVATE_KEY_FILE = join(ACTIVE_DIR, 'evidence-signing.key');
const PUBLIC_KEY_FILE = join(ACTIVE_DIR, 'evidence-signing.pub');
const KEY_ID_FILE = join(ACTIVE_DIR, 'key_id.txt');

// Legacy paths for migration
const LEGACY_PRIVATE_KEY = join(KEYS_DIR, 'evidence-signing.key');
const LEGACY_PUBLIC_KEY = join(KEYS_DIR, 'evidence-signing.pub');

export type KeyPair = { privateKey: string; publicKey: string };
export type KeyInfo = { publicKey: string; keyId: string };
export type RevocationInfo = { revoked: true; reason: string; revokedAt: string };
export type KeyStatus = { keyId: string; isActive: boolean; isRevoked: boolean; revocationInfo?: RevocationInfo };
export type VerifyResult = {
  valid: boolean;
  keyId?: string;
  error?: 'KEY_NOT_FOUND' | 'KEY_REVOKED' | 'SIGNATURE_INVALID' | 'INVALID_FORMAT';
  revocationReason?: string;
};

/**
 * Computes key_id from public key (SHA-256 fingerprint, first 16 hex chars).
 */
function computeKeyId(publicKey: string): string {
  return crypto.createHash('sha256').update(publicKey, 'utf8').digest('hex').slice(0, 16);
}

/**
 * Generates ed25519 key pair. Keys are PEM-encoded.
 */
function generateKeyPair(): KeyPair {
  const { publicKey, privateKey } = crypto.generateKeyPairSync('ed25519', {
    publicKeyEncoding: { type: 'spki', format: 'pem' },
    privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
  });
  return { publicKey, privateKey };
}

/**
 * Migrates legacy keys (pre-key_id) to new structure.
 */
function migrateLegacyKeys(): void {
  if (existsSync(LEGACY_PRIVATE_KEY) && existsSync(LEGACY_PUBLIC_KEY) && !existsSync(ACTIVE_DIR)) {
    mkdirSync(ACTIVE_DIR, { recursive: true });
    const privateKey = readFileSync(LEGACY_PRIVATE_KEY, 'utf8');
    const publicKey = readFileSync(LEGACY_PUBLIC_KEY, 'utf8');
    const keyId = computeKeyId(publicKey);
    writeFileSync(PRIVATE_KEY_FILE, privateKey, { mode: 0o600 });
    writeFileSync(PUBLIC_KEY_FILE, publicKey, { mode: 0o644 });
    writeFileSync(KEY_ID_FILE, keyId, { mode: 0o644 });
    // Keep legacy files for safety, they can be manually removed
  }
}

/**
 * Ensures keys exist; generates if missing.
 * Returns { publicKey, keyId } for embedding in export; privateKey stays on disk.
 */
export function ensureKeys(): KeyInfo {
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
  }
  migrateLegacyKeys();
  if (!existsSync(ACTIVE_DIR)) {
    mkdirSync(ACTIVE_DIR, { recursive: true });
  }
  if (existsSync(PRIVATE_KEY_FILE) && existsSync(PUBLIC_KEY_FILE) && existsSync(KEY_ID_FILE)) {
    const publicKey = readFileSync(PUBLIC_KEY_FILE, 'utf8');
    const keyId = readFileSync(KEY_ID_FILE, 'utf8').trim();
    return { publicKey, keyId };
  }
  const { publicKey, privateKey } = generateKeyPair();
  const keyId = computeKeyId(publicKey);
  writeFileSync(PRIVATE_KEY_FILE, privateKey, { mode: 0o600 });
  writeFileSync(PUBLIC_KEY_FILE, publicKey, { mode: 0o644 });
  writeFileSync(KEY_ID_FILE, keyId, { mode: 0o644 });
  return { publicKey, keyId };
}

/**
 * Gets the current active key_id.
 */
export function getActiveKeyId(): string | null {
  if (existsSync(KEY_ID_FILE)) {
    return readFileSync(KEY_ID_FILE, 'utf8').trim();
  }
  return null;
}

/**
 * Signs export_hash (hex string) with active private key.
 * Uses Ed25519 (algorithm built-in, no streaming).
 * Returns { signature, keyId }.
 */
export function signExportHash(exportHash: string): { signature: string; keyId: string } {
  const { keyId } = ensureKeys();
  const privateKey = readFileSync(PRIVATE_KEY_FILE, 'utf8');
  const data = Buffer.from(exportHash, 'utf8');
  const sig = crypto.sign(null, data, privateKey);
  return { signature: sig.toString('hex'), keyId };
}

/**
 * Finds public key by key_id (checks active, then archived).
 */
export function findPublicKeyById(keyId: string): string | null {
  // Check active
  if (existsSync(KEY_ID_FILE)) {
    const activeKeyId = readFileSync(KEY_ID_FILE, 'utf8').trim();
    if (activeKeyId === keyId && existsSync(PUBLIC_KEY_FILE)) {
      return readFileSync(PUBLIC_KEY_FILE, 'utf8');
    }
  }
  // Check archived
  const archivedKeyDir = join(ARCHIVED_DIR, keyId);
  const archivedPubFile = join(archivedKeyDir, 'evidence-signing.pub');
  if (existsSync(archivedPubFile)) {
    return readFileSync(archivedPubFile, 'utf8');
  }
  return null;
}

/**
 * Verifies signature of export_hash.
 * keyId: key_id to find the correct public key (optional for legacy).
 * publicKey: PEM string (optional, overrides keyId lookup).
 * NOTE: Rejects revoked keys. For detailed result, use verifyExportHashWithDetails.
 */
export function verifyExportHash(
  exportHash: string,
  signatureHex: string,
  keyId?: string,
  publicKey?: string
): boolean {
  // If publicKey is provided directly, skip revocation check (caller's responsibility)
  if (publicKey) {
    try {
      const data = Buffer.from(exportHash, 'utf8');
      const sig = Buffer.from(signatureHex, 'hex');
      return crypto.verify(null, data, publicKey, sig);
    } catch {
      return false;
    }
  }
  
  // Use detailed verification (includes revocation check)
  const result = verifyExportHashWithDetails(exportHash, signatureHex, keyId);
  return result.valid;
}

/**
 * Rotates keys: archives current active key and generates new one.
 * Returns new KeyInfo.
 */
export function rotateKeys(): KeyInfo {
  const currentKeyId = getActiveKeyId();
  
  // Archive current key if exists
  if (currentKeyId && existsSync(PRIVATE_KEY_FILE) && existsSync(PUBLIC_KEY_FILE)) {
    if (!existsSync(ARCHIVED_DIR)) {
      mkdirSync(ARCHIVED_DIR, { recursive: true });
    }
    const archiveDir = join(ARCHIVED_DIR, currentKeyId);
    if (!existsSync(archiveDir)) {
      mkdirSync(archiveDir, { recursive: true });
    }
    // Copy public key to archive (private key not archived for security)
    const publicKey = readFileSync(PUBLIC_KEY_FILE, 'utf8');
    writeFileSync(join(archiveDir, 'evidence-signing.pub'), publicKey, { mode: 0o644 });
    writeFileSync(join(archiveDir, 'archived_at.txt'), new Date().toISOString(), { mode: 0o644 });
  }
  
  // Generate new key pair
  const { publicKey, privateKey } = generateKeyPair();
  const keyId = computeKeyId(publicKey);
  writeFileSync(PRIVATE_KEY_FILE, privateKey, { mode: 0o600 });
  writeFileSync(PUBLIC_KEY_FILE, publicKey, { mode: 0o644 });
  writeFileSync(KEY_ID_FILE, keyId, { mode: 0o644 });
  
  return { publicKey, keyId };
}

/**
 * Lists all key_ids (active + archived).
 */
export function listKeyIds(): { active: string | null; archived: string[] } {
  const active = getActiveKeyId();
  const archived: string[] = [];
  if (existsSync(ARCHIVED_DIR)) {
    try {
      const dirs = readdirSync(ARCHIVED_DIR, { withFileTypes: true });
      for (const d of dirs) {
        if (d.isDirectory()) {
          archived.push(d.name);
        }
      }
    } catch {
      // ignore
    }
  }
  return { active, archived };
}

/**
 * Checks if a key is revoked.
 */
export function isKeyRevoked(keyId: string): RevocationInfo | null {
  const revokedFile = join(ARCHIVED_DIR, keyId, 'revoked.json');
  if (existsSync(revokedFile)) {
    try {
      const data = JSON.parse(readFileSync(revokedFile, 'utf8'));
      if (data.revoked) {
        return { revoked: true, reason: data.reason, revokedAt: data.revokedAt };
      }
    } catch {
      // ignore malformed file
    }
  }
  return null;
}

/**
 * Revokes a key by key_id. Key must be archived first.
 * @param keyId - the key to revoke
 * @param reason - reason for revocation (e.g., "compromised", "personnel change", "policy rotation")
 */
export function revokeKey(keyId: string, reason: string): boolean {
  const activeKeyId = getActiveKeyId();
  if (activeKeyId === keyId) {
    throw new Error('Cannot revoke active key. Rotate keys first.');
  }
  const keyDir = join(ARCHIVED_DIR, keyId);
  if (!existsSync(keyDir)) {
    return false; // key not found
  }
  const revokedFile = join(keyDir, 'revoked.json');
  const revocationData = {
    revoked: true,
    reason,
    revokedAt: new Date().toISOString(),
  };
  writeFileSync(revokedFile, JSON.stringify(revocationData, null, 2), { mode: 0o644 });
  return true;
}

/**
 * Gets status of a key by key_id.
 */
export function getKeyStatus(keyId: string): KeyStatus | null {
  const activeKeyId = getActiveKeyId();
  const isActive = activeKeyId === keyId;
  
  // Check if key exists
  if (isActive && existsSync(PUBLIC_KEY_FILE)) {
    return { keyId, isActive: true, isRevoked: false };
  }
  
  const archivedKeyDir = join(ARCHIVED_DIR, keyId);
  if (!existsSync(archivedKeyDir)) {
    return null;
  }
  
  const revocationInfo = isKeyRevoked(keyId);
  return {
    keyId,
    isActive: false,
    isRevoked: !!revocationInfo,
    revocationInfo: revocationInfo ?? undefined,
  };
}

/**
 * Verifies signature with detailed result (checks revocation).
 */
export function verifyExportHashWithDetails(
  exportHash: string,
  signatureHex: string,
  keyId?: string,
  publicKey?: string
): VerifyResult {
  // Validate format
  if (!exportHash || typeof exportHash !== 'string') {
    return { valid: false, error: 'INVALID_FORMAT' };
  }
  if (!signatureHex || typeof signatureHex !== 'string' || !/^[a-f0-9]+$/i.test(signatureHex)) {
    return { valid: false, error: 'INVALID_FORMAT' };
  }

  let pub = publicKey;
  let resolvedKeyId = keyId;

  if (!pub && keyId) {
    // Check revocation first
    const revocation = isKeyRevoked(keyId);
    if (revocation) {
      return { valid: false, keyId, error: 'KEY_REVOKED', revocationReason: revocation.reason };
    }
    pub = findPublicKeyById(keyId) ?? undefined;
  }

  if (!pub) {
    // Legacy fallback: try active key
    if (existsSync(PUBLIC_KEY_FILE)) {
      pub = readFileSync(PUBLIC_KEY_FILE, 'utf8');
      resolvedKeyId = getActiveKeyId() ?? undefined;
    }
  }

  if (!pub) {
    return { valid: false, keyId: resolvedKeyId, error: 'KEY_NOT_FOUND' };
  }

  try {
    const data = Buffer.from(exportHash, 'utf8');
    const sig = Buffer.from(signatureHex, 'hex');
    const valid = crypto.verify(null, data, pub, sig);
    if (valid) {
      return { valid: true, keyId: resolvedKeyId };
    }
    return { valid: false, keyId: resolvedKeyId, error: 'SIGNATURE_INVALID' };
  } catch {
    return { valid: false, keyId: resolvedKeyId, error: 'SIGNATURE_INVALID' };
  }
}
