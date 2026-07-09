/**
 * @fileoverview Gate Rules for CommissionProvider
 * 
 * Gate rules enforce eligibility requirements BEFORE commission calculation.
 * If a gate rule rejects, NO commission is calculated (entire evaluation stops).
 * 
 * **Design Pattern:**
 * - Gate rules run FIRST (highest priority range: 195-199)
 * - Return `reject` action type on failure
 * - Return `allow` action type on success
 * - Disabled by default (opt-in per tenant)
 * 
 * **Use Cases:**
 * - Trial period restrictions (no commission until confirmed)
 * - Quality thresholds (minimum rating required)
 * - Minimum performance requirements (minimum sessions)
 * - Compliance checks (certifications, training)
 * 
 * Priority Range: 195-199 (runs before all other rules)
 * 
 * @module decision-engine/providers/commission/rules/gate-rules
 */

import type { Rule, RuleContext } from '@/lib/decision-engine/types/rule';
import type { CommissionDecisionInput } from '../types';

/**
 * Minimum Sessions Gate
 * 
 * Enforces minimum session requirement for commission eligibility.
 * Prevents commission payout for trial/probationary employees.
 * 
 * **Default Threshold:** 5 sessions
 * **Action if Failed:** REJECT (no commission calculated)
 * 
 * **Use Cases:**
 * - Trial period employees (first month)
 * - New hires in probation
 * - Part-time KTVs with minimal hours
 * - Quality gate (serious commitment required)
 * 
 * **Example:**
 * ```typescript
 * // Config: minSessionsForCommission = 5
 * 
 * // Case 1: Below threshold
 * // Input: totalSessions = 3
 * // Output: REJECT, commission = 0đ
 * // Reason: "Minimum 5 sessions required for commission"
 * 
 * // Case 2: Meets threshold
 * // Input: totalSessions = 5
 * // Output: ALLOW, continue to commission calculation
 * ```
 * 
 * **Configuration:**
 * ```typescript
 * config: {
 *   enableMinSessionsGate: true,
 *   minSessionsForCommission: 5
 * }
 * ```
 * 
 * **Business Rationale:**
 * - Prevents commission for employees who quit early
 * - Ensures minimum commitment before payout
 * - Reduces administrative overhead
 * - Aligns with probation period policies
 * 
 * **Status:** DISABLED by default (enabled = false)
 * **Priority:** 195 (runs first among all commission rules)
 */
export const minimumSessionsGateRule: Rule = {
  id: 'commission_gate_minimum_sessions',
  name: 'Gate: Minimum Sessions Required',
  description: 'Rejects commission if below minimum session threshold',
  priority: 195,
  enabled: false, // Disabled by default - opt-in per tenant
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    const config = input.config;
    
    // Only apply gate if explicitly enabled in config
    if (!config.enableMinSessionsGate) {
      return false; // Gate disabled, don't evaluate
    }
    
    const minSessions = config.minSessionsForCommission ?? 5;
    const totalSessions = input.totalSessions ?? 0;
    
    // Gate triggers if BELOW threshold
    return totalSessions < minSessions;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    const config = input.config;
    
    const minSessions = config.minSessionsForCommission ?? 5;
    const totalSessions = input.totalSessions ?? 0;
    
    return {
      gateDecision: 'reject',
      gateType: 'minimum_sessions',
      rejectReason: `Minimum ${minSessions} sessions required for commission`,
      actualSessions: totalSessions,
      requiredSessions: minSessions,
      shortfall: minSessions - totalSessions,
    };
  },
};

/**
 * Quality Gate (Minimum Rating)
 * 
 * Enforces minimum quality standard for commission eligibility.
 * Prevents commission for KTVs with poor customer ratings.
 * 
 * **Default Threshold:** 3.5★
 * **Action if Failed:** REJECT (no commission calculated)
 * 
 * **Use Cases:**
 * - Quality control enforcement
 * - Customer satisfaction standards
 * - Service quality accountability
 * - Performance improvement program
 * 
 * **Example:**
 * ```typescript
 * // Config: minRatingForCommission = 3.5★
 * 
 * // Case 1: Below threshold
 * // Input: avgRating = 3.2★
 * // Output: REJECT, commission = 0đ
 * // Reason: "Minimum 3.5★ rating required for commission"
 * 
 * // Case 2: Meets threshold
 * // Input: avgRating = 3.5★
 * // Output: ALLOW, continue to commission calculation
 * ```
 * 
 * **Configuration:**
 * ```typescript
 * config: {
 *   enableQualityGate: true,
 *   minRatingForCommission: 3.5
 * }
 * ```
 * 
 * **Business Rationale:**
 * - Maintains service quality standards
 * - Protects brand reputation
 * - Motivates performance improvement
 * - Reduces customer complaints
 * 
 * **Management Process:**
 * When gate rejects:
 * 1. Notify KTV of rejection reason
 * 2. Review customer feedback (identify issues)
 * 3. Provide coaching/training
 * 4. Set improvement plan (1-2 months)
 * 5. Monitor progress
 * 6. Re-enable commission when rating improves
 * 
 * **Grace Period:**
 * Consider implementing grace period for new KTVs:
 * ```typescript
 * // Don't apply gate for first 30 days
 * if (daysSinceHired <= 30) {
 *   return false; // Skip gate check
 * }
 * ```
 * 
 * **Severity Levels:**
 * - 3.5★ - 3.9★: Warning (coaching, no commission loss yet)
 * - 3.0★ - 3.49★: Gate triggers (commission suspended)
 * - < 3.0★: Disciplinary action (potential termination)
 * 
 * **Status:** DISABLED by default (enabled = false)
 * **Priority:** 196 (runs after minimum sessions gate)
 */
export const qualityGateRule: Rule = {
  id: 'commission_gate_quality',
  name: 'Gate: Minimum Quality Rating',
  description: 'Rejects commission if below minimum rating threshold',
  priority: 196,
  enabled: false, // Disabled by default - opt-in per tenant
  
  condition: (context: RuleContext): boolean => {
    const input = context.input as CommissionDecisionInput;
    const config = input.config;
    
    // Only apply gate if explicitly enabled in config
    if (!config.enableQualityGate) {
      return false; // Gate disabled, don't evaluate
    }
    
    const minRating = config.minRatingForCommission ?? 3.5;
    const avgRating = input.avgRating ?? 0;
    
    // Gate triggers if BELOW threshold (and rating exists)
    return avgRating > 0 && avgRating < minRating;
  },
  
  action: (context: RuleContext): Record<string, unknown> => {
    const input = context.input as CommissionDecisionInput;
    const config = input.config;
    
    const minRating = config.minRatingForCommission ?? 3.5;
    const avgRating = input.avgRating ?? 0;
    
    return {
      gateDecision: 'reject',
      gateType: 'quality',
      rejectReason: `Minimum ${minRating}★ rating required for commission`,
      actualRating: avgRating,
      requiredRating: minRating,
      shortfall: Number((minRating - avgRating).toFixed(2)),
      needsReview: true, // Flag for management intervention
    };
  },
};

/**
 * Gate Rule Execution Flow
 * 
 * **How Gates Work:**
 * 
 * 1. Gates run BEFORE all other rules (priority 195-199)
 * 2. If any gate returns `reject`, evaluation stops immediately
 * 3. No commission is calculated
 * 4. Error/rejection message returned to caller
 * 
 * **Example Flow:**
 * ```typescript
 * // Input: totalSessions = 3, avgRating = 4.5★
 * 
 * // Step 1: Check Minimum Sessions Gate (priority 195)
 * // Result: REJECT (3 < 5)
 * // Action: Stop evaluation, return error
 * 
 * // Quality Gate never runs (already rejected)
 * // Commission rules never run (already rejected)
 * 
 * // Output: {
 * //   success: false,
 * //   commission: 0,
 * //   rejectReason: "Minimum 5 sessions required"
 * // }
 * ```
 * 
 * **Multi-Gate Scenario:**
 * ```typescript
 * // Input: totalSessions = 8, avgRating = 3.2★
 * 
 * // Step 1: Check Minimum Sessions Gate
 * // Result: ALLOW (8 >= 5)
 * 
 * // Step 2: Check Quality Gate
 * // Result: REJECT (3.2 < 3.5)
 * // Action: Stop evaluation, return error
 * 
 * // Output: {
 * //   success: false,
 * //   commission: 0,
 * //   rejectReason: "Minimum 3.5★ rating required"
 * // }
 * ```
 * 
 * **Configuration Example:**
 * 
 * ```typescript
 * // Enable gates for specific tenant
 * await updateTenantConfig({
 *   tenantId: 'bella-spa-hcm',
 *   config: {
 *     commission: {
 *       // Enable gates
 *       enableMinSessionsGate: true,
 *       enableQualityGate: true,
 *       
 *       // Set thresholds
 *       minSessionsForCommission: 5,
 *       minRatingForCommission: 3.5,
 *       
 *       // Grace period for new KTVs
 *       gracePerDays: 30, // Skip gates for first 30 days
 *     }
 *   }
 * });
 * ```
 * 
 * **Testing Gates:**
 * 
 * ```typescript
 * // Test minimum sessions gate
 * const result1 = await commissionProvider.evaluate({
 *   totalSessions: 3, // Below threshold
 *   config: { enableMinSessionsGate: true }
 * });
 * expect(result1.gateDecision).toBe('reject');
 * expect(result1.commission).toBe(0);
 * 
 * // Test quality gate
 * const result2 = await commissionProvider.evaluate({
 *   avgRating: 3.2, // Below threshold
 *   config: { enableQualityGate: true }
 * });
 * expect(result2.gateDecision).toBe('reject');
 * expect(result2.commission).toBe(0);
 * ```
 * 
 * **Future Gate Ideas:**
 * 
 * 1. **Certification Gate**: Require training completion
 * 2. **Attendance Gate**: Minimum attendance % (e.g., 90%)
 * 3. **Compliance Gate**: Background check, license verification
 * 4. **Performance Trend Gate**: Reject if declining performance
 * 5. **Customer Retention Gate**: Minimum repeat customer %
 */
