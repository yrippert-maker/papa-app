/**
 * API route /api/anchoring/health
 * GET — health статус anchoring (no auth).
 */
jest.mock('@/lib/anchoring-health-service');

import { GET } from '@/app/api/anchoring/health/route';
import { getAnchoringHealth } from '@/lib/anchoring-health-service';

describe('GET /api/anchoring/health', () => {
  it('returns 200 with status field', async () => {
    (getAnchoringHealth as jest.Mock).mockResolvedValue({
      network: 'polygon',
      chainId: 137,
      status: 'OK',
      lastConfirmedAt: '2024-01-01T00:00:00Z',
      daysSinceLastConfirmed: 0,
      windowDays: 30,
      confirmedInWindow: 5,
      emptyInWindow: 0,
      failedInWindow: 0,
      pendingOlderThanHours: 0,
    });

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('OK');
    expect(body.network).toBeDefined();
    expect(body.chainId).toBeDefined();
  });

  it('returns fallback on error', async () => {
    (getAnchoringHealth as jest.Mock).mockRejectedValue(new Error('DB error'));

    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.status).toBe('UNAVAILABLE');
  });
});
