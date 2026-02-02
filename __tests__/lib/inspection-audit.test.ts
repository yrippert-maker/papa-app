/**
 * Unit tests for lib/inspection-audit — ledger append for transitions.
 */
import Database from 'better-sqlite3';
import { appendInspectionTransitionEvent } from '@/lib/inspection-audit';
import { verifyLedgerChain } from '@/lib/ledger-hash';

describe('inspection-audit', () => {
  let db: Database.Database;

  beforeEach(() => {
    db = new Database(':memory:');
    db.exec(`
      CREATE TABLE ledger_events (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        event_type TEXT NOT NULL,
        payload_json TEXT NOT NULL,
        prev_hash TEXT,
        block_hash TEXT NOT NULL,
        created_at TEXT NOT NULL,
        actor_id TEXT
      );
    `);
  });

  afterEach(() => {
    db.close();
  });

  it('appends INSPECTION_CARD_TRANSITION event', () => {
    const blockHash = appendInspectionTransitionEvent(db, 'user-1', {
      inspection_card_id: 'CARD-001',
      card_no: 'IC-001',
      from_status: 'DRAFT',
      to_status: 'IN_PROGRESS',
      transitioned_by: 'user@example.com',
      transitioned_at: '2026-02-01T12:00:00.000Z',
    });
    expect(typeof blockHash).toBe('string');
    expect(blockHash.length).toBe(64);

    const row = db.prepare('SELECT * FROM ledger_events').get() as Record<string, unknown>;
    expect(row.event_type).toBe('INSPECTION_CARD_TRANSITION');
    expect(row.actor_id).toBe('user-1');
    const payload = JSON.parse(row.payload_json as string);
    expect(payload.inspection_card_id).toBe('CARD-001');
    expect(payload.from_status).toBe('DRAFT');
    expect(payload.to_status).toBe('IN_PROGRESS');
  });

  it('maintains hash chain integrity', () => {
    appendInspectionTransitionEvent(db, 'user-1', {
      inspection_card_id: 'CARD-001',
      from_status: 'DRAFT',
      to_status: 'IN_PROGRESS',
      transitioned_by: 'u@x.com',
      transitioned_at: '2026-02-01T12:00:00.000Z',
    });
    appendInspectionTransitionEvent(db, 'user-1', {
      inspection_card_id: 'CARD-002',
      from_status: 'IN_PROGRESS',
      to_status: 'COMPLETED',
      transitioned_by: 'u@x.com',
      transitioned_at: '2026-02-01T12:01:00.000Z',
    });

    const events = db.prepare('SELECT * FROM ledger_events ORDER BY id').all();
    expect(() => verifyLedgerChain(events)).not.toThrow();
  });
});
