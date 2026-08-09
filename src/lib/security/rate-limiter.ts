/**
 * Rate Limiter Middleware
 * 
 * Prevents abuse by limiting requests per IP/user
 * Uses in-memory store (for simplicity) or Redis (for production scale)
 * 
 * Rate limit rules:
 * - Partner registration: 3 requests per hour per IP
 * - Email verification: 5 requests per hour per email
 * - Admin actions: 100 requests per minute per admin
 * - API endpoints: 60 requests per minute per IP
 */

interface RateLimitEntry {
  count: number;
  resetAt: number;
}

// In-memory store (use Redis in production for multi-instance deployments)
const rateLimitStore = new Map<string, RateLimitEntry>();

// Cleanup old entries every 5 minutes
setInterval(() => {
  const now = Date.now();
  for (const [key, entry] of rateLimitStore.entries()) {
    if (entry.resetAt < now) {
      rateLimitStore.delete(key);
    }
  }
}, 5 * 60 * 1000);

export interface RateLimitConfig {
  windowMs: number; // Time window in milliseconds
  maxRequests: number; // Max requests per window
  keyPrefix?: string; // Prefix for the rate limit key (e.g., 'register', 'verify')
}

export interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  resetAt: number;
  retryAfter?: number; // Seconds until reset
}

/**
 * Check rate limit for a given identifier (IP, email, user ID)
 */
export function checkRateLimit(
  identifier: string,
  config: RateLimitConfig
): RateLimitResult {
  const key = config.keyPrefix ? `${config.keyPrefix}:${identifier}` : identifier;
  const now = Date.now();
  
  let entry = rateLimitStore.get(key);
  
  // Create new entry if doesn't exist or expired
  if (!entry || entry.resetAt < now) {
    entry = {
      count: 0,
      resetAt: now + config.windowMs,
    };
    rateLimitStore.set(key, entry);
  }
  
  // Increment count
  entry.count++;
  
  // Check if limit exceeded
  const allowed = entry.count <= config.maxRequests;
  const remaining = Math.max(0, config.maxRequests - entry.count);
  const retryAfter = allowed ? undefined : Math.ceil((entry.resetAt - now) / 1000);
  
  return {
    allowed,
    limit: config.maxRequests,
    remaining,
    resetAt: entry.resetAt,
    retryAfter,
  };
}

/**
 * Reset rate limit for a given identifier (used after successful actions)
 */
export function resetRateLimit(identifier: string, keyPrefix?: string): void {
  const key = keyPrefix ? `${keyPrefix}:${identifier}` : identifier;
  rateLimitStore.delete(key);
}

/**
 * Get client IP from Next.js request
 */
export function getClientIp(request: Request): string {
  // Try x-forwarded-for header (proxy/load balancer)
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  
  // Try x-real-ip header (Nginx)
  const realIp = request.headers.get('x-real-ip');
  if (realIp) {
    return realIp;
  }
  
  // Try CF-Connecting-IP (Cloudflare)
  const cfIp = request.headers.get('cf-connecting-ip');
  if (cfIp) {
    return cfIp;
  }
  
  // Fallback to connection remote address (direct connection)
  return 'unknown';
}

/**
 * Rate limit configurations for different endpoints
 */
export const RATE_LIMITS = {
  // Partner registration: 3 per hour per IP
  PARTNER_REGISTRATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyPrefix: 'register',
  },
  
  // Email verification: 5 per hour per email
  EMAIL_VERIFICATION: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 5,
    keyPrefix: 'verify',
  },
  
  // Email resend: 3 per hour per email
  EMAIL_RESEND: {
    windowMs: 60 * 60 * 1000, // 1 hour
    maxRequests: 3,
    keyPrefix: 'resend',
  },
  
  // Admin actions: 100 per minute per admin
  ADMIN_ACTIONS: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 100,
    keyPrefix: 'admin',
  },
  
  // General API: 60 per minute per IP
  API_GENERAL: {
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 60,
    keyPrefix: 'api',
  },
  
  // Login attempts: 5 per 15 minutes per IP
  LOGIN_ATTEMPTS: {
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyPrefix: 'login',
  },
} as const;

/**
 * Rate limit middleware helper for API routes
 */
export function withRateLimit<TArgs extends unknown[]>(
  handler: (request: Request, ...args: TArgs) => Promise<Response>,
  config: RateLimitConfig
) {
  return async (request: Request, ...args: TArgs): Promise<Response> => {
    const ip = getClientIp(request);
    const result = checkRateLimit(ip, config);
    
    if (!result.allowed) {
      return new Response(
        JSON.stringify({
          success: false,
          error: 'Rate limit exceeded',
          retryAfter: result.retryAfter,
          message: `Too many requests. Please try again in ${result.retryAfter} seconds.`,
        }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Limit': result.limit.toString(),
            'X-RateLimit-Remaining': result.remaining.toString(),
            'X-RateLimit-Reset': new Date(result.resetAt).toISOString(),
            'Retry-After': result.retryAfter?.toString() || '60',
          },
        }
      );
    }
    
    // Add rate limit headers to response
    const response = await handler(request, ...args);
    
    if (response instanceof Response) {
      response.headers.set('X-RateLimit-Limit', result.limit.toString());
      response.headers.set('X-RateLimit-Remaining', result.remaining.toString());
      response.headers.set('X-RateLimit-Reset', new Date(result.resetAt).toISOString());
    }
    
    return response;
  };
}
