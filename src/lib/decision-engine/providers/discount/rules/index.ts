/**
 * Discount Rules Registry
 * 
 * Centralized export of all discount eligibility rules.
 * Rules are organized by category for maintainability.
 * 
 * Rule Categories:
 * - Membership Tier (4 rules): VIP, Loyal, Active, New
 * - Campaign (4 rules): Seasonal, Bundle, Referral
 * - Lifecycle (3 rules): Birthday, Weekend, Default
 * 
 * Total: 11 rules
 * 
 * Priority Order (highest to lowest):
 * 1. VIP Customer (110)
 * 2. Loyal Customer (100)
 * 3. New Customer (95)
 * 4. Lunar New Year Campaign (90)
 * 5. Summer Promotion (85)
 * 6. Bundle Services (80)
 * 7. Referral Program (75)
 * 8. Birthday Month (70)
 * 9. Active Customer (60)
 * 10. Weekend Special (50)
 * 11. No Discount (10) - Fallback
 * 
 * @module decision-engine/providers/discount/rules
 */

import type { Rule } from '@/lib/decision-engine/types';
import { membershipTierRules } from './membership-tier-rules';
import { campaignRules } from './campaign-rules';
import { lifecycleRules } from './lifecycle-rules';

/**
 * All discount eligibility rules sorted by priority (descending)
 * 
 * Engine will evaluate rules in order until first match.
 * Higher priority rules take precedence over lower priority ones.
 */
export const discountRules: Rule[] = [
  ...membershipTierRules,
  ...campaignRules,
  ...lifecycleRules,
].sort((a, b) => b.priority - a.priority);

/**
 * Get all enabled discount rules
 */
export function getEnabledDiscountRules(): Rule[] {
  return discountRules.filter((rule) => rule.enabled);
}

/**
 * Get discount rules by category
 */
export function getDiscountRulesByCategory(category: string): Rule[] {
  return discountRules.filter((rule) => rule.metadata?.category === category);
}

/**
 * Get discount rule by ID
 */
export function getDiscountRuleById(ruleId: string): Rule | undefined {
  return discountRules.find((rule) => rule.id === ruleId);
}

/**
 * Count discount rules by status
 */
export function getDiscountRuleStats(): {
  total: number;
  enabled: number;
  disabled: number;
  byCategory: Record<string, number>;
} {
  const enabled = discountRules.filter((r) => r.enabled).length;
  const byCategory: Record<string, number> = {};

  for (const rule of discountRules) {
    const category = rule.metadata?.category as string || 'unknown';
    byCategory[category] = (byCategory[category] || 0) + 1;
  }

  return {
    total: discountRules.length,
    enabled,
    disabled: discountRules.length - enabled,
    byCategory,
  };
}

// Re-export individual rule arrays for fine-grained access
export { membershipTierRules } from './membership-tier-rules';
export { campaignRules } from './campaign-rules';
export { lifecycleRules } from './lifecycle-rules';

// Re-export specific rules for direct reference
export {
  vipCustomerDiscountRule,
  loyalCustomerDiscountRule,
  activeCustomerDiscountRule,
  newCustomerDiscountRule,
} from './membership-tier-rules';

export {
  lunarNewYearCampaignRule,
  summerPromotionRule,
  bundleDiscountRule,
  referralDiscountRule,
} from './campaign-rules';

export {
  birthdayMonthDiscountRule,
  weekendSpecialRule,
  noDiscountRule,
} from './lifecycle-rules';
