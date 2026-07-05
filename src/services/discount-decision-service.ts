/**
 * Discount Decision Service
 * 
 * Provider #2: Proves Decision Engine extensibility beyond Booking.
 * 
 * Integrates Decision Engine with discount eligibility evaluation.
 * Replaces hard-coded discount logic with rule-based decisions.
 * 
 * Phase 0.5: Multi-Provider Validation
 * 
 * @module services/discount-decision
 */

import {
  bootstrapForTesting,
  createDecisionContext,
  type DecisionResult,
  type DecisionContext,
} from '@/lib/decision-engine';
import {
  metricsCollector,
  auditTrail,
  type DecisionMetric,
  type AuditRecord,
  generateDecisionId,
} from '@/lib/decision-engine/observability';
import {
  getDiscountEligibilityRules,
  mapCustomerTierForDiscount,
  calculateDiscountAmount,
  isWithinCampaignPeriod,
  type CustomerTier,
  type DiscountType,
} from '@/lib/decision-engine/rules/discount-eligibility-rules';

/**
 * Discount decision input
 */
export interface DiscountDecisionInput {
  /** Purchase total amount (before discount) */
  totalAmount: number;
  
  /** Customer information */
  customer: {
    id: string;
    status: string | null;
    totalSpending: number; // Lifetime spending
    completedBookingsCount: number;
    isFirstBooking?: boolean;
    birthdayMonth?: number; // 1-12
  };
  
  /** Campaign information (optional) */
  campaign?: {
    code: string;
    startDate: string; // ISO date
    endDate: string; // ISO date
  };
  
  /** Purchase details */
  purchase?: {
    serviceCount?: number;
    referralCode?: string;
    bookingDate?: Date;
  };
  
  /** Optional: Tenant ID for multi-tenant setup */
  tenantId?: string;
  
  /** Optional: Additional context */
  metadata?: Record<string, unknown>;
}

/**
 * Discount decision output
 */
export interface DiscountDecisionOutput {
  /** Whether discount is eligible */
  eligible: boolean;
  
  /** Discount percentage (0-100) */
  discountPercent: number;
  
  /** Discount amount in VND */
  discountAmount: number;
  
  /** Discount type */
  discountType: DiscountType;
  
  /** Final amount after discount */
  finalAmount: number;
  
  /** Decision reason (human-readable) */
  reason: string;
  
  /** Matched rule IDs (for audit trail) */
  matchedRules: string[];
  
  /** Restrictions/conditions */
  restrictions: string[];
  
  /** Campaign code (if applicable) */
  campaignCode?: string;
  
  /** Decision confidence (0.0 - 1.0) */
  confidence: number;
  
  /** Execution time in milliseconds */
  executionTime: number;
  
  /** Provider used */
  provider: string;
  
  /** Customer tier (for debugging) */
  customerTier: CustomerTier;
  
  /** Full decision result (for debugging/audit) */
  _raw: DecisionResult;
}

/**
 * Evaluate discount eligibility using Decision Engine
 * 
 * **Process:**
 * 1. Map customer to tier (new/active/loyal/vip)
 * 2. Check campaign validity (if applicable)
 * 3. Create decision context with purchase data
 * 4. Evaluate rules in priority order
 * 5. Return first matching rule's discount
 * 6. Calculate final amount after discount
 * 
 * **Rules Priority** (high to low):
 * - 110: VIP customers (15%)
 * - 100: Loyal customers (10%)
 * - 95: First-time customers (5%)
 * - 90: Lunar New Year campaign (20%)
 * - 85: Summer promotion (15%)
 * - 80: Bundle discount (12%)
 * - 75: Referral discount (8%)
 * - 70: Birthday month (10%)
 * - 60: Active customers (5%)
 * - 50: Weekend special (7%)
 * - 10: No discount (fallback)
 * 
 * @param input - Discount decision input
 * @returns Discount decision output with eligibility and amount
 * 
 * @example
 * ```typescript
 * // VIP customer - gets 15% discount
 * const result1 = await evaluateDiscountEligibility({
 *   totalAmount: 10000000,
 *   customer: {
 *     id: 'cust-123',
 *     status: 'vip',
 *     totalSpending: 60000000,
 *     completedBookingsCount: 25,
 *   },
 * });
 * // result1.eligible = true, result1.discountPercent = 15
 * 
 * // First-time customer - gets 5% welcome discount
 * const result2 = await evaluateDiscountEligibility({
 *   totalAmount: 5000000,
 *   customer: {
 *     id: 'cust-456',
 *     status: 'new',
 *     totalSpending: 0,
 *     completedBookingsCount: 0,
 *     isFirstBooking: true,
 *   },
 * });
 * // result2.eligible = true, result2.discountPercent = 5
 * 
 * // Campaign discount - Lunar New Year
 * const result3 = await evaluateDiscountEligibility({
 *   totalAmount: 8000000,
 *   customer: {
 *     id: 'cust-789',
 *     status: 'active',
 *     totalSpending: 15000000,
 *     completedBookingsCount: 5,
 *   },
 *   campaign: {
 *     code: 'TET2026',
 *     startDate: '2026-01-20',
 *     endDate: '2026-02-10',
 *   },
 * });
 * // result3.eligible = true, result3.discountPercent = 20 (if within period)
 * ```
 */
export async function evaluateDiscountEligibility(
  input: DiscountDecisionInput
): Promise<DiscountDecisionOutput> {
  const startTime = Date.now();
  const decisionId = generateDecisionId();
  const decisionStartTime = performance.now();
  
  // Bootstrap Decision Engine with testing mode (no events)
  const { engine } = bootstrapForTesting();
  
  // Map customer to tier for discount rules
  const customerTier = mapCustomerTierForDiscount(
    input.customer.status,
    input.customer.totalSpending,
    input.customer.completedBookingsCount
  );
  
  // Check campaign validity
  const isWithinCampaign = input.campaign
    ? isWithinCampaignPeriod(input.campaign.startDate, input.campaign.endDate)
    : false;
  
  // Check if it's customer's birthday month
  const currentMonth = new Date().getMonth() + 1; // 1-12
  const isBirthdayMonth = input.customer.birthdayMonth === currentMonth;
  
  // Check if booking is on weekend
  const bookingDate = input.purchase?.bookingDate || new Date();
  const dayOfWeek = bookingDate.getDay(); // 0=Sunday, 6=Saturday
  const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
  
  // Get all discount rules (sort by priority descending - highest first)
  const rules = getDiscountEligibilityRules().sort((a, b) => b.priority - a.priority);
  
  // Evaluate each rule in priority order until one matches
  for (const rule of rules) {
    try {
      // Create decision context
      const context: DecisionContext = createDecisionContext({
        tenantId: input.tenantId || 'bella-spa-vn',
        module: 'discount',
        decisionType: 'eligibility',
        ruleType: 'if-then',
        rule,
        data: {
          totalAmount: input.totalAmount,
          customerTier,
          customerId: input.customer.id,
          completedBookingsCount: input.customer.completedBookingsCount,
          totalSpending: input.customer.totalSpending,
          isFirstBooking: input.customer.isFirstBooking || false,
          campaignCode: input.campaign?.code,
          isWithinCampaign,
          serviceCount: input.purchase?.serviceCount || 1,
          hasReferralCode: Boolean(input.purchase?.referralCode),
          isBirthdayMonth,
          isWeekend,
          ...input.metadata,
        },
      });
      
      // Evaluate decision
      const result = await engine.evaluate(context);
      
      // Collect observability data
      const decisionEndTime = performance.now();
      const executionTime = decisionEndTime - decisionStartTime;
      
      // Record metrics
      const metric: DecisionMetric = {
        timestamp: new Date(startTime),
        decisionType: 'discount_eligibility',
        executionTime,
        confidence: result.confidence,
        provider: 'RuleProvider',
        rulesMatched: result.confidence > 0 ? 1 : 0,
        approved: result.confidence > 0,
        requiresManualReview: false,
        cacheHit: false,
        failed: false,
        usedFallback: false,
        tenantId: input.tenantId || 'bella-spa-vn',
      };
      metricsCollector.record(metric);
      
      // Record audit trail
      const auditRecord: AuditRecord = {
        decisionId,
        decisionType: 'discount_eligibility',
        timestamp: new Date(startTime),
        tenantId: input.tenantId || 'bella-spa-vn',
        provider: 'RuleProvider',
        matchedRules: result.confidence > 0 ? [{
          ruleId: rule.id,
          priority: rule.priority,
          condition: JSON.stringify(rule.condition),
          action: result.action,
        }] : [],
        executionTime,
        confidence: result.confidence,
        actions: result.action ? [result.action] : [],
        reason: result.reason,
        context,
        result,
        cacheHit: false,
        failed: false,
        usedFallback: false,
      };
      auditTrail.record(auditRecord);
      
      // If rule matched (confidence > 0), use this decision
      if (result.confidence > 0 && result.action) {
        const action = result.action as Record<string, unknown>;
        const eligible = Boolean(action.eligible);
        const discountPercent = Number(action.discountPercent || 0);
        const discountType = (action.discountType || 'none') as DiscountType;
        const restrictions = (action.restrictions || []) as string[];
        const campaignCode = action.campaignCode as string | undefined;
        
        const discountAmount = calculateDiscountAmount(input.totalAmount, discountPercent);
        const finalAmount = input.totalAmount - discountAmount;
        
        return {
          eligible,
          discountPercent,
          discountAmount,
          discountType,
          finalAmount,
          reason: result.reason,
          matchedRules: [rule.id],
          restrictions,
          campaignCode,
          confidence: result.confidence,
          executionTime,
          provider: 'RuleProvider',
          customerTier,
          _raw: result,
        };
      }
    } catch (error) {
      console.error('[evaluateDiscountEligibility] Error evaluating rule:', rule.id, error);
      // Continue to next rule on error
    }
  }
  
  // Fallback: No discount (should never reach here if rules are complete)
  const fallbackExecutionTime = performance.now() - decisionStartTime;
  
  return {
    eligible: false,
    discountPercent: 0,
    discountAmount: 0,
    discountType: 'none',
    finalAmount: input.totalAmount,
    reason: 'No discount rules matched (fallback)',
    matchedRules: [],
    restrictions: [],
    confidence: 0,
    executionTime: fallbackExecutionTime,
    provider: 'RuleProvider',
    customerTier,
    _raw: {
      approved: false,
      requiresManualReview: false,
      requiresDeposit: false,
      depositAmount: 0,
      confidence: 0,
      reason: 'No discount rules matched (fallback)',
      actions: [],
      timestamp: new Date(),
    },
  };
}

/**
 * Evaluate discount eligibility for multiple purchases (batch processing)
 * 
 * @param inputs - Array of discount decision inputs
 * @returns Array of discount decision outputs (same order as inputs)
 * 
 * @example
 * ```typescript
 * const results = await evaluateDiscountEligibilityBatch([
 *   { totalAmount: 5000000, customer: { ... } },
 *   { totalAmount: 10000000, customer: { ... } },
 *   { totalAmount: 15000000, customer: { ... } },
 * ]);
 * 
 * results.forEach((result, index) => {
 *   console.log(`Purchase ${index + 1}: ${result.discountPercent}% discount`);
 * });
 * ```
 */
export async function evaluateDiscountEligibilityBatch(
  inputs: DiscountDecisionInput[]
): Promise<DiscountDecisionOutput[]> {
  // Process all decisions in parallel
  return Promise.all(inputs.map(input => evaluateDiscountEligibility(input)));
}

/**
 * Get suggested discount for display (convenience function)
 * 
 * @param decision - Discount decision output
 * @returns User-friendly discount message
 * 
 * @example
 * ```typescript
 * const decision = await evaluateDiscountEligibility(input);
 * const message = getSuggestedDiscountMessage(decision);
 * // "🎉 VIP Discount: 15% off (Save 1,500,000đ)"
 * ```
 */
export function getSuggestedDiscountMessage(decision: DiscountDecisionOutput): string {
  if (!decision.eligible || decision.discountPercent === 0) {
    return 'No discount available';
  }
  
  const emoji = decision.discountType === 'campaign' ? '🎊' : 
                decision.discountType === 'membership' ? '⭐' : 
                decision.discountType === 'firsttime' ? '🎉' :
                decision.discountType === 'bundle' ? '📦' :
                decision.discountType === 'referral' ? '👥' : '🎁';
  
  const formattedAmount = decision.discountAmount.toLocaleString('vi-VN');
  
  return `${emoji} ${decision.discountPercent}% discount (Save ${formattedAmount}đ)`;
}
