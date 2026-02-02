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
 */
export function verifyExportHash(
  exportHash: string,
  signatureHex: string,
  keyId?: string,
  publicKey?: string
): boolean {
  let pub = publicKey;
  if (!pub && keyId) {
    pub = findPublicKeyById(keyId) ?? undefined;
  }
  if (!pub) {
    // Legacy fallback: try active key
    pub = existsSync(PUBLIC_KEY_FILE) ? readFileSync(PUBLIC_KEY_FILE, 'utf8') : undefined;
  }
  if (!pub) return false;
  try {
    const data = Buffer.from(exportHash, 'utf8');
    const sig = Buffer.from(signatureHex, 'hex');
    return crypto.verify(null, data, pub, sig);
  } catch {
    return false;
  }
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
