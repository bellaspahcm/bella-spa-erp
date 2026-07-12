/**
 * Discount Provider Test Suite
 * 
 * Comprehensive tests for Discount Provider (20+ test cases).
 * Covers tier mapping, rule priority, discount calculation, edge cases.
 * 
 * Test Categories:
 * 1. Tier Mapping (4 tests)
 * 2. Membership Discounts (4 tests)
 * 3. Campaign Discounts (4 tests)
 * 4. Lifecycle Discounts (3 tests)
 * 5. Edge Cases (5 tests)
 * 6. Multi-tenant Isolation (2 tests)
 * 
 * Total: 22 tests
 */

import { DiscountProvider } from '../discount-provider';
import type { DiscountDecisionInput } from '../types';

describe('DiscountProvider', () => {
  let provider: DiscountProvider;

  beforeEach(() => {
    provider = new DiscountProvider();
  });

  // ======================
  // Category 1: Tier Mapping (4 tests)
  // ======================
  describe('Tier Mapping', () => {
    it('should map customer to VIP tier (≥50M spending)', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 10000000,
        customer: {
          id: 'cust-001',
          status: 'active',
          totalSpending: 60000000,
          completedBookingsCount: 25,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.customerTier).toBe('vip');
      expect(result.discountPercent).toBe(15);
    });

    it('should map customer to Loyal tier (≥20M spending)', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 5000000,
        customer: {
          id: 'cust-002',
          status: 'active',
          totalSpending: 25000000,
          completedBookingsCount: 8,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.customerTier).toBe('loyal');
      expect(result.discountPercent).toBe(10);
    });

    it('should map customer to Active tier (>1 booking)', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 3000000,
        customer: {
          id: 'cust-003',
          status: 'active',
          totalSpending: 5000000,
          completedBookingsCount: 3,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.customerTier).toBe('active');
      expect(result.discountPercent).toBe(5);
    });

    it('should map customer to New tier (≤1 booking)', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 4000000,
        customer: {
          id: 'cust-004',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
          isFirstBooking: true,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.customerTier).toBe('new');
      expect(result.discountPercent).toBe(5);
    });
  });

  // ======================
  // Category 2: Membership Discounts (4 tests)
  // ======================
  describe('Membership Discounts', () => {
    it('should apply 15% VIP discount (highest priority)', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 10000000,
        customer: {
          id: 'cust-vip',
          status: 'vip',
          totalSpending: 70000000,
          completedBookingsCount: 30,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(15);
      expect(result.discountType).toBe('membership');
      expect(result.discountAmount).toBe(1500000);
      expect(result.finalAmount).toBe(8500000);
      expect(result.reason).toBe('VIP Customer Discount');
    });

    it('should apply 10% Loyal discount', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 8000000,
        customer: {
          id: 'cust-loyal',
          status: 'active',
          totalSpending: 22000000,
          completedBookingsCount: 12,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.discountPercent).toBe(10);
      expect(result.discountAmount).toBe(800000);
      expect(result.finalAmount).toBe(7200000);
    });

    it('should apply 5% Active discount', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 6000000,
        customer: {
          id: 'cust-active',
          status: 'active',
          totalSpending: 8000000,
          completedBookingsCount: 4,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.discountPercent).toBe(5);
      expect(result.discountAmount).toBe(300000);
      expect(result.finalAmount).toBe(5700000);
    });

    it('should apply 5% New customer discount (first booking)', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 5000000,
        customer: {
          id: 'cust-new',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
          isFirstBooking: true,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.discountPercent).toBe(5);
      expect(result.discountType).toBe('firsttime');
      expect(result.restrictions).toContain('First purchase only');
    });
  });

  // ======================
  // Category 3: Campaign Discounts (4 tests)
  // ======================
  describe('Campaign Discounts', () => {
    it('should apply 20% Lunar New Year campaign (highest campaign priority)', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 10000000,
        customer: {
          id: 'cust-campaign',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
        },
        campaign: {
          code: 'LUNAR_NEW_YEAR_2026',
          startDate: '2026-01-20',
          endDate: '2026-02-10',
        },
      };

      // Mock current date to be within campaign period
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-01-25'));

      const result = await provider.evaluate(input);

      expect(result.discountPercent).toBe(20);
      expect(result.discountType).toBe('seasonal');
      expect(result.campaignCode).toBe('LUNAR_NEW_YEAR_2026');

      jest.useRealTimers();
    });

    it('should apply 15% Summer promotion', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 8000000,
        customer: {
          id: 'cust-summer',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
        },
        campaign: {
          code: 'SUMMER_2026',
          startDate: '2026-06-01',
          endDate: '2026-08-31',
        },
      };

      jest.useFakeTimers();
      jest.setSystemTime(new Date('2026-07-15'));

      const result = await provider.evaluate(input);

      expect(result.discountPercent).toBe(15);
      expect(result.campaignCode).toBe('SUMMER_2026');

      jest.useRealTimers();
    });

    it('should apply 12% Bundle discount (3+ services)', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 9000000,
        customer: {
          id: 'cust-bundle',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
        },
        purchase: {
          serviceCount: 4,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.discountPercent).toBe(12);
      expect(result.discountType).toBe('bundle');
      expect(result.restrictions).toContain('Minimum 3 services required');
    });

    it('should apply 8% Referral discount', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 7000000,
        customer: {
          id: 'cust-referral',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
        },
        purchase: {
          referralCode: 'REF123456',
        },
      };

      const result = await provider.evaluate(input);

      expect(result.discountPercent).toBe(8);
      expect(result.discountType).toBe('referral');
    });
  });

  // ======================
  // Category 4: Lifecycle Discounts (3 tests)
  // ======================
  describe('Lifecycle Discounts', () => {
    it('should apply 10% Birthday month discount', async () => {
      const currentMonth = new Date().getMonth() + 1; // 1-12

      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 6000000,
        customer: {
          id: 'cust-birthday',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
          birthdayMonth: currentMonth,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.discountPercent).toBe(10);
      expect(result.discountType).toBe('birthday');
    });

    it('should apply 7% Weekend discount (Saturday)', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 5000000,
        customer: {
          id: 'cust-weekend',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
        },
        purchase: {
          bookingDate: new Date('2026-07-12'), // Saturday
        },
      };

      const result = await provider.evaluate(input);

      expect(result.discountPercent).toBe(7);
      expect(result.discountType).toBe('weekend');
    });

    it('should apply 0% when no rules match (fallback)', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 5000000,
        customer: {
          id: 'cust-no-discount',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 1, // Not first booking (>0), not active (≤1)
          isFirstBooking: false, // Explicitly not first booking
        },
        purchase: {
          bookingDate: new Date('2026-07-09'), // Thursday (not weekend)
          serviceCount: 1, // Not bundle (< 3)
        },
      };

      const result = await provider.evaluate(input);

      // Fallback rule always matches (totalAmount > 0), so eligible = true but discount = 0
      expect(result.discountPercent).toBe(0);
      expect(result.discountType).toBe('none');
      expect(result.finalAmount).toBe(5000000);
      expect(result.reason).toBe('No rules matched');
    });
  });

  // ======================
  // Category 5: Edge Cases (5 tests)
  // ======================
  describe('Edge Cases', () => {
    it('should handle zero amount', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 0,
        customer: {
          id: 'cust-zero',
          status: 'vip',
          totalSpending: 60000000,
          completedBookingsCount: 25,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(0);
    });

    it('should handle negative spending gracefully', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 5000000,
        customer: {
          id: 'cust-negative',
          status: 'new',
          totalSpending: -1000000, // Invalid data
          completedBookingsCount: 0,
        },
      };

      const result = await provider.evaluate(input);

      // Should map to 'new' tier despite negative spending
      expect(result.customerTier).toBe('new');
      expect(result).toBeDefined();
    });

    it('should handle null customer status', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 5000000,
        customer: {
          id: 'cust-null-status',
          status: null,
          totalSpending: 30000000,
          completedBookingsCount: 15,
        },
      };

      const result = await provider.evaluate(input);

      // Should still map to Loyal (≥20M spending)
      expect(result.customerTier).toBe('loyal');
      expect(result.discountPercent).toBe(10);
    });

    it('should clamp discount calculation to 0-100%', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 10000000,
        customer: {
          id: 'cust-vip',
          status: 'vip',
          totalSpending: 100000000,
          completedBookingsCount: 50,
        },
      };

      const result = await provider.evaluate(input);

      // Even VIP discount should not exceed 100%
      expect(result.discountPercent).toBeLessThanOrEqual(100);
      expect(result.discountPercent).toBeGreaterThanOrEqual(0);
      expect(result.finalAmount).toBeGreaterThanOrEqual(0);
    });

    it('should return execution time metadata', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 5000000,
        customer: {
          id: 'cust-perf',
          status: 'active',
          totalSpending: 10000000,
          completedBookingsCount: 5,
        },
      };

      const result = await provider.evaluate(input);

      expect(result.executionTime).toBeGreaterThan(0);
      expect(result.provider).toBe('DiscountProvider');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  // ======================
  // Category 6: Multi-tenant Isolation (2 tests)
  // ======================
  describe('Multi-tenant Isolation', () => {
    it('should support different tenants with same customer data', async () => {
      const inputTenant1: DiscountDecisionInput = {
        tenantId: 'tenant-1',
        totalAmount: 10000000,
        customer: {
          id: 'cust-multi',
          status: 'vip',
          totalSpending: 60000000,
          completedBookingsCount: 25,
        },
      };

      const inputTenant2: DiscountDecisionInput = {
        ...inputTenant1,
        tenantId: 'tenant-2',
      };

      const result1 = await provider.evaluate(inputTenant1);
      const result2 = await provider.evaluate(inputTenant2);

      // Both should get VIP discount
      expect(result1.discountPercent).toBe(result2.discountPercent);
      expect(result1.customerTier).toBe(result2.customerTier);
    });

    it('should handle metadata correctly', async () => {
      const input: DiscountDecisionInput = {
        tenantId: 'bella-spa-vn',
        totalAmount: 5000000,
        customer: {
          id: 'cust-metadata',
          status: 'active',
          totalSpending: 10000000,
          completedBookingsCount: 5,
        },
        metadata: {
          source: 'mobile-app',
          version: '1.2.0',
        },
      };

      const result = await provider.evaluate(input);

      expect(result).toBeDefined();
      expect(result.discountPercent).toBeGreaterThan(0);
    });
  });
});
