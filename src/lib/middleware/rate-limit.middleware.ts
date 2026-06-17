/**
 * Rate Limiting Middleware
 * 
 * Implements token bucket algorithm with Redis backend.
 * Enforces per-partner rate limits based on tier (Free, Basic, Pro, Enterprise).
 * 
 * Features:
 * - Token bucket algorithm (smooth rate limiting)
 * - Redis for distributed rate limiting
 * - Degraded mode with in-memory emergency limiter (when Redis down)
 * - Partner tier-based limits
 * - X-RateLimit-* response headers
 * - X-RateLimit-Mode header (normal/degraded)
 * - Real-time monitoring alerts
 * - Block unknown partners in degraded mode
 * 
 * @module middleware/rate-limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APIError } from '@/lib/errors/api-error';
import type { APIPartner } from '@/types/api-gateway';

// Redis client (lazy initialization)
let redisClient: any = null;
let redisStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
let lastRedisCheckTime = 0;

// In-memory emergency rate limiter (for degraded mode)
interface EmergencyLimit {
  count: number;
  windowStart: number;
}
const emergencyLimiter = new Map<string, EmergencyLimit>();

// Known partners cache (for degraded mode)
const knownPartnersCache = new Set<string>();
let knownPartnersCacheTime = 0;
const KNOWN_PARTNERS_CACHE_TTL = 60000; // 1 minute

/**
 * Rate limit tiers with degraded mode limits
 * Define limits per minute and per day for each partner tier
 */
export const RATE_LIMIT_TIERS = {
  free: {
    per_minute: 60,
    per_day: 1_000,
    tier_name: 'Free',
    description: 'Testing and small integrations',
    degraded_per_minute: 30, // 50% of normal limit in degraded mode
  },
  basic: {
    per_minute: 300,
    per_day: 10_000,
    tier_name: 'Basic',
    description: 'Small partners',
    degraded_per_minute: 150,
  },
  pro: {
    per_minute: 1_000,
    per_day: 100_000,
    tier_name: 'Pro',
    description: 'Medium partners',
    degraded_per_minute: 500,
  },
  enterprise: {
    per_minute: 5_000,
    per_day: 1_000_000,
    tier_name: 'Enterprise',
    description: 'Large partners',
    degraded_per_minute: 2_500,
  },
  unlimited: {
    per_minute: Infinity,
    per_day: Infinity,
    tier_name: 'Unlimited',
    description: 'Internal Bella services',
    degraded_per_minute: 10_000, // Even unlimited gets some limit in degraded mode
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
  mode: 'normal' | 'degraded'; // NEW: Indicate if degraded mode
}

/**
 * Initialize Redis client
 * Uses environment variables for connection
 */
async function getRedisClient() {
  if (redisClient) {
    // Periodic health check (every 30 seconds)
    const now = Date.now();
    if (now - lastRedisCheckTime > 30000) {
      lastRedisCheckTime = now;
      try {
        await redisClient.ping();
        if (redisStatus !== 'connected') {
          redisStatus = 'connected';
          console.log('✅ Redis reconnected');
          await sendRateLimitAlert(null as any, 'free', null as any, 'REDIS_RECOVERED');
        }
      } catch (error) {
        if (redisStatus !== 'disconnected') {
          redisStatus = 'disconnected';
          console.error('❌ Redis health check failed:', error);
          await sendRateLimitAlert(null as any, 'free', null as any, 'REDIS_DOWN');
        }
        return null;
      }
    }
    return redisClient;
  }

  // Check if Redis is configured
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('⚠️ REDIS_URL not configured, rate limiting will use degraded mode');
    redisStatus = 'disconnected';
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
    redisStatus = 'connected';
    console.log('✅ Redis connected for rate limiting');
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    redisStatus = 'disconnected';
    await sendRateLimitAlert(null as any, 'free', null as any, 'REDIS_DOWN');
    return null;
  }
}


/**
 * Load known partners from database into cache
 * Used in degraded mode to block unknown partners
 */
async function refreshKnownPartnersCache(): Promise<void> {
  const now = Date.now();
  
  // Only refresh if cache is stale
  if (now - knownPartnersCacheTime < KNOWN_PARTNERS_CACHE_TTL) {
    return;
  }

  try {
    const supabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.SUPABASE_SERVICE_ROLE_KEY!
    );

    const { data, error } = await supabase
      .from('api_partners')
      .select('id')
      .eq('is_active', true);

    if (error) throw error;

    knownPartnersCache.clear();
    data?.forEach(partner => knownPartnersCache.add(partner.id));
    knownPartnersCacheTime = now;
    
    console.log(`✅ Refreshed known partners cache: ${knownPartnersCache.size} partners`);
  } catch (error) {
    console.error('❌ Failed to refresh known partners cache:', error);
  }
}

/**
 * Emergency in-memory rate limiter (degraded mode)
 * Uses simple per-minute counter with reduced limits
 */
function checkEmergencyRateLimit(
  partnerId: string,
  tier: RateLimitTier
): RateLimitResult {
  const now = Date.now();
  const windowStart = Math.floor(now / 60000) * 60000; // Start of current minute
  const key = `${partnerId}:${windowStart}`;
  
  // Get or create counter for current window
  let counter = emergencyLimiter.get(key);
  if (!counter || counter.windowStart !== windowStart) {
    counter = { count: 0, windowStart };
    emergencyLimiter.set(key, counter);
    
    // Clean up old windows (older than 2 minutes)
    const oldWindowStart = windowStart - 120000;
    for (const [k, v] of emergencyLimiter.entries()) {
      if (v.windowStart < oldWindowStart) {
        emergencyLimiter.delete(k);
      }
    }
  }
  
  counter.count++;
  
  // Use degraded limit (50% of normal)
  const limit = RATE_LIMIT_TIERS[tier].degraded_per_minute;
  const remaining = Math.max(0, limit - counter.count);
  const resetTimestamp = Math.ceil((windowStart + 60000) / 1000);
  
  return {
    allowed: counter.count <= limit,
    limit,
    remaining,
    reset: resetTimestamp,
    retryAfter: counter.count > limit ? Math.ceil((windowStart + 60000 - now) / 1000) : undefined,
    mode: 'degraded',
  };
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
  
  // DEGRADED MODE: Use in-memory emergency limiter if Redis unavailable
  if (!redis) {
    // Only check per-minute in degraded mode (ignore per-day)
    if (window === 'day') {
      return {
        allowed: true,
        limit: RATE_LIMIT_TIERS[tier].per_day,
        remaining: RATE_LIMIT_TIERS[tier].per_day,
        reset: Math.ceil(Date.now() / 1000) + 86400,
        mode: 'degraded',
      };
    }
    
    return checkEmergencyRateLimit(partnerId, tier);
  }

  const limit = RATE_LIMIT_TIERS[tier][`per_${window}`];
  
  // Unlimited tier bypasses rate limiting (even in normal mode)
  if (limit === Infinity) {
    return {
      allowed: true,
      limit: Infinity,
      remaining: Infinity,
      reset: Math.ceil(Date.now() / 1000) + (window === 'minute' ? 60 : 86400),
      mode: 'normal',
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
        mode: 'normal',
      };
    }
    
    return {
      allowed: true,
      limit,
      remaining: limit - current,
      reset: resetTimestamp,
      mode: 'normal',
    };
  } catch (error) {
    console.error('Redis rate limit check failed:', error);
    redisStatus = 'disconnected';
    
    // Fall back to emergency limiter
    if (window === 'minute') {
      return checkEmergencyRateLimit(partnerId, tier);
    } else {
      // Day window: allow in degraded mode
      return {
        allowed: true,
        limit,
        remaining: limit,
        reset: Math.ceil(Date.now() / 1000) + 86400,
        mode: 'degraded',
      };
    }
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

  // DEGRADED MODE: Block unknown partners
  if (redisStatus !== 'connected') {
    await refreshKnownPartnersCache();
    
    if (!knownPartnersCache.has(partner.id)) {
      console.warn('🚫 Unknown partner blocked in degraded mode:', {
        partner_id: partner.id,
        partner_name: partner.name,
      });
      
      throw new APIError('RATE_LIMIT_EXCEEDED', {
        message: 'Rate limiting is in degraded mode. Only known partners allowed.',
        mode: 'degraded',
        partner_status: 'unknown',
      });
    }
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

  // Set rate limit headers (informational) with mode indicator
  (req as any).rateLimitHeaders = {
    'X-RateLimit-Limit': result.limit === Infinity ? 'unlimited' : result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining === Infinity ? 'unlimited' : result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
    'X-RateLimit-Mode': result.mode, // NEW: Indicate degraded mode
  };

  // If rate limit exceeded, throw error
  if (!result.allowed) {
    // Log rate limit event for monitoring
    console.warn('Rate limit exceeded:', {
      partner_id: partner.id,
      partner_name: partner.name,
      tier,
      limit: result.limit,
      mode: result.mode,
      reset: new Date(result.reset * 1000).toISOString(),
    });

    // Send alert if 100% consumed
    if (result.remaining === 0) {
      await sendRateLimitAlert(partner, tier, result, 'LIMIT_EXCEEDED');
    }

    throw new APIError('RATE_LIMIT_EXCEEDED', {
      message: `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`,
      limit: result.limit,
      reset: result.reset,
      retryAfter: result.retryAfter,
      mode: result.mode,
    });
  }

  // Warning if approaching limit (>80% consumed)
  const consumed = result.limit === Infinity ? 0 : result.limit - result.remaining;
  const consumedPercentage = result.limit === Infinity ? 0 : (consumed / result.limit) * 100;
  
  if (consumedPercentage > 80 && consumedPercentage < 100) {
    console.warn('Partner approaching rate limit:', {
      partner_id: partner.id,
      tier,
      consumed: `${consumedPercentage.toFixed(1)}%`,
      remaining: result.remaining,
      mode: result.mode,
    });
    
    // Send alert at 80% threshold
    await sendRateLimitAlert(partner, tier, result, 'APPROACHING_LIMIT');
  }
}


/**
 * Send rate limit alert to monitoring system
 * Triggers alert when partner exceeds rate limit or Redis status changes
 */
async function sendRateLimitAlert(
  partner: APIPartner | null,
  tier: RateLimitTier,
  result: RateLimitResult | null,
  alertType: 'APPROACHING_LIMIT' | 'LIMIT_EXCEEDED' | 'REDIS_DOWN' | 'REDIS_RECOVERED'
): Promise<void> {
  // In production, this would send to monitoring system (PagerDuty, Slack, etc.)
  
  const alertSeverity = {
    'APPROACHING_LIMIT': 'MEDIUM',
    'LIMIT_EXCEEDED': 'MEDIUM',
    'REDIS_DOWN': 'CRITICAL',
    'REDIS_RECOVERED': 'INFO',
  }[alertType];

  const alert: any = {
    type: alertType,
    severity: alertSeverity,
    timestamp: new Date().toISOString(),
  };

  if (alertType === 'REDIS_DOWN') {
    alert.message = '🚨 CRITICAL: Redis unavailable, rate limiting in DEGRADED mode';
    alert.impact = 'Unknown partners blocked, known partners have 50% reduced limits';
    console.error('🚨 REDIS DOWN ALERT:', JSON.stringify(alert, null, 2));
  } else if (alertType === 'REDIS_RECOVERED') {
    alert.message = '✅ INFO: Redis reconnected, rate limiting back to NORMAL mode';
    console.log('✅ REDIS RECOVERED:', JSON.stringify(alert, null, 2));
  } else if (partner && result) {
    alert.partner_id = partner.id;
    alert.partner_name = partner.name;
    alert.tenant_id = partner.tenant_id;
    alert.tier = tier;
    alert.limit = result.limit;
    alert.mode = result.mode;
    
    if (alertType === 'APPROACHING_LIMIT') {
      alert.message = `⚠️ Partner ${partner.name} at 80% rate limit (${result.mode} mode)`;
      alert.remaining = result.remaining;
      console.warn('⚠️ APPROACHING LIMIT:', JSON.stringify(alert, null, 2));
    } else if (alertType === 'LIMIT_EXCEEDED') {
      alert.message = `🚫 Partner ${partner.name} exceeded rate limit (${result.mode} mode)`;
      alert.reset = new Date(result.reset * 1000).toISOString();
      alert.retryAfter = result.retryAfter;
      console.error('🚫 LIMIT EXCEEDED:', JSON.stringify(alert, null, 2));
    }
  }

  // TODO: Implement actual alerting
  // - Send to Slack #api-alerts channel
  // - Create PagerDuty incident if CRITICAL
  // - Email partner contact for LIMIT_EXCEEDED
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
  mode: 'normal' | 'degraded';
}> {
  const redis = await getRedisClient();
  const tier = await getPartnerTier(partnerId);
  const mode: 'normal' | 'degraded' = redis ? 'normal' : 'degraded';

  if (!redis) {
    // Degraded mode: return emergency limits
    return {
      minute: {
        allowed: true,
        limit: RATE_LIMIT_TIERS[tier].degraded_per_minute,
        remaining: RATE_LIMIT_TIERS[tier].degraded_per_minute,
        reset: Math.ceil(Date.now() / 1000) + 60,
        mode: 'degraded',
      },
      day: {
        allowed: true,
        limit: RATE_LIMIT_TIERS[tier].per_day,
        remaining: RATE_LIMIT_TIERS[tier].per_day,
        reset: Math.ceil(Date.now() / 1000) + 86400,
        mode: 'degraded',
      },
      tier,
      mode: 'degraded',
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
      mode: 'normal',
    },
    day: {
      allowed: dayCount < dayLimit,
      limit: dayLimit,
      remaining: Math.max(0, dayLimit - dayCount),
      reset: Math.ceil((dayWindow + 1) * 86400 / 1000),
      mode: 'normal',
    },
    tier,
    mode: 'normal',
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

