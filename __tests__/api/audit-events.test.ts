/**
 * T13: API route /api/audit/events
 * GET list with filters/pagination; POST client-side audit log.
 */
import type { Session } from 'next-auth';

jest.mock('@/lib/auth-options', () => ({ authOptions: {} }));
jest.mock('next-auth', () => ({ getServerSession: jest.fn() }));
jest.mock('@/lib/requireRole', () => ({
  requireRoleForApi: jest.fn(),
}));
jest.mock('@/lib/prisma', () => ({
  prisma: {
    auditEvent: {
      findMany: jest.fn(),
      create: jest.fn(),
    },
  },
}));

import { GET, POST } from '@/app/api/audit/events/route';
import { getServerSession } from 'next-auth';
import { requireRoleForApi } from '@/lib/requireRole';
import { prisma } from '@/lib/prisma';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRequireRole = requireRoleForApi as jest.MockedFunction<typeof requireRoleForApi>;

describe('GET /api/audit/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user lacks admin/auditor role', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequireRole.mockReturnValue(Response.json({ error: 'Forbidden' }, { status: 403 }) as any);

    const req = new Request('http://localhost/api/audit/events');
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns events with nextCursor when user has role', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequireRole.mockReturnValue(null);
    const mockEvents = [
      { id: 'e1', action: 'LOGIN', actorUserId: 'u1', createdAt: new Date('2024-01-01') },
      { id: 'e2', action: 'LOGOUT', actorUserId: 'u1', createdAt: new Date('2024-01-02') },
    ];
    (prisma.auditEvent.findMany as jest.Mock).mockResolvedValue(mockEvents);

    const req = new Request('http://localhost/api/audit/events');
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.events).toEqual(mockEvents);
    expect(typeof body.hasMore).toBe('boolean');
    expect(body.nextCursor === null || typeof body.nextCursor === 'string').toBe(true);
  });
});

describe('POST /api/audit/events', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 401 when not authenticated', async () => {
    mockGetServerSession.mockResolvedValue(null);

    const req = new Request('http://localhost/api/audit/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'VIEW_PAGE', target: '/dashboard' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(401);
  });

  it('returns 400 when action invalid', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' }, expires: '' } as Session);

    const req = new Request('http://localhost/api/audit/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: '', target: '/x' }),
    });
    const res = await POST(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 and creates event when valid', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: 'u1' }, expires: '' } as Session);
    (prisma.auditEvent.create as jest.Mock).mockResolvedValue({});

    const req = new Request('http://localhost/api/audit/events', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'VIEW_PAGE', target: '/dashboard', metadata: { ref: 'home' } }),
    });
    const res = await POST(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.ok).toBe(true);
  });
});
