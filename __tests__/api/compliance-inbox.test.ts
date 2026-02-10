/**
 * API route /api/compliance/inbox
 * GET — список change events. Требует COMPLIANCE.VIEW.
 */
import type { Session } from 'next-auth';

jest.mock('@/lib/auth-options', () => ({ authOptions: {} }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/authz', () => ({
  requirePermission: jest.fn(),
  PERMISSIONS: { COMPLIANCE_VIEW: 'COMPLIANCE.VIEW' },
}));
jest.mock('@/lib/compliance-inbox-service');

import { GET } from '@/app/api/compliance/inbox/route';
import { getServerSession } from 'next-auth';
import { requirePermission } from '@/lib/authz';
import { listInbox } from '@/lib/compliance-inbox-service';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRequirePermission = requirePermission as jest.MockedFunction<typeof requirePermission>;

describe('GET /api/compliance/inbox', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 403 when user lacks COMPLIANCE.VIEW', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockResolvedValue(Response.json({ error: 'Forbidden' }, { status: 403 }) as any);

    const req = new Request('http://localhost/api/compliance/inbox');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns items when user has permission', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockResolvedValue(null);
    (listInbox as jest.Mock).mockResolvedValue([{ id: 'e1', status: 'NEW' }]);

    const req = new Request('http://localhost/api/compliance/inbox');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(Array.isArray(body.items)).toBe(true);
  });
});
