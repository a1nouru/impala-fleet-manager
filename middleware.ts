import { type NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  const { supabase, response } = await createClient(request)

  // Refresh session if expired - required for Server Components
  // https://supabase.com/docs/guides/auth/auth-helpers/nextjs#managing-session-with-middleware
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const path = request.nextUrl.pathname;
  const isDev = process.env.NODE_ENV === 'development';
  const isStaticAsset = path.startsWith('/_next') || path.includes('.') || path.startsWith('/favicon');

  // Log middleware processing in development
  if (isDev && !isStaticAsset) {
    console.log(`🌐 Middleware processing: ${path}`);
    if (user) {
      console.log(`👤 User authenticated: ${user.email}`);
    } else {
      console.log(`👤 No user session found.`);
    }
  }

  // Define protected routes
  const protectedRoutes = ['/admin', '/dashboard', '/profile'];
  const isProtectedRoute = protectedRoutes.some(route => path.startsWith(route));

  // If no user and trying to access a protected route, redirect to login
  if (!user && isProtectedRoute) {
    if (isDev) {
      console.log(`🔒 Unauthorized access to ${path}, redirecting to /login.`);
    }
    return Response.redirect(new URL('/login', request.url))
  }
  
  // If user is logged in and tries to access login page, redirect to dashboard
  if (user && path === '/login') {
    if (isDev) {
      console.log(`↩️ User already logged in, redirecting from /login to /dashboard.`);
    }
    return Response.redirect(new URL('/dashboard', request.url))
  }

  // Set security headers for protected routes
  if (isProtectedRoute) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('X-Session-Validation', 'required'); // Keep custom header for logging if needed
    if (isDev) {
      console.log(`🔒 Applied session protection headers for: ${path}`);
    }
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - api/auth (for Supabase auth routes)
     * - _vercel (Vercel internals)
     */
    '/((?!_next/static|_next/image|favicon.ico|api/auth|_vercel).*)',
  ],
} 