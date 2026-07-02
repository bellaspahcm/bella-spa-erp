/**
 * Marketing Intelligence Connectors Tests
 * 
 * Tests for external ad platform connectors:
 * - Facebook Ads Connector
 * - Zalo OA Connector
 * - Marketing Service sync operations
 * - Cache layer functionality
 * 
 * @created 2026-06-22
 * @phase Intelligence Layer Priority 2 Task #4
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import { createFacebookAdsConnector, FacebookAdsConnector } from '../connectors/facebook-ads';
import { createZaloOAConnector, ZaloOAConnector } from '../connectors/zalo-oa';
import { InMemoryCache, createCacheKey } from '../cache';

describe('Facebook Ads Connector', () => {
  let connector: FacebookAdsConnector;

  beforeEach(() => {
    connector = createFacebookAdsConnector({
      accessToken: 'mock_access_token',
      adAccountId: 'act_123456789',
    });
  });

  it('should create connector instance', () => {
    expect(connector).toBeInstanceOf(FacebookAdsConnector);
  });

  it('should fetch insights with mock data', async () => {
    const insights = await connector.fetchInsights('2026-06-01', '2026-06-07');
    
    expect(insights).toBeDefined();
    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBeGreaterThan(0);
    
    // Verify insight structure
    const firstInsight = insights[0];
    expect(firstInsight).toHaveProperty('date');
    expect(firstInsight).toHaveProperty('campaignId');
    expect(firstInsight).toHaveProperty('campaignName');
    expect(firstInsight).toHaveProperty('impressions');
    expect(firstInsight).toHaveProperty('clicks');
    expect(firstInsight).toHaveProperty('spend');
    expect(firstInsight).toHaveProperty('conversions');
    expect(firstInsight).toHaveProperty('revenue');
    expect(firstInsight).toHaveProperty('ctr');
    expect(firstInsight).toHaveProperty('cpc');
    expect(firstInsight).toHaveProperty('roas');
    
    // Verify metrics are positive numbers
    expect(firstInsight.impressions).toBeGreaterThan(0);
    expect(firstInsight.clicks).toBeGreaterThan(0);
    expect(firstInsight.spend).toBeGreaterThan(0);
    expect(firstInsight.conversions).toBeGreaterThanOrEqual(0);
    expect(firstInsight.revenue).toBeGreaterThanOrEqual(0);
    
    // Verify calculated metrics
    expect(firstInsight.ctr).toBeGreaterThan(0);
    expect(firstInsight.cpc).toBeGreaterThan(0);
  });

  it('should validate credentials (mock)', async () => {
    const isValid = await connector.validateCredentials();
    expect(isValid).toBe(true);
  });

  it('should get account info (mock)', async () => {
    const accountInfo = await connector.getAccountInfo();
    
    expect(accountInfo).toBeDefined();
    expect(accountInfo).toHaveProperty('id');
    expect(accountInfo).toHaveProperty('name');
    expect(accountInfo).toHaveProperty('currency');
    expect(accountInfo).toHaveProperty('status');
    expect(accountInfo).toHaveProperty('timezone');
    
    expect(accountInfo.id).toBe('act_123456789');
    expect(accountInfo.currency).toBe('VND');
    expect(accountInfo.status).toBe('ACTIVE');
  });

  it('should generate data for multiple days', async () => {
    const insights = await connector.fetchInsights('2026-06-01', '2026-06-07');
    
    // Should have data for 7 days x 2 campaigns = 14 records
    expect(insights.length).toBe(14);
    
    // Verify date range
    const dates = new Set(insights.map(i => i.date));
    expect(dates.size).toBe(7); // 7 unique dates
  });

  it('should have consistent metrics across insights', async () => {
    const insights = await connector.fetchInsights('2026-06-01', '2026-06-01');
    
    for (const insight of insights) {
      // CTR should match: (clicks / impressions) * 100
      const expectedCTR = (insight.clicks / insight.impressions) * 100;
      expect(insight.ctr).toBeCloseTo(expectedCTR, 3); // Reduced precision for floating point
      
      // CPC should match: spend / clicks
      const expectedCPC = insight.spend / insight.clicks;
      expect(insight.cpc).toBeCloseTo(expectedCPC, 3);
      
      // CPA should match: spend / conversions (if conversions > 0)
      if (insight.conversions > 0) {
        const expectedCPA = insight.spend / insight.conversions;
        expect(insight.cpa).toBeCloseTo(expectedCPA, 3);
      }
      
      // ROAS should match: revenue / spend (if spend > 0)
      if (insight.spend > 0) {
        const expectedROAS = insight.revenue / insight.spend;
        expect(insight.roas).toBeCloseTo(expectedROAS, 3);
      }
    }
  });
});

describe('Zalo OA Connector', () => {
  let connector: ZaloOAConnector;

  beforeEach(() => {
    connector = createZaloOAConnector({
      accessToken: 'mock_zalo_access_token',
      oaId: 'oa_123456789',
      secretKey: 'mock_secret_key',
    });
  });

  it('should create connector instance', () => {
    expect(connector).toBeInstanceOf(ZaloOAConnector);
  });

  it('should fetch OA insights with mock data', async () => {
    const insights = await connector.fetchOAInsights('2026-06-01', '2026-06-07');
    
    expect(insights).toBeDefined();
    expect(Array.isArray(insights)).toBe(true);
    expect(insights.length).toBe(7); // 7 days
    
    // Verify insight structure
    const firstInsight = insights[0];
    expect(firstInsight).toHaveProperty('date');
    expect(firstInsight).toHaveProperty('oaId');
    expect(firstInsight).toHaveProperty('oaName');
    
    // Follower metrics
    expect(firstInsight).toHaveProperty('totalFollowers');
    expect(firstInsight).toHaveProperty('newFollowers');
    expect(firstInsight).toHaveProperty('unfollowers');
    
    // Message metrics
    expect(firstInsight).toHaveProperty('messagesSent');
    expect(firstInsight).toHaveProperty('messagesDelivered');
    expect(firstInsight).toHaveProperty('messagesRead');
    expect(firstInsight).toHaveProperty('messageClicks');
    
    // Article metrics
    expect(firstInsight).toHaveProperty('articlesPublished');
    expect(firstInsight).toHaveProperty('articleViews');
    expect(firstInsight).toHaveProperty('articleShares');
    expect(firstInsight).toHaveProperty('articleInteractions');
    
    // Mini Program metrics
    expect(firstInsight).toHaveProperty('miniProgramVisits');
    expect(firstInsight).toHaveProperty('miniProgramConversions');
    
    // Transaction metrics
    expect(firstInsight).toHaveProperty('transactions');
    expect(firstInsight).toHaveProperty('revenue');
    
    // Engagement metrics
    expect(firstInsight).toHaveProperty('engagementRate');
    expect(firstInsight).toHaveProperty('clickThroughRate');
    expect(firstInsight).toHaveProperty('conversionRate');
  });

  it('should validate credentials (mock)', async () => {
    const isValid = await connector.validateCredentials();
    expect(isValid).toBe(true);
  });

  it('should get account info (mock)', async () => {
    const accountInfo = await connector.getAccountInfo();
    
    expect(accountInfo).toBeDefined();
    expect(accountInfo).toHaveProperty('oaId');
    expect(accountInfo).toHaveProperty('name');
    expect(accountInfo).toHaveProperty('description');
    expect(accountInfo).toHaveProperty('avatar');
    expect(accountInfo).toHaveProperty('followerCount');
    expect(accountInfo).toHaveProperty('isVerified');
    
    expect(accountInfo.oaId).toBe('oa_123456789');
    expect(accountInfo.isVerified).toBe(true);
  });

  it('should have realistic message delivery rate', async () => {
    const insights = await connector.fetchOAInsights('2026-06-01', '2026-06-01');
    const insight = insights[0];
    
    // Delivery rate should be between 95-99%
    const deliveryRate = (insight.messagesDelivered / insight.messagesSent) * 100;
    expect(deliveryRate).toBeGreaterThanOrEqual(95);
    expect(deliveryRate).toBeLessThanOrEqual(99);
    
    // Read rate should be between 70-90% of delivered
    const readRate = (insight.messagesRead / insight.messagesDelivered) * 100;
    expect(readRate).toBeGreaterThanOrEqual(70);
    expect(readRate).toBeLessThanOrEqual(90);
  });

  it('should track cumulative followers correctly', async () => {
    const insights = await connector.fetchOAInsights('2026-06-01', '2026-06-07');
    
    // Each day should have total followers >= previous day (accounting for unfollowers)
    for (let i = 1; i < insights.length; i++) {
      const prevDay = insights[i - 1];
      const currentDay = insights[i];
      
      const expectedFollowers = prevDay.totalFollowers + currentDay.newFollowers - currentDay.unfollowers;
      expect(currentDay.totalFollowers).toBe(expectedFollowers);
    }
  });

  it('should get follower demographics (mock)', async () => {
    const demographics = await connector.getFollowerDemographics('2026-06-01', '2026-06-07');
    
    expect(demographics).toBeDefined();
    expect(demographics).toHaveProperty('ageGroups');
    expect(demographics).toHaveProperty('genderDistribution');
    expect(demographics).toHaveProperty('topLocations');
    
    // Age groups should sum to 100%
    const totalAgePercentage = demographics.ageGroups.reduce((sum, group) => sum + group.percentage, 0);
    expect(totalAgePercentage).toBeCloseTo(100, 1);
    
    // Gender distribution should sum to 100%
    const totalGenderPercentage = demographics.genderDistribution.reduce((sum, g) => sum + g.percentage, 0);
    expect(totalGenderPercentage).toBeCloseTo(100, 1);
  });
});

describe('In-Memory Cache', () => {
  let cache: InMemoryCache<any>;

  beforeEach(() => {
    cache = new InMemoryCache({
      defaultTTL: 1000, // 1 second for testing
      maxSize: 10,
      cleanupInterval: 999999999, // Disable auto-cleanup for tests
    });
  });

  it('should store and retrieve values', () => {
    cache.set('key1', 'value1');
    expect(cache.get('key1')).toBe('value1');
  });

  it('should return undefined for non-existent keys', () => {
    expect(cache.get('nonexistent')).toBeUndefined();
  });

  it('should respect TTL', async () => {
    cache.set('key2', 'value2', 100); // 100ms TTL
    expect(cache.get('key2')).toBe('value2');
    
    // Wait for TTL to expire
    await new Promise(resolve => setTimeout(resolve, 150));
    expect(cache.get('key2')).toBeUndefined();
  });

  it('should check key existence', () => {
    cache.set('key3', 'value3');
    expect(cache.has('key3')).toBe(true);
    expect(cache.has('nonexistent')).toBe(false);
  });

  it('should delete keys', () => {
    cache.set('key4', 'value4');
    expect(cache.has('key4')).toBe(true);
    
    cache.delete('key4');
    expect(cache.has('key4')).toBe(false);
  });

  it('should clear all keys', () => {
    cache.set('key5', 'value5');
    cache.set('key6', 'value6');
    expect(cache.size()).toBe(2);
    
    cache.clear();
    expect(cache.size()).toBe(0);
  });

  it('should invalidate by pattern', () => {
    cache.set('user:123', 'user123');
    cache.set('user:456', 'user456');
    cache.set('product:789', 'product789');
    
    const deleted = cache.invalidatePattern('user:*');
    expect(deleted).toBe(2);
    expect(cache.has('user:123')).toBe(false);
    expect(cache.has('user:456')).toBe(false);
    expect(cache.has('product:789')).toBe(true);
  });

  it('should track cache statistics', () => {
    cache.set('key7', 'value7');
    
    // Hit
    cache.get('key7');
    
    // Miss
    cache.get('nonexistent');
    
    const stats = cache.getStats();
    expect(stats.hits).toBe(1);
    expect(stats.misses).toBe(1);
    expect(stats.size).toBe(1);
  });

  it('should use getOrSet helper', async () => {
    let fetchCount = 0;
    const fetchFn = async () => {
      fetchCount++;
      return 'fetched_value';
    };
    
    // First call should fetch
    const value1 = await cache.getOrSet('key8', fetchFn);
    expect(value1).toBe('fetched_value');
    expect(fetchCount).toBe(1);
    
    // Second call should use cache
    const value2 = await cache.getOrSet('key8', fetchFn);
    expect(value2).toBe('fetched_value');
    expect(fetchCount).toBe(1); // Not incremented
  });

  it('should enforce max size with LRU eviction', () => {
    // Fill cache to max size
    for (let i = 0; i < 10; i++) {
      cache.set(`key${i}`, `value${i}`);
    }
    expect(cache.size()).toBe(10);
    
    // Add one more (should evict oldest)
    cache.set('key10', 'value10');
    expect(cache.size()).toBe(10);
    expect(cache.has('key0')).toBe(false); // Oldest key evicted
  });

  it('should create cache keys correctly', () => {
    const key1 = createCacheKey('marketing', 'campaign', 'tenant123', '2026-06-01');
    expect(key1).toBe('marketing:campaign:tenant123:2026-06-01');
    
    const key2 = createCacheKey('customer', 'churn', 'tenant456', 0.7);
    expect(key2).toBe('customer:churn:tenant456:0.7');
  });
});

describe('Cache Integration with Marketing Queries', () => {
  it('should use cache key format correctly', () => {
    const key = createCacheKey(
      'marketing',
      'campaign-analytics',
      'tenant123',
      'campaign456',
      '2026-06-01',
      '2026-06-07'
    );
    
    expect(key).toBe('marketing:campaign-analytics:tenant123:campaign456:2026-06-01:2026-06-07');
  });

  it('should handle optional tenant id in cache key', () => {
    const keyWithTenant = createCacheKey(
      'marketing',
      'channel-performance',
      'tenant123',
      '2026-06-01',
      '2026-06-07'
    );
    expect(keyWithTenant).toContain('tenant123');
    
    const keyWithoutTenant = createCacheKey(
      'marketing',
      'channel-performance',
      'notenant',
      '2026-06-01',
      '2026-06-07'
    );
    expect(keyWithoutTenant).toContain('notenant');
  });
});
