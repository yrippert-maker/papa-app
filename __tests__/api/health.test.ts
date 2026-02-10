/**
 * T11: API route /api/health
 * Health check for ALB/load balancer — no auth, returns 200 + { ok: true }.
 */
import { GET } from '@/app/api/health/route';

describe('GET /api/health', () => {
  it('returns 200 with { ok: true }', async () => {
    const res = await GET();
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body).toEqual({ ok: true });
  });
});
