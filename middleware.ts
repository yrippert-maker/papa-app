import { NextRequest, NextResponse } from 'next/server';
import { withAuth } from 'next-auth/middleware';

// Fail-fast: E2E_MODE только для e2e (CI=true в test:e2e и GitHub Actions)
const isE2EModeInProduction =
  process.env.NODE_ENV === 'production' &&
  process.env.E2E_MODE === '1' &&
  process.env.CI !== 'true';

const authMiddleware = withAuth({ pages: { signIn: '/login' } });

export default function middleware(req: NextRequest, event: { next: (r: NextRequest) => Promise<Response> }) {
  if (isE2EModeInProduction) {
    console.error('FATAL: E2E_MODE must not be set in production (outside CI)');
    return new NextResponse(
      JSON.stringify({ error: 'Server misconfiguration: E2E_MODE is for tests only' }),
      { status: 503, headers: { 'Content-Type': 'application/json' } }
    );
  }
  // @ts-expect-error — NextRequest compatible at runtime; nextauth added by withAuth
  return authMiddleware(req, event);
}

export const config = {
  // Защита всех маршрутов, кроме:
  // - api/auth (NextAuth callbacks)
  // - login (страница входа)
  // - _next/static, _next/image, favicon.ico (static assets)
  matcher: [
    '/((?!api/auth|login|_next/static|_next/image|favicon.ico).*)',
  ],
};
