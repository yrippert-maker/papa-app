/**
 * Storage adapter interface.
 * Domain logic works with key + sha256, not disk paths.
 * Implementations: LocalStorageAdapter (dev), S3StorageAdapter (prod).
 */

export interface PutResult {
  key: string;
  sha256: string;
  size: number;
}

export interface StorageAdapter {
  putObject(key: string, bytes: Buffer | Uint8Array, contentType?: string): Promise<PutResult>;
  getObject(key: string): Promise<Buffer>;
  getSignedUrl?(key: string, expiresInSec?: number): Promise<string>;
  exists?(key: string): Promise<boolean>;
}
