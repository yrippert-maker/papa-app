/**
 * LocalStorageAdapter — files in workspace/00_SYSTEM/storage/
 * For dev / local deployment. Prod: use S3StorageAdapter.
 */
import { createHash } from 'crypto';
import { mkdirSync, writeFileSync, readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { WORKSPACE_ROOT } from '@/lib/config';
import type { StorageAdapter, PutResult } from './types';

const STORAGE_DIR = join(WORKSPACE_ROOT, '00_SYSTEM', 'storage');

function ensureDir(path: string): void {
  const dir = dirname(path);
  if (!existsSync(dir)) mkdirSync(dir, { recursive: true });
}

export const localStorageAdapter: StorageAdapter = {
  async putObject(key: string, bytes: Buffer | Uint8Array, _contentType?: string): Promise<PutResult> {
    const buf = Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes);
    const sha256 = createHash('sha256').update(buf).digest('hex');
    const fullPath = join(STORAGE_DIR, key);
    ensureDir(fullPath);
    writeFileSync(fullPath, buf);
    return { key, sha256, size: buf.length };
  },

  async getObject(key: string): Promise<Buffer> {
    const fullPath = join(STORAGE_DIR, key);
    if (!existsSync(fullPath)) throw new Error(`Object not found: ${key}`);
    return readFileSync(fullPath);
  },

  async exists(key: string): Promise<boolean> {
    return existsSync(join(STORAGE_DIR, key));
  },
};
