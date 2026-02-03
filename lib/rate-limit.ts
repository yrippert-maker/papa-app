/**
 * Simple in-memory rate limiter for sensitive endpoints.
 * Per-key (e.g. IP) sliding window; 10 requests per minute by default.
 * For multi-instance deployments, use Redis or similar.
 */
const store = new Map<string, { count: number; resetAt: number }>();

export function checkRateLimit(
  key: string,
  opts: { windowMs?: number; max?: number } = {}
): { allowed: boolean; retryAfterMs?: number } {
  const windowMs = opts.windowMs ?? 60_000;
  const max = opts.max ?? 10;
  const now = Date.now();

  let entry = store.get(key);
  if (!entry) {
    store.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true };
  }

  if (now >= entry.resetAt) {
    entry = { count: 1, resetAt: now + windowMs };
    store.set(key, entry);
    return { allowed: true };
  }

  entry.count++;
  if (entry.count > max) {
    return { allowed: false, retryAfterMs: Math.max(0, entry.resetAt - now) };
  }
  return { allowed: true };
}

/** Get client identifier from request headers. */
export function getClientKey(req: Request): string {
  const forwarded = req.headers.get('x-forwarded-for');
  const realIp = req.headers.get('x-real-ip');
  return (forwarded?.split(',')[0]?.trim() || realIp || 'unknown').slice(0, 64);
}
