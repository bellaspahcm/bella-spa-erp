/**
 * Rate Limit Middleware Tests
 * 
 * Tests for token bucket rate limiting with Redis backend
 * Covers all tiers, graceful degradation, and edge cases
 */

import { NextRequest } from 'next/server';
import {
  rateLimitMiddleware,
  getPartnerUsageStats,
  RATE_LIMIT_TIERS,
} from '@/lib/middleware/rate-limit.middleware';
import { APIError } from '@/lib/errors/api-error';
import type { APIPartner } from '@/types/api-gateway';

// Mock Redis client
let mockRedisData: Record<string, number> = {};
let mockRedisAvailable = true;

jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    connect: jest.fn().mockResolvedValue(undefined),
    incr: jest.fn((key: string) => {
      if (!mockRedisAvailable) throw new Error('Redis unavailable');
      mockRedisData[key] = (mockRedisData[key] || 0) + 1;
      return Promise.resolve(mockRedisData[key]);
    }),
    expire: jest.fn().mockResolvedValue(1),
    get: jest.fn((key: string) => Promise.resolve(mockRedisData[key]?.toString() || null)),
  }));
});

// Mock Supabase
jest.mock('@supabase/supabase-js', () => ({
  createClient: jest.fn(() => ({
    from: jest.fn(() => ({
      select: jest.fn(() => ({
        eq: jest.fn(() => ({
          single: jest.fn(() => Promise.resolve({
            data: { rate_limit_tier: 'free' },
            error: null,
          })),
        })),
      })),
    })),
  })),
}));

describe('Rate Limit Middleware', () => {
  beforeEach(() => {
    // Reset Redis mock data
    mockRedisData = {};
    mockRedisAvailable = true;
    
    // Mock environment variables
    process.env.REDIS_URL = 'redis://localhost:6379';
  });

  describe('Rate Limit Tiers', () => {
    it('defines correct limits for free tier', () => {
      expect(RATE_LIMIT_TIERS.free).toEqual({
        per_minute: 60,
        per_day: 1_000,
        tier_name: 'Free',
        description: 'Testing and small integrations',
      });
    });

    it('defines correct limits for basic tier', () => {
      expect(RATE_LIMIT_TIERS.basic).toEqual({
        per_minute: 300,
        per_day: 10_000,
        tier_name: 'Basic',
        description: 'Small partners',
      });
    });

    it('defines correct limits for pro tier', () => {
      expect(RATE_LIMIT_TIERS.pro).toEqual({
        per_minute: 1_000,
        per_day: 100_000,
        tier_name: 'Pro',
        description: 'Medium partners',
      });
    });

    it('defines correct limits for enterprise tier', () => {
      expect(RATE_LIMIT_TIERS.enterprise).toEqual({
        per_minute: 5_000,
        per_day: 1_000_000,
        tier_name: 'Enterprise',
        description: 'Large partners',
      });
    });

    it('defines unlimited tier with Infinity limits', () => {
      expect(RATE_LIMIT_TIERS.unlimited.per_minute).toBe(Infinity);
      expect(RATE_LIMIT_TIERS.unlimited.per_day).toBe(Infinity);
    });
  });

  describe('Basic Rate Limiting', () => {
    it('allows first request within limit', async () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-1',
        name: 'Test Partner',
      } as APIPartner;

      await expect(rateLimitMiddleware(req)).resolves.not.toThrow();
    });

    it('tracks request count correctly', async () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-2',
        name: 'Test Partner 2',
      } as APIPartner;

      // Make 3 requests
      await rateLimitMiddleware(req);
      await rateLimitMiddleware(req);
      await rateLimitMiddleware(req);

      // Check Redis has correct count (should be 3)
      const keys = Object.keys(mockRedisData).filter(k => k.includes('partner-2'));
      expect(keys.length).toBeGreaterThan(0);
      expect(mockRedisData[keys[0]]).toBe(3);
    });

    it('sets rate limit headers on request', async () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-3',
        name: 'Test Partner 3',
      } as APIPartner;

      await rateLimitMiddleware(req);

      const headers = (req as any).rateLimitHeaders;
      expect(headers).toBeDefined();
      expect(headers['X-RateLimit-Limit']).toBe('60'); // Free tier per minute
      expect(headers['X-RateLimit-Remaining']).toBe('59'); // 60 - 1
      expect(headers['X-RateLimit-Reset']).toBeDefined();
    });
  });


  describe('Rate Limit Enforcement', () => {
    it('blocks request when per-minute limit exceeded', async () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-rate-limit',
        name: 'Test Partner',
      } as APIPartner;

      // Free tier: 60 requests per minute
      // Make 60 requests (should all succeed)
      for (let i = 0; i < 60; i++) {
        await rateLimitMiddleware(req);
      }

      // 61st request should fail
      await expect(rateLimitMiddleware(req)).rejects.toThrow(APIError);
      await expect(rateLimitMiddleware(req)).rejects.toThrow('RATE_LIMIT_EXCEEDED');
    });

    it('includes retry-after in error when limit exceeded', async () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-retry',
        name: 'Test Partner',
      } as APIPartner;

      // Exceed limit
      for (let i = 0; i < 61; i++) {
        try {
          await rateLimitMiddleware(req);
        } catch (error) {
          if (i === 60) {
            // Last request should fail
            expect(error).toBeInstanceOf(APIError);
            const apiError = error as APIError;
            expect(apiError.code).toBe('RATE_LIMIT_EXCEEDED');
            expect(apiError.details?.retryAfter).toBeDefined();
            expect(typeof apiError.details?.retryAfter).toBe('number');
          }
        }
      }
    });

    it('resets counter after time window expires', async () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-reset',
        name: 'Test Partner',
      } as APIPartner;

      // Make requests until limit
      for (let i = 0; i < 60; i++) {
        await rateLimitMiddleware(req);
      }

      // 61st should fail
      await expect(rateLimitMiddleware(req)).rejects.toThrow();

      // Simulate time window change (clear Redis)
      mockRedisData = {};

      // New request should succeed (new window)
      await expect(rateLimitMiddleware(req)).resolves.not.toThrow();
    });
  });

  describe('Tier-Specific Limits', () => {
    it('enforces different limits for different tiers', async () => {
      // Create mock for different tiers
      const mockSupabase = require('@supabase/supabase-js');
      
      // Pro tier partner (1000 req/min)
      mockSupabase.createClient.mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: { rate_limit_tier: 'pro' },
                error: null,
              })),
            })),
          })),
        })),
      });

      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-pro',
        name: 'Pro Partner',
      } as APIPartner;

      // Should allow more requests than free tier
      for (let i = 0; i < 100; i++) {
        await rateLimitMiddleware(req);
      }

      const headers = (req as any).rateLimitHeaders;
      expect(headers['X-RateLimit-Limit']).toBe('1000'); // Pro tier limit
    });

    it('allows unlimited requests for unlimited tier', async () => {
      const mockSupabase = require('@supabase/supabase-js');
      
      mockSupabase.createClient.mockReturnValue({
        from: jest.fn(() => ({
          select: jest.fn(() => ({
            eq: jest.fn(() => ({
              single: jest.fn(() => Promise.resolve({
                data: { rate_limit_tier: 'unlimited' },
                error: null,
              })),
            })),
          })),
        })),
      });

      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-unlimited',
        name: 'Unlimited Partner',
      } as APIPartner;

      // Should never throw
      for (let i = 0; i < 10000; i++) {
        await rateLimitMiddleware(req);
      }

      const headers = (req as any).rateLimitHeaders;
      expect(headers['X-RateLimit-Limit']).toBe('Infinity');
    });
  });


  describe('Graceful Degradation', () => {
    it('allows request when Redis is unavailable (fail open)', async () => {
      // Simulate Redis failure
      mockRedisAvailable = false;

      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-no-redis',
        name: 'Test Partner',
      } as APIPartner;

      // Should not throw even without Redis
      await expect(rateLimitMiddleware(req)).resolves.not.toThrow();
    });

    it('logs warning when Redis fails', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      mockRedisAvailable = false;

      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-redis-fail',
        name: 'Test Partner',
      } as APIPartner;

      await rateLimitMiddleware(req);

      // Should have logged warning about Redis
      expect(consoleWarnSpy).toHaveBeenCalled();
      
      consoleWarnSpy.mockRestore();
    });

    it('falls back to in-memory when REDIS_URL not set', async () => {
      delete process.env.REDIS_URL;

      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-no-url',
        name: 'Test Partner',
      } as APIPartner;

      // Should still work (in-memory fallback)
      await expect(rateLimitMiddleware(req)).resolves.not.toThrow();
    });
  });

  describe('Edge Cases', () => {
    it('throws error if partner not set', async () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      // No partner set

      await expect(rateLimitMiddleware(req)).rejects.toThrow('INTERNAL_ERROR');
      await expect(rateLimitMiddleware(req)).rejects.toThrow('Partner not set');
    });

    it('handles concurrent requests correctly', async () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-concurrent',
        name: 'Test Partner',
      } as APIPartner;

      // Make 10 concurrent requests
      const promises = Array(10).fill(null).map(() => rateLimitMiddleware(req));
      
      // All should succeed (within limit)
      await expect(Promise.all(promises)).resolves.toBeDefined();
      
      // Check count is correct (should be 10)
      const keys = Object.keys(mockRedisData).filter(k => k.includes('partner-concurrent'));
      expect(mockRedisData[keys[0]]).toBe(10);
    });

    it('tracks separate counters for different time windows', async () => {
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-windows',
        name: 'Test Partner',
      } as APIPartner;

      // Make request
      await rateLimitMiddleware(req);

      // Should have 2 keys (minute and day)
      const keys = Object.keys(mockRedisData).filter(k => k.includes('partner-windows'));
      expect(keys.length).toBe(2);
      expect(keys.some(k => k.includes(':minute:'))).toBe(true);
      expect(keys.some(k => k.includes(':day:'))).toBe(true);
    });
  });

  describe('Usage Statistics', () => {
    it('returns current usage stats', async () => {
      const partnerId = 'partner-stats';
      
      // Make some requests
      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: partnerId,
        name: 'Test Partner',
      } as APIPartner;

      await rateLimitMiddleware(req);
      await rateLimitMiddleware(req);
      await rateLimitMiddleware(req);

      // Get stats
      const stats = await getPartnerUsageStats(partnerId);

      expect(stats.tier).toBe('free');
      expect(stats.minute.limit).toBe(60);
      expect(stats.minute.remaining).toBe(57); // 60 - 3
      expect(stats.day.limit).toBe(1000);
      expect(stats.day.remaining).toBe(997); // 1000 - 3
    });

    it('handles stats request when Redis unavailable', async () => {
      mockRedisAvailable = false;

      const stats = await getPartnerUsageStats('partner-no-redis-stats');

      // Should return default limits
      expect(stats.tier).toBe('free');
      expect(stats.minute.remaining).toBe(60);
      expect(stats.day.remaining).toBe(1000);
    });
  });

  describe('Monitoring & Alerts', () => {
    it('logs warning when approaching limit (>80%)', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-warning',
        name: 'Test Partner',
      } as APIPartner;

      // Make 50 requests (83% of 60)
      for (let i = 0; i < 50; i++) {
        await rateLimitMiddleware(req);
      }

      // Should have logged warning
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        expect.stringContaining('approaching rate limit'),
        expect.any(Object)
      );

      consoleWarnSpy.mockRestore();
    });

    it('logs alert when limit exceeded', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();

      const req = new NextRequest('https://api.bella.vn/v1/orders');
      (req as any).partner = {
        id: 'partner-alert',
        name: 'Test Partner',
      } as APIPartner;

      // Exceed limit
      for (let i = 0; i < 61; i++) {
        try {
          await rateLimitMiddleware(req);
        } catch (error) {
          // Expected on 61st request
        }
      }

      // Should have logged alert
      expect(consoleWarnSpy).toHaveBeenCalledWith(
        'Rate limit exceeded:',
        expect.any(Object)
      );

      consoleErrorSpy.mockRestore();
      consoleWarnSpy.mockRestore();
    });
  });
});
