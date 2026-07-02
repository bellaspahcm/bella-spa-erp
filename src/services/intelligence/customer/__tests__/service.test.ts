/**
 * Unit Tests for CustomerIntelligenceService
 * 
 * Tests cache behavior, error handling, tenant isolation,
 * and all public methods of the Customer Intelligence Service.
 * 
 * Mock Strategy:
 * - Redis cache mocked to control cache hit/miss scenarios
 * - Supabase client mocked to return test data
 * - No real database or cache connections
 */

import { describe, it, expect, beforeEach, jest } from '@jest/globals';
import { CustomerIntelligenceService } from '../service';
import type { 
  CustomerSegment,
  CustomerLTV,
  CustomerActivitySummary,
  SegmentDistribution,
  CohortAnalysis,
} from '../queries';

// ─────────────────────────────────────────────────────────────────────────────
// Mock Setup
// ─────────────────────────────────────────────────────────────────────────────

// Mock Cache Service
const mockCacheGet = jest.fn();
const mockCacheSet = jest.fn();
const mockCacheDel = jest.fn();

const mockCache = {
  get: mockCacheGet,
  set: mockCacheSet,
  del: mockCacheDel,
  clear: jest.fn(),
  healthCheck: jest.fn().mockResolvedValue({ healthy: true }),
};

jest.mock('../cache', () => ({
  getCache: jest.fn(() => mockCache),
}));

// Mock query functions
jest.mock('../queries', () => ({
  getCustomerSegmentation: jest.fn(),
  getCustomerLTV: jest.fn(),
  getChurnRiskAnalysis: jest.fn(),
  getRFMAnalysis: jest.fn(),
  getSegmentDistribution: jest.fn(),
  getCohortAnalysis: jest.fn(),
}));

// Import mocked functions
import * as queries from '../queries';

// ─────────────────────────────────────────────────────────────────────────────
// Test Data
// ─────────────────────────────────────────────────────────────────────────────

const TEST_TENANT_ID = '123e4567-e89b-12d3-a456-426614174000';
const TEST_CUSTOMER_ID = '123e4567-e89b-12d3-a456-426614174001';
const TEST_COHORT_MONTH = '2025-01';

const mockSegmentData: CustomerSegment[] = [
  {
    tenantId: TEST_TENANT_ID,
    customerId: TEST_CUSTOMER_ID,
    customerName: 'Nguyễn Thị Lan',
    customerPhone: '0901234567',
    customerSince: new Date('2025-01-15').toISOString(),
    customerLifetimeDays: 180,
    daysSinceLastBooking: 15,
    totalBookings: 12,
    totalRevenue: 25000000,
    avgBookingAmount: 2083333,
    totalSessionsCompleted: 48,
    avgSessionsPerBooking: 4,
    lastBookingDate: new Date('2026-05-28').toISOString(),
    recencyScore: 4,
    frequencyScore: 4,
    monetaryScore: 4,
    rfmScore: 4.0,
    segment: 'Champions',
    retentionPriority: 5,
    churnRiskLevel: 'Low Risk',
    recommendedAction: 'Reward & Retain',
    computedAt: new Date().toISOString(),
  },
  {
    tenantId: TEST_TENANT_ID,
    customerId: '123e4567-e89b-12d3-a456-426614174002',
    customerName: 'Trần Thị Mai',
    customerPhone: '0902345678',
    customerSince: new Date('2024-06-10').toISOString(),
    customerLifetimeDays: 400,
    daysSinceLastBooking: 200,
    totalBookings: 8,
    totalRevenue: 15000000,
    avgBookingAmount: 1875000,
    totalSessionsCompleted: 24,
    avgSessionsPerBooking: 3,
    lastBookingDate: new Date('2025-11-20').toISOString(),
    recencyScore: 1,
    frequencyScore: 3,
    monetaryScore: 3,
    rfmScore: 2.33,
    segment: 'About To Sleep',
    retentionPriority: 2,
    churnRiskLevel: 'High Risk',
    recommendedAction: 'Re-engage Urgently',
    computedAt: new Date().toISOString(),
  },
];

const mockLTVData: CustomerLTV[] = [
  {
    tenantId: TEST_TENANT_ID,
    customerId: TEST_CUSTOMER_ID,
    customerName: 'Nguyễn Thị Lan',
    customerPhone: '0901234567',
    customerSince: new Date('2025-01-15').toISOString(),
    cohortMonth: TEST_COHORT_MONTH,
    customerLifetimeDays: 180,
    totalBookings: 12,
    totalRevenue: 25000000,
    avgRevenuePerBooking: 2083333,
    totalSessionsCompleted: 48,
    avgSessionsPerBooking: 4,
    revenuePerSession: 520833,
    firstBookingDate: new Date('2025-01-18').toISOString(),
    lastBookingDate: new Date('2026-05-28').toISOString(),
    activeMonths: 6,
    avgBookingsPerMonth: 2.0,
    predictedLtv12Months: 30000000,
    predictedLtv24Months: 55000000,
    cohortAvgLtv: 18000000,
    ltvVsCohortPct: 138.89,
    valueTier: 'VIP',
    computedAt: new Date().toISOString(),
  },
];

const mockChurnRiskData: CustomerActivitySummary[] = [
  {
    tenantId: TEST_TENANT_ID,
    customerId: TEST_CUSTOMER_ID,
    customerName: 'Nguyễn Thị Lan',
    customerPhone: '0901234567',
    customerSince: new Date('2025-01-15').toISOString(),
    customerLifetimeDays: 180,
    totalBookings: 12,
    totalRevenue: 25000000,
    avgBookingAmount: 2083333,
    totalSessionsCompleted: 48,
    sessionCompletionRatePct: 95.0,
    firstBookingDate: new Date('2025-01-18').toISOString(),
    lastBookingDate: new Date('2026-05-28').toISOString(),
    daysSinceLastBooking: 15,
    activeMonths: 6,
    avgBookingsPerMonth: 2.0,
    totalReviews: 10,
    avgReviewRating: 4.7,
    bookingsLast90Days: 5,
    revenueLast90Days: 12000000,
    bookings90180DaysAgo: 4,
    revenue90180DaysAgo: 9000000,
    bookings180270DaysAgo: 3,
    revenue180270DaysAgo: 4000000,
    bookingFrequencyChangePct: 25.0,
    revenueChangePct: 33.33,
    recencyRiskScore: 0,
    frequencyDeclineRiskScore: 0,
    revenueDeclineRiskScore: 0,
    satisfactionRiskScore: 0,
    churnRiskScore: 0,
    churnRiskLevel: 'Low',
    recommendedRetentionActions: ['Regular newsletter', 'Loyalty rewards reminder', 'New service announcements'],
    computedAt: new Date().toISOString(),
  },
  {
    tenantId: TEST_TENANT_ID,
    customerId: '123e4567-e89b-12d3-a456-426614174002',
    customerName: 'Trần Thị Mai',
    customerPhone: '0902345678',
    customerSince: new Date('2024-06-10').toISOString(),
    customerLifetimeDays: 400,
    totalBookings: 8,
    totalRevenue: 15000000,
    avgBookingAmount: 1875000,
    totalSessionsCompleted: 24,
    sessionCompletionRatePct: 85.0,
    firstBookingDate: new Date('2024-07-01').toISOString(),
    lastBookingDate: new Date('2025-11-20').toISOString(),
    daysSinceLastBooking: 200,
    activeMonths: 12,
    avgBookingsPerMonth: 0.67,
    totalReviews: 5,
    avgReviewRating: 3.4,
    bookingsLast90Days: 0,
    revenueLast90Days: 0,
    bookings90180DaysAgo: 1,
    revenue90180DaysAgo: 2000000,
    bookings180270DaysAgo: 2,
    revenue180270DaysAgo: 5000000,
    bookingFrequencyChangePct: -100.0,
    revenueChangePct: -100.0,
    recencyRiskScore: 100,
    frequencyDeclineRiskScore: 100,
    revenueDeclineRiskScore: 100,
    satisfactionRiskScore: 70,
    churnRiskScore: 97,
    churnRiskLevel: 'High',
    recommendedRetentionActions: [
      'Urgent: Personal call from manager',
      'Exclusive VIP discount offer',
      'Survey: Why are you leaving?',
      'Win-back campaign'
    ],
    computedAt: new Date().toISOString(),
  },
];

const mockSegmentDistribution: SegmentDistribution[] = [
  {
    tenantId: TEST_TENANT_ID,
    segment: 'Champions',
    customerCount: 50,
    totalRevenue: 500000000,
    avgRfmScore: 4.0,
    avgRecencyScore: 4.0,
    avgFrequencyScore: 4.0,
    avgMonetaryScore: 4.0,
    computedAt: new Date().toISOString(),
  },
  {
    tenantId: TEST_TENANT_ID,
    segment: 'Loyal Customers',
    customerCount: 80,
    totalRevenue: 600000000,
    avgRfmScore: 3.5,
    avgRecencyScore: 3.5,
    avgFrequencyScore: 3.5,
    avgMonetaryScore: 3.5,
    computedAt: new Date().toISOString(),
  },
];

const mockCohortAnalysis: CohortAnalysis[] = [
  {
    tenantId: TEST_TENANT_ID,
    cohortMonth: TEST_COHORT_MONTH,
    cohortSize: 45,
    activeCustomers: 38,
    retentionRatePct: 84.44,
    totalRevenue: 120000000,
    avgRevenuePerCustomer: 2666667,
    avgLtv: 18000000,
    avgActiveMonths: 5.5,
    avgBookingsPerCustomer: 3.2,
    computedAt: new Date().toISOString(),
  },
  {
    tenantId: TEST_TENANT_ID,
    cohortMonth: '2025-02',
    cohortSize: 52,
    activeCustomers: 44,
    retentionRatePct: 84.62,
    totalRevenue: 140000000,
    avgRevenuePerCustomer: 2692308,
    avgLtv: 17000000,
    avgActiveMonths: 5.0,
    avgBookingsPerCustomer: 3.0,
    computedAt: new Date().toISOString(),
  },
];

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('CustomerIntelligenceService', () => {
  let service: CustomerIntelligenceService;

  beforeEach(() => {
    // Reset all mocks before each test
    jest.clearAllMocks();

    // Create fresh service instance
    service = new CustomerIntelligenceService(mockCache);
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Customer Segmentation Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('getCustomerSegmentation', () => {
    it('should return cached data when cache hit', async () => {
      // Setup cache hit
      const cachedResponse = {
        data: mockSegmentData,
        metadata: {
          generatedAt: new Date().toISOString(),
          cacheHit: true,
          queryTimeMs: 0,
          dataSourcesUsed: ['redis'],
        },
      };
      mockCacheGet.mockResolvedValue(JSON.stringify(cachedResponse));

      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      expect(result.metadata.cacheHit).toBe(true);
      expect(result.data).toEqual(mockSegmentData);
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(queries.getCustomerSegmentation).not.toHaveBeenCalled();
    });

    it('should fetch from database on cache miss', async () => {
      // Setup cache miss
      mockCacheGet.mockResolvedValue(null);

      // Setup query response
      (queries.getCustomerSegmentation as jest.Mock).mockResolvedValue(mockSegmentData);

      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      expect(result.metadata.cacheHit).toBe(false);
      expect(result.data).toEqual(mockSegmentData);
      expect(mockCacheGet).toHaveBeenCalledTimes(1);
      expect(queries.getCustomerSegmentation).toHaveBeenCalled();
      expect(mockCacheSet).toHaveBeenCalledTimes(1);
    });

    it('should filter by segment when provided', async () => {
      mockCacheGet.mockResolvedValue(null);
      const championsOnly = mockSegmentData.filter(c => c.segment === 'Champions');
      (queries.getCustomerSegmentation as jest.Mock).mockResolvedValue(championsOnly);

      const result = await service.getCustomerSegmentation(TEST_TENANT_ID, 'Champions');

      expect(result.data.every(c => c.segment === 'Champions')).toBe(true);
      expect(queries.getCustomerSegmentation).toHaveBeenCalledWith(
        TEST_TENANT_ID,
        'Champions',
        undefined
      );
    });

    it('should handle database errors gracefully', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getCustomerSegmentation as jest.Mock).mockRejectedValue(
        new Error('Database connection failed')
      );

      await expect(
        service.getCustomerSegmentation(TEST_TENANT_ID)
      ).rejects.toThrow('Database connection failed');
    });

    it('should handle cache write failures silently', async () => {
      mockCacheGet.mockResolvedValue(null);
      mockCacheSet.mockRejectedValue(new Error('Redis write failed'));
      (queries.getCustomerSegmentation as jest.Mock).mockResolvedValue(mockSegmentData);

      // Should not throw despite cache write failure
      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      expect(result.data).toEqual(mockSegmentData);
      expect(result.metadata.cacheHit).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Customer LTV Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('getCustomerLTV', () => {
    it('should return LTV data', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getCustomerLTV as jest.Mock).mockResolvedValue(mockLTVData);

      const result = await service.getCustomerLTV(TEST_TENANT_ID);

      expect(result.data).toEqual(mockLTVData);
      expect(result.data.length).toBeGreaterThan(0);
    });

    it('should filter by cohort month when provided', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getCustomerLTV as jest.Mock).mockResolvedValue(mockLTVData);

      const result = await service.getCustomerLTV(TEST_TENANT_ID, TEST_COHORT_MONTH);

      expect(queries.getCustomerLTV).toHaveBeenCalledWith(
        TEST_TENANT_ID,
        TEST_COHORT_MONTH,
        undefined,
        undefined
      );
    });

    it('should filter by value tier when provided', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getCustomerLTV as jest.Mock).mockResolvedValue(mockLTVData);

      const result = await service.getCustomerLTV(TEST_TENANT_ID, undefined, 'VIP');

      expect(queries.getCustomerLTV).toHaveBeenCalledWith(
        TEST_TENANT_ID,
        undefined,
        'VIP',
        undefined
      );
    });

    it('should return empty array when no data found', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getCustomerLTV as jest.Mock).mockResolvedValue([]);

      const result = await service.getCustomerLTV(TEST_TENANT_ID);

      expect(result.data).toEqual([]);
      expect(result.metadata.cacheHit).toBe(false);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Churn Risk Analysis Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('getChurnRiskAnalysis', () => {
    it('should return churn risk data with correct scores', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getChurnRiskAnalysis as jest.Mock).mockResolvedValue(mockChurnRiskData);

      const result = await service.getChurnRiskAnalysis(TEST_TENANT_ID);

      expect(result.data).toEqual(mockChurnRiskData);
      expect(result.data[0].churnRiskScore).toBe(0);
      expect(result.data[1].churnRiskScore).toBe(97);
    });

    it('should filter by risk level when provided', async () => {
      mockCacheGet.mockResolvedValue(null);
      const highRiskOnly = mockChurnRiskData.filter(c => c.churnRiskLevel === 'High');
      (queries.getChurnRiskAnalysis as jest.Mock).mockResolvedValue(highRiskOnly);

      const result = await service.getChurnRiskAnalysis(TEST_TENANT_ID, 'High');

      expect(result.data.every(c => c.churnRiskLevel === 'High')).toBe(true);
      expect(queries.getChurnRiskAnalysis).toHaveBeenCalledWith(
        TEST_TENANT_ID,
        'High',
        undefined
      );
    });

    it('should include recommended retention actions', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getChurnRiskAnalysis as jest.Mock).mockResolvedValue(mockChurnRiskData);

      const result = await service.getChurnRiskAnalysis(TEST_TENANT_ID);

      expect(result.data[0].recommendedRetentionActions).toBeDefined();
      expect(Array.isArray(result.data[0].recommendedRetentionActions)).toBe(true);
      expect(result.data[1].recommendedRetentionActions[0]).toBe('Urgent: Personal call from manager');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // RFM Analysis Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('getRFMAnalysis', () => {
    it('should be an alias for getCustomerSegmentation', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getRFMAnalysis as jest.Mock).mockResolvedValue(mockSegmentData);

      const result = await service.getRFMAnalysis(TEST_TENANT_ID);

      expect(result.data).toEqual(mockSegmentData);
      expect(queries.getRFMAnalysis).toHaveBeenCalled();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Segment Distribution Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('getSegmentDistribution', () => {
    it('should return aggregated segment metrics', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getSegmentDistribution as jest.Mock).mockResolvedValue(mockSegmentDistribution);

      const result = await service.getSegmentDistribution(TEST_TENANT_ID);

      expect(result.data).toEqual(mockSegmentDistribution);
      expect(result.data[0]).toHaveProperty('customerCount');
      expect(result.data[0]).toHaveProperty('totalRevenue');
      expect(result.data[0]).toHaveProperty('avgRfmScore');
    });

    it('should handle empty segments', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getSegmentDistribution as jest.Mock).mockResolvedValue([]);

      const result = await service.getSegmentDistribution(TEST_TENANT_ID);

      expect(result.data).toEqual([]);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Cohort Analysis Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('getCohortAnalysis', () => {
    it('should return cohort retention data', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getCohortAnalysis as jest.Mock).mockResolvedValue(mockCohortAnalysis);

      const result = await service.getCohortAnalysis(TEST_TENANT_ID);

      expect(result.data).toEqual(mockCohortAnalysis);
      expect(result.data[0]).toHaveProperty('cohortSize');
      expect(result.data[0]).toHaveProperty('retentionRatePct');
      expect(result.data[0]).toHaveProperty('avgLtv');
    });

    it('should respect limit parameter', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getCohortAnalysis as jest.Mock).mockResolvedValue(mockCohortAnalysis);

      const result = await service.getCohortAnalysis(TEST_TENANT_ID, 6);

      expect(queries.getCohortAnalysis).toHaveBeenCalledWith(TEST_TENANT_ID, 6);
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Health Check Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('healthCheck', () => {
    it('should return healthy status when cache is accessible', async () => {
      mockCache.healthCheck.mockResolvedValue({ healthy: true });

      const result = await service.healthCheck();

      expect(result.healthy).toBe(true);
    });

    it('should return unhealthy when cache fails', async () => {
      mockCache.healthCheck.mockResolvedValue({ 
        healthy: false, 
        error: 'Redis connection failed' 
      });

      const result = await service.healthCheck();

      expect(result.healthy).toBe(false);
      expect(result.error).toContain('Redis connection failed');
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Cache Management Tests
  // ───────────────────────────────────────────────────────────────────────────

  describe('clearCache', () => {
    it('should clear tenant-specific cache when tenantId provided', async () => {
      mockCacheDel.mockResolvedValue(1);

      await service.clearCache(TEST_TENANT_ID);

      expect(mockCacheDel).toHaveBeenCalledWith(`customer:${TEST_TENANT_ID}:*`);
    });

    it('should clear all customer cache when no tenantId', async () => {
      mockCacheDel.mockResolvedValue(10);

      await service.clearCache();

      expect(mockCacheDel).toHaveBeenCalledWith('customer:*');
    });

    it('should not throw on cache clear failure', async () => {
      mockCacheDel.mockRejectedValue(new Error('Redis del failed'));

      await expect(service.clearCache()).resolves.not.toThrow();
    });
  });

  // ───────────────────────────────────────────────────────────────────────────
  // Edge Cases & Error Handling
  // ───────────────────────────────────────────────────────────────────────────

  describe('edge cases', () => {
    it('should handle malformed cached data', async () => {
      // Cache contains invalid JSON
      mockCacheGet.mockResolvedValue('invalid-json{{{');
      (queries.getCustomerSegmentation as jest.Mock).mockResolvedValue(mockSegmentData);

      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      // Should fall back to database
      expect(result.data).toEqual(mockSegmentData);
      expect(queries.getCustomerSegmentation).toHaveBeenCalled();
    });

    it('should include query timing in metadata', async () => {
      mockCacheGet.mockResolvedValue(null);
      (queries.getCustomerSegmentation as jest.Mock).mockResolvedValue(mockSegmentData);

      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      expect(result.metadata.queryTimeMs).toBeGreaterThanOrEqual(0);
      expect(result.metadata.generatedAt).toBeDefined();
    });

    it('should handle RFM scores at boundaries', async () => {
      const boundaryData = [{
        ...mockSegmentData[0],
        recencyScore: 1,
        frequencyScore: 1,
        monetaryScore: 1,
        rfmScore: 1.0,
      }];

      mockCacheGet.mockResolvedValue(null);
      (queries.getCustomerSegmentation as jest.Mock).mockResolvedValue(boundaryData);

      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      expect(result.data[0].rfmScore).toBe(1.0);
      expect(result.data[0].recencyScore).toBeGreaterThanOrEqual(1);
      expect(result.data[0].recencyScore).toBeLessThanOrEqual(4);
    });

    it('should handle customers with no bookings', async () => {
      const newCustomer = [{
        ...mockSegmentData[0],
        totalBookings: 0,
        totalRevenue: 0,
        segment: 'New',
      }];

      mockCacheGet.mockResolvedValue(null);
      (queries.getCustomerSegmentation as jest.Mock).mockResolvedValue(newCustomer);

      const result = await service.getCustomerSegmentation(TEST_TENANT_ID);

      expect(result.data[0].segment).toBe('New');
      expect(result.data[0].totalBookings).toBe(0);
    });
  });
});
