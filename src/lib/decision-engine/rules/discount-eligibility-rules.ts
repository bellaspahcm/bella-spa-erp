/**
 * Discount Eligibility Rules
 * 
 * Provider #2: Proves Decision Engine works beyond Booking domain.
 * 
 * Business Rules:
 * - Membership tier discounts (VIP, Loyal, Active, New)
 * - Campaign-based promotions (seasonal, events)
 * - Package bundle discounts
 * - First-time customer discounts
 * - Minimum purchase requirements
 * - Exclusion rules (cannot combine certain discounts)
 * 
 * Priority Model (highest to lowest):
 * - 100-110: VIP/Premium tier discounts
 * - 90-99: Loyal customer discounts
 * - 80-89: Campaign/seasonal promotions
 * - 70-79: Bundle/package discounts
 * - 60-69: First-time customer discounts
 * - 50-59: Standard discounts
 * 
 * @module DecisionEngine/Rules/Discount
 */

import type { IfThenRule } from '../providers/RuleProvider';

/**
 * Customer tier for discount eligibility
 */
export type CustomerTier = 'new' | 'active' | 'loyal' | 'vip';

/**
 * Discount type
 */
export type DiscountType = 
  | 'membership' 
  | 'campaign' 
  | 'bundle' 
  | 'firsttime' 
  | 'referral' 
  | 'seasonal'
  | 'none';

/**
 * Map customer status and history to tier
 * 
 * @param status - Customer status from database
 * @param totalSpending - Total lifetime spending (VND)
 * @param completedBookingsCount - Number of completed bookings
 * @returns Customer tier for discount rules
 */
export function mapCustomerTierForDiscount(
  status: string | null | undefined,
  totalSpending: number,
  completedBookingsCount: number
): CustomerTier {
  const normalizedStatus = String(status ?? '').trim().toLowerCase();
  
  // VIP: High lifetime value (>50M) OR VIP status
  if (totalSpending >= 50000000 || normalizedStatus === 'vip') {
    return 'vip';
  }
  
  // Loyal: Good spending (>20M) OR many bookings (>10)
  if (totalSpending >= 20000000 || completedBookingsCount > 10) {
    return 'loyal';
  }
  
  // Active: Some history (>1 booking)
  if (completedBookingsCount > 1) {
    return 'active';
  }
  
  // New: First-time or no history
  return 'new';
}

/**
 * Calculate final discount amount
 * 
 * @param totalAmount - Total purchase amount before discount
 * @param discountPercent - Discount percentage (0-100)
 * @returns Discount amount in VND
 */
export function calculateDiscountAmount(
  totalAmount: number,
  discountPercent: number
): number {
  const clampedPercent = Math.max(0, Math.min(100, discountPercent));
  return Math.round(totalAmount * clampedPercent / 100);
}

/**
 * Check if current date is within campaign period
 * 
 * @param campaignStart - Campaign start date (ISO string)
 * @param campaignEnd - Campaign end date (ISO string)
 * @returns Whether current date is in campaign period
 */
export function isWithinCampaignPeriod(
  campaignStart: string | null,
  campaignEnd: string | null
): boolean {
  if (!campaignStart || !campaignEnd) return false;
  
  const now = new Date();
  const start = new Date(campaignStart);
  const end = new Date(campaignEnd);
  
  return now >= start && now <= end;
}

/**
 * Get all discount eligibility rules
 * 
 * Rules are evaluated in priority order (highest first).
 * First matching rule determines the discount.
 * 
 * @returns Array of discount rules sorted by priority
 */
export function getDiscountEligibilityRules(): IfThenRule[] {
  return [
    // Priority 110: VIP customers get 15% discount (no minimum)
    {
      id: 'discount-vip-15percent',
      name: 'VIP Customer Discount',
      priority: 110,
      condition: {
        and: [
          { field: 'customerTier', operator: '==', value: 'vip' },
        ],
      },
      action: {
        eligible: true,
        discountPercent: 15,
        discountType: 'membership',
        reason: 'VIP membership: 15% discount on all purchases',
        restrictions: [],
      },
    },

    // Priority 100: Loyal customers get 10% discount (minimum 5M)
    {
      id: 'discount-loyal-10percent',
      name: 'Loyal Customer Discount',
      priority: 100,
      condition: {
        and: [
          { field: 'customerTier', operator: '==', value: 'loyal' },
          { field: 'totalAmount', operator: '>=', value: 5000000 },
        ],
      },
      action: {
        eligible: true,
        discountPercent: 10,
        discountType: 'membership',
        reason: 'Loyal customer: 10% discount for purchases ≥5M VND',
        restrictions: ['minimum_5m'],
      },
    },

    // Priority 95: First-time customer gets 5% welcome discount
    {
      id: 'discount-firsttime-5percent',
      name: 'First-Time Customer Welcome Discount',
      priority: 95,
      condition: {
        and: [
          { field: 'customerTier', operator: '==', value: 'new' },
          { field: 'isFirstBooking', operator: '==', value: true },
        ],
      },
      action: {
        eligible: true,
        discountPercent: 5,
        discountType: 'firsttime',
        reason: 'Welcome discount: 5% off your first booking',
        restrictions: ['first_booking_only'],
      },
    },

    // Priority 90: Lunar New Year campaign (20% off for all)
    {
      id: 'discount-campaign-lunar-new-year',
      name: 'Lunar New Year Campaign',
      priority: 90,
      condition: {
        and: [
          { field: 'campaignCode', operator: '==', value: 'TET2026' },
          { field: 'isWithinCampaign', operator: '==', value: true },
          { field: 'totalAmount', operator: '>=', value: 3000000 },
        ],
      },
      action: {
        eligible: true,
        discountPercent: 20,
        discountType: 'campaign',
        reason: 'Lunar New Year special: 20% off for purchases ≥3M VND',
        restrictions: ['campaign_period', 'minimum_3m'],
        campaignCode: 'TET2026',
      },
    },

    // Priority 85: Summer promotion (15% off)
    {
      id: 'discount-campaign-summer',
      name: 'Summer Promotion',
      priority: 85,
      condition: {
        and: [
          { field: 'campaignCode', operator: '==', value: 'SUMMER2026' },
          { field: 'isWithinCampaign', operator: '==', value: true },
          { field: 'totalAmount', operator: '>=', value: 5000000 },
        ],
      },
      action: {
        eligible: true,
        discountPercent: 15,
        discountType: 'campaign',
        reason: 'Summer special: 15% off for purchases ≥5M VND',
        restrictions: ['campaign_period', 'minimum_5m'],
        campaignCode: 'SUMMER2026',
      },
    },

    // Priority 80: Package bundle discount (12% for multiple services)
    {
      id: 'discount-bundle-3services',
      name: 'Bundle Discount - 3+ Services',
      priority: 80,
      condition: {
        and: [
          { field: 'serviceCount', operator: '>=', value: 3 },
          { field: 'totalAmount', operator: '>=', value: 10000000 },
        ],
      },
      action: {
        eligible: true,
        discountPercent: 12,
        discountType: 'bundle',
        reason: 'Bundle discount: 12% off when purchasing 3+ services (≥10M VND)',
        restrictions: ['minimum_3_services', 'minimum_10m'],
      },
    },

    // Priority 75: Referral discount (8% for both referrer and referee)
    {
      id: 'discount-referral-8percent',
      name: 'Referral Discount',
      priority: 75,
      condition: {
        and: [
          { field: 'hasReferralCode', operator: '==', value: true },
          { field: 'totalAmount', operator: '>=', value: 5000000 },
        ],
      },
      action: {
        eligible: true,
        discountPercent: 8,
        discountType: 'referral',
        reason: 'Referral program: 8% off for referred customers (≥5M VND)',
        restrictions: ['valid_referral', 'minimum_5m'],
      },
    },

    // Priority 70: Birthday month discount (10% special)
    {
      id: 'discount-birthday-month',
      name: 'Birthday Month Special',
      priority: 70,
      condition: {
        and: [
          { field: 'isBirthdayMonth', operator: '==', value: true },
          { field: 'totalAmount', operator: '>=', value: 3000000 },
        ],
      },
      action: {
        eligible: true,
        discountPercent: 10,
        discountType: 'seasonal',
        reason: 'Birthday special: 10% off during your birthday month (≥3M VND)',
        restrictions: ['birthday_month_only', 'minimum_3m'],
      },
    },

    // Priority 60: Active customer small discount (5% for repeat customers)
    {
      id: 'discount-active-5percent',
      name: 'Active Customer Appreciation',
      priority: 60,
      condition: {
        and: [
          { field: 'customerTier', operator: '==', value: 'active' },
          { field: 'totalAmount', operator: '>=', value: 7000000 },
        ],
      },
      action: {
        eligible: true,
        discountPercent: 5,
        discountType: 'membership',
        reason: 'Active customer: 5% off for purchases ≥7M VND',
        restrictions: ['minimum_7m'],
      },
    },

    // Priority 50: Weekend promotion (7% off on Saturdays/Sundays)
    {
      id: 'discount-weekend-7percent',
      name: 'Weekend Special',
      priority: 50,
      condition: {
        and: [
          { field: 'isWeekend', operator: '==', value: true },
          { field: 'totalAmount', operator: '>=', value: 5000000 },
        ],
      },
      action: {
        eligible: true,
        discountPercent: 7,
        discountType: 'seasonal',
        reason: 'Weekend special: 7% off for Saturday/Sunday bookings (≥5M VND)',
        restrictions: ['weekend_only', 'minimum_5m'],
      },
    },

    // Priority 10: No discount (fallback)
    {
      id: 'discount-none',
      name: 'No Discount',
      priority: 10,
      condition: {
        // Always matches if no other rule matched
        field: 'totalAmount', 
        operator: '>=', 
        value: 0,
      },
      action: {
        eligible: false,
        discountPercent: 0,
        discountType: 'none',
        reason: 'No discount applicable for this purchase',
        restrictions: [],
      },
    },
  ];
}
