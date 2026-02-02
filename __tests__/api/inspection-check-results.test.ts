/**
 * Integration tests for POST /api/inspection/cards/:id/check-results
 */
import type { Session } from 'next-auth';

jest.mock('@/lib/auth-options', () => ({
  authOptions: {},
}));

jest.mock('next-auth', () => ({
  getServerSession: jest.fn(),
}));

const mockDbResults: Array<Record<string, unknown>> = [];
jest.mock('@/lib/db', () => {
  const mockCard = { inspection_card_id: 'CARD-1', status: 'IN_PROGRESS', card_kind: 'INPUT', card_no: 'IC-001' };
  const mockTemplates = [
    { check_code: 'DOCS' },
    { check_code: 'PACK' },
    { check_code: 'QTY' },
    { check_code: 'VIS' },
  ];
  type GetResult = Record<string, unknown> | null;
  return {
    getDb: () => ({
      prepare: (sql: string) => {
        if (sql.includes('SELECT inspection_card_id') && sql.includes('inspection_card')) {
          return { get: (): GetResult => mockCard as GetResult };
        }
        if (sql.includes('inspection_check_item_template') && sql.includes('AND check_code')) {
          return { get: (): GetResult => ({ check_item_id: 'CHK-TMC-IN-001' }) };
        }
        if (sql.includes('inspection_check_item_template')) {
          return { all: () => mockTemplates };
        }
        if (sql.includes('INSERT INTO inspection_check_result')) {
          return {
            run: () => {
              mockDbResults.push({ inspection_check_result_id: 'CHR-1', check_code: 'DOCS', result: 'PASS' });
            },
          };
        }
        if (sql.includes('SELECT * FROM inspection_check_result')) {
          return { all: () => mockDbResults };
        }
        if (sql.includes('inspection_check_result') && sql.includes('inspection_card_id') && sql.includes('check_code') && !sql.includes('INSERT')) {
          return { get: (): GetResult => null };
        }
        return { get: (): GetResult => null, run: () => {}, all: () => [] };
      },
    }),
    getDbReadOnly: () => ({}),
    withRetry: (fn: () => unknown) => fn(),
  };
});

jest.mock('@/lib/authz', () => ({
  requirePermissionWithAlias: jest.fn(),
  PERMISSIONS: { INSPECTION_MANAGE: 'INSPECTION.MANAGE' },
}));

jest.mock('@/lib/inspection-audit', () => ({
  appendInspectionCheckRecordedEvent: jest.fn(),
}));

import { POST } from '@/app/api/inspection/cards/[id]/check-results/route';
import { getServerSession } from 'next-auth';
import { requirePermissionWithAlias } from '@/lib/authz';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRequirePermission = requirePermissionWithAlias as jest.MockedFunction<typeof requirePermissionWithAlias>;

describe('POST /api/inspection/cards/:id/check-results', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user lacks INSPECTION.MANAGE', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue({ status: 403 } as any);

    const req = new Request('http://localhost/api/inspection/cards/CARD-1/check-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [{ check_code: 'DOCS', result: 'PASS' }] }),
    });
    const params = Promise.resolve({ id: 'CARD-1' });
    const res = await POST(req, { params });
    expect(res.status).toBe(403);
  });

  it('returns 200 for valid check result', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1', email: 'test@example.com' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue(null);

    const req = new Request('http://localhost/api/inspection/cards/CARD-1/check-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [{ check_code: 'DOCS', result: 'PASS', comment: '' }] }),
    });
    const params = Promise.resolve({ id: 'CARD-1' });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.check_results).toBeDefined();
  });

  it('returns 200 with value and unit', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1', email: 'test@example.com' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue(null);

    const req = new Request('http://localhost/api/inspection/cards/CARD-1/check-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        results: [{ check_code: 'QTY', result: 'PASS', value: '12.3', unit: 'kg', comment: '' }],
      }),
    });
    const params = Promise.resolve({ id: 'CARD-1' });
    const res = await POST(req, { params });
    expect(res.status).toBe(200);
  });

  it('returns 400 for invalid result value', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1', email: 'test@example.com' }, expires: '' } as Session);
    mockRequirePermission.mockReturnValue(null);

    const req = new Request('http://localhost/api/inspection/cards/CARD-1/check-results', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ results: [{ check_code: 'DOCS', result: 'INVALID' }] }),
    });
    const params = Promise.resolve({ id: 'CARD-1' });
    const res = await POST(req, { params });
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error.code).toBe('BAD_REQUEST');
  });
});
