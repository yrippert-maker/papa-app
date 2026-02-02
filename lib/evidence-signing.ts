/**
 * Evidence signing — ed25519 sign/verify for export_hash.
 * Keys stored in {WORKSPACE_ROOT}/00_SYSTEM/keys/
 */
import crypto from 'crypto';
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';

const KEYS_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'keys');
const PRIVATE_KEY_FILE = join(KEYS_DIR, 'evidence-signing.key');
const PUBLIC_KEY_FILE = join(KEYS_DIR, 'evidence-signing.pub');

export type KeyPair = { privateKey: string; publicKey: string };

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
 * Ensures keys exist; generates if missing.
 * Returns { publicKey } for embedding in export; privateKey stays on disk.
 */
export function ensureKeys(): { publicKey: string } {
  if (!existsSync(KEYS_DIR)) {
    mkdirSync(KEYS_DIR, { recursive: true });
  }
  if (existsSync(PRIVATE_KEY_FILE) && existsSync(PUBLIC_KEY_FILE)) {
    const publicKey = readFileSync(PUBLIC_KEY_FILE, 'utf8');
    return { publicKey };
  }
  const { publicKey, privateKey } = generateKeyPair();
  writeFileSync(PRIVATE_KEY_FILE, privateKey, { mode: 0o600 });
  writeFileSync(PUBLIC_KEY_FILE, publicKey, { mode: 0o644 });
  return { publicKey };
}

/**
 * Signs export_hash (hex string) with private key.
 * Uses Ed25519 (algorithm built-in, no streaming).
 * Returns signature as hex string.
 */
export function signExportHash(exportHash: string): string {
  ensureKeys();
  const privateKey = readFileSync(PRIVATE_KEY_FILE, 'utf8');
  const data = Buffer.from(exportHash, 'utf8');
  const sig = crypto.sign(null, data, privateKey);
  return sig.toString('hex');
}

/**
 * Verifies signature of export_hash.
 * publicKey: PEM string (optional, reads from file if not provided).
 */
export function verifyExportHash(
  exportHash: string,
  signatureHex: string,
  publicKey?: string
): boolean {
  const pub = publicKey ?? (existsSync(PUBLIC_KEY_FILE) ? readFileSync(PUBLIC_KEY_FILE, 'utf8') : null);
  if (!pub) return false;
  const data = Buffer.from(exportHash, 'utf8');
  const sig = Buffer.from(signatureHex, 'hex');
  return crypto.verify(null, data, pub, sig);
}
