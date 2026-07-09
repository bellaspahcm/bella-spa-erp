/**
 * Discount Provider - Public API
 * 
 * Provider #2 for Decision Engine Platform (Phase 0.5).
 * Proves platform extensibility beyond Booking domain.
 * 
 * @module decision-engine/providers/discount
 */

// Main provider
export { DiscountProvider } from './discount-provider';

// Types
export type {
  CustomerTier,
  DiscountType,
  DiscountDecisionInput,
  DiscountDecisionOutput,
  DiscountKnowledge,
} from './types';

// Rules (for inspection/debugging)
export {
  discountRules,
  getEnabledDiscountRules,
  getDiscountRulesByCategory,
  getDiscountRuleById,
  getDiscountRuleStats,
} from './rules';

// Helper functions
export {
  vipCustomerDiscountRule,
  loyalCustomerDiscountRule,
  activeCustomerDiscountRule,
  newCustomerDiscountRule,
  lunarNewYearCampaignRule,
  summerPromotionRule,
  bundleDiscountRule,
  referralDiscountRule,
  birthdayMonthDiscountRule,
  weekendSpecialRule,
  noDiscountRule,
} from './rules';
