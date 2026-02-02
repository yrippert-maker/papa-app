/**
 * Unit tests for lib/api/error-response — standardized error payload.
 */
import { badRequest, forbidden, unauthorized, jsonError } from '@/lib/api/error-response';

describe('error-response', () => {
  it('badRequest returns 400 with BAD_REQUEST code and request_id', async () => {
    const res = badRequest('Invalid limit');
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body).toMatchObject({ error: { code: 'BAD_REQUEST', message: 'Invalid limit' } });
    expect(typeof body.error.request_id).toBe('string');
    expect(body.error.request_id.length).toBeGreaterThan(0);
  });

  it('forbidden returns 403 with FORBIDDEN code', async () => {
    const res = forbidden();
    expect(res.status).toBe(403);
    const body = await res.json();
    expect(body.error.code).toBe('FORBIDDEN');
    expect(typeof body.error.request_id).toBe('string');
  });

  it('unauthorized returns 401 with UNAUTHORIZED code', async () => {
    const res = unauthorized();
    expect(res.status).toBe(401);
    const body = await res.json();
    expect(body.error.code).toBe('UNAUTHORIZED');
    expect(typeof body.error.request_id).toBe('string');
  });

  it('jsonError returns custom status and code', async () => {
    const res = jsonError(422, 'VALIDATION_ERROR', 'Custom message');
    expect(res.status).toBe(422);
    const body = await res.json();
    expect(body).toMatchObject({ error: { code: 'VALIDATION_ERROR', message: 'Custom message' } });
    expect(typeof body.error.request_id).toBe('string');
  });
});
