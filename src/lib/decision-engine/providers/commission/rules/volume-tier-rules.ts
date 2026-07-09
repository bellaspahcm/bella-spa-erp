/**
 * @fileoverview Volume Tier Rules for CommissionProvider
 * 
 * Applies commission multipliers based on total session volume.
 * Incentivizes KTVs to complete more sessions by increasing commission rates at higher volumes.
 * 
 * **Volume Tiers:**
 * - Tier 1 (Standard): < 30 sessions → 1.0x (baseline)
 * - Tier 2 (High Volume): 30-49 sessions → 1.1x (+10%)
 * - Tier 3 (Premium Volume): 50-79 sessions → 1.2x (+20%)
 * - Tier 4 (Elite Volume): 80+ sessions → 1.3x (+30%)
 * 
 * Priority Range: 250-280
 * 
 * **Design Pattern:**
 * - Mutually exclusive tiers (only one matches per evaluation)
 * - Higher priority = higher tier (opposite of normal priority)
 * - Multiplier applied AFTER base commission calculation
 * 
 * @module decision-engine/providers/commission/rules/volume-tier-rules
 */

import type { Rule, RuleContext } from '@/lib/decision-engine/types/rule';
import type { CommissionDecisionInput } from '../types';

/**
 * Volume Tier 1: Standard (Baseline)
 * 
 * Applies to KTVs with low session volume (< 30 sessions).
 * No multiplier bonus - this is the baseline rate.
 * 
 * **Threshold:** < 30 sessions
 * **Multiplier:** 1.0x (no change)
 * 
 * **Use Case:**
 * - New KTVs still building clientele
 * - Part-time KTVs
 * - KTVs on leave/reduced hours
 * 
 * **Example:**
 * ```typescript
 * // Input: 25 sessions, base commission = 3,000,000đ
 * // Output: 3,000,000 × 1.0 = 3,000,000đ (no change)
 * ```
 * 
 * **Priority:** 250 (lowest tier - matches first if no higher tier qualifies)
 */
export const volumeTierStandardRule: Rule = {
  id: 'commission_volume_tier_standard',
  name: 'Volume Tier 1: Standard (< 30 sessions)',
  description: 'Baseline commission rate for standard session volume',
  priority: 250,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    // Matches if total sessions < 30
    const totalSessions = input.totalSessions ?? 0;
    return totalSessions < 30;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    
    return {
      volumeMultiplier: 1.0,
      volumeTier: 'standard',
      totalSessions: input.totalSessions,
      tierThreshold: { min: 0, max: 29 },
      bonusPercentage: 0, // No bonus at baseline
    };
  },
};

/**
 * Volume Tier 2: High Volume
 * 
 * Applies to KTVs with good session volume (30-49 sessions).
 * Rewards consistent performance with 10% commission bonus.
 * 
 * **Threshold:** 30-49 sessions
 * **Multiplier:** 1.1x (+10%)
 * 
 * **Use Case:**
 * - Full-time KTVs meeting monthly targets
 * - Consistent performers
 * - Standard monthly volume for experienced KTVs
 * 
 * **Example:**
 * ```typescript
 * // Input: 40 sessions, base commission = 4,500,000đ
 * // Output: 4,500,000 × 1.1 = 4,950,000đ (+450,000đ bonus)
 * ```
 * 
 * **Priority:** 260
 */
export const volumeTierHighRule: Rule = {
  id: 'commission_volume_tier_high',
  name: 'Volume Tier 2: High Volume (30-49 sessions)',
  description: 'Commission bonus for high session volume (+10%)',
  priority: 260,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    const totalSessions = input.totalSessions ?? 0;
    return totalSessions >= 30 && totalSessions < 50;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    
    return {
      volumeMultiplier: 1.1,
      volumeTier: 'high',
      totalSessions: input.totalSessions,
      tierThreshold: { min: 30, max: 49 },
      bonusPercentage: 10,
    };
  },
};

/**
 * Volume Tier 3: Premium Volume
 * 
 * Applies to KTVs with excellent session volume (50-79 sessions).
 * Rewards high performers with 20% commission bonus.
 * 
 * **Threshold:** 50-79 sessions
 * **Multiplier:** 1.2x (+20%)
 * 
 * **Use Case:**
 * - Top performers exceeding monthly targets
 * - Senior KTVs with large client base
 * - High-demand KTVs working extended hours
 * 
 * **Example:**
 * ```typescript
 * // Input: 60 sessions, base commission = 6,000,000đ
 * // Output: 6,000,000 × 1.2 = 7,200,000đ (+1,200,000đ bonus)
 * ```
 * 
 * **Business Impact:**
 * - Incentivizes exceeding targets
 * - Retains high performers
 * - Competitive advantage in recruitment
 * 
 * **Priority:** 270
 */
export const volumeTierPremiumRule: Rule = {
  id: 'commission_volume_tier_premium',
  name: 'Volume Tier 3: Premium Volume (50-79 sessions)',
  description: 'Commission bonus for premium session volume (+20%)',
  priority: 270,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    const totalSessions = input.totalSessions ?? 0;
    return totalSessions >= 50 && totalSessions < 80;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    
    return {
      volumeMultiplier: 1.2,
      volumeTier: 'premium',
      totalSessions: input.totalSessions,
      tierThreshold: { min: 50, max: 79 },
      bonusPercentage: 20,
    };
  },
};

/**
 * Volume Tier 4: Elite Volume
 * 
 * Applies to KTVs with exceptional session volume (80+ sessions).
 * Rewards elite performers with 30% commission bonus.
 * 
 * **Threshold:** 80+ sessions
 * **Multiplier:** 1.3x (+30%)
 * 
 * **Use Case:**
 * - Elite performers (top 5-10%)
 * - Lead KTVs with team management
 * - KTVs with VIP client portfolios
 * - Extended hours/weekend shifts
 * 
 * **Example:**
 * ```typescript
 * // Input: 100 sessions, base commission = 10,000,000đ
 * // Output: 10,000,000 × 1.3 = 13,000,000đ (+3,000,000đ bonus)
 * ```
 * 
 * **Business Impact:**
 * - Recognizes exceptional performance
 * - Retains top talent
 * - Sets aspirational goals for team
 * - Competitive differentiation
 * 
 * **Note:** Elite tier is intentionally difficult to achieve.
 * Approximately 5-10% of KTVs reach this level.
 * 
 * **Priority:** 280 (highest tier - checked first)
 */
export const volumeTierEliteRule: Rule = {
  id: 'commission_volume_tier_elite',
  name: 'Volume Tier 4: Elite Volume (80+ sessions)',
  description: 'Commission bonus for elite session volume (+30%)',
  priority: 280,
  enabled: true,
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    
    const totalSessions = input.totalSessions ?? 0;
    return totalSessions >= 80;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    
    return {
      volumeMultiplier: 1.3,
      volumeTier: 'elite',
      totalSessions: input.totalSessions,
      tierThreshold: { min: 80, max: null }, // No upper limit
      bonusPercentage: 30,
    };
  },
};

/**
 * Volume Tier Selection Algorithm
 * 
 * **How Tiers Are Selected:**
 * 
 * 1. RuleReasoner evaluates rules in descending priority order (280 → 250)
 * 2. First matching rule wins (mutually exclusive design)
 * 3. Only ONE tier multiplier is applied per evaluation
 * 
 * **Evaluation Order:**
 * ```
 * Priority 280: Elite (80+)     → If matches, STOP
 * Priority 270: Premium (50-79) → If matches, STOP
 * Priority 260: High (30-49)    → If matches, STOP
 * Priority 250: Standard (<30)  → Always matches (fallback)
 * ```
 * 
 * **Example Flow:**
 * ```typescript
 * // Input: totalSessions = 65
 * 
 * // Check Elite (>=80): NO → Continue
 * // Check Premium (50-79): YES → Apply 1.2x, STOP
 * // Result: volumeMultiplier = 1.2, volumeTier = 'premium'
 * ```
 * 
 * **Configuration:**
 * 
 * Thresholds are currently hardcoded but can be made configurable:
 * 
 * ```typescript
 * config: {
 *   volumeTiers: {
 *     high: { min: 30, multiplier: 1.1 },
 *     premium: { min: 50, multiplier: 1.2 },
 *     elite: { min: 80, multiplier: 1.3 }
 *   }
 * }
 * ```
 * 
 * **Future Enhancement:**
 * - Dynamic thresholds per tenant
 * - Seasonal adjustments (lower thresholds during slow periods)
 * - Position-based thresholds (junior vs senior)
 * - Progressive tiers (more granular: 5 or 6 tiers)
 */
