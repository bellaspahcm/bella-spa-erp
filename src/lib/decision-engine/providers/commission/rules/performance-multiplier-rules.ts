/**
 * @fileoverview Performance Multiplier Rules for CommissionProvider
 * 
 * Applies commission adjustments based on customer rating performance.
 * Rewards quality service and penalizes poor performance.
 * 
 * **Rating Tiers:**
 * - Below Standard: < 4.0★ → 0.9x (-10% penalty)
 * - Standard: 4.0-4.49★ → 1.0x (baseline)
 * - Good: 4.5-4.79★ → 1.05x (+5%)
 * - Excellent: 4.8-4.94★ → 1.1x (+10%)
 * - Perfect: ≥ 4.95★ → 1.15x (+15%)
 * 
 * Priority Range: 290-330
 * 
 * **Design Philosophy:**
 * - Quality matters more than quantity
 * - Penalty for poor ratings (accountability)
 * - Progressive rewards for excellence
 * - Perfect rating is rare and highly rewarded
 * 
 * **Interaction with Volume Tiers:**
 * Both multipliers stack multiplicatively:
 * ```
 * adjusted_commission = base × volume_multiplier × performance_multiplier
 * ```
 * 
 * **Example:**
 * ```typescript
 * // Base: 5,000,000đ
 * // Volume: 60 sessions → 1.2x (premium tier)
 * // Rating: 4.9★ → 1.1x (excellent)
 * // Final: 5M × 1.2 × 1.1 = 6,600,000đ
 * ```
 * 
 * @module decision-engine/providers/commission/rules/performance-multiplier-rules
 */

import type { Rule, RuleContext } from '@/lib/decision-engine/types/rule';
import type { CommissionDecisionInput } from '../types';

/**
 * Performance: Below Standard (Penalty)
 * 
 * Applies a 10% penalty for below-standard customer ratings.
 * Accountability measure to ensure service quality.
 * 
 * **Threshold:** < 4.0★
 * **Multiplier:** 0.9x (-10% penalty)
 * 
 * **Rationale:**
 * - Customer satisfaction is critical to business
 * - Low ratings indicate service quality issues
 * - Penalty motivates improvement
 * - Fair warning system (not punitive, just reduced)
 * 
 * **Use Case:**
 * - KTVs with consistent negative feedback
 * - New KTVs still learning service standards
 * - Temporary performance dips (burnout, personal issues)
 * 
 * **Example:**
 * ```typescript
 * // Input: avgRating = 3.8★, base = 4,000,000đ
 * // Output: 4,000,000 × 0.9 = 3,600,000đ (-400,000đ)
 * ```
 * 
 * **Management Action:**
 * When this rule triggers:
 * - Review customer feedback
 * - Provide coaching/training
 * - Monitor improvement over 1-2 months
 * - Consider disciplinary action if no improvement
 * 
 * **Priority:** 290 (lowest performance tier)
 */
export const performanceBelowStandardRule: Rule = {
  id: 'commission_performance_below_standard',
  name: 'Performance: Below Standard (< 4.0★)',
  description: 'Commission penalty for below-standard ratings (-10%)',
  priority: 290,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    const avgRating = input.avgRating ?? 0;
    return avgRating > 0 && avgRating < 4.0;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    
    return {
      performanceMultiplier: 0.9,
      performanceTier: 'below_standard',
      avgRating: input.avgRating,
      ratingRange: { min: 0, max: 3.99 },
      adjustmentPercentage: -10, // Penalty
      needsReview: true, // Flag for management review
    };
  },
};

/**
 * Performance: Standard (Baseline)
 * 
 * Baseline performance tier for acceptable ratings.
 * No multiplier adjustment - this is the standard rate.
 * 
 * **Threshold:** 4.0-4.49★
 * **Multiplier:** 1.0x (no change)
 * 
 * **Use Case:**
 * - Most KTVs fall into this range
 * - Acceptable but not exceptional performance
 * - Room for improvement
 * 
 * **Example:**
 * ```typescript
 * // Input: avgRating = 4.2★, base = 5,000,000đ
 * // Output: 5,000,000 × 1.0 = 5,000,000đ (no change)
 * ```
 * 
 * **Priority:** 300
 */
export const performanceStandardRule: Rule = {
  id: 'commission_performance_standard',
  name: 'Performance: Standard (4.0-4.49★)',
  description: 'Baseline commission for standard ratings',
  priority: 300,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    const avgRating = input.avgRating ?? 0;
    return avgRating >= 4.0 && avgRating < 4.5;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    
    return {
      performanceMultiplier: 1.0,
      performanceTier: 'standard',
      avgRating: input.avgRating,
      ratingRange: { min: 4.0, max: 4.49 },
      adjustmentPercentage: 0, // Baseline
    };
  },
};

/**
 * Performance: Good (Reward)
 * 
 * Applies 5% bonus for good customer ratings.
 * Recognizes above-average performance.
 * 
 * **Threshold:** 4.5-4.79★
 * **Multiplier:** 1.05x (+5%)
 * 
 * **Use Case:**
 * - KTVs with consistently positive feedback
 * - Good service quality
 * - Customer satisfaction focus
 * 
 * **Example:**
 * ```typescript
 * // Input: avgRating = 4.6★, base = 6,000,000đ
 * // Output: 6,000,000 × 1.05 = 6,300,000đ (+300,000đ)
 * ```
 * 
 * **Business Impact:**
 * - Incentivizes quality focus
 * - Reduces customer complaints
 * - Improves brand reputation
 * 
 * **Priority:** 310
 */
export const performanceGoodRule: Rule = {
  id: 'commission_performance_good',
  name: 'Performance: Good (4.5-4.79★)',
  description: 'Commission bonus for good ratings (+5%)',
  priority: 310,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    const avgRating = input.avgRating ?? 0;
    return avgRating >= 4.5 && avgRating < 4.8;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    
    return {
      performanceMultiplier: 1.05,
      performanceTier: 'good',
      avgRating: input.avgRating,
      ratingRange: { min: 4.5, max: 4.79 },
      adjustmentPercentage: 5,
    };
  },
};

/**
 * Performance: Excellent (High Reward)
 * 
 * Applies 10% bonus for excellent customer ratings.
 * Recognizes exceptional service quality.
 * 
 * **Threshold:** 4.8-4.94★
 * **Multiplier:** 1.1x (+10%)
 * 
 * **Use Case:**
 * - Top 20-30% of KTVs
 * - Exceptional customer service
 * - High customer retention
 * - Positive word-of-mouth referrals
 * 
 * **Example:**
 * ```typescript
 * // Input: avgRating = 4.85★, base = 7,000,000đ
 * // Output: 7,000,000 × 1.1 = 7,700,000đ (+700,000đ)
 * ```
 * 
 * **Business Impact:**
 * - Retains high performers
 * - Sets performance benchmarks
 * - Improves average service quality
 * - Attracts premium customers
 * 
 * **Priority:** 320
 */
export const performanceExcellentRule: Rule = {
  id: 'commission_performance_excellent',
  name: 'Performance: Excellent (4.8-4.94★)',
  description: 'Commission bonus for excellent ratings (+10%)',
  priority: 320,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    const avgRating = input.avgRating ?? 0;
    return avgRating >= 4.8 && avgRating < 4.95;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    
    return {
      performanceMultiplier: 1.1,
      performanceTier: 'excellent',
      avgRating: input.avgRating,
      ratingRange: { min: 4.8, max: 4.94 },
      adjustmentPercentage: 10,
    };
  },
};

/**
 * Performance: Perfect (Elite Reward)
 * 
 * Applies 15% bonus for near-perfect customer ratings.
 * Recognizes elite-level service quality.
 * 
 * **Threshold:** ≥ 4.95★
 * **Multiplier:** 1.15x (+15%)
 * 
 * **Use Case:**
 * - Elite performers (top 5-10%)
 * - Perfect or near-perfect customer satisfaction
 * - Brand ambassadors
 * - Mentors for other KTVs
 * 
 * **Example:**
 * ```typescript
 * // Input: avgRating = 5.0★, base = 10,000,000đ
 * // Output: 10,000,000 × 1.15 = 11,500,000đ (+1,500,000đ)
 * ```
 * 
 * **Business Impact:**
 * - Recognizes exceptional dedication
 * - Sets aspirational standard
 * - Retains best talent
 * - Competitive advantage in market
 * 
 * **Rarity:**
 * Perfect tier is intentionally difficult to achieve:
 * - Requires consistent 5★ ratings
 * - One 4★ can drop average below 4.95
 * - Only top 5-10% reach this level
 * 
 * **Management Recognition:**
 * When this rule triggers:
 * - Public recognition (team meetings)
 * - Certificate/award
 * - Case study for training
 * - Mentor assignment for new KTVs
 * 
 * **Priority:** 330 (highest performance tier)
 */
export const performancePerfectRule: Rule = {
  id: 'commission_performance_perfect',
  name: 'Performance: Perfect (≥ 4.95★)',
  description: 'Commission bonus for perfect ratings (+15%)',
  priority: 330,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    const avgRating = input.avgRating ?? 0;
    return avgRating >= 4.95;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    
    return {
      performanceMultiplier: 1.15,
      performanceTier: 'perfect',
      avgRating: input.avgRating,
      ratingRange: { min: 4.95, max: 5.0 },
      adjustmentPercentage: 15,
      eliteStatus: true, // Flag for special recognition
    };
  },
};

/**
 * Performance Tier Selection Algorithm
 * 
 * **How Tiers Are Selected:**
 * 
 * 1. RuleReasoner evaluates rules in descending priority order (330 → 290)
 * 2. First matching rule wins (mutually exclusive design)
 * 3. Only ONE performance multiplier is applied per evaluation
 * 
 * **Evaluation Order:**
 * ```
 * Priority 330: Perfect (≥4.95)  → If matches, STOP
 * Priority 320: Excellent (4.8+) → If matches, STOP
 * Priority 310: Good (4.5+)      → If matches, STOP
 * Priority 300: Standard (4.0+)  → If matches, STOP
 * Priority 290: Below (<4.0)     → Always matches (fallback)
 * ```
 * 
 * **Example Flow:**
 * ```typescript
 * // Input: avgRating = 4.85★
 * 
 * // Check Perfect (≥4.95): NO → Continue
 * // Check Excellent (4.8-4.94): YES → Apply 1.1x, STOP
 * // Result: performanceMultiplier = 1.1, performanceTier = 'excellent'
 * ```
 * 
 * **Stacking with Volume Tiers:**
 * 
 * Performance and volume multipliers stack:
 * 
 * ```typescript
 * // Example: High volume + Excellent performance
 * base_commission = 5,000,000đ
 * volume_multiplier = 1.2x (60 sessions, premium tier)
 * performance_multiplier = 1.1x (4.85★, excellent tier)
 * 
 * adjusted_commission = 5M × 1.2 × 1.1 = 6,600,000đ
 * 
 * // Breakdown:
 * // - Volume bonus: +1,000,000đ (20%)
 * // - Performance bonus: +600,000đ (10% of 6M)
 * // - Total bonus: +1,600,000đ (32% combined!)
 * ```
 * 
 * **Configuration:**
 * 
 * Thresholds can be made tenant-configurable:
 * 
 * ```typescript
 * config: {
 *   performanceTiers: {
 *     good: { min: 4.5, multiplier: 1.05 },
 *     excellent: { min: 4.8, multiplier: 1.1 },
 *     perfect: { min: 4.95, multiplier: 1.15 }
 *   },
 *   penaltyEnabled: true, // Enable/disable below-standard penalty
 *   penaltyMultiplier: 0.9 // Configurable penalty rate
 * }
 * ```
 * 
 * **Future Enhancements:**
 * - Dynamic thresholds based on industry benchmarks
 * - Seasonal adjustments (lower thresholds during training periods)
 * - Service-type weighting (different standards for different services)
 * - Trend analysis (improving vs declining ratings)
 * - Customer retention impact (repeat customers boost multiplier)
 */
