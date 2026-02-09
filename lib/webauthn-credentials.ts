/**
 * File-based WebAuthn credential store.
 * For production: use DB (Prisma).
 */
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';

const CREDENTIALS_FILE = join(WORKSPACE_ROOT, '00_SYSTEM', 'webauthn-credentials.json');

export type StoredCredential = {
  id: string;
  publicKey: string; // base64
  counter: number;
  transports?: string[];
  userId: string;
  createdAt: string;
};

type Store = Record<string, StoredCredential[]>;

function loadStore(): Store {
  if (!existsSync(CREDENTIALS_FILE)) return {};
  try {
    return JSON.parse(readFileSync(CREDENTIALS_FILE, 'utf8')) as Store;
  } catch {
    return {};
  }
}

function saveStore(store: Store): void {
  const dir = join(WORKSPACE_ROOT, '00_SYSTEM');
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
  writeFileSync(CREDENTIALS_FILE, JSON.stringify(store, null, 2), 'utf8');
}

export function getCredentialsForUser(userId: string): StoredCredential[] {
  const store = loadStore();
  return store[userId] ?? [];
}

export function getCredentialById(userId: string, credentialId: string): StoredCredential | null {
  const creds = getCredentialsForUser(userId);
  return creds.find((c) => c.id === credentialId) ?? null;
}

export function saveCredential(
  userId: string,
  credential: Omit<StoredCredential, 'userId' | 'createdAt'>
): void {
  const store = loadStore();
  const list = store[userId] ?? [];
  const existing = list.findIndex((c) => c.id === credential.id);
  const entry: StoredCredential = {
    ...credential,
    userId,
    createdAt: new Date().toISOString(),
  };
  if (existing >= 0) {
    list[existing] = entry;
  } else {
    list.push(entry);
  }
  store[userId] = list;
  saveStore(store);
}

export function updateCredentialCounter(
  userId: string,
  credentialId: string,
  newCounter: number
): void {
  const store = loadStore();
  const list = store[userId] ?? [];
  const idx = list.findIndex((c) => c.id === credentialId);
  if (idx >= 0) {
    list[idx] = { ...list[idx], counter: newCounter };
    store[userId] = list;
    saveStore(store);
  }
}
