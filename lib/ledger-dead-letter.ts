/**
 * Ledger dead-letter: persist failed append events for manual replay.
 * File-based to avoid DB dependency when DB is the failure cause.
 */
import { appendFileSync, mkdirSync, existsSync } from 'fs';
import { join } from 'path';
import { WORKSPACE_ROOT } from './config';
import { incDeadLetterEvent } from './metrics/dead-letter';

const DEAD_LETTER_DIR = join(WORKSPACE_ROOT, '00_SYSTEM');
const DEAD_LETTER_FILE = join(DEAD_LETTER_DIR, 'ledger-dead-letter.jsonl');

export type DeadLetterEntry = {
  event_type: string;
  payload_json: string;
  actor_id: string | null;
  error: string;
  ts_utc: string;
};

/**
 * Appends a failed ledger event to the dead-letter file.
 * Non-throwing: logs and returns false on filesystem error.
 */
export function appendToDeadLetter(entry: DeadLetterEntry): boolean {
  try {
    if (!existsSync(DEAD_LETTER_DIR)) {
      mkdirSync(DEAD_LETTER_DIR, { recursive: true });
    }
    const line = JSON.stringify(entry) + '\n';
    appendFileSync(DEAD_LETTER_FILE, line, 'utf8');
    incDeadLetterEvent();
    console.warn('[ledger-dead-letter] Recorded failed event:', entry.event_type, entry.error);
    return true;
  } catch (e) {
    console.error('[ledger-dead-letter] Failed to write:', e);
    return false;
  }
}
