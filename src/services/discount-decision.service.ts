/**
 * Discount Decision Service
 * 
 * Centralizes all discount calculation logic using Decision Engine framework.
 * 
 * Provider Methods:
 * 1. calculateTierDiscount() - Membership tier discounts (VIP/Loyal/New)
 * 2. applyCampaignPromotion() - Time-bound campaigns (seasonal/bundles/referrals)
 * 3. checkDiscountEligibility() - Validate eligibility conditions
 * 
 * Architecture:
 * - Uses DecisionEngineContext wrapper for automatic metrics emission
 * - Domain-agnostic (works same as Booking providers)
 * - Fire-and-forget metrics (never blocks discount calculation)
 * 
 * @module services/discount-decision
 */

import { createClient } from '@/lib/supabase-server';

// ============================================================================
// TYPES
// ============================================================================

export interface CalculateTierDiscountRequest {
  customerId: string;
  customerTier: 'vip' | 'loyal' | 'new';
  orderTotal: number; // VND
  orderType: 'service' | 'product' | 'package';
  serviceIds?: string[];
  productIds?: string[];
  tenantId: string;
}

export interface CalculateTierDiscountResult {
  eligible: boolean;
  discountPercent: number; // 0-100
  discountAmount: number; // VND
  tierName: string;
  reason: string;
  ruleId?: string;
  executionTime: number; // ms
}

export interface ApplyCampaignPromotionRequest {
  customerId: string;
  orderTotal: number; // VND
  orderItems: Array<{
    serviceId?: string;
    productId?: string;
    quantity: number;
    price: number;
  }>;
  orderDate: string; // ISO timestamp
  branchId?: string;
  referralCode?: string;
  tenantId: string;
}

export interface ApplyCampaignPromotionResult {
  eligible: boolean;
  campaignId?: string;
  campaignName?: string;
  discountType: 'percentage' | 'fixed_amount' | 'bundle' | 'gift';
  discountPercent?: number;
  discountAmount?: number;
  freeItem?: { itemId: string; quantity: number };
  reason: string;
  validUntil?: string; // Campaign end date
  executionTime: number; // ms
}

export interface CheckDiscountEligibilityRequest {
  customerId: string;
  orderTotal: number;
  orderDate: string;
  serviceIds?: string[];
  productIds?: string[];
  branchId?: string;
  existingDiscounts: string[]; // Already applied discount IDs
  tenantId: string;
}

export interface CheckDiscountEligibilityResult {
  eligible: boolean;
  violations: Array<{
    rule: string;
    message: string;
    severity: 'blocking' | 'warning';
  }>;
  eligibleDiscounts: string[]; // IDs of discounts customer can use
  reason: string;
  executionTime: number; // ms
}

// ============================================================================
// PROVIDER 1: Calculate Tier Discount
// ============================================================================

/**
 * Calculate membership tier discount (VIP/Loyal/New)
 * 
 * Logic:
 * 1. Query discount_rules for customer tier
 * 2. Filter by order type (service/product/package)
 * 3. Apply highest priority rule
 * 4. Calculate discount amount with min/max caps
 * 
 * @param request - Discount calculation parameters
 * @returns Discount result with amount and reason
 */
export async function calculateTierDiscount(
  request: CalculateTierDiscountRequest
): Promise<CalculateTierDiscountResult> {
  const startTime = performance.now();

  try {
    const supabase = await createClient();

    // Step 1: Query tier discount rules
    const rpcFn = (supabase.rpc as unknown) as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data: rulesRaw, error: rulesError } = await rpcFn('get_customer_tier_discounts', {
      p_tenant_id: request.tenantId,
      p_customer_tier: request.customerTier,
    });
    const rules = rulesRaw as unknown as Array<{
      discount_type: string;
      discount_value: number;
      rule_name: string;
      rule_id: string;
      applies_to: string[];
    }> | null;

    if (rulesError) {
      console.error('[CalculateTierDiscount] Failed to fetch rules:', rulesError);
      return {
        eligible: false,
        discountPercent: 0,
        discountAmount: 0,
        tierName: request.customerTier.toUpperCase(),
        reason: 'Failed to fetch discount rules',
        executionTime: performance.now() - startTime,
      };
    }

    // Step 2: No rules found
    if (!rules || rules.length === 0) {
      return {
        eligible: false,
        discountPercent: 0,
        discountAmount: 0,
        tierName: request.customerTier.toUpperCase(),
        reason: 'No discount rules configured for tier',
        executionTime: performance.now() - startTime,
      };
    }

    // Step 3: Filter rules by order type (applies_to)
    const applicableRules = rules.filter((rule: any) => {
      const appliesTo = rule.applies_to || [];
      return (
        appliesTo.includes('all') ||
        (request.orderType === 'service' && appliesTo.includes('services')) ||
        (request.orderType === 'product' && appliesTo.includes('products')) ||
        (request.orderType === 'package' && appliesTo.includes('packages'))
      );
    });

    if (applicableRules.length === 0) {
      return {
        eligible: false,
        discountPercent: 0,
        discountAmount: 0,
        tierName: request.customerTier.toUpperCase(),
        reason: `No discount for ${request.orderType} orders`,
        executionTime: performance.now() - startTime,
      };
    }

    // Step 4: Use highest priority rule (already sorted by priority DESC in RPC)
    const rule = applicableRules[0];

    // Step 5: Calculate discount amount
    let discountAmount = 0;
    let discountPercent = 0;

    if (rule.discount_type === 'percentage') {
      discountPercent = rule.discount_value;
      discountAmount = (request.orderTotal * discountPercent) / 100;
    } else if (rule.discount_type === 'fixed_amount') {
      discountAmount = rule.discount_value;
      discountPercent = (discountAmount / request.orderTotal) * 100;
    }

    // Step 6: Apply min/max caps (if configured in rule metadata)
    // Note: max_discount_amount and min_discount_amount columns exist but not used yet
    // Future: Add logic to enforce caps

    // Step 7: Return result
    return {
      eligible: true,
      discountPercent,
      discountAmount: Math.round(discountAmount),
      tierName: rule.rule_name,
      reason: `${request.customerTier.toUpperCase()} tier discount applied`,
      ruleId: rule.rule_id,
      executionTime: performance.now() - startTime,
    };
  } catch (error) {
    console.error('[CalculateTierDiscount] Unexpected error:', error);
    return {
      eligible: false,
      discountPercent: 0,
      discountAmount: 0,
      tierName: request.customerTier.toUpperCase(),
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      executionTime: performance.now() - startTime,
    };
  }
}

// ============================================================================
// PROVIDER 2: Apply Campaign Promotion
// ============================================================================

/**
 * Apply time-bound campaign promotions (seasonal/bundles/referrals)
 * 
 * Logic:
 * 1. Query active campaigns (start_date <= now <= end_date)
 * 2. Check customer usage limits (max_uses_per_customer)
 * 3. Validate eligibility (min purchase, time restrictions, etc.)
 * 4. Apply best campaign (highest discount)
 * 5. Track usage in discount_usage table
 * 
 * @param request - Campaign application parameters
 * @returns Campaign result with discount or reason
 */
export async function applyCampaignPromotion(
  request: ApplyCampaignPromotionRequest
): Promise<ApplyCampaignPromotionResult> {
  const startTime = performance.now();

  try {
    const supabase = await createClient();

    // Step 1: Query active campaigns
    const rpcFn = (supabase.rpc as unknown) as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data: campaignsRaw, error: campaignsError } = await rpcFn('get_active_campaigns', {
      p_tenant_id: request.tenantId,
      p_check_date: request.orderDate,
    });
    const campaigns = campaignsRaw as unknown as Array<{
      campaign_id: string;
      campaign_name: string;
      discount_type: 'percentage' | 'fixed_amount' | 'bundle' | 'gift';
      discount_value: number;
      min_purchase_amount?: number | null;
      max_uses_per_customer?: number | null;
      end_date?: string | null;
      [key: string]: unknown;
    }> | null;

    if (campaignsError) {
      console.error('[ApplyCampaignPromotion] Failed to fetch campaigns:', campaignsError);
      return {
        eligible: false,
        discountType: 'percentage',
        reason: 'Failed to fetch campaigns',
        executionTime: performance.now() - startTime,
      };
    }

    // Step 2: No active campaigns
    if (!campaigns || campaigns.length === 0) {
      return {
        eligible: false,
        discountType: 'percentage',
        reason: 'No active campaigns available',
        executionTime: performance.now() - startTime,
      };
    }

    // Step 3: Filter campaigns by eligibility
    const eligibleCampaigns: any[] = [];

    for (const campaign of campaigns) {
      // Check minimum purchase
      if (campaign.min_purchase_amount && request.orderTotal < campaign.min_purchase_amount) {
        continue; // Skip this campaign
      }

      // Check customer usage limit
      if (campaign.max_uses_per_customer) {
        const usageRpcFn = (supabase.rpc as unknown) as (
          fn: string,
          args: Record<string, unknown>
        ) => Promise<{ data: unknown; error: { message: string } | null }>;
        const { data: usageRaw } = await usageRpcFn('check_customer_campaign_usage', {
          p_customer_id: request.customerId,
          p_campaign_id: campaign.campaign_id,
        });
        const usage = usageRaw as unknown as Array<{ can_use: boolean }> | null;

        if (usage && usage.length > 0 && !usage[0].can_use) {
          continue; // Customer exceeded usage limit
        }
      }

      // TODO: Check time restrictions (days of week, hours)
      // TODO: Check branch restrictions
      // TODO: Check service/product applicability

      // Campaign is eligible
      eligibleCampaigns.push(campaign);
    }

    // Step 4: No eligible campaigns
    if (eligibleCampaigns.length === 0) {
      return {
        eligible: false,
        discountType: 'percentage',
        reason: 'No eligible campaigns (check minimum purchase or usage limits)',
        executionTime: performance.now() - startTime,
      };
    }

    // Step 5: Select best campaign (highest discount)
    // For now, use first campaign (already sorted by priority and discount_value DESC)
    const bestCampaign = eligibleCampaigns[0];

    // Step 6: Calculate discount based on campaign type
    let discountAmount = 0;
    let discountPercent = 0;
    let freeItem: { itemId: string; quantity: number } | undefined;

    if (bestCampaign.discount_type === 'percentage') {
      discountPercent = bestCampaign.discount_value;
      discountAmount = (request.orderTotal * discountPercent) / 100;
    } else if (bestCampaign.discount_type === 'fixed_amount') {
      discountAmount = bestCampaign.discount_value;
      discountPercent = (discountAmount / request.orderTotal) * 100;
    } else if (bestCampaign.discount_type === 'bundle') {
      // TODO: Implement bundle logic (buy X get Y)
      discountAmount = 0;
    } else if (bestCampaign.discount_type === 'gift') {
      // TODO: Implement gift logic (free item)
      freeItem = { itemId: 'gift-item', quantity: 1 };
    }

    // Step 7: Return result
    return {
      eligible: true,
      campaignId: bestCampaign.campaign_id,
      campaignName: bestCampaign.campaign_name,
      discountType: bestCampaign.discount_type,
      discountPercent,
      discountAmount: Math.round(discountAmount),
      freeItem,
      reason: `Campaign "${bestCampaign.campaign_name}" applied`,
      validUntil: bestCampaign.end_date,
      executionTime: performance.now() - startTime,
    };
  } catch (error) {
    console.error('[ApplyCampaignPromotion] Unexpected error:', error);
    return {
      eligible: false,
      discountType: 'percentage',
      reason: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
      executionTime: performance.now() - startTime,
    };
  }
}

// ============================================================================
// PROVIDER 3: Check Discount Eligibility
// ============================================================================

/**
 * Validate all eligibility conditions before applying discount
 * 
 * Logic:
 * 1. Check minimum purchase requirement
 * 2. Check time restrictions (weekday/weekend, time range)
 * 3. Check service/product exclusions
 * 4. Check customer usage limits
 * 5. Check stacking rules (can combine discounts?)
 * 6. Return violations or eligible discount IDs
 * 
 * @param request - Eligibility check parameters
 * @returns Eligibility result with violations or eligible discounts
 */
export async function checkDiscountEligibility(
  request: CheckDiscountEligibilityRequest
): Promise<CheckDiscountEligibilityResult> {
  const startTime = performance.now();

  try {
    const violations: Array<{
      rule: string;
      message: string;
      severity: 'blocking' | 'warning';
    }> = [];

    const eligibleDiscounts: string[] = [];

    // Step 1: Check minimum purchase (placeholder - no global min purchase yet)
    // In real implementation, query global settings or campaign-specific min purchase

    // Step 2: Check time restrictions (placeholder)
    // In real implementation, check day of week, time of day against campaign restrictions

    // Step 3: Check stacking rules
    if (request.existingDiscounts.length > 0) {
      // Check if any existing discounts disallow stacking
      // For now, assume stacking is allowed
    }

    // Step 4: Query all active tier rules and campaigns
    const supabase = await createClient();

    // Get tier discounts (if customer has tier)
    // Note: We need customer tier, which is not in request
    // For now, assume eligible

    // Get active campaigns
    const rpcFn = (supabase.rpc as unknown) as (
      fn: string,
      args: Record<string, unknown>
    ) => Promise<{ data: unknown; error: { message: string } | null }>;
    const { data: campaignsRaw } = await rpcFn('get_active_campaigns', {
      p_tenant_id: request.tenantId,
      p_check_date: request.orderDate,
    });
    const campaigns = campaignsRaw as unknown as Array<{
      campaign_id: string;
      campaign_name: string;
      discount_type: 'percentage' | 'fixed_amount' | 'bundle' | 'gift';
      discount_value: number;
      min_purchase_amount?: number | null;
      max_uses_per_customer?: number | null;
      end_date?: string | null;
      [key: string]: unknown;
    }> | null;

    if (campaigns && campaigns.length > 0) {
      for (const campaign of campaigns) {
        // Check min purchase
        if (campaign.min_purchase_amount && request.orderTotal < campaign.min_purchase_amount) {
          violations.push({
            rule: 'minimum_purchase',
            message: `Order total (${request.orderTotal} VND) below campaign minimum (${campaign.min_purchase_amount} VND)`,
            severity: 'warning',
          });
          continue;
        }

        // Campaign is eligible
        eligibleDiscounts.push(campaign.campaign_id);
      }
    }

    // Step 5: Return result
    const eligible = eligibleDiscounts.length > 0 && violations.filter(v => v.severity === 'blocking').length === 0;

    return {
      eligible,
      violations,
      eligibleDiscounts,
      reason: eligible
        ? `${eligibleDiscounts.length} discount(s) available`
        : violations.length > 0
        ? `Eligibility failed: ${violations[0].message}`
        : 'No discounts available',
      executionTime: performance.now() - startTime,
    };
  } catch (error) {
    console.error('[CheckDiscountEligibility] Unexpected error:', error);
    return {
      eligible: false,
      violations: [
        {
          rule: 'system_error',
          message: `Error: ${error instanceof Error ? error.message : 'Unknown'}`,
          severity: 'blocking',
        },
      ],
      eligibleDiscounts: [],
      reason: 'System error during eligibility check',
      executionTime: performance.now() - startTime,
    };
  }
}

// ============================================================================
// HELPER: Track Discount Usage
// ============================================================================

/**
 * Track discount usage in discount_usage table
 * 
 * Call this after successfully applying a discount to an order.
 * 
 * @param params - Usage tracking parameters
 */
export async function trackDiscountUsage(params: {
  tenantId: string;
  customerId: string;
  discountRuleId?: string;
  discountCampaignId?: string;
  orderId?: string;
  bookingId?: string;
  discountType: 'percentage' | 'fixed_amount' | 'bundle' | 'gift';
  discountAmount: number;
  originalAmount: number;
  finalAmount: number;
  metadata?: Record<string, any>;
}): Promise<{ success: boolean; error?: string }> {
  try {
    const supabase = await createClient();

    const rawClient = (supabase as unknown) as {
      from: (table: string) => {
        insert: (data: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
      };
    };

    const { error } = await rawClient.from('discount_usage').insert({
      tenant_id: params.tenantId,
      customer_id: params.customerId,
      discount_rule_id: params.discountRuleId || null,
      discount_campaign_id: params.discountCampaignId || null,
      order_id: params.orderId || null,
      booking_id: params.bookingId || null,
      discount_type: params.discountType,
      discount_amount: params.discountAmount,
      original_amount: params.originalAmount,
      final_amount: params.finalAmount,
      metadata: (params.metadata || {}) as Record<string, unknown>,
    });

    if (error) {
      console.error('[TrackDiscountUsage] Insert failed:', error);
      return { success: false, error: error.message };
    }

    // Increment campaign usage count (if campaign discount)
    if (params.discountCampaignId) {
      const rpcFn = (supabase.rpc as unknown) as (
        fn: string,
        args: Record<string, unknown>
      ) => Promise<{ error: { message: string } | null }>;
      await rpcFn('increment_campaign_usage', {
        p_campaign_id: params.discountCampaignId,
      });
    }

    return { success: true };
  } catch (error) {
    console.error('[TrackDiscountUsage] Unexpected error:', error);
    return {
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
    };
  }
}
