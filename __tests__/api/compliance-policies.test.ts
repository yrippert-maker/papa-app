/**
 * T12: API route /api/compliance/policies
 * GET list policies, GET by key_class; POST create/update.
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
jest.mock('@/lib/governance-policy-service');

import { GET, POST } from '@/app/api/compliance/policies/route';
import { getServerSession } from 'next-auth';
import { hasPermission } from '@/lib/authz';
import * as governance from '@/lib/governance-policy-service';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockHasPermission = hasPermission as jest.MockedFunction<typeof hasPermission>;

describe('GET /api/compliance/policies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user lacks COMPLIANCE.VIEW and ADMIN', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockHasPermission.mockResolvedValue(false);
    mockRequirePermission.mockResolvedValue(Response.json({ error: 'Forbidden' }, { status: 403 }));

    const req = new Request('http://localhost/api/compliance/policies');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns policies list when user has COMPLIANCE.VIEW', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockHasPermission.mockResolvedValue(true);
    const mockPolicies = [
      { policy_id: 'policy-1', name: 'Standard', key_class: 'standard', required_approvals: 2 },
    ];
    (governance.listPolicies as jest.Mock).mockReturnValue(mockPolicies);

    const req = new Request('http://localhost/api/compliance/policies');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.policies).toEqual(mockPolicies);
    expect(body.total_count).toBe(1);
  });

  it('returns single policy when key_class query param', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockHasPermission.mockResolvedValue(true);
    const mockPolicy = { policy_id: 'policy-standard', key_class: 'standard', required_approvals: 2 };
    (governance.getPolicy as jest.Mock).mockReturnValue(mockPolicy);

    const req = new Request('http://localhost/api/compliance/policies?key_class=standard');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.policy).toEqual(mockPolicy);
  });
});

describe('POST /api/compliance/policies', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user lacks ADMIN.MANAGE_USERS', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockHasPermission.mockResolvedValue(false);
    mockRequirePermission.mockResolvedValue(Response.json({ error: 'Forbidden' }, { status: 403 }));

    const req = new Request('http://localhost/api/compliance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create', name: 'Test', key_class: 'standard', required_approvals: 2 }),
    });
    const res = await POST(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when action=update without policy_id', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockHasPermission.mockResolvedValue(true);

    const req = new Request('http://localhost/api/compliance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'update' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error?.code).toBe('BAD_REQUEST');
  });

  it('returns 400 when action=create without required fields', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockHasPermission.mockResolvedValue(true);

    const req = new Request('http://localhost/api/compliance/policies', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'create' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });
});
