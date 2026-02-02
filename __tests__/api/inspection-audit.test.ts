/**
 * Integration tests for GET /api/inspection/cards/:id/audit
 */
import type { Session } from 'next-auth';

jest.mock('@/lib/auth-options', () => ({
  authOptions: {},
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

const mockCard = { inspection_card_id: 'CARD-1' };
const mockEvents = [
  {
    id: 1,
    event_type: 'INSPECTION_CARD_TRANSITION',
    payload_json: JSON.stringify({
      inspection_card_id: 'CARD-1',
      from_status: 'DRAFT',
      to_status: 'IN_PROGRESS',
      transitioned_by: 'admin@local',
      transitioned_at: '2025-01-15T10:00:00.000Z',
    }),
    created_at: '2025-01-15T10:00:00.000Z',
    block_hash: 'abc123',
    actor_id: 'admin-id',
  },
  {
    id: 2,
    event_type: 'INSPECTION_CHECK_RECORDED',
    payload_json: JSON.stringify({
      inspection_card_id: 'CARD-1',
      check_code: 'DOCS',
      result: 'PASS',
      recorded_by: 'admin@local',
      recorded_at: '2025-01-15T10:05:00.000Z',
    }),
    created_at: '2025-01-15T10:05:00.000Z',
    block_hash: 'def456',
    actor_id: 'admin-id',
  },
];

jest.mock('@/lib/db', () => ({
  getDbReadOnly: () => ({
    prepare: (sql: string) => {
      if (sql.includes('SELECT inspection_card_id FROM inspection_card')) {
        return {
          get: (id: string) => (id === 'NONEXISTENT' ? null : mockCard),
        };
      }
      if (sql.includes('COUNT(*)') && sql.includes('ledger_events')) {
        return { get: () => ({ c: mockEvents.length }) };
      }
      if (sql.includes('ledger_events') && sql.includes('INSPECTION_CARD_TRANSITION')) {
        return { all: () => mockEvents };
      }
      return { get: () => null, all: () => [] };
    },
  }),
}));

jest.mock('@/lib/authz', () => ({
  requirePermissionWithAlias: jest.fn(),
  PERMISSIONS: { INSPECTION_VIEW: 'INSPECTION.VIEW' },
}));

import { GET } from '@/app/api/inspection/cards/[id]/audit/route';
import { getServerSession } from 'next-auth';
import { requirePermissionWithAlias } from '@/lib/authz';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRequirePermission = requirePermissionWithAlias as jest.MockedFunction<typeof requirePermissionWithAlias>;

describe('GET /api/inspection/cards/:id/audit', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user lacks INSPECTION.VIEW', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue({ status: 403 } as any);

    const req = new Request('http://localhost/api/inspection/cards/CARD-1/audit');
    const params = Promise.resolve({ id: 'CARD-1' });
    const res = await GET(req, { params });
    expect(res.status).toBe(403);
  });

  it('returns 404 when card not found', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue(null);

    const req = new Request('http://localhost/api/inspection/cards/NONEXISTENT/audit');
    const params = Promise.resolve({ id: 'NONEXISTENT' });
    const res = await GET(req, { params });
    expect(res.status).toBe(404);
  });

  it('returns 200 with events when user has INSPECTION.VIEW', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue(null);

    const req = new Request('http://localhost/api/inspection/cards/CARD-1/audit');
    const params = Promise.resolve({ id: 'CARD-1' });
    const res = await GET(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events.length).toBe(2);
    expect(body.events[0].event_type).toBe('INSPECTION_CARD_TRANSITION');
    expect(body.events[0].payload.from_status).toBe('DRAFT');
    expect(body.events[0].payload.to_status).toBe('IN_PROGRESS');
    expect(body.events[1].event_type).toBe('INSPECTION_CHECK_RECORDED');
    expect(body.events[1].payload.check_code).toBe('DOCS');
    expect(body.events[1].payload.result).toBe('PASS');
    expect(body.total).toBe(2);
    expect(body.hasMore).toBe(false);
    expect(body.limit).toBe(100);
    expect(body.offset).toBe(0);
  });
});
