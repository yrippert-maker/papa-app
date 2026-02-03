import { createRemoteJWKSet, jwtVerify } from 'jose';

const mode = (process.env.PORTAL_AUTH_MODE || 'none').trim();
const apiKey = (process.env.PORTAL_API_KEY || '').trim();

const jwksUrl = (process.env.PORTAL_OIDC_JWKS_URL || '').trim();
const issuer = (process.env.PORTAL_OIDC_ISSUER || '').trim() || undefined;
const audience = (process.env.PORTAL_OIDC_AUDIENCE || '').trim() || undefined;

let jwks = null;
if (mode === 'oidc') {
  if (!jwksUrl) throw new Error('PORTAL_OIDC_JWKS_URL is required for PORTAL_AUTH_MODE=oidc');
  jwks = createRemoteJWKSet(new URL(jwksUrl));
}

export function authMiddleware(req, res, next) {
  if (mode === 'none') return next();

  if (mode === 'api_key') {
    if (!apiKey) return res.status(500).json({ ok: false, error: 'server misconfigured: missing PORTAL_API_KEY' });
    const hdr = String(req.headers['x-api-key'] || '');
    if (hdr && hdr === apiKey) return next();
    return res.status(401).json({ ok: false, error: 'unauthorized' });
  }

  if (mode === 'oidc') {
    const h = String(req.headers.authorization || '');
    const m = /^Bearer\s+(.+)$/.exec(h);
    if (!m) return res.status(401).json({ ok: false, error: 'missing bearer token' });
    const token = m[1];
    jwtVerify(token, jwks, { issuer, audience })
      .then((r) => {
        req.user = r.payload;
        next();
      })
      .catch(() => res.status(401).json({ ok: false, error: 'invalid token' }));
    return;
  }

  return res.status(500).json({ ok: false, error: `unknown PORTAL_AUTH_MODE=${mode}` });
}
