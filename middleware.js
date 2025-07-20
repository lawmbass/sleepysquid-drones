import { NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';

export async function middleware(request) {
  // Create response
  const response = NextResponse.next();

  // Security headers
  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  response.headers.set('Content-Security-Policy', "default-src 'self'; script-src 'self' 'unsafe-eval' 'unsafe-inline' https://www.google.com https://www.gstatic.com; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' data:; frame-src https://www.google.com; connect-src 'self' https://www.google.com;");

  // Additional security for API routes
  if (request.nextUrl.pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store');
    response.headers.set('Pragma', 'no-cache');
  }

  // Define protected routes that require active user access
  const protectedRoutes = [
    '/dashboard',
    '/admin',
    '/api/admin',
    '/api/user',
    '/profile',
    '/settings'
  ];

  // Define public routes that don't require authentication
  const publicRoutes = [
    '/',
    '/login',
    '/register',
    '/about',
    '/contact',
    '/api/auth',
    '/access-denied',
    '/invite',
    '/verify-email',
    '/verify-email-change',
    '/api/admin/invitations/validate'  // Invitation validation should be public
  ];

  const { pathname } = request.nextUrl;

  // Check if the current path is a public route first
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route)
  );

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );

  // If it's a protected route and not a public route, check user access
  if (isProtectedRoute && !isPublicRoute) {
    try {
      // Get the JWT token from the request
      const token = await getToken({ 
        req: request, 
        secret: process.env.NEXTAUTH_SECRET 
      });

      // If no token, redirect to login
      if (!token) {
        const loginUrl = new URL('/login', request.url);
        loginUrl.searchParams.set('callbackUrl', pathname);
        return NextResponse.redirect(loginUrl);
      }

      // Check if user has access by making an API call to our own endpoint
      // This avoids the mongoose import issue in middleware
      if (token.email) {
        try {
          // Make an internal API call to check user access
          const baseUrl = request.nextUrl.origin;
          const checkAccessUrl = new URL('/api/auth/check-access', baseUrl);
          
          const accessResponse = await fetch(checkAccessUrl, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${token.sub}`, // Use token subject as identifier
            },
            body: JSON.stringify({ email: token.email })
          });

          if (accessResponse.ok) {
            const accessData = await accessResponse.json();
            
            // If user doesn't have access, redirect to access denied
            if (!accessData.hasAccess) {
              // Allow admins to always access (SleepySquid emails)
              const isAdmin = token.email?.toLowerCase()?.endsWith('@sleepysquid.com');
              
              if (!isAdmin) {
                const accessDeniedUrl = new URL('/access-denied', request.url);
                accessDeniedUrl.searchParams.set('reason', 'inactive');
                return NextResponse.redirect(accessDeniedUrl);
              }
            }
          }
          // If API call fails, let the request through (graceful degradation)
        } catch (apiError) {
          console.error('API error in middleware:', apiError);
          // On API error, let the request through to avoid breaking the app
          // The session callback will handle the access check as fallback
        }
      }
    } catch (error) {
      console.error('Error in middleware access check:', error);
      // On error, redirect to login for safety
      const loginUrl = new URL('/login', request.url);
      loginUrl.searchParams.set('callbackUrl', pathname);
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