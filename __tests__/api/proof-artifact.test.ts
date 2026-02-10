/**
 * API route /api/proof/artifact
 * GET — события по SHA-256 артефакта. Требует LEDGER.READ.
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
jest.mock('@/lib/ledger-anchoring-service', () => ({
  getEventsByArtifact: jest.fn(),
}));

import { GET } from '@/app/api/proof/artifact/route';
import { getServerSession } from 'next-auth';
import { requirePermission } from '@/lib/authz';
import { getEventsByArtifact } from '@/lib/ledger-anchoring-service';

const mockGetServerSession = getServerSession as jest.MockedFunction<typeof getServerSession>;
const mockRequirePermission = requirePermission as jest.MockedFunction<typeof requirePermission>;

describe('GET /api/proof/artifact', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('returns 403 when user lacks LEDGER.READ', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockResolvedValue(Response.json({ error: 'Forbidden' }, { status: 403 }) as any);

    const req = new Request('http://localhost/api/proof/artifact?sha256=' + 'a'.repeat(64));
    const res = await GET(req);
    expect(res.status).toBe(403);
  });

  it('returns 400 when sha256 missing', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockResolvedValue(null);

    const req = new Request('http://localhost/api/proof/artifact');
    const res = await GET(req);
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toContain('sha256');
  });

  it('returns 400 when sha256 invalid format', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockResolvedValue(null);

    const req = new Request('http://localhost/api/proof/artifact?sha256=short');
    const res = await GET(req);
    expect(res.status).toBe(400);
  });

  it('returns 200 with events when valid', async () => {
    mockGetServerSession.mockResolvedValue({ user: { id: '1' }, expires: '' } as Session);
    mockRequirePermission.mockResolvedValue(null);
    const sha256 = 'a'.repeat(64);
    (getEventsByArtifact as jest.Mock).mockResolvedValue([
      { id: 'e1', event_type: 'DOC_UPLOADED', created_at: '2024-01-01', actor_id: 'u1', block_hash: 'h1', anchor_id: null },
    ]);

    const req = new Request(`http://localhost/api/proof/artifact?sha256=${sha256}`);
    const res = await GET(req);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.artifact_sha256).toBe(sha256);
    expect(Array.isArray(body.events)).toBe(true);
    expect(body.events).toHaveLength(1);
    expect(body.events[0].event_type).toBe('DOC_UPLOADED');
  });
});
