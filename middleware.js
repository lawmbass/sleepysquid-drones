import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import { adminConfig } from '@/libs/adminConfig';

function matchesRoute(pathname, route) {
  if (route === '/') {
    return pathname === '/';
  }
  return pathname === route || pathname.startsWith(`${route}/`);
}

// Before #83 the auth cookies were host-only on drones.sleepysquid.com. Those old cookies share their names
// with the new shared .sleepysquid.com ones, and the browser sends the older host-only copy first, so the
// server read a stale callback-url (drones home) and an expired session token: first sign-in landed on the
// drones homepage looking signed out. When a request carries two copies, expire the host-only copy (a
// Set-Cookie without Domain only clears the host-only one) and retry the same URL once.
const SHARED_AUTH_COOKIES = ['__Secure-next-auth.session-token', '__Secure-next-auth.callback-url', '__Secure-next-auth.csrf-token', '__Secure-next-auth.pkce.code_verifier', '__Secure-next-auth.state', '__Secure-next-auth.nonce'];
export function duplicatedAuthCookies(cookieHeader) {
  const counts = {};
  for (const part of String(cookieHeader || '').split(';')) {
    const name = part.split('=')[0].trim();
    // chunked session cookies are named <name>.0, <name>.1
    const base = SHARED_AUTH_COOKIES.find((n) => name === n || name.startsWith(`${n}.`));
    if (base) counts[name] = (counts[name] || 0) + 1;
  }
  return Object.keys(counts).filter((n) => counts[n] > 1);
}

export async function middleware(request) {
  if (process.env.NEXTAUTH_COOKIE_DOMAIN && !request.nextUrl.searchParams.has('_ckfix')) {
    const dups = duplicatedAuthCookies(request.headers.get('cookie'));
    if (dups.length) {
      const url = request.nextUrl.clone();
      url.searchParams.set('_ckfix', '1');
      const res = NextResponse.redirect(url, 307);
      for (const n of dups) res.headers.append('Set-Cookie', `${n}=; Path=/; Max-Age=0; Secure; HttpOnly; SameSite=Lax`);
      res.headers.set('Cache-Control', 'no-store');
      return res;
    }
  }
  const response = NextResponse.next();

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-src https://www.google.com; connect-src 'self' https://www.google.com;");

  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');
  }

  const protectedPages = [
    '/dashboard',
    '/admin',
    '/profile',
    '/settings'
  ];

  const { pathname } = request.nextUrl;

  // API routes enforce their own 401 responses. Do not redirect them to the login page.
  const isProtectedPage = !pathname.startsWith('/api/') && protectedPages.some((route) => matchesRoute(pathname, route));

  if (isProtectedPage) {
    try {
      const token = await getToken({
        req: request,
        secret: process.env.NEXTAUTH_SECRET
      });

      if (!token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
        return NextResponse.redirect(loginUrl);
      }

      // Fail closed: anything other than a clear "hasAccess: true" denies access, unless the user is an admin.
      const email = token.email?.toLowerCase() || '';
      const isAdmin = adminConfig.isAdmin(email);
      if (!isAdmin) {
        let hasAccess = false;
        try {
          if (email) {
            const accessResponse = await fetch(new URL('/api/auth/check-access', request.nextUrl.origin), {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ email }),
            });
            if (accessResponse.ok) {
              const accessData = await accessResponse.json();
              hasAccess = accessData?.hasAccess === true;
            }
          }
        } catch (apiError) {
          console.error('Access check failed; denying access:', apiError?.message);
        }
        if (!hasAccess) {
          const accessDeniedUrl = new URL('/access-denied', request.url);
          accessDeniedUrl.searchParams.set('reason', 'inactive');
          return NextResponse.redirect(accessDeniedUrl);
        }
      }
    } catch (error) {
      console.error('Error in middleware access check:', error);
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', `${pathname}${request.nextUrl.search}`);
      return NextResponse.redirect(loginUrl);
    }
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - _next/webpack-hmr (hot module replacement)
     */
    '/((?!_next/static|_next/image|_next/webpack-hmr|favicon.ico).*)',
  ],
};
