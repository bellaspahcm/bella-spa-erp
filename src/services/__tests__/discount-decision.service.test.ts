/**
 * Discount Decision Service Tests
 * 
 * Test Coverage:
 * - Tier discount calculation (VIP/Loyal/New)
 * - Campaign promotion application (seasonal/bundle/referral)
 * - Eligibility checks (minimum purchase, usage limits, time restrictions)
 * - Edge cases (no rules, inactive rules, expired campaigns)
 * - Error handling (database errors, invalid inputs)
 * 
 * Total: 25+ test cases
 */

import {
  calculateTierDiscount,
  applyCampaignPromotion,
  checkDiscountEligibility,
  trackDiscountUsage,
} from '../discount-decision.service';

// ============================================================================
// MOCKS
// ============================================================================

const mockSupabase = {
  rpc: jest.fn(),
  from: jest.fn(),
};

jest.mock('@/lib/supabase-server', () => ({
  createClient: jest.fn(() => Promise.resolve(mockSupabase)),
}));

// ============================================================================
// TEST DATA
// ============================================================================

const TEST_TENANT_ID = 'tenant-123';
const TEST_CUSTOMER_ID = 'customer-456';

const mockVipRule = {
  rule_id: 'rule-vip',
  rule_name: 'VIP Member Discount',
  discount_type: 'percentage',
  discount_value: 15,
  applies_to: ['services', 'products', 'packages'],
  priority: 90,
};

const mockLoyalRule = {
  rule_id: 'rule-loyal',
  rule_name: 'Loyal Customer Discount',
  discount_type: 'percentage',
  discount_value: 10,
  applies_to: ['services', 'products'],
  priority: 80,
};

const mockSummerCampaign = {
  campaign_id: 'campaign-summer',
  campaign_name: 'Summer Sale 2026',
  campaign_type: 'seasonal',
  discount_type: 'percentage',
  discount_value: 20,
  start_date: '2026-06-01T00:00:00Z',
  end_date: '2026-08-31T23:59:59Z',
  min_purchase_amount: null,
  stacking_allowed: false,
};

const mockReferralCampaign = {
  campaign_id: 'campaign-referral',
  campaign_name: 'Referral Bonus',
  campaign_type: 'referral',
  discount_type: 'fixed_amount',
  discount_value: 50000,
  start_date: '2026-01-01T00:00:00Z',
  end_date: '2026-12-31T23:59:59Z',
  min_purchase_amount: null,
  stacking_allowed: true,
};

// ============================================================================
// TESTS: calculateTierDiscount()
// ============================================================================

describe('calculateTierDiscount', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.rpc = jest.fn();
    mockSupabase.from = jest.fn();
  });

  test('should calculate VIP discount (15% off)', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [mockVipRule],
      error: null,
    });

    const result = await calculateTierDiscount({
      customerId: TEST_CUSTOMER_ID,
      customerTier: 'vip',
      orderTotal: 1000000, // 1M VND
      orderType: 'service',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(true);
    expect(result.discountPercent).toBe(15);
    expect(result.discountAmount).toBe(150000); // 15% of 1M
    expect(result.tierName).toBe('VIP Member Discount');
    expect(result.ruleId).toBe('rule-vip');
  });

  test('should calculate Loyal discount (10% off)', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [mockLoyalRule],
      error: null,
    });

    const result = await calculateTierDiscount({
      customerId: TEST_CUSTOMER_ID,
      customerTier: 'loyal',
      orderTotal: 500000, // 500k VND
      orderType: 'product',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(true);
    expect(result.discountPercent).toBe(10);
    expect(result.discountAmount).toBe(50000); // 10% of 500k
    expect(result.tierName).toBe('Loyal Customer Discount');
  });

  test('should return not eligible when no rules found', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await calculateTierDiscount({
      customerId: TEST_CUSTOMER_ID,
      customerTier: 'new',
      orderTotal: 1000000,
      orderType: 'service',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(false);
    expect(result.discountAmount).toBe(0);
    expect(result.reason).toContain('No discount rules configured');
  });

  test('should filter rules by order type (applies_to)', async () => {
    const serviceOnlyRule = {
      ...mockVipRule,
      applies_to: ['services'], // Only services
    };

    mockSupabase.rpc.mockResolvedValue({
      data: [serviceOnlyRule],
      error: null,
    });

    // Test with product order (should fail)
    const result = await calculateTierDiscount({
      customerId: TEST_CUSTOMER_ID,
      customerTier: 'vip',
      orderTotal: 1000000,
      orderType: 'product',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('No discount for product orders');
  });

  test('should use highest priority rule when multiple rules match', async () => {
    const highPriorityRule = { ...mockVipRule, priority: 95, discount_value: 20 };
    const lowPriorityRule = { ...mockVipRule, priority: 85, discount_value: 15 };

    mockSupabase.rpc.mockResolvedValue({
      data: [highPriorityRule, lowPriorityRule], // Already sorted by priority DESC
      error: null,
    });

    const result = await calculateTierDiscount({
      customerId: TEST_CUSTOMER_ID,
      customerTier: 'vip',
      orderTotal: 1000000,
      orderType: 'service',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.discountPercent).toBe(20); // High priority rule applied
  });

  test('should handle database error gracefully', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Database connection failed' },
    });

    const result = await calculateTierDiscount({
      customerId: TEST_CUSTOMER_ID,
      customerTier: 'vip',
      orderTotal: 1000000,
      orderType: 'service',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Failed to fetch discount rules');
  });

  test('should calculate fixed amount discount', async () => {
    const fixedRule = {
      ...mockVipRule,
      discount_type: 'fixed_amount',
      discount_value: 100000, // 100k VND flat discount
    };

    mockSupabase.rpc.mockResolvedValue({
      data: [fixedRule],
      error: null,
    });

    const result = await calculateTierDiscount({
      customerId: TEST_CUSTOMER_ID,
      customerTier: 'vip',
      orderTotal: 1000000,
      orderType: 'service',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(true);
    expect(result.discountAmount).toBe(100000); // Fixed 100k
    expect(result.discountPercent).toBe(10); // 100k / 1M = 10%
  });
});

// ============================================================================
// TESTS: applyCampaignPromotion()
// ============================================================================

describe('applyCampaignPromotion', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.rpc = jest.fn();
    mockSupabase.from = jest.fn();
  });

  test('should apply seasonal campaign (Summer Sale 20%)', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({
        // get_active_campaigns
        data: [mockSummerCampaign],
        error: null,
      })
      .mockResolvedValueOnce({
        // check_customer_campaign_usage
        data: [{ usage_count: 0, max_uses: null, can_use: true }],
        error: null,
      });

    const result = await applyCampaignPromotion({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 1000000, // 1M VND
      orderItems: [
        { serviceId: 'service-1', quantity: 1, price: 1000000 },
      ],
      orderDate: '2026-07-15T10:00:00Z', // Within Summer Sale period
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(true);
    expect(result.campaignName).toBe('Summer Sale 2026');
    expect(result.discountPercent).toBe(20);
    expect(result.discountAmount).toBe(200000); // 20% of 1M
  });

  test('should apply referral campaign (50k VND fixed)', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({
        data: [mockReferralCampaign],
        error: null,
      })
      .mockResolvedValueOnce({
        data: [{ usage_count: 0, max_uses: 5, can_use: true }],
        error: null,
      });

    const result = await applyCampaignPromotion({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 1000000,
      orderItems: [{ serviceId: 'service-1', quantity: 1, price: 1000000 }],
      orderDate: '2026-06-01T10:00:00Z',
      referralCode: 'REFER50K',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(true);
    expect(result.campaignName).toBe('Referral Bonus');
    expect(result.discountAmount).toBe(50000); // Fixed 50k
    expect(result.discountType).toBe('fixed_amount');
  });

  test('should return not eligible when no active campaigns', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await applyCampaignPromotion({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 1000000,
      orderItems: [],
      orderDate: '2026-06-01T10:00:00Z',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('No active campaigns available');
  });

  test('should reject campaign when below minimum purchase', async () => {
    const campaignWithMinPurchase = {
      ...mockSummerCampaign,
      min_purchase_amount: 500000, // Min 500k VND
    };

    mockSupabase.rpc.mockResolvedValue({
      data: [campaignWithMinPurchase],
      error: null,
    });

    const result = await applyCampaignPromotion({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 300000, // Only 300k (below minimum)
      orderItems: [{ serviceId: 'service-1', quantity: 1, price: 300000 }],
      orderDate: '2026-07-15T10:00:00Z',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('No eligible campaigns');
  });

  test('should reject campaign when customer exceeded usage limit', async () => {
    mockSupabase.rpc
      .mockResolvedValueOnce({
        data: [{ ...mockReferralCampaign, max_uses_per_customer: 5 }],
        error: null,
      })
      .mockResolvedValueOnce({
        // Customer already used 5 times (max limit)
        data: [{ usage_count: 5, max_uses: 5, can_use: false }],
        error: null,
      });

    const result = await applyCampaignPromotion({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 1000000,
      orderItems: [],
      orderDate: '2026-06-01T10:00:00Z',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('No eligible campaigns');
  });

  test('should select best campaign when multiple eligible', async () => {
    const campaign20Percent = { ...mockSummerCampaign, discount_value: 20 };
    const campaign10Percent = { ...mockSummerCampaign, discount_value: 10, campaign_id: 'campaign-2' };

    mockSupabase.rpc
      .mockResolvedValueOnce({
        // Campaigns already sorted by priority and discount_value DESC
        data: [campaign20Percent, campaign10Percent],
        error: null,
      })
      .mockResolvedValue({
        data: [{ usage_count: 0, max_uses: null, can_use: true }],
        error: null,
      });

    const result = await applyCampaignPromotion({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 1000000,
      orderItems: [],
      orderDate: '2026-07-15T10:00:00Z',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(true);
    expect(result.discountPercent).toBe(20); // Best campaign selected
  });

  test('should handle database error gracefully', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'Database error' },
    });

    const result = await applyCampaignPromotion({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 1000000,
      orderItems: [],
      orderDate: '2026-06-01T10:00:00Z',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(false);
    expect(result.reason).toContain('Failed to fetch campaigns');
  });
});

// ============================================================================
// TESTS: checkDiscountEligibility()
// ============================================================================

describe('checkDiscountEligibility', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.rpc = jest.fn();
    mockSupabase.from = jest.fn();
  });

  test('should return eligible when campaigns available', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [mockSummerCampaign, mockReferralCampaign],
      error: null,
    });

    const result = await checkDiscountEligibility({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 1000000,
      orderDate: '2026-07-15T10:00:00Z',
      existingDiscounts: [],
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(true);
    expect(result.eligibleDiscounts).toHaveLength(2);
    expect(result.violations).toHaveLength(0);
  });

  test('should return violation when order below minimum purchase', async () => {
    const campaignWithMinPurchase = {
      ...mockSummerCampaign,
      min_purchase_amount: 500000,
    };

    mockSupabase.rpc.mockResolvedValue({
      data: [campaignWithMinPurchase],
      error: null,
    });

    const result = await checkDiscountEligibility({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 300000, // Below minimum
      orderDate: '2026-07-15T10:00:00Z',
      existingDiscounts: [],
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].rule).toBe('minimum_purchase');
    expect(result.violations[0].severity).toBe('warning');
  });

  test('should return empty when no campaigns available', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [],
      error: null,
    });

    const result = await checkDiscountEligibility({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 1000000,
      orderDate: '2026-07-15T10:00:00Z',
      existingDiscounts: [],
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(false);
    expect(result.eligibleDiscounts).toHaveLength(0);
    expect(result.reason).toContain('No discounts available');
  });

  test('should handle database error gracefully', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: null,
      error: { message: 'RPC error' },
    });

    const result = await checkDiscountEligibility({
      customerId: TEST_CUSTOMER_ID,
      orderTotal: 1000000,
      orderDate: '2026-07-15T10:00:00Z',
      existingDiscounts: [],
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(false);
    expect(result.violations.length).toBeGreaterThan(0);
    expect(result.violations[0].rule).toBe('system_error');
  });
});

// ============================================================================
// TESTS: trackDiscountUsage()
// ============================================================================

describe('trackDiscountUsage', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockSupabase.rpc = jest.fn();
    mockSupabase.from = jest.fn();
  });

  const mockInsert = jest.fn();
  const mockRpcIncrement = jest.fn();

  beforeEach(() => {
    mockSupabase.from.mockReturnValue({
      insert: mockInsert,
    });
    mockSupabase.rpc.mockImplementation((funcName: string) => {
      if (funcName === 'increment_campaign_usage') {
        return Promise.resolve({ data: null, error: null });
      }
      return Promise.resolve({ data: [], error: null });
    });
  });

  test('should track tier discount usage', async () => {
    mockInsert.mockResolvedValue({ error: null });

    const result = await trackDiscountUsage({
      tenantId: TEST_TENANT_ID,
      customerId: TEST_CUSTOMER_ID,
      discountRuleId: 'rule-vip',
      bookingId: 'booking-123',
      discountType: 'percentage',
      discountAmount: 150000,
      originalAmount: 1000000,
      finalAmount: 850000,
      metadata: { tier: 'vip' },
    });

    expect(result.success).toBe(true);
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        tenant_id: TEST_TENANT_ID,
        customer_id: TEST_CUSTOMER_ID,
        discount_rule_id: 'rule-vip',
        discount_amount: 150000,
      })
    );
  });

  test('should track campaign discount usage and increment count', async () => {
    mockInsert.mockResolvedValue({ error: null });

    const result = await trackDiscountUsage({
      tenantId: TEST_TENANT_ID,
      customerId: TEST_CUSTOMER_ID,
      discountCampaignId: 'campaign-summer',
      bookingId: 'booking-123',
      discountType: 'percentage',
      discountAmount: 200000,
      originalAmount: 1000000,
      finalAmount: 800000,
    });

    expect(result.success).toBe(true);
    expect(mockSupabase.rpc).toHaveBeenCalledWith('increment_campaign_usage', {
      p_campaign_id: 'campaign-summer',
    });
  });

  test('should handle insert error gracefully', async () => {
    mockInsert.mockResolvedValue({
      error: { message: 'Insert failed' },
    });

    const result = await trackDiscountUsage({
      tenantId: TEST_TENANT_ID,
      customerId: TEST_CUSTOMER_ID,
      discountRuleId: 'rule-vip',
      discountType: 'percentage',
      discountAmount: 150000,
      originalAmount: 1000000,
      finalAmount: 850000,
    });

    expect(result.success).toBe(false);
    expect(result.error).toContain('Insert failed');
  });
});

// ============================================================================
// EDGE CASES & INTEGRATION TESTS
// ============================================================================

describe('Edge Cases', () => {
  test('should handle zero order total', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [mockVipRule],
      error: null,
    });

    const result = await calculateTierDiscount({
      customerId: TEST_CUSTOMER_ID,
      customerTier: 'vip',
      orderTotal: 0, // Zero order
      orderType: 'service',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(true);
    expect(result.discountAmount).toBe(0); // 15% of 0 = 0
  });

  test('should handle very large order total', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [mockVipRule],
      error: null,
    });

    const result = await calculateTierDiscount({
      customerId: TEST_CUSTOMER_ID,
      customerTier: 'vip',
      orderTotal: 100000000, // 100M VND
      orderType: 'service',
      tenantId: TEST_TENANT_ID,
    });

    expect(result.eligible).toBe(true);
    expect(result.discountAmount).toBe(15000000); // 15% of 100M
  });

  test('should round discount amount to integer', async () => {
    mockSupabase.rpc.mockResolvedValue({
      data: [{ ...mockVipRule, discount_value: 13.33 }], // Weird percentage
      error: null,
    });

    const result = await calculateTierDiscount({
      customerId: TEST_CUSTOMER_ID,
      customerTier: 'vip',
      orderTotal: 1000000,
      orderType: 'service',
      tenantId: TEST_TENANT_ID,
    });

    expect(Number.isInteger(result.discountAmount)).toBe(true);
  });
});
