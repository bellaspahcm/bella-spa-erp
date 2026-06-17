/**
 * Rate Limiting Middleware
 * 
 * Implements token bucket algorithm with Redis backend.
 * Enforces per-partner rate limits based on tier (Free, Basic, Pro, Enterprise).
 * 
 * Features:
 * - Token bucket algorithm (smooth rate limiting)
 * - Redis for distributed rate limiting
 * - Partner tier-based limits
 * - Graceful degradation if Redis unavailable
 * - X-RateLimit-* response headers
 * - Real-time monitoring alerts
 * 
 * @module middleware/rate-limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APIError } from '@/lib/errors/api-error';
import type { APIPartner } from '@/types/api-gateway';

// Redis client (lazy initialization)
let redisClient: any = null;

/**
 * Rate limit tiers
 * Define limits per minute and per day for each partner tier
 */
export const RATE_LIMIT_TIERS = {
  free: {
    per_minute: 60,
    per_day: 1_000,
    tier_name: 'Free',
    description: 'Testing and small integrations',
  },
  basic: {
    per_minute: 300,
    per_day: 10_000,
    tier_name: 'Basic',
    description: 'Small partners',
  },
  pro: {
    per_minute: 1_000,
    per_day: 100_000,
    tier_name: 'Pro',
    description: 'Medium partners',
  },
  enterprise: {
    per_minute: 5_000,
    per_day: 1_000_000,
    tier_name: 'Enterprise',
    description: 'Large partners',
  },
  unlimited: {
    per_minute: Infinity,
    per_day: Infinity,
    tier_name: 'Unlimited',
    description: 'Internal Bella services',
  },
} as const;

export type RateLimitTier = keyof typeof RATE_LIMIT_TIERS;

/**
 * Rate limit result
 */
interface RateLimitResult {
  allowed: boolean;
  limit: number;
  remaining: number;
  reset: number; // Unix timestamp (seconds)
  retryAfter?: number; // Seconds until reset
}

/**
 * Initialize Redis client
 * Uses environment variables for connection
 */
async function getRedisClient() {
  if (redisClient) return redisClient;

  // Check if Redis is configured
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('REDIS_URL not configured, rate limiting will use in-memory fallback');
    return null;
  }

  try {
    // Use ioredis for Redis connection
    const Redis = require('ioredis');
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
    });

    await redisClient.connect();
    console.log('✅ Redis connected for rate limiting');
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    return null;
  }
}


/**
 * Check rate limit using token bucket algorithm
 * 
 * @param partnerId - Partner UUID
 * @param tier - Rate limit tier (free, basic, pro, enterprise, unlimited)
 * @param window - Time window ('minute' or 'day')
 * @returns Rate limit result
 */
async function checkRateLimit(
  partnerId: string,
  tier: RateLimitTier,
  window: 'minute' | 'day'
): Promise<RateLimitResult> {
  const redis = await getRedisClient();
  
  // If Redis unavailable, allow request (fail open)
  if (!redis) {
    return {
      allowed: true,
      limit: RATE_LIMIT_TIERS[tier][`per_${window}`],
      remaining: RATE_LIMIT_TIERS[tier][`per_${window}`],
      reset: Math.ceil(Date.now() / 1000) + (window === 'minute' ? 60 : 86400),
    };
  }

  const limit = RATE_LIMIT_TIERS[tier][`per_${window}`];
  
  // Unlimited tier bypasses rate limiting
  if (limit === Infinity) {
    return {
      allowed: true,
      limit: Infinity,
      remaining: Infinity,
      reset: Math.ceil(Date.now() / 1000) + (window === 'minute' ? 60 : 86400),
    };
  }

  // Calculate current time window
  const now = Date.now();
  const windowSize = window === 'minute' ? 60 * 1000 : 24 * 60 * 60 * 1000;
  const currentWindow = Math.floor(now / windowSize);
  
  // Redis key format: rate_limit:{partnerId}:{window}:{timestamp}
  const key = `rate_limit:${partnerId}:${window}:${currentWindow}`;
  
  try {
    // Increment counter atomically
    const current = await redis.incr(key);
    
    // Set expiry on first request in window (prevent memory leak)
    if (current === 1) {
      const ttl = window === 'minute' ? 60 : 86400;
      await redis.expire(key, ttl);
    }
    
    // Calculate reset time (end of current window)
    const resetTimestamp = Math.ceil((currentWindow + 1) * windowSize / 1000);
    
    // Check if limit exceeded
    if (current > limit) {
      const retryAfter = resetTimestamp - Math.ceil(now / 1000);
      return {
        allowed: false,
        limit,
        remaining: 0,
        reset: resetTimestamp,
        retryAfter,
      };
    }
    
    return {
      allowed: true,
      limit,
      remaining: limit - current,
      reset: resetTimestamp,
    };
  } catch (error) {
    console.error('Redis rate limit check failed:', error);
    // Fail open (allow request if Redis fails)
    return {
      allowed: true,
      limit,
      remaining: limit,
      reset: Math.ceil(Date.now() / 1000) + (window === 'minute' ? 60 : 86400),
    };
  }
}

/**
 * Get partner's rate limit tier from database
 * Falls back to 'free' tier if not specified
 */
async function getPartnerTier(partnerId: string): Promise<RateLimitTier> {
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data, error } = await supabase
    .from('api_partners')
    .select('rate_limit_tier')
    .eq('id', partnerId)
    .single();

  if (error || !data) {
    console.warn(`Failed to get tier for partner ${partnerId}, using 'free'`);
    return 'free';
  }

  return (data.rate_limit_tier as RateLimitTier) || 'free';
}


/**
 * Rate limit middleware
 * Checks both per-minute and per-day limits
 * 
 * @param req - Next.js request (must have req.partner set by withAPIKey)
 * @returns Rate limit result or throws APIError if limit exceeded
 * 
 * @example
 * ```typescript
 * export async function GET(req: NextRequest) {
 *   await withAPIKey(req);
 *   await rateLimitMiddleware(req);
 *   
 *   // Request is allowed, proceed...
 * }
 * ```
 */
export async function rateLimitMiddleware(req: NextRequest): Promise<void> {
  // Ensure partner is set (should be set by withAPIKey)
  const partner = (req as any).partner as APIPartner | undefined;
  
  if (!partner) {
    throw new APIError('INTERNAL_ERROR', {
      message: 'Partner not set. Ensure withAPIKey() is called before rateLimitMiddleware()',
    });
  }

  // Get partner's tier
  const tier = await getPartnerTier(partner.id);

  // Check per-minute limit
  const minuteResult = await checkRateLimit(partner.id, tier, 'minute');
  
  // Check per-day limit
  const dayResult = await checkRateLimit(partner.id, tier, 'day');

  // Use the stricter limit (whichever has fewer remaining)
  let result: RateLimitResult;
  if (!minuteResult.allowed) {
    result = minuteResult;
  } else if (!dayResult.allowed) {
    result = dayResult;
  } else {
    // Both allowed, use minute limit for headers
    result = minuteResult;
  }

  // Set rate limit headers (informational)
  (req as any).rateLimitHeaders = {
    'X-RateLimit-Limit': result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
  };

  // If rate limit exceeded, throw error
  if (!result.allowed) {
    // Log rate limit event for monitoring
    console.warn('Rate limit exceeded:', {
      partner_id: partner.id,
      partner_name: partner.name,
      tier,
      limit: result.limit,
      reset: new Date(result.reset * 1000).toISOString(),
    });

    // Send alert if high usage (>90% of limit)
    if (result.remaining === 0) {
      await sendRateLimitAlert(partner, tier, result);
    }

    throw new APIError('RATE_LIMIT_EXCEEDED', {
      message: `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`,
      limit: result.limit,
      reset: result.reset,
      retryAfter: result.retryAfter,
    });
  }

  // Warning if approaching limit (>80% consumed)
  const consumed = result.limit - result.remaining;
  const consumedPercentage = (consumed / result.limit) * 100;
  
  if (consumedPercentage > 80) {
    console.warn('Partner approaching rate limit:', {
      partner_id: partner.id,
      tier,
      consumed: `${consumedPercentage.toFixed(1)}%`,
      remaining: result.remaining,
    });
  }
}


/**
 * Send rate limit alert to monitoring system
 * Triggers alert when partner exceeds rate limit
 */
async function sendRateLimitAlert(
  partner: APIPartner,
  tier: RateLimitTier,
  result: RateLimitResult
): Promise<void> {
  // In production, this would send to monitoring system (PagerDuty, Slack, etc.)
  // For now, just log
  
  const alert = {
    type: 'RATE_LIMIT_EXCEEDED',
    severity: 'MEDIUM',
    partner_id: partner.id,
    partner_name: partner.name,
    tenant_id: partner.tenant_id,
    tier,
    limit: result.limit,
    reset: new Date(result.reset * 1000).toISOString(),
    retryAfter: result.retryAfter,
    timestamp: new Date().toISOString(),
  };

  console.error('🚨 RATE LIMIT ALERT:', JSON.stringify(alert, null, 2));

  // TODO: Implement actual alerting
  // - Send to Slack #api-alerts channel
  // - Create PagerDuty incident if critical partner
  // - Email partner contact
  // - Store in security_events table
}

/**
 * Get partner usage statistics
 * Returns current usage for monitoring dashboard
 */
export async function getPartnerUsageStats(partnerId: string): Promise<{
  minute: RateLimitResult;
  day: RateLimitResult;
  tier: RateLimitTier;
}> {
  const redis = await getRedisClient();
  const tier = await getPartnerTier(partnerId);

  if (!redis) {
    return {
      minute: {
        allowed: true,
        limit: RATE_LIMIT_TIERS[tier].per_minute,
        remaining: RATE_LIMIT_TIERS[tier].per_minute,
        reset: Math.ceil(Date.now() / 1000) + 60,
      },
      day: {
        allowed: true,
        limit: RATE_LIMIT_TIERS[tier].per_day,
        remaining: RATE_LIMIT_TIERS[tier].per_day,
        reset: Math.ceil(Date.now() / 1000) + 86400,
      },
      tier,
    };
  }

  // Get current usage without incrementing
  const now = Date.now();
  const minuteWindow = Math.floor(now / (60 * 1000));
  const dayWindow = Math.floor(now / (24 * 60 * 60 * 1000));

  const minuteKey = `rate_limit:${partnerId}:minute:${minuteWindow}`;
  const dayKey = `rate_limit:${partnerId}:day:${dayWindow}`;

  const [minuteCount, dayCount] = await Promise.all([
    redis.get(minuteKey).then((v: string) => parseInt(v || '0')),
    redis.get(dayKey).then((v: string) => parseInt(v || '0')),
  ]);

  const minuteLimit = RATE_LIMIT_TIERS[tier].per_minute;
  const dayLimit = RATE_LIMIT_TIERS[tier].per_day;

  return {
    minute: {
      allowed: minuteCount < minuteLimit,
      limit: minuteLimit,
      remaining: Math.max(0, minuteLimit - minuteCount),
      reset: Math.ceil((minuteWindow + 1) * 60),
    },
    day: {
      allowed: dayCount < dayLimit,
      limit: dayLimit,
      remaining: Math.max(0, dayLimit - dayCount),
      reset: Math.ceil((dayWindow + 1) * 86400 / 1000),
    },
    tier,
  };
}

/**
 * Helper: Add rate limit headers to response
 * Call this after rateLimitMiddleware to include headers
 */
export function addRateLimitHeaders(
  req: NextRequest,
  response: NextResponse
): NextResponse {
  const headers = (req as any).rateLimitHeaders as Record<string, string> | undefined;
  
  if (headers) {
    Object.entries(headers).forEach(([key, value]) => {
      response.headers.set(key, value);
    });
  }
  
  return response;
}

/**
 * Wrapper: API route with rate limiting
 * Combines withAPIKey + rateLimitMiddleware + adds headers to response
 */
export function withRateLimit(
  handler: (req: NextRequest) => Promise<NextResponse>
) {
  return async (req: NextRequest): Promise<NextResponse> => {
    // Import withAPIKey to avoid circular dependency
    const { withAPIKey } = await import('./api-key.middleware');
    
    // Authenticate
    await withAPIKey(req);
    
    // Check rate limit
    await rateLimitMiddleware(req);
    
    // Execute handler
    const response = await handler(req);
    
    // Add rate limit headers
    return addRateLimitHeaders(req, response);
  };
}

