import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

function matchesRoute(pathname, route) {
  if (route === '/') {
    return pathname === '/';
  }
  return pathname === route || pathname.startsWith(`${route}/`);
}

export async function middleware(request) {
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

      if (token.email) {
        try {
          const baseUrl = request.nextUrl.origin;
          const checkAccessUrl = new URL('/api/auth/check-access', baseUrl);

          const accessResponse = await fetch(checkAccessUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ email: token.email })
          });

          if (accessResponse.ok) {
            const accessData = await accessResponse.json();

            if (!accessData.hasAccess) {
              const isAdmin = token.email?.toLowerCase()?.endsWith('@sleepysquid.com');

              if (!isAdmin) {
                const accessDeniedUrl = new URL('/access-denied', request.url);
                accessDeniedUrl.searchParams.set('reason', 'inactive');
                return NextResponse.redirect(accessDeniedUrl);
              }
            }
          }
        } catch (apiError) {
          console.error('API error in middleware:', apiError);
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
