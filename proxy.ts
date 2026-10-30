import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js 16 proxy (replaces middleware.ts).
 * Optimistic cookie-based redirects only — NEVER the authorization boundary.
 * Real authorization lives in the server-only DAL at app/api/(services)/authz/.
 */

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('azentio_session');

  // Redirect unauthenticated users away from /portal/** to /login
  if (pathname.startsWith('/portal') && !sessionCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect authenticated users away from /login to their portal
  if (pathname.startsWith('/login') && sessionCookie) {
    return NextResponse.redirect(new URL('/portal', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/portal/:path*', '/login'],
};