import { NextRequest, NextResponse, type NextFetchEvent } from 'next/server';
import { withAuth, type NextRequestWithAuth } from 'next-auth/middleware';

// Fail-fast: E2E_MODE только для e2e (CI=true в test:e2e и GitHub Actions)
const isE2EModeInProduction =
  process.env.NODE_ENV === 'production' &&
  process.env.E2E_MODE === '1' &&
  process.env.CI !== 'true';

function rbacMiddleware(req: NextRequestWithAuth, _event: NextFetchEvent) {
  const token = req.nextauth?.token;
  if (!token) return NextResponse.next();
  const roles = ((token as { roles?: string[] }).roles ?? []).map((r) => r.toLowerCase());
  const path = req.nextUrl.pathname;
  if (path.startsWith('/admin') && !roles.includes('admin')) {
    return NextResponse.redirect(new URL('/403', req.url));
  }
  if ((path.startsWith('/audit') || path.startsWith('/compliance/snapshots')) && !roles.includes('admin') && !roles.includes('auditor')) {
    return NextResponse.redirect(new URL('/403', req.url));
  }
  return NextResponse.next();
}

const authMiddleware = withAuth(rbacMiddleware, {
  pages: { signIn: '/login' },
  callbacks: { authorized: ({ token }) => !!token },
});

export default function middleware(req: NextRequest, event: { next: (r: NextRequest) => Promise<Response> }) {
  // Static assets и API — не трогать (matcher должен исключать, но belt-and-suspenders)
  const pathname = req.nextUrl.pathname;
  if (
    pathname.startsWith('/_next') ||
    pathname.startsWith('/api') ||
    pathname === '/favicon.ico' ||
    pathname === '/robots.txt' ||
    pathname === '/sitemap.xml'
  ) {
    return NextResponse.next();
  }
  if (isE2EModeInProduction) {
    console.error('FATAL: E2E_MODE must not be set in production (outside CI)');
    return new NextResponse(
      JSON.stringify({ error: 'Server misconfiguration: E2E_MODE is for tests only' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  // Debug 500: bypass auth for / → /dev-home (same dashboard, no auth)
  if (process.env.SKIP_AUTH_FOR_ROOT === '1' && req.nextUrl.pathname === '/') {
    return NextResponse.redirect(new URL('/dev-home', req.url));
  }
  // requestId для корреляции audit ↔ app logs (прокидывается в API routes)
  const requestHeaders = new Headers(req.headers);
  if (!requestHeaders.get('x-request-id')) {
    requestHeaders.set('x-request-id', crypto.randomUUID());
  }
  const reqWithId = new NextRequest(req.url, { headers: requestHeaders });
  // @ts-expect-error — NextRequest compatible at runtime; nextauth added by withAuth
  return authMiddleware(reqWithId, event);
}

export const config = {
  // Защита всех маршрутов, кроме:
  // - api/auth (NextAuth callbacks)
  // - api/health, api/metrics (ALB/Prometheus; restrict at proxy/ingress)
  // - api/anchoring/health, api/workspace/status (health/status — JSON, не redirect)
  // - login (страница входа)
  // - dev-home (бинарный тест 500: рендер без auth)
  // - _next/static, _next/image, favicon.ico (static assets)
  matcher: [
    '/((?!api/auth|api/health|api/metrics|api/anchoring/health|api/workspace/status|login|dev-home|_next/static|_next/image|favicon.ico).*)',
  ],
};
