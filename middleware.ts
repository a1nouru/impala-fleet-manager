import { NextRequest, NextResponse } from 'next/server';

export default function middleware(request: NextRequest) {
  // Get the pathname from the URL
  const path = request.nextUrl.pathname;
  
  // Only log in development if it's not a static asset or internal Next.js route
  const isDev = process.env.NODE_ENV === 'development';
  const isStaticAsset = path.startsWith('/_next') || path.includes('.') || path.startsWith('/favicon');
  
  if (isDev && !isStaticAsset) {
    console.log(`🌐 Middleware processing: ${path}`);
  }
  
  // Create response
  const response = NextResponse.next();
  
  // Add cold start detection headers (primarily for production)
  if (!isDev) {
    const startTime = Date.now();
    response.headers.set('X-Request-Start', startTime.toString());
    response.headers.set('X-Middleware-Timestamp', new Date().toISOString());
  }
  
  // Add session state protection headers for dynamic routes
  if (path.startsWith('/admin') || path.startsWith('/dashboard') || path.startsWith('/profile')) {
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate');
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    
    // Add session state validation header
    response.headers.set('X-Session-Validation', 'required');
    
    if (isDev && !isStaticAsset) {
      console.log(`🔒 Applied session protection headers for: ${path}`);
    }
  }
  
  // Add warmup detection for health/warmup endpoints (production only)
  if (!isDev && (path.startsWith('/api/health') || path.startsWith('/api/warmup'))) {
    const userAgent = request.headers.get('user-agent') || '';
    const isWarmupRequest = userAgent.includes('Warmup') || userAgent.includes('Vercel-Cron');
    
    if (isWarmupRequest) {
      response.headers.set('X-Warmup-Request', 'true');
      console.log(`🔥 Warmup request detected for: ${path}`);
    }
  }
  
  // Add performance monitoring headers (production only)
  if (!isDev) {
    response.headers.set('X-Powered-By', 'Next.js + Vercel');
    response.headers.set('X-Cold-Start-Prevention', 'active');
  }
  
  return response;
}

// Configure middleware to run on specific paths
export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - _vercel (Vercel internals)
     * 
     * This ensures that middleware runs on all pages and API routes.
     */
    '/((?!_next/static|_next/image|favicon.ico|_vercel).*)',
  ],
}; 