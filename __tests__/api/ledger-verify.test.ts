/**
 * API route /api/ledger/verify
 * GET — верификация цепочки ledger. Требует LEDGER.READ.
 */
import type { Session } from 'next-auth';

jest.mock('@/lib/auth-options', () => ({ authOptions: {} }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/authz', () => ({
  requirePermission: jest.fn(),
  PERMISSIONS: { LEDGER_READ: 'LEDGER.READ' },
}));
jest.mock('@/lib/rate-limit', () => ({
  getClientKey: jest.fn(() => 'test-client'),
  checkRateLimit: jest.fn(() => ({ allowed: true })),
}));
jest.mock('@/lib/db', () => ({
  getDbReadOnly: jest.fn(),
  dbAll: jest.fn(),
}));
jest.mock('@/lib/ledger-hash', () => ({
  verifyLedgerChain: jest.fn(),
}));

import { GET } from '@/app/api/ledger/verify/route';
import { getServerSession } from 'next-auth';
import { requirePermission } from '@/lib/authz';
import { getDbReadOnly, dbAll } from '@/lib/db';
import { verifyLedgerChain } from '@/lib/ledger-hash';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRequirePermission = requirePermission as jest.MockedFunction<typeof requirePermission>;

describe('GET /api/ledger/verify', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user lacks LEDGER.READ', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockResolvedValue(Response.json({ error: 'Forbidden' }, { status: 403 }) as any);

    const req = new Request('http://localhost/api/ledger/verify');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with ok when chain valid', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockResolvedValue(null);
    (getDbReadOnly as jest.Mock).mockResolvedValue({});
    (dbAll as jest.Mock).mockResolvedValue([
      { id: 1, event_type: 'X', payload_json: '{}', prev_hash: null, block_hash: 'abc', created_at: '2024-01-01', actor_id: null },
    ]);
    (verifyLedgerChain as jest.Mock).mockImplementation(() => {});

    const req = new Request('http://localhost/api/ledger/verify');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
    expect(body.message).toContain('OK');
    expect(body.scope).toBeDefined();
    expect(body.timing_ms).toBeDefined();
  });

  it('returns 500 when verifyLedgerChain throws', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockResolvedValue(null);
    (getDbReadOnly as jest.Mock).mockResolvedValue({});
    (dbAll as jest.Mock).mockResolvedValue([{ id: 1, event_type: 'X', payload_json: '{}', prev_hash: null, block_hash: 'x', created_at: '2024-01-01', actor_id: null }]);
    (verifyLedgerChain as jest.Mock).mockImplementation(() => {
      throw new Error('Chain break at index 1');
    });

    const req = new Request('http://localhost/api/ledger/verify');
    const res = await GET(req);
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.ok).toBe(false);
    expect(body.error).toBeDefined();
  });
});
