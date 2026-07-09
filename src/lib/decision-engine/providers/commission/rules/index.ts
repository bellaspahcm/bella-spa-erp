/**
 * @fileoverview Commission Rules Index
 * 
 * Central export point for all commission calculation rules.
 * 
 * **Rule Categories:**
 * 1. Gate Rules (2 rules, disabled by default) - Priority: 195-199
 * 2. Base Commission Rules (5 rules) - Priority: 200-240
 * 3. Volume Tier Rules (4 rules) - Priority: 250-280
 * 4. Performance Multiplier Rules (5 rules) - Priority: 290-330
 * 
 * **Total:** 16 rules (14 enabled, 2 disabled)
 * 
 * **Rule Priority Order:**
 * ```
 * 195-199: Gates (eligibility checks, reject if fail)
 * 200-240: Base Commission (fixed/percentage calculation)
 * 250-280: Volume Tiers (session count multipliers)
 * 290-330: Performance Multipliers (rating-based adjustments)
 * ```
 * 
 * **Execution Flow:**
 * 1. Check gates → If any reject, STOP
 * 2. Calculate base commission → Service + Product
 * 3. Apply volume multiplier → Based on total sessions
 * 4. Apply performance multiplier → Based on avg rating
 * 5. Add bonuses → Position, seniority, manual adjustments
 * 6. Return total commission
 * 
 * @module decision-engine/providers/commission/rules
 */

// Gate Rules (Priority: 195-199)
export {
  minimumSessionsGateRule,
  qualityGateRule,
} from './gate-rules';

// Base Commission Rules (Priority: 200-240)
export {
  serviceCommissionFixedRule,
  serviceCommissionPercentageRule,
  productCommissionFixedRule,
  productCommissionPercentageRule,
  manualOverrideCommissionRule,
} from './base-commission-rules';

// Volume Tier Rules (Priority: 250-280)
export {
  volumeTierStandardRule,
  volumeTierHighRule,
  volumeTierPremiumRule,
  volumeTierEliteRule,
} from './volume-tier-rules';

// Performance Multiplier Rules (Priority: 290-330)
export {
  performanceBelowStandardRule,
  performanceStandardRule,
  performanceGoodRule,
  performanceExcellentRule,
  performancePerfectRule,
} from './performance-multiplier-rules';

/**
 * All Commission Rules (for provider initialization)
 */
import { minimumSessionsGateRule, qualityGateRule } from './gate-rules';
import {
  serviceCommissionFixedRule,
  serviceCommissionPercentageRule,
  productCommissionFixedRule,
  productCommissionPercentageRule,
  manualOverrideCommissionRule,
} from './base-commission-rules';
import {
  volumeTierStandardRule,
  volumeTierHighRule,
  volumeTierPremiumRule,
  volumeTierEliteRule,
} from './volume-tier-rules';
import {
  performanceBelowStandardRule,
  performanceStandardRule,
  performanceGoodRule,
  performanceExcellentRule,
  performancePerfectRule,
} from './performance-multiplier-rules';

export const allCommissionRules = [
  // Gates (run first)
  minimumSessionsGateRule,
  qualityGateRule,
  
  // Base Commission
  serviceCommissionFixedRule,
  serviceCommissionPercentageRule,
  productCommissionFixedRule,
  productCommissionPercentageRule,
  manualOverrideCommissionRule,
  
  // Volume Tiers
  volumeTierStandardRule,
  volumeTierHighRule,
  volumeTierPremiumRule,
  volumeTierEliteRule,
  
  // Performance Multipliers
  performanceBelowStandardRule,
  performanceStandardRule,
  performanceGoodRule,
  performanceExcellentRule,
  performancePerfectRule,
];

/**
 * Rule Counts
 */
export const COMMISSION_RULE_STATS = {
  total: 16,
  enabled: 14,
  disabled: 2,
  categories: {
    gates: 2,
    baseCommission: 5,
    volumeTiers: 4,
    performanceMultipliers: 5,
  },
  priorityRanges: {
    gates: '195-199',
    baseCommission: '200-240',
    volumeTiers: '250-280',
    performanceMultipliers: '290-330',
  },
};
