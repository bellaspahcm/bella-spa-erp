import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

/**
 * Bella ERP Middleware
 * 
 * Handles:
 * - CDN caching headers for API endpoints
 * - Security headers
 * - Request logging
 * - Rate limiting (TODO: integrate with Redis)
 */

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const response = NextResponse.next();

  // ============================================================================
  // CDN CACHING STRATEGY
  // ============================================================================

  // API Gateway endpoints - Cache public data
  if (pathname.startsWith('/api/v1/public')) {
    // Public booking form data, service catalogs
    response.headers.set('Cache-Control', 's-maxage=300, stale-while-revalidate=600');
    response.headers.set('CDN-Cache-Control', 'max-age=300');
    response.headers.set('Vercel-CDN-Cache-Control', 'max-age=300');
  }

  // API Gateway partner webhooks - No cache
  else if (pathname.startsWith('/api/v1/webhooks')) {
    response.headers.set('Cache-Control', 'no-store, no-cache, must-revalidate');
  }

  // Internal API routes - No cache (dynamic data)
  else if (pathname.startsWith('/api/')) {
    response.headers.set('Cache-Control', 'no-store, must-revalidate');
  }

  // Static assets - Long cache
  if (pathname.startsWith('/_next/static') || pathname.match(/\.(jpg|jpeg|png|gif|ico|svg|webp|woff|woff2)$/)) {
    response.headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  }

  // ============================================================================
  // SECURITY HEADERS
  // ============================================================================

  response.headers.set('X-Content-Type-Options', 'nosniff');
  response.headers.set('X-Frame-Options', 'DENY');
  response.headers.set('X-XSS-Protection', '1; mode=block');
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // CSP - Content Security Policy
  const csp = [
    "default-src 'self'",
    "script-src 'self' 'unsafe-eval' 'unsafe-inline' https://vercel.live",
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: https: blob:",
    "font-src 'self' data:",
    "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
    "frame-ancestors 'none'",
  ].join('; ');
  response.headers.set('Content-Security-Policy', csp);

  // Permissions Policy
  response.headers.set(
    'Permissions-Policy',
    'geolocation=(), microphone=(), camera=(), payment=(self)'
  );

  // HSTS - Only in production
  if (process.env.DEPLOYMENT_ENV === 'production') {
    response.headers.set(
      'Strict-Transport-Security',
      'max-age=63072000; includeSubDomains; preload'
    );
  }

  // ============================================================================
  // ENVIRONMENT INDICATOR
  // ============================================================================

  response.headers.set('X-Environment', process.env.DEPLOYMENT_ENV || 'development');

  // Robots - Block staging from search engines
  if (process.env.DEPLOYMENT_ENV === 'staging') {
    response.headers.set('X-Robots-Tag', 'noindex, nofollow');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
};
