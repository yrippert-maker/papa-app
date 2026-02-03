/**
 * Integration tests for POST /api/inspection/cards/:id/transition
 */
import type { Session } from 'next-auth';

// Mock auth-options before importing route handler
jest.mock('@/lib/auth-options', () => ({
  authOptions: {},
}));

// Mock next-auth
jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

// Mock db
jest.mock('@/lib/db', () => {
  let mockCard = {
    inspection_card_id: 'CARD-1',
    status: 'DRAFT',
    card_no: 'IC-001',
    tmc_request_id: 'REQ-1',
  };

  const mockDb = () => ({
    prepare: (sql: string) => {
      if (sql.includes('SELECT inspection_card_id')) {
        return {
          get: () => mockCard,
        };
      }
      if (sql.includes('UPDATE inspection_card')) {
        return {
          run: (status: string, by: string, at: string, id: string) => {
            mockCard = { ...mockCard, status: status as any };
          },
        };
      }
      if (sql.includes('SELECT * FROM inspection_card')) {
        return {
          get: () => ({ ...mockCard, transitioned_by: 'test@example.com', transitioned_at: new Date().toISOString() }),
        };
      }
      return { get: () => null, run: () => {}, all: () => [] };
    },
  });

  return {
    getDb: mockDb,
    getDbReadOnly: mockDb,
    withRetry: (fn: () => any) => fn(),
  };
});

// Mock authz
jest.mock('@/lib/authz', () => ({
  requirePermissionWithAlias: jest.fn(),
  PERMISSIONS: { INSPECTION_MANAGE: 'INSPECTION.MANAGE' },
}));

import { POST } from '@/app/api/inspection/cards/[id]/transition/route';
import { getServerSession } from 'next-auth';
import { requirePermissionWithAlias } from '@/lib/authz';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRequirePermission = requirePermissionWithAlias as jest.MockedFunction<typeof requirePermissionWithAlias>;

describe('POST /api/inspection/cards/:id/transition', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user lacks INSPECTION.MANAGE', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue({ status: 403 } as any);

    const req = new Request('http://localhost/api/inspection/cards/CARD-1/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    const params = Promise.resolve({ id: 'CARD-1' });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
  });

  it('returns 200 for valid transition DRAFT → IN_PROGRESS', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1', email: 'test@example.com' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue(null);

    const req = new Request('http://localhost/api/inspection/cards/CARD-1/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'IN_PROGRESS' }),
    });
    const params = Promise.resolve({ id: 'CARD-1' });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('IN_PROGRESS');
  });

  it('returns 400 for invalid status', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1', email: 'test@example.com' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue(null);

    const req = new Request('http://localhost/api/inspection/cards/CARD-1/transition', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'INVALID' }),
    });
    const params = Promise.resolve({ id: 'CARD-1' });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});
