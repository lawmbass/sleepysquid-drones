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
    '/access-denied'
  ];

  const { pathname } = request.nextUrl;

  // Check if the current path is a protected route
  const isProtectedRoute = protectedRoutes.some(route => 
    pathname.startsWith(route)
  );

  // Check if the current path is a public route
  const isPublicRoute = publicRoutes.some(route => 
    pathname === route || pathname.startsWith(route)
  );

  // If it's a protected route, check user access
  if (isProtectedRoute) {
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

      // Check if user has access (for routes that require active users)
      // We need to get fresh user data from the database
      if (token.email) {
        try {
          // Import here to avoid circular dependencies
          const { default: connectMongo } = await import('./libs/mongoose');
          const { default: User } = await import('./models/User');
          
          await connectMongo();
          const user = await User.findOne({ email: token.email.toLowerCase() });
          
          // If user doesn't exist or doesn't have access, redirect to access denied
          if (!user || !user.hasAccess) {
            // Allow admins to always access (SleepySquid emails)
            const isAdmin = token.email?.toLowerCase()?.endsWith('@sleepysquid.com');
            
            if (!isAdmin) {
              const accessDeniedUrl = new URL('/access-denied', request.url);
              accessDeniedUrl.searchParams.set('reason', 'inactive');
              return NextResponse.redirect(accessDeniedUrl);
            }
          }
        } catch (dbError) {
          console.error('Database error in middleware:', dbError);
          // On database error, let the request through to avoid breaking the app
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