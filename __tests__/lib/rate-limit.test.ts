import { checkRateLimit, getClientKey } from '@/lib/rate-limit';

describe('checkRateLimit', () => {
  it('allows first request', () => {
    const r = checkRateLimit('key1', { windowMs: 60_000, max: 2 });
    expect(r.allowed).toBe(true);
  });

  it('allows up to max requests', () => {
    const key = 'key2-' + Date.now();
    expect(checkRateLimit(key, { windowMs: 60_000, max: 2 }).allowed).toBe(true);
    expect(checkRateLimit(key, { windowMs: 60_000, max: 2 }).allowed).toBe(true);
    const third = checkRateLimit(key, { windowMs: 60_000, max: 2 });
    expect(third.allowed).toBe(false);
    expect(third.retryAfterMs).toBeDefined();
  });
});

describe('getClientKey', () => {
  it('extracts x-forwarded-for', () => {
    const req = new Request('http://x', {
      headers: { 'x-forwarded-for': '1.2.3.4, 5.6.7.8' },
    });
    expect(getClientKey(req)).toBe('1.2.3.4');
  });

  it('uses x-real-ip as fallback', () => {
    const req = new Request('http://x', { headers: { 'x-real-ip': '10.0.0.1' } });
    expect(getClientKey(req)).toBe('10.0.0.1');
  });

  it('returns unknown when no headers', () => {
    const req = new Request('http://x');
    expect(getClientKey(req)).toBe('unknown');
  });
});
