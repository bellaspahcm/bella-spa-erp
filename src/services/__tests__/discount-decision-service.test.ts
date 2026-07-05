/**
 * Discount Decision Service Tests
 * 
 * Provider #2: Multi-Provider Platform Validation
 * Validates Decision Engine works beyond Booking domain.
 * 
 * Tests cover:
 * - Membership tier discounts (VIP, Loyal, Active, New)
 * - Campaign promotions (Lunar New Year, Summer)
 * - Bundle discounts (3+ services)
 * - Referral discounts
 * - Birthday month specials
 * - Weekend promotions
 * - Edge cases and fallbacks
 */

import { describe, it, expect, beforeEach } from '@jest/globals';
import {
  evaluateDiscountEligibility,
  evaluateDiscountEligibilityBatch,
  getSuggestedDiscountMessage,
  type DiscountDecisionInput,
} from '../discount-decision-service';
import { resetDecisionEngine } from '@/lib/decision-engine';

describe('Discount Decision Service', () => {
  beforeEach(() => {
    // Reset engine singleton between tests for isolation
    resetDecisionEngine();
  });

  describe('evaluateDiscountEligibility() - Membership Tiers', () => {
    it('should give VIP customers 15% discount with no minimum', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 1000000,
        customer: {
          id: 'cust-vip-001',
          status: 'vip',
          totalSpending: 60000000,
          completedBookingsCount: 25,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(15);
      expect(result.discountAmount).toBe(150000); // 15% of 1M
      expect(result.finalAmount).toBe(850000);
      expect(result.discountType).toBe('membership');
      expect(result.matchedRules).toContain('discount-vip-15percent');
      expect(result.customerTier).toBe('vip');
      expect(result.confidence).toBeGreaterThan(0);
    });

    it('should give loyal customers 10% discount with 5M minimum', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 7000000,
        customer: {
          id: 'cust-loyal-001',
          status: 'active',
          totalSpending: 25000000,
          completedBookingsCount: 12,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(10);
      expect(result.discountAmount).toBe(700000); // 10% of 7M
      expect(result.finalAmount).toBe(6300000);
      expect(result.discountType).toBe('membership');
      expect(result.matchedRules).toContain('discount-loyal-10percent');
      expect(result.customerTier).toBe('loyal');
      expect(result.restrictions).toContain('minimum_5m');
    });

    it('should NOT give loyal discount if below 5M minimum', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 4000000, // Below 5M threshold
        customer: {
          id: 'cust-loyal-002',
          status: 'active',
          totalSpending: 25000000,
          completedBookingsCount: 12,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      // Should fall through to lower priority rules or no discount
      expect(result.matchedRules).not.toContain('discount-loyal-10percent');
    });

    it('should give first-time customers 5% welcome discount', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 3000000,
        customer: {
          id: 'cust-new-001',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
          isFirstBooking: true,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(5);
      expect(result.discountAmount).toBe(150000); // 5% of 3M
      expect(result.finalAmount).toBe(2850000);
      expect(result.discountType).toBe('firsttime');
      expect(result.matchedRules).toContain('discount-firsttime-5percent');
      expect(result.customerTier).toBe('new');
      expect(result.restrictions).toContain('first_booking_only');
    });

    it('should give active customers 5% discount with 7M minimum', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 8000000,
        customer: {
          id: 'cust-active-001',
          status: 'active',
          totalSpending: 10000000,
          completedBookingsCount: 3,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(5);
      expect(result.discountAmount).toBe(400000); // 5% of 8M
      expect(result.finalAmount).toBe(7600000);
      expect(result.discountType).toBe('membership');
      expect(result.matchedRules).toContain('discount-active-5percent');
      expect(result.customerTier).toBe('active');
      expect(result.restrictions).toContain('minimum_7m');
    });
  });

  describe('evaluateDiscountEligibility() - Campaign Promotions', () => {
    it('should give 20% Lunar New Year discount within campaign period', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 5000000,
        customer: {
          id: 'cust-campaign-001',
          status: 'active',
          totalSpending: 10000000,
          completedBookingsCount: 3,
        },
        campaign: {
          code: 'TET2026',
          startDate: '2026-01-20',
          endDate: '2026-12-31', // Ensure current date is within range
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(20);
      expect(result.discountAmount).toBe(1000000); // 20% of 5M
      expect(result.finalAmount).toBe(4000000);
      expect(result.discountType).toBe('campaign');
      expect(result.matchedRules).toContain('discount-campaign-lunar-new-year');
      expect(result.campaignCode).toBe('TET2026');
      expect(result.restrictions).toContain('campaign_period');
      expect(result.restrictions).toContain('minimum_3m');
    });

    it('should NOT give campaign discount outside period', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 5000000,
        customer: {
          id: 'cust-campaign-002',
          status: 'active',
          totalSpending: 10000000,
          completedBookingsCount: 3,
        },
        campaign: {
          code: 'TET2026',
          startDate: '2025-01-20', // Past campaign
          endDate: '2025-02-10',
        },
      };

      const result = await evaluateDiscountEligibility(input);

      // Should not match campaign rule
      expect(result.matchedRules).not.toContain('discount-campaign-lunar-new-year');
    });

    it('should give 15% Summer promotion within campaign period', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 6000000,
        customer: {
          id: 'cust-summer-001',
          status: 'active',
          totalSpending: 15000000,
          completedBookingsCount: 5,
        },
        campaign: {
          code: 'SUMMER2026',
          startDate: '2026-06-01',
          endDate: '2026-12-31',
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(15);
      expect(result.discountAmount).toBe(900000); // 15% of 6M
      expect(result.finalAmount).toBe(5100000);
      expect(result.discountType).toBe('campaign');
      expect(result.matchedRules).toContain('discount-campaign-summer');
      expect(result.campaignCode).toBe('SUMMER2026');
    });

    it('should NOT give Summer discount if below 5M minimum', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 4500000,
        customer: {
          id: 'cust-summer-002',
          status: 'active',
          totalSpending: 15000000,
          completedBookingsCount: 5,
        },
        campaign: {
          code: 'SUMMER2026',
          startDate: '2026-06-01',
          endDate: '2026-12-31',
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.matchedRules).not.toContain('discount-campaign-summer');
    });
  });

  describe('evaluateDiscountEligibility() - Bundle Discounts', () => {
    it('should give 12% bundle discount for 3+ services (>=10M)', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 12000000,
        customer: {
          id: 'cust-bundle-001',
          status: 'active',
          totalSpending: 20000000,
          completedBookingsCount: 8,
        },
        purchase: {
          serviceCount: 3,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(12);
      expect(result.discountAmount).toBe(1440000); // 12% of 12M
      expect(result.finalAmount).toBe(10560000);
      expect(result.discountType).toBe('bundle');
      expect(result.matchedRules).toContain('discount-bundle-3services');
      expect(result.restrictions).toContain('minimum_3_services');
      expect(result.restrictions).toContain('minimum_10m');
    });

    it('should NOT give bundle discount if less than 3 services', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 12000000,
        customer: {
          id: 'cust-bundle-002',
          status: 'active',
          totalSpending: 20000000,
          completedBookingsCount: 8,
        },
        purchase: {
          serviceCount: 2, // Only 2 services
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.matchedRules).not.toContain('discount-bundle-3services');
    });

    it('should NOT give bundle discount if below 10M minimum', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 9000000,
        customer: {
          id: 'cust-bundle-003',
          status: 'active',
          totalSpending: 20000000,
          completedBookingsCount: 8,
        },
        purchase: {
          serviceCount: 4,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.matchedRules).not.toContain('discount-bundle-3services');
    });
  });

  describe('evaluateDiscountEligibility() - Referral Discounts', () => {
    it('should give 8% referral discount with valid code (>=5M)', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 6000000,
        customer: {
          id: 'cust-referral-001',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
        },
        purchase: {
          referralCode: 'REF-VIP-123',
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(8);
      expect(result.discountAmount).toBe(480000); // 8% of 6M
      expect(result.finalAmount).toBe(5520000);
      expect(result.discountType).toBe('referral');
      expect(result.matchedRules).toContain('discount-referral-8percent');
      expect(result.restrictions).toContain('valid_referral');
      expect(result.restrictions).toContain('minimum_5m');
    });

    it('should NOT give referral discount if below 5M minimum', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 4000000,
        customer: {
          id: 'cust-referral-002',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
        },
        purchase: {
          referralCode: 'REF-VIP-456',
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.matchedRules).not.toContain('discount-referral-8percent');
    });
  });

  describe('evaluateDiscountEligibility() - Seasonal Discounts', () => {
    it('should give 10% birthday month discount (>=3M)', async () => {
      const currentMonth = new Date().getMonth() + 1;
      
      const input: DiscountDecisionInput = {
        totalAmount: 4000000,
        customer: {
          id: 'cust-birthday-001',
          status: 'active',
          totalSpending: 15000000,
          completedBookingsCount: 5,
          birthdayMonth: currentMonth, // Current month
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(10);
      expect(result.discountAmount).toBe(400000); // 10% of 4M
      expect(result.finalAmount).toBe(3600000);
      expect(result.discountType).toBe('seasonal');
      expect(result.matchedRules).toContain('discount-birthday-month');
      expect(result.restrictions).toContain('birthday_month_only');
      expect(result.restrictions).toContain('minimum_3m');
    });

    it('should NOT give birthday discount if not birthday month', async () => {
      const currentMonth = new Date().getMonth() + 1;
      const notBirthdayMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      
      const input: DiscountDecisionInput = {
        totalAmount: 4000000,
        customer: {
          id: 'cust-birthday-002',
          status: 'active',
          totalSpending: 15000000,
          completedBookingsCount: 5,
          birthdayMonth: notBirthdayMonth,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.matchedRules).not.toContain('discount-birthday-month');
    });

    it('should give 7% weekend discount for Saturday/Sunday (>=5M)', async () => {
      // Create a weekend date (Saturday or Sunday)
      const today = new Date();
      const dayOfWeek = today.getDay();
      
      // If not weekend, skip this test
      if (dayOfWeek !== 0 && dayOfWeek !== 6) {
        // Find next Saturday
        const daysUntilSaturday = (6 - dayOfWeek + 7) % 7 || 7;
        today.setDate(today.getDate() + daysUntilSaturday);
      }

      const input: DiscountDecisionInput = {
        totalAmount: 6000000,
        customer: {
          id: 'cust-weekend-001',
          status: 'active',
          totalSpending: 10000000,
          completedBookingsCount: 3,
        },
        purchase: {
          bookingDate: today,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      expect(result.discountPercent).toBe(7);
      expect(result.discountAmount).toBe(420000); // 7% of 6M
      expect(result.finalAmount).toBe(5580000);
      expect(result.discountType).toBe('seasonal');
      expect(result.matchedRules).toContain('discount-weekend-7percent');
      expect(result.restrictions).toContain('weekend_only');
      expect(result.restrictions).toContain('minimum_5m');
    });
  });

  describe('evaluateDiscountEligibility() - Priority and Edge Cases', () => {
    it('should prioritize VIP discount over campaign discount', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 5000000,
        customer: {
          id: 'cust-priority-001',
          status: 'vip',
          totalSpending: 60000000,
          completedBookingsCount: 25,
        },
        campaign: {
          code: 'TET2026',
          startDate: '2026-01-20',
          endDate: '2026-12-31',
        },
      };

      const result = await evaluateDiscountEligibility(input);

      // VIP has priority 110, Campaign has priority 90
      expect(result.matchedRules).toContain('discount-vip-15percent');
      expect(result.discountPercent).toBe(15); // VIP discount, not campaign
    });

    it('should return no discount if no rules match', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 1000000,
        customer: {
          id: 'cust-edge-001',
          status: 'new',
          totalSpending: 0,
          completedBookingsCount: 0,
          isFirstBooking: false, // Not first booking
        },
      };

      const result = await evaluateDiscountEligibility(input);

      // Should match fallback rule
      expect(result.eligible).toBe(false);
      expect(result.discountPercent).toBe(0);
      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(1000000);
      expect(result.discountType).toBe('none');
      expect(result.matchedRules).toContain('discount-none');
    });

    it('should handle zero amount purchase', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 0,
        customer: {
          id: 'cust-zero-001',
          status: 'vip',
          totalSpending: 60000000,
          completedBookingsCount: 25,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.discountAmount).toBe(0);
      expect(result.finalAmount).toBe(0);
    });

    it('should include execution time in result', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 5000000,
        customer: {
          id: 'cust-perf-001',
          status: 'vip',
          totalSpending: 60000000,
          completedBookingsCount: 25,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.executionTime).toBeGreaterThanOrEqual(0);
      expect(typeof result.executionTime).toBe('number');
    });

    it('should include raw decision result for audit', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 5000000,
        customer: {
          id: 'cust-audit-001',
          status: 'vip',
          totalSpending: 60000000,
          completedBookingsCount: 25,
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result._raw).toBeDefined();
      expect(result._raw.confidence).toBe(result.confidence);
    });

    it('should support tenant ID override', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 5000000,
        customer: {
          id: 'cust-tenant-001',
          status: 'vip',
          totalSpending: 60000000,
          completedBookingsCount: 25,
        },
        tenantId: 'custom-tenant-001',
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      // Tenant ID should be passed to decision context
    });

    it('should support additional metadata', async () => {
      const input: DiscountDecisionInput = {
        totalAmount: 5000000,
        customer: {
          id: 'cust-meta-001',
          status: 'vip',
          totalSpending: 60000000,
          completedBookingsCount: 25,
        },
        metadata: {
          source: 'mobile_app',
          promotionId: 'promo-123',
        },
      };

      const result = await evaluateDiscountEligibility(input);

      expect(result.eligible).toBe(true);
      // Metadata should be passed to decision context
    });
  });

  describe('evaluateDiscountEligibilityBatch()', () => {
    it('should evaluate multiple purchases in parallel', async () => {
      const inputs: DiscountDecisionInput[] = [
        {
          totalAmount: 5000000,
          customer: { id: 'cust-1', status: 'vip', totalSpending: 60000000, completedBookingsCount: 25 },
        },
        {
          totalAmount: 7000000,
          customer: { id: 'cust-2', status: 'active', totalSpending: 25000000, completedBookingsCount: 12 },
        },
        {
          totalAmount: 3000000,
          customer: { id: 'cust-3', status: 'new', totalSpending: 0, completedBookingsCount: 0, isFirstBooking: true },
        },
      ];

      const results = await evaluateDiscountEligibilityBatch(inputs);

      expect(results).toHaveLength(3);
      
      // VIP customer
      expect(results[0].eligible).toBe(true);
      expect(results[0].discountPercent).toBe(15);
      
      // Loyal customer
      expect(results[1].eligible).toBe(true);
      expect(results[1].discountPercent).toBe(10);
      
      // First-time customer
      expect(results[2].eligible).toBe(true);
      expect(results[2].discountPercent).toBe(5);
    });

    it('should handle empty batch', async () => {
      const results = await evaluateDiscountEligibilityBatch([]);
      expect(results).toHaveLength(0);
    });
  });

  describe('getSuggestedDiscountMessage()', () => {
    it('should format VIP discount message', () => {
      const message = getSuggestedDiscountMessage({
        eligible: true,
        discountPercent: 15,
        discountAmount: 1500000,
        discountType: 'membership',
        finalAmount: 8500000,
        reason: 'VIP discount',
        matchedRules: [],
        restrictions: [],
        confidence: 0.9,
        executionTime: 10,
        provider: 'RuleProvider',
        customerTier: 'vip',
        _raw: {} as any,
      });

      expect(message).toContain('15%');
      expect(message).toContain('1.500.000'); // Vietnamese thousands separator (dot)
      expect(message).toContain('⭐'); // Membership emoji
    });

    it('should format campaign discount message', () => {
      const message = getSuggestedDiscountMessage({
        eligible: true,
        discountPercent: 20,
        discountAmount: 2000000,
        discountType: 'campaign',
        finalAmount: 8000000,
        reason: 'Campaign discount',
        matchedRules: [],
        restrictions: [],
        confidence: 0.9,
        executionTime: 10,
        provider: 'RuleProvider',
        customerTier: 'active',
        _raw: {} as any,
      });

      expect(message).toContain('20%');
      expect(message).toContain('2.000.000');
      expect(message).toContain('🎊'); // Campaign emoji
    });

    it('should format first-time discount message', () => {
      const message = getSuggestedDiscountMessage({
        eligible: true,
        discountPercent: 5,
        discountAmount: 150000,
        discountType: 'firsttime',
        finalAmount: 2850000,
        reason: 'Welcome discount',
        matchedRules: [],
        restrictions: [],
        confidence: 0.9,
        executionTime: 10,
        provider: 'RuleProvider',
        customerTier: 'new',
        _raw: {} as any,
      });

      expect(message).toContain('5%');
      expect(message).toContain('150.000');
      expect(message).toContain('🎉'); // First-time emoji
    });

    it('should format bundle discount message', () => {
      const message = getSuggestedDiscountMessage({
        eligible: true,
        discountPercent: 12,
        discountAmount: 1440000,
        discountType: 'bundle',
        finalAmount: 10560000,
        reason: 'Bundle discount',
        matchedRules: [],
        restrictions: [],
        confidence: 0.9,
        executionTime: 10,
        provider: 'RuleProvider',
        customerTier: 'active',
        _raw: {} as any,
      });

      expect(message).toContain('12%');
      expect(message).toContain('1.440.000');
      expect(message).toContain('📦'); // Bundle emoji
    });

    it('should format referral discount message', () => {
      const message = getSuggestedDiscountMessage({
        eligible: true,
        discountPercent: 8,
        discountAmount: 480000,
        discountType: 'referral',
        finalAmount: 5520000,
        reason: 'Referral discount',
        matchedRules: [],
        restrictions: [],
        confidence: 0.9,
        executionTime: 10,
        provider: 'RuleProvider',
        customerTier: 'new',
        _raw: {} as any,
      });

      expect(message).toContain('8%');
      expect(message).toContain('480.000');
      expect(message).toContain('👥'); // Referral emoji
    });

    it('should format no discount message', () => {
      const message = getSuggestedDiscountMessage({
        eligible: false,
        discountPercent: 0,
        discountAmount: 0,
        discountType: 'none',
        finalAmount: 5000000,
        reason: 'No discount',
        matchedRules: [],
        restrictions: [],
        confidence: 0.9,
        executionTime: 10,
        provider: 'RuleProvider',
        customerTier: 'new',
        _raw: {} as any,
      });

      expect(message).toBe('No discount available');
    });
  });
});
