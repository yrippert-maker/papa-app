/**
 * Unit tests for GET /api/inspection/cards/:id/evidence
 */
import { GET } from '@/app/api/inspection/cards/[id]/evidence/route';

jest.mock('@/lib/auth-options', () => ({ authOptions: {} }));

const mockCard = {
  inspection_card_id: 'CARD-1',
  card_no: 'IC-001',
  status: 'IN_PROGRESS',
  request_no: 'REQ-001',
};

const mockCheckResults = [
  { inspection_check_result_id: 'CHR-1', check_code: 'DOCS', result: 'PASS', comment: null },
];

const mockAuditRows = [
  {
    id: 1,
    event_type: 'INSPECTION_CARD_TRANSITION',
    payload_json: JSON.stringify({
      inspection_card_id: 'CARD-1',
      from_status: 'DRAFT',
      to_status: 'IN_PROGRESS',
      transitioned_by: 'user@test',
      transitioned_at: '2026-02-02T12:00:00.000Z',
    }),
    created_at: '2026-02-02T12:00:00.000Z',
    block_hash: 'abc123',
    prev_hash: null,
    actor_id: 'user@test',
  },
];

jest.mock('next-auth', () => ({
  getServerSession: () => ({ user: { id: '1', email: 'auditor@local' } }),
}));

jest.mock('@/lib/authz', () => ({
  requirePermissionWithAlias: () => null,
  PERMISSIONS: {},
}));

jest.mock('@/lib/evidence-signing', () => ({
  ensureKeys: () => ({
    publicKey: '-----BEGIN PUBLIC KEY-----\nMOCK\n-----END PUBLIC KEY-----',
    keyId: 'mock_key_id_1234',
  }),
  signExportHash: (hash: string) => ({
    signature: `sig_${hash.slice(0, 8)}`,
    keyId: 'mock_key_id_1234',
  }),
}));

jest.mock('@/lib/db', () => ({
  getDbReadOnly: () => ({
    prepare: (sql: string) => ({
      get: (id?: string) => {
        if (sql.includes('inspection_card') && sql.includes('tmc_request') && !sql.includes('inspection_check_result')) {
          return id === 'CARD-1' ? mockCard : undefined;
        }
        return undefined;
      },
      all: (id?: string) => {
        if (sql.includes('inspection_check_result')) {
          return id === 'CARD-1' ? mockCheckResults : [];
        }
        if (sql.includes('ledger_events')) {
          return id === 'CARD-1' ? mockAuditRows : [];
        }
        return [];
      },
    }),
  }),
}));

describe('GET /api/inspection/cards/:id/evidence', () => {
  it('returns 200 with evidence export for existing card', async () => {
    const req = new Request('http://localhost/api/inspection/cards/CARD-1/evidence');
    const res = await GET(req, { params: Promise.resolve({ id: 'CARD-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.schema_version).toBe('1');
    expect(body.inspection_card_id).toBe('CARD-1');
    expect(body.card).toEqual(mockCard);
    expect(body.check_results).toEqual(mockCheckResults);
    expect(body.audit_events).toHaveLength(1);
    expect(body.audit_events[0].event_type).toBe('INSPECTION_CARD_TRANSITION');
    expect(body.audit_events[0].block_hash).toBe('abc123');
    expect(typeof body.export_hash).toBe('string');
    expect(body.export_hash).toMatch(/^[a-f0-9]{64}$/);
  });

  it('returns 404 with standardized payload for non-existent card', async () => {
    const req = new Request('http://localhost/api/inspection/cards/NONEXISTENT/evidence');
    const res = await GET(req, { params: Promise.resolve({ id: 'NONEXISTENT' }) });
    expect(res.status).toBe(404);
    const body = await res.json();
    expect(body?.error?.code).toBe('NOT_FOUND');
    expect(body?.error?.request_id).toBeDefined();
  });

  it('returns 400 for missing id', async () => {
    const req = new Request('http://localhost/api/inspection/cards//evidence');
    const res = await GET(req, { params: Promise.resolve({ id: '' }) });
    expect(res.status).toBe(400);
  });

  it('returns signed export when signed=1', async () => {
    const req = new Request('http://localhost/api/inspection/cards/CARD-1/evidence?signed=1');
    const res = await GET(req, { params: Promise.resolve({ id: 'CARD-1' }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.export_signature).toBeDefined();
    expect(body.export_signature).toMatch(/^sig_/);
    expect(body.export_key_id).toBe('mock_key_id_1234');
    expect(body.export_public_key).toContain('BEGIN PUBLIC KEY');
  });

  it('returns ZIP bundle when format=bundle', async () => {
    const req = new Request('http://localhost/api/inspection/cards/CARD-1/evidence?format=bundle');
    const res = await GET(req, { params: Promise.resolve({ id: 'CARD-1' }) });
    expect(res.status).toBe(200);
    expect(res.headers.get('Content-Type')).toBe('application/zip');
    expect(res.headers.get('Content-Disposition')).toContain('attachment');
    const buf = await res.arrayBuffer();
    expect(buf.byteLength).toBeGreaterThan(0);
  });
});
