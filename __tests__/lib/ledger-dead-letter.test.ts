/**
 * Unit tests for lib/ledger-dead-letter — appendToDeadLetter.
 */
import type { DeadLetterEntry } from '@/lib/ledger-dead-letter';
import { readFileSync, existsSync, mkdirSync } from 'fs';
import { join } from 'path';
import { tmpdir } from 'os';

const originalEnv = { ...process.env };

describe('appendToDeadLetter', () => {
  let tmpWorkspace: string;

  beforeEach(() => {
    tmpWorkspace = join(tmpdir(), `papa-dead-letter-test-${Date.now()}`);
    mkdirSync(tmpWorkspace, { recursive: true });
    process.env.WORKSPACE_ROOT = tmpWorkspace;
    jest.resetModules();
  });

  afterEach(() => {
    Object.assign(process.env, originalEnv);
  });

  it('appends entry to dead-letter file', () => {
    const { appendToDeadLetter: append } = require('@/lib/ledger-dead-letter');
    const entry: DeadLetterEntry = {
      event_type: 'FILE_REGISTERED',
      payload_json: JSON.stringify({
        action: 'FILE_REGISTERED',
        relative_path: 'x',
        checksum_sha256: 'a'.repeat(64),
      }),
      actor_id: '1',
      error: 'SQLITE_BUSY',
      ts_utc: '2026-02-01T12:00:00.000Z',
    };
    const result = append(entry);
    expect(result).toBe(true);
    const filePath = join(tmpWorkspace, '00_SYSTEM', 'ledger-dead-letter.jsonl');
    expect(existsSync(filePath)).toBe(true);
    const content = readFileSync(filePath, 'utf8');
    const parsed = JSON.parse(content.trim());
    expect(parsed.event_type).toBe('FILE_REGISTERED');
    expect(parsed.error).toBe('SQLITE_BUSY');
    expect(parsed.actor_id).toBe('1');
  });

  it('creates 00_SYSTEM dir if missing', () => {
    const { appendToDeadLetter: append } = require('@/lib/ledger-dead-letter');
    const entry: DeadLetterEntry = {
      event_type: 'X',
      payload_json: '{}',
      actor_id: null,
      error: 'test',
      ts_utc: new Date().toISOString(),
    };
    append(entry);
    expect(existsSync(join(tmpWorkspace, '00_SYSTEM'))).toBe(true);
  });
});
