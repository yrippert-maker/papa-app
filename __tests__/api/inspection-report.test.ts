/**
 * Integration tests for GET /api/inspection/report
 */
import type { Session } from 'next-auth';

jest.mock('@/lib/auth-options', () => ({
  authOptions: {},
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

const mockCount = { c: 5 };
const mockByStatus = [
  { status: 'DRAFT', cnt: 2 },
  { status: 'IN_PROGRESS', cnt: 1 },
  { status: 'COMPLETED', cnt: 2 },
  { status: 'CANCELLED', cnt: 0 },
];
const mockResultsByCheck = [
  { check_code: 'DOCS', result: 'PASS', cnt: 3 },
  { check_code: 'DOCS', result: 'FAIL', cnt: 1 },
  { check_code: 'QTY', result: 'PASS', cnt: 2 },
];

jest.mock('@/lib/db', () => ({
  getDbReadOnly: () => ({
    prepare: (sql: string) => {
      if (sql.includes('GROUP BY c.status')) {
        return { all: () => mockByStatus };
      }
      if (sql.includes('GROUP BY r.check_code, r.result')) {
        return { all: () => mockResultsByCheck };
      }
      if (sql.includes('COUNT(*)') && sql.includes('inspection_card')) {
        return { get: () => mockCount };
      }
      return { get: () => null, all: () => [] };
    },
  }),
}));

jest.mock('@/lib/authz', () => ({
  requirePermissionWithAlias: jest.fn(),
  PERMISSIONS: { INSPECTION_VIEW: 'INSPECTION.VIEW' },
}));

import { GET } from '@/app/api/inspection/report/route';
import { getServerSession } from 'next-auth';
import { requirePermissionWithAlias } from '@/lib/authz';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRequirePermission = requirePermissionWithAlias as jest.MockedFunction<typeof requirePermissionWithAlias>;

describe('GET /api/inspection/report', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user lacks INSPECTION.VIEW', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue({ status: 403 } as any);

    const req = new Request('http://localhost/api/inspection/report');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 200 with aggregates when user has INSPECTION.VIEW', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue(null);

    const req = new Request('http://localhost/api/inspection/report');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.total_cards).toBe(5);
    expect(body.by_status).toEqual({ DRAFT: 2, IN_PROGRESS: 1, COMPLETED: 2, CANCELLED: 0 });
    expect(typeof body.completion_rate_pct).toBe('number');
    expect(typeof body.fail_rate_pct).toBe('number');
    expect(body.breakdown_by_check_code).toEqual({
      DOCS: { PASS: 3, FAIL: 1, NA: 0 },
      QTY: { PASS: 2, FAIL: 0, NA: 0 },
    });
    expect(body.filters).toEqual({ kind: null, status: null, from_date: null, to_date: null });
  });

  it('passes query filters to response', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue(null);

    const req = new Request('http://localhost/api/inspection/report?kind=INPUT&status=COMPLETED&from_date=2025-01-01&to_date=2025-01-31');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.filters).toEqual({
      kind: 'INPUT',
      status: 'COMPLETED',
      from_date: '2025-01-01',
      to_date: '2025-01-31',
    });
  });
});
