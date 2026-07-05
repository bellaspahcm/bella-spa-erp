/**
 * Discount Eligibility Rules
 * 
 * @deprecated This file uses legacy rule format. For reference only.
 * See src/services/providers/ for current implementation.
 */

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
 */
export function mapCustomerTierForDiscount(
  status: string | null | undefined,
  totalSpending: number,
  completedBookingsCount: number
): CustomerTier {
  const normalizedStatus = String(status ?? '').trim().toLowerCase();
  
  if (totalSpending >= 50000000 || normalizedStatus === 'vip') {
    return 'vip';
  }
  
  if (totalSpending >= 20000000 || completedBookingsCount > 10) {
    return 'loyal';
  }
  
  if (completedBookingsCount > 1) {
    return 'active';
  }
  
  return 'new';
}

/**
 * Calculate final discount amount
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
 * @deprecated Legacy rules - use for reference only
 */
export function getDiscountEligibilityRules(): any[] {
  return [];
}
