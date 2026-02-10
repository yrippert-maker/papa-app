/**
 * API route /api/compliance/break-glass
 * GET/POST — emergency override status.
 */
import type { Session } from 'next-auth';

jest.mock('@/lib/auth-options', () => ({ authOptions: {} }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
const mockRequirePermission = jest.fn();
jest.mock('@/lib/authz', () => ({
  hasPermission: jest.fn(),
  requirePermission: mockRequirePermission,
  PERMISSIONS: { COMPLIANCE_VIEW: 'COMPLIANCE.VIEW', ADMIN_MANAGE_USERS: 'ADMIN.MANAGE_USERS' },
}));
jest.mock('@/lib/key-lifecycle-service');

import { GET, POST } from '@/app/api/compliance/break-glass/route';
import { getServerSession } from 'next-auth';
import { hasPermission } from '@/lib/authz';
import * as keyLifecycle from '@/lib/key-lifecycle-service';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;

describe('GET /api/compliance/break-glass', () => {
  beforeEach(() => jest.clearAllMocks());

  it('returns 403 when user lacks permission', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    (hasPermission as jest.Mock).mockResolvedValue(false);
    mockRequirePermission.mockResolvedValue(Response.json({ error: 'Forbidden' }, { status: 403 }));

    const req = new Request('http://localhost/api/compliance/break-glass');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns active state when break-glass active', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    (hasPermission as jest.Mock).mockResolvedValue(true);
    (keyLifecycle.isBreakGlassActive as jest.Mock).mockResolvedValue(true);
    (keyLifecycle.getBreakGlassState as jest.Mock).mockResolvedValue({
      activated_by: 'admin',
      activated_at: '2024-01-01',
      expires_at: '2024-01-02',
      reason: 'Emergency',
      actions_taken: [],
    });

    const req = new Request('http://localhost/api/compliance/break-glass');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.active).toBe(true);
    expect(body.state).toBeDefined();
  });
});
