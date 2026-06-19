/**
 * Rate Limiting Middleware
 * 
 * Implements token bucket algorithm with Redis backend and circuit breaker protection.
 * Enforces per-partner rate limits based on tier (Free, Basic, Pro, Enterprise).
 * 
 * Features:
 * - Token bucket algorithm (smooth rate limiting)
 * - Redis for distributed rate limiting
 * - Circuit breaker (3 failures → OPEN, 2 successes → CLOSED)
 * - Degraded mode with in-memory emergency limiter (when Redis down)
 * - Partner tier-based limits
 * - Endpoint-specific limits (read vs write operations)
 * - X-RateLimit-* response headers
 * - X-RateLimit-Mode header (normal/degraded)
 * - Real-time monitoring alerts (console + TODO: Telegram/Sentry/Email)
 * - Block unknown partners in degraded mode
 * 
 * Circuit Breaker States:
 * - CLOSED: Normal operation, all requests go to Redis
 * - OPEN: Redis unavailable (after 3 consecutive failures in 60s window), use in-memory fallback for 30s
 * - HALF_OPEN: Testing recovery (after 30s), allow limited Redis calls, need 2 successes to close
 * 
 * Degraded Mode Strategy:
 * - Read endpoints: 50% of normal limit
 * - Write endpoints (POST/PUT/PATCH/DELETE, payments, invoices, sync): 20% of normal limit
 * - Unknown partners: blocked entirely
 * - Unlimited tier: capped at 10,000/min read, 5,000/min write
 * 
 * Multi-Instance Warning:
 * When Redis is down, each server instance maintains its own in-memory limiter.
 * Actual total limit = degraded_per_minute × number_of_instances.
 * Example: 3 servers with Free tier (30/min read) = ~90 requests/min total.
 * This is a best-effort fallback, NOT distributed rate limiting.
 * 
 * @module middleware/rate-limit
 */

import { NextRequest, NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { APIError } from '@/types/api-gateway';
import Redis from 'ioredis';
import type { APIPartner } from '@/types/api-gateway';

// Redis client (lazy initialization)
let redisClient: unknown = null;
let redisStatus: 'connected' | 'disconnected' | 'unknown' = 'unknown';
let lastRedisCheckTime = 0;

// Circuit Breaker State
type CircuitState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';
interface CircuitBreakerState {
  state: CircuitState;
  failureCount: number;
  successCount: number;
  lastFailureTime: number;
  nextAttemptTime: number; // When to try HALF_OPEN
}

const circuitBreaker: CircuitBreakerState = {
  state: 'CLOSED',
  failureCount: 0,
  successCount: 0,
  lastFailureTime: 0,
  nextAttemptTime: 0,
};

// Circuit Breaker Configuration
const CIRCUIT_CONFIG = {
  FAILURE_THRESHOLD: 3, // 3 consecutive failures → OPEN
  SUCCESS_THRESHOLD: 2, // 2 consecutive successes in HALF_OPEN → CLOSED
  OPEN_TIMEOUT: 30000, // 30 seconds before trying HALF_OPEN
  FAILURE_WINDOW: 60000, // 60 seconds window for counting failures
} as const;

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
 * 
 * DEGRADED MODE STRATEGY:
 * - Read endpoints: 50% of normal limit
 * - Write endpoints: 20% of normal limit (more restrictive for data safety)
 * - Unknown partners: blocked entirely
 * - Unlimited tier: capped at 10,000/min in degraded mode
 * 
 * MULTI-INSTANCE WARNING:
 * When Redis is down, each server instance maintains its own in-memory limiter.
 * If you run 3 instances, actual limit = degraded_per_minute × 3.
 * Example: Free tier (30/min degraded) × 3 servers = ~90 requests/min total.
 * This is a best-effort fallback, not distributed rate limiting.
 */
export const RATE_LIMIT_TIERS = {
  free: {
    per_minute: 60,
    per_day: 1_000,
    tier_name: 'Free',
    description: 'Testing and small integrations',
    degraded_per_minute_read: 30, // 50% of normal for read operations
    degraded_per_minute_write: 12, // 20% of normal for write operations
  },
  basic: {
    per_minute: 300,
    per_day: 10_000,
    tier_name: 'Basic',
    description: 'Small partners',
    degraded_per_minute_read: 150,
    degraded_per_minute_write: 60,
  },
  pro: {
    per_minute: 1_000,
    per_day: 100_000,
    tier_name: 'Pro',
    description: 'Medium partners',
    degraded_per_minute_read: 500,
    degraded_per_minute_write: 200,
  },
  enterprise: {
    per_minute: 5_000,
    per_day: 1_000_000,
    tier_name: 'Enterprise',
    description: 'Large partners',
    degraded_per_minute_read: 2_500,
    degraded_per_minute_write: 1_000,
  },
  unlimited: {
    per_minute: Infinity,
    per_day: Infinity,
    tier_name: 'Unlimited',
    description: 'Internal Bella services (unlimited in normal mode, capped in degraded mode)',
    degraded_per_minute_read: 10_000, // Even unlimited gets capped in degraded mode
    degraded_per_minute_write: 5_000,
  },
} as const;

/**
 * Classify endpoint as read or write operation
 * Write operations get stricter limits in degraded mode
 */
function classifyEndpoint(req: NextRequest): 'read' | 'write' {
  const method = req.method.toUpperCase();
  const path = new URL(req.url).pathname;
  
  // Write operations (data modification)
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(method)) {
    return 'write';
  }
  
  // Critical write endpoints even if GET (e.g., /api/v1/payments/confirm)
  const writePatterns = [
    '/payments/confirm',
    '/payments/refund',
    '/orders/confirm',
    '/invoices/finalize',
    '/sync',
    '/accounting/entry',
  ];
  
  if (writePatterns.some(pattern => path.includes(pattern))) {
    return 'write';
  }
  
  // Default: read operation
  return 'read';
}

/**
 * Circuit Breaker: Record failure
 */
function recordRedisFailure(): void {
  const now = Date.now();
  
  // Reset counter if outside failure window
  if (now - circuitBreaker.lastFailureTime > CIRCUIT_CONFIG.FAILURE_WINDOW) {
    circuitBreaker.failureCount = 0;
  }
  
  circuitBreaker.failureCount++;
  circuitBreaker.lastFailureTime = now;
  circuitBreaker.successCount = 0; // Reset success counter on failure
  
  console.warn(`⚠️ Redis failure ${circuitBreaker.failureCount}/${CIRCUIT_CONFIG.FAILURE_THRESHOLD}`, {
    state: circuitBreaker.state,
    failureWindow: CIRCUIT_CONFIG.FAILURE_WINDOW / 1000 + 's',
  });
  
  // Transition to OPEN after threshold failures
  if (circuitBreaker.failureCount >= CIRCUIT_CONFIG.FAILURE_THRESHOLD && circuitBreaker.state !== 'OPEN') {
    circuitBreaker.state = 'OPEN';
    circuitBreaker.nextAttemptTime = now + CIRCUIT_CONFIG.OPEN_TIMEOUT;
    redisStatus = 'disconnected';
    
    console.error('🚨 Circuit breaker OPENED: Redis marked unavailable', {
      failures: circuitBreaker.failureCount,
      nextAttempt: new Date(circuitBreaker.nextAttemptTime).toISOString(),
    });
    
    // Send critical alert
    sendRateLimitAlert(null as unknown, 'free', null as unknown, 'REDIS_DOWN').catch(console.error);
  }
}

/**
 * Circuit Breaker: Record success
 */
function recordRedisSuccess(): void {
  circuitBreaker.successCount++;
  circuitBreaker.failureCount = 0; // Reset failure counter on success
  
  if (circuitBreaker.state === 'HALF_OPEN') {
    console.log(`✅ Redis success ${circuitBreaker.successCount}/${CIRCUIT_CONFIG.SUCCESS_THRESHOLD} in HALF_OPEN`);
    
    // Transition to CLOSED after threshold successes
    if (circuitBreaker.successCount >= CIRCUIT_CONFIG.SUCCESS_THRESHOLD) {
      circuitBreaker.state = 'CLOSED';
      redisStatus = 'connected';
      
      console.log('✅ Circuit breaker CLOSED: Redis fully recovered', {
        successes: circuitBreaker.successCount,
      });
      
      // Send recovery alert
      sendRateLimitAlert(null as unknown, 'free', null as unknown, 'REDIS_RECOVERED').catch(console.error);
    }
  } else if (circuitBreaker.state === 'OPEN') {
    // First success after OPEN → HALF_OPEN
    circuitBreaker.state = 'HALF_OPEN';
    circuitBreaker.successCount = 1;
    console.log('🔄 Circuit breaker → HALF_OPEN: Testing Redis recovery');
  } else {
    // Already CLOSED, just ensure status is correct
    redisStatus = 'connected';
  }
}

/**
 * Circuit Breaker: Check if should attempt Redis call
 */
function shouldAttemptRedis(): boolean {
  const now = Date.now();
  
  switch (circuitBreaker.state) {
    case 'CLOSED':
      // Normal operation, always attempt
      return true;
      
    case 'OPEN':
      // Check if enough time passed to try HALF_OPEN
      if (now >= circuitBreaker.nextAttemptTime) {
        circuitBreaker.state = 'HALF_OPEN';
        circuitBreaker.successCount = 0;
        console.log('🔄 Circuit breaker → HALF_OPEN: Attempting reconnection');
        return true;
      }
      // Still in OPEN state, don't attempt
      return false;
      
    case 'HALF_OPEN':
      // Allow attempts to test recovery
      return true;
  }
}

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
  mode: 'normal' | 'degraded';
  circuitState?: CircuitState; // Circuit breaker state for monitoring
}

/**
 * Initialize Redis client with circuit breaker protection
 * Uses environment variables for connection
 */
async function getRedisClient() {
  // Circuit breaker: Don't attempt if OPEN
  if (!shouldAttemptRedis()) {
    return null;
  }
  
  if (redisClient) {
    // Periodic health check (every 30 seconds)
    const now = Date.now();
    if (now - lastRedisCheckTime > 30000) {
      lastRedisCheckTime = now;
      try {
        await redisClient.ping();
        recordRedisSuccess();
      } catch (error) {
        console.error('❌ Redis health check failed:', error);
        recordRedisFailure();
        return null;
      }
    }
    return redisClient;
  }

  // Check if Redis is configured
  const redisUrl = process.env.REDIS_URL;
  if (!redisUrl) {
    console.warn('⚠️ REDIS_URL not configured, rate limiting will use degraded mode');
    circuitBreaker.state = 'OPEN';
    redisStatus = 'disconnected';
    return null;
  }

  try {
    // Use ioredis for Redis connection
    redisClient = new Redis(redisUrl, {
      maxRetriesPerRequest: 3,
      enableReadyCheck: true,
      lazyConnect: true,
      connectTimeout: 5000, // 5 second timeout
    });

    await redisClient.connect();
    recordRedisSuccess();
    console.log('✅ Redis connected for rate limiting');
    return redisClient;
  } catch (error) {
    console.error('❌ Failed to connect to Redis:', error);
    recordRedisFailure();
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
 * Differentiates between read and write operations
 */
function checkEmergencyRateLimit(
  partnerId: string,
  tier: RateLimitTier,
  operation: 'read' | 'write'
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
  
  // Use degraded limit based on operation type
  const limitKey = operation === 'read' ? 'degraded_per_minute_read' : 'degraded_per_minute_write';
  const limit = RATE_LIMIT_TIERS[tier][limitKey];
  const remaining = Math.max(0, limit - counter.count);
  const resetTimestamp = Math.ceil((windowStart + 60000) / 1000);
  
  return {
    allowed: counter.count <= limit,
    limit,
    remaining,
    reset: resetTimestamp,
    retryAfter: counter.count > limit ? Math.ceil((windowStart + 60000 - now) / 1000) : undefined,
    mode: 'degraded',
    circuitState: circuitBreaker.state,
  };
}

/**
 * Check rate limit using token bucket algorithm
 * 
 * @param partnerId - Partner UUID
 * @param tier - Rate limit tier (free, basic, pro, enterprise, unlimited)
 * @param window - Time window ('minute' or 'day')
 * @param operation - Operation type ('read' or 'write') for degraded mode
 * @returns Rate limit result
 */
async function checkRateLimit(
  partnerId: string,
  tier: RateLimitTier,
  window: 'minute' | 'day',
  operation: 'read' | 'write'
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
        circuitState: circuitBreaker.state,
      };
    }
    
    return checkEmergencyRateLimit(partnerId, tier, operation);
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
      circuitState: circuitBreaker.state,
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
    
    // Record success for circuit breaker
    recordRedisSuccess();
    
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
        circuitState: circuitBreaker.state,
      };
    }
    
    return {
      allowed: true,
      limit,
      remaining: limit - current,
      reset: resetTimestamp,
      mode: 'normal',
      circuitState: circuitBreaker.state,
    };
  } catch (error) {
    console.error('Redis rate limit check failed:', error);
    recordRedisFailure();
    
    // Fall back to emergency limiter
    if (window === 'minute') {
      return checkEmergencyRateLimit(partnerId, tier, operation);
    } else {
      // Day window: allow in degraded mode
      return {
        allowed: true,
        limit,
        remaining: limit,
        reset: Math.ceil(Date.now() / 1000) + 86400,
        mode: 'degraded',
        circuitState: circuitBreaker.state,
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
 * Classifies endpoints as read/write for degraded mode
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
  const partner = (req as unknown).partner as APIPartner | undefined;
  
  if (!partner) {
    throw new APIError(
      'SERVER_001',
      'Partner not set. Ensure withAPIKey() is called before rateLimitMiddleware()'
    );
  }

  // Classify endpoint as read or write
  const operation = classifyEndpoint(req);

  // DEGRADED MODE: Block unknown partners
  if (circuitBreaker.state !== 'CLOSED') {
    await refreshKnownPartnersCache();
    
    if (!knownPartnersCache.has(partner.id)) {
      console.warn('🚫 Unknown partner blocked in degraded mode:', {
        partner_id: partner.id,
        partner_name: partner.partner_name,
        circuit_state: circuitBreaker.state,
      });
      
      throw new APIError(
        'RATE_LIMIT_EXCEEDED',
        'Rate limiting is in degraded mode. Only known partners allowed.',
        {
          mode: 'degraded',
          partner_status: 'unknown',
          circuit_state: circuitBreaker.state,
        },
        503
      );
    }
  }

  // Get partner's tier
  const tier = await getPartnerTier(partner.id);

  // Check per-minute limit
  const minuteResult = await checkRateLimit(partner.id, tier, 'minute', operation);
  
  // Check per-day limit
  const dayResult = await checkRateLimit(partner.id, tier, 'day', operation);

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

  // Set rate limit headers (informational) with mode and circuit state
  (req as unknown).rateLimitHeaders = {
    'X-RateLimit-Limit': result.limit === Infinity ? 'unlimited' : result.limit.toString(),
    'X-RateLimit-Remaining': result.remaining === Infinity ? 'unlimited' : result.remaining.toString(),
    'X-RateLimit-Reset': result.reset.toString(),
    'X-RateLimit-Mode': result.mode,
    'X-RateLimit-Operation': operation, // NEW: Indicate if read or write
  };

  // If rate limit exceeded, throw error
  if (!result.allowed) {
    // Log rate limit event for monitoring
    console.warn('Rate limit exceeded:', {
      partner_id: partner.id,
      partner_name: partner.partner_name,
      tier,
      operation,
      limit: result.limit,
      mode: result.mode,
      circuit_state: result.circuitState,
      reset: new Date(result.reset * 1000).toISOString(),
    });

    // Send alert if 100% consumed
    if (result.remaining === 0) {
      await sendRateLimitAlert(partner, tier, result, 'LIMIT_EXCEEDED');
    }

    throw new APIError(
      'RATE_LIMIT_EXCEEDED',
      `Rate limit exceeded. Please retry after ${result.retryAfter} seconds.`,
      {
        limit: result.limit,
        reset: result.reset,
        retryAfter: result.retryAfter,
        mode: result.mode,
        operation,
        circuit_state: result.circuitState,
      },
      429
    );
  }

  // Warning if approaching limit (>80% consumed)
  const consumed = result.limit === Infinity ? 0 : result.limit - result.remaining;
  const consumedPercentage = result.limit === Infinity ? 0 : (consumed / result.limit) * 100;
  
  if (consumedPercentage > 80 && consumedPercentage < 100) {
    console.warn('Partner approaching rate limit:', {
      partner_id: partner.id,
      tier,
      operation,
      consumed: `${consumedPercentage.toFixed(1)}%`,
      remaining: result.remaining,
      mode: result.mode,
      circuit_state: result.circuitState,
    });
    
    // Send alert at 80% threshold
    await sendRateLimitAlert(partner, tier, result, 'APPROACHING_LIMIT');
  }
}


/**
 * Send rate limit alert to monitoring system
 * Triggers alert when partner exceeds rate limit or Redis status changes
 * 
 * ALERT INTEGRATIONS:
 * - Console logs (always)
 * - Telegram: TODO - Send to @bella_alerts_bot
 * - Sentry: TODO - Create Sentry event with severity
 * - Email: TODO - Send to ops@bella.vn for CRITICAL alerts
 * - Database: TODO - Store in security_events table
 */
async function sendRateLimitAlert(
  partner: APIPartner | null,
  tier: RateLimitTier,
  result: RateLimitResult | null,
  alertType: 'APPROACHING_LIMIT' | 'LIMIT_EXCEEDED' | 'REDIS_DOWN' | 'REDIS_RECOVERED'
): Promise<void> {
  const alertSeverity = {
    'APPROACHING_LIMIT': 'MEDIUM',
    'LIMIT_EXCEEDED': 'MEDIUM',
    'REDIS_DOWN': 'CRITICAL',
    'REDIS_RECOVERED': 'INFO',
  }[alertType];

  const alert: unknown = {
    type: alertType,
    severity: alertSeverity,
    timestamp: new Date().toISOString(),
    circuit_state: circuitBreaker.state,
    failure_count: circuitBreaker.failureCount,
    success_count: circuitBreaker.successCount,
  };

  if (alertType === 'REDIS_DOWN') {
    alert.message = '🚨 CRITICAL: Redis unavailable after 3 consecutive failures';
    alert.impact = 'Unknown partners blocked, known partners have reduced limits (read: 50%, write: 20%)';
    alert.next_attempt = new Date(circuitBreaker.nextAttemptTime).toISOString();
    console.error('🚨 REDIS DOWN ALERT:', JSON.stringify(alert, null, 2));
    
    // TODO: Send critical alerts
    // await sendTelegramAlert(alert);
    // await sendSentryEvent('error', alert);
    // await sendEmailAlert('ops@bella.vn', alert);
    
  } else if (alertType === 'REDIS_RECOVERED') {
    alert.message = '✅ INFO: Redis fully recovered after 2 consecutive successes';
    alert.recovery_time = new Date().toISOString();
    console.log('✅ REDIS RECOVERED:', JSON.stringify(alert, null, 2));
    
    // TODO: Send recovery notification
    // await sendTelegramAlert(alert);
    // await sendSentryEvent('info', alert);
    
  } else if (partner && result) {
    alert.partner_id = partner.id;
    alert.partner_name = partner.partner_name;
    alert.tenant_id = partner.tenant_id;
    alert.tier = tier;
    alert.limit = result.limit;
    alert.mode = result.mode;
    
    if (alertType === 'APPROACHING_LIMIT') {
      alert.message = `⚠️ Partner ${partner.partner_name} at 80% rate limit (${result.mode} mode)`;
      alert.remaining = result.remaining;
      alert.consumed_percentage = ((result.limit - result.remaining) / result.limit * 100).toFixed(1) + '%';
      console.warn('⚠️ APPROACHING LIMIT:', JSON.stringify(alert, null, 2));
      
      // TODO: Notify partner
      // await sendPartnerEmailWarning(partner, alert);
      
    } else if (alertType === 'LIMIT_EXCEEDED') {
      alert.message = `🚫 Partner ${partner.partner_name} exceeded rate limit (${result.mode} mode)`;
      alert.reset = new Date(result.reset * 1000).toISOString();
      alert.retryAfter = result.retryAfter;
      console.error('🚫 LIMIT EXCEEDED:', JSON.stringify(alert, null, 2));
      
      // TODO: Notify partner and log security event
      // await sendPartnerEmailBlocked(partner, alert);
      // await logSecurityEvent('rate_limit_exceeded', alert);
    }
  }

  // TODO: Store all alerts in database for audit trail
  // await storeAlert(alert);
}

/**
 * TODO: Telegram Integration
 * Send alert to Telegram channel via bot
 */
async function sendTelegramAlert(alert: unknown): Promise<void> {
  // Implementation:
  // const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
  // const TELEGRAM_CHAT_ID = process.env.TELEGRAM_ALERTS_CHAT_ID;
  // 
  // await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
  //   method: 'POST',
  //   headers: { 'Content-Type': 'application/json' },
  //   body: JSON.stringify({
  //     chat_id: TELEGRAM_CHAT_ID,
  //     text: `${alert.message}\n\nSeverity: ${alert.severity}\nTime: ${alert.timestamp}`,
  //     parse_mode: 'Markdown',
  //   }),
  // });
}

/**
 * TODO: Sentry Integration
 * Create Sentry event with proper severity
 */
async function sendSentryEvent(level: 'error' | 'warning' | 'info', alert: unknown): Promise<void> {
  // Implementation:
  // const Sentry = require('@sentry/node');
  // 
  // Sentry.captureMessage(alert.message, {
  //   level,
  //   tags: {
  //     alert_type: alert.type,
  //     circuit_state: alert.circuit_state,
  //   },
  //   extra: alert,
  // });
}

/**
 * TODO: Email Integration
 * Send email alert for critical issues
 */
async function sendEmailAlert(to: string, alert: unknown): Promise<void> {
  // Implementation using SendGrid, AWS SES, or similar:
  // const sgMail = require('@sendgrid/mail');
  // sgMail.setApiKey(process.env.SENDGRID_API_KEY);
  // 
  // await sgMail.send({
  //   to,
  //   from: 'alerts@bella.vn',
  //   subject: `[${alert.severity}] ${alert.type}`,
  //   text: JSON.stringify(alert, null, 2),
  //   html: `<pre>${JSON.stringify(alert, null, 2)}</pre>`,
  // });
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
  circuit_state: CircuitState;
}> {
  const redis = await getRedisClient();
  const tier = await getPartnerTier(partnerId);
  const mode: 'normal' | 'degraded' = redis ? 'normal' : 'degraded';

  if (!redis) {
    // Degraded mode: return emergency limits (using read limits as default)
    return {
      minute: {
        allowed: true,
        limit: RATE_LIMIT_TIERS[tier].degraded_per_minute_read,
        remaining: RATE_LIMIT_TIERS[tier].degraded_per_minute_read,
        reset: Math.ceil(Date.now() / 1000) + 60,
        mode: 'degraded',
        circuitState: circuitBreaker.state,
      },
      day: {
        allowed: true,
        limit: RATE_LIMIT_TIERS[tier].per_day,
        remaining: RATE_LIMIT_TIERS[tier].per_day,
        reset: Math.ceil(Date.now() / 1000) + 86400,
        mode: 'degraded',
        circuitState: circuitBreaker.state,
      },
      tier,
      mode: 'degraded',
      circuit_state: circuitBreaker.state,
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
      circuitState: circuitBreaker.state,
    },
    day: {
      allowed: dayCount < dayLimit,
      limit: dayLimit,
      remaining: Math.max(0, dayLimit - dayCount),
      reset: Math.ceil((dayWindow + 1) * 86400 / 1000),
      mode: 'normal',
      circuitState: circuitBreaker.state,
    },
    tier,
    mode: 'normal',
    circuit_state: circuitBreaker.state,
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
  const headers = (req as unknown).rateLimitHeaders as Record<string, string> | undefined;
  
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

