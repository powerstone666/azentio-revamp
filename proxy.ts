import { NextRequest, NextResponse } from 'next/server';

/**
 * Next.js 16 proxy (replaces middleware.ts).
 * Optimistic cookie-based redirects only — NEVER the authorization boundary.
 * Real authorization lives in the server-only DAL at app/api/(services)/authz/.
 */

export default function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const sessionCookie = request.cookies.get('better-auth.session_token')
    ?? request.cookies.get('__Secure-better-auth.session_token');
  const demoCookie = request.cookies.get('azentio_mock_persona');

  // Demo cookie grants the preview surface; real access is checked by the server DAL.
  if (pathname.startsWith('/portal') && !sessionCookie && !demoCookie) {
    const loginUrl = new URL('/login', request.url);
    loginUrl.searchParams.set('redirect', pathname);
    return NextResponse.redirect(loginUrl);
  }

  // Redirect signed-in and demo users away from /login to their portal
  if (pathname.startsWith('/login') && (sessionCookie || demoCookie)) {
    return NextResponse.redirect(new URL('/portal', request.url));
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/portal/:path*', '/login'],
};
