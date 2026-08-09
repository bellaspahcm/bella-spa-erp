/**
 * Discount Provider
 * 
 * Provider #2: Proves Decision Engine extensibility beyond Booking (Phase 0.5).
 * 
 * Integrates discount eligibility evaluation with Decision Engine Platform.
 * Follows all 10 Commandments of Decision Engine architecture.
 * 
 * **Architecture Compliance:**
 * - ✅ Commandment #1: Engine doesn't know about Discount domain
 * - ✅ Commandment #2: Provider-based (this is a provider)
 * - ✅ Commandment #3: Replaceable (can swap with BI/AI provider later)
 * - ✅ Commandment #4: Stateless (no instance state)
 * - ✅ Commandment #5: Business logic in Provider (not Engine)
 * - ✅ Commandment #6: Can integrate BI/AI (extensible)
 * - ✅ Commandment #7: Returns standard DecisionResult
 * - ✅ Commandment #8: No direct database access
 * - ✅ Commandment #9: One-way dependency (Provider uses Engine types)
 * - ✅ Commandment #10: Fully auditable via observability layer
 * 
 * @module decision-engine/providers/discount
 */

import { RuleReasoner } from '../../RuleReasoner';
import type { Policy, Knowledge, Condition } from '../../types';
import type { RuleCondition } from '../../types/rule';
import { discountRules } from './rules';
import type {
  CustomerTier,
  DiscountDecisionInput,
  DiscountDecisionOutput,
  DiscountKnowledge,
  DiscountType,
} from './types';

/**
 * Discount Provider
 * 
 * Evaluates discount eligibility using Rule-based decision logic.
 * Uses Decision Engine's RuleReasoner with Discount Policy.
 * 
 * **Process:**
 * 1. Map customer to tier (VIP/Loyal/Active/New)
 * 2. Check campaign validity
 * 3. Enrich input into Knowledge
 * 4. Evaluate rules via RuleReasoner
 * 5. Calculate discount amount
 * 6. Return standard DecisionResult
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
 */
export class DiscountProvider {
  private readonly reasoner: RuleReasoner;
  private readonly policy: Policy;

  constructor(options?: { debug?: boolean }) {
    this.reasoner = new RuleReasoner({ debug: options?.debug });
    
    // Create discount policy from rules
    // NOTE: RuleReasoner evaluates rules in ASCENDING priority order.
    // To ensure high-priority discount rules match first, we INVERT priorities:
    // - Original priority 110 (VIP) → becomes priority 1 (matches first)
    // - Original priority 10 (fallback) → becomes priority 100 (matches last)
    const maxPriority = Math.max(...discountRules.map((r) => r.priority));
    
    this.policy = {
      id: 'discount-eligibility-policy',
      version: '1.0.0',
      name: 'Discount Eligibility Policy',
      description: 'Determines customer discount eligibility based on tier, campaigns, and lifecycle events',
      rules: discountRules.map((rule) => ({
        id: rule.id,
        priority: maxPriority - rule.priority + 1, // Invert priority for RuleReasoner
        conditions: this.convertConditionToReasoner(rule.condition),
        action: {
          outcome: 'APPROVE', // All discount rules approve with different percentages
          reason: rule.name,
        },
      })),
    };
  }

  /**
   * Evaluate discount eligibility
   * 
   * @param input - Discount decision input (Knowledge)
   * @returns Discount decision output (DecisionResult)
   * 
   * @example
   * ```typescript
   * const provider = new DiscountProvider();
   * 
   * const result = await provider.evaluate({
   *   tenantId: 'bella-spa-vn',
   *   totalAmount: 10000000,
   *   customer: {
   *     id: 'cust-123',
   *     status: 'vip',
   *     totalSpending: 60000000,
   *     completedBookingsCount: 25,
   *   },
   * });
   * 
   * console.log(result.discountPercent); // 15 (VIP)
   * console.log(result.finalAmount); // 8500000
   * ```
   */
  async evaluate(input: DiscountDecisionInput): Promise<DiscountDecisionOutput> {
    const startTime = performance.now();

    // 1. Map customer to tier
    const customerTier = this.mapCustomerTier(
      input.customer.status,
      input.customer.totalSpending,
      input.customer.completedBookingsCount
    );

    // 2. Check campaign validity
    const isWithinCampaign = input.campaign
      ? this.isWithinCampaignPeriod(input.campaign.startDate, input.campaign.endDate)
      : false;

    // 3. Check birthday month
    const currentMonth = new Date().getMonth() + 1; // 1-12
    const isBirthdayMonth = input.customer.birthdayMonth === currentMonth;

    // 4. Check weekend
    const bookingDate = input.purchase?.bookingDate || new Date();
    const dayOfWeek = bookingDate.getDay(); // 0=Sunday, 6=Saturday
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;

    // 5. Enrich knowledge
    const knowledge: DiscountKnowledge = {
      tenantId: input.tenantId,
      totalAmount: input.totalAmount,
      customerId: input.customer.id,
      completedBookingsCount: input.customer.completedBookingsCount,
      totalSpending: input.customer.totalSpending,
      isFirstBooking: input.customer.isFirstBooking || false,
      customerTier,
      isWithinCampaign,
      isBirthdayMonth,
      isWeekend,
      serviceCount: input.purchase?.serviceCount || 1,
      hasReferralCode: Boolean(input.purchase?.referralCode),
      campaignCode: input.campaign?.code,
      ...input.metadata,
    };

    // 6. Evaluate via RuleReasoner
    const decisionResult = this.reasoner.evaluate(this.policy, knowledge as Knowledge);

    // 7. Find matched rule to extract discount details
    const matchedRule = discountRules.find(
      (rule) => rule.name === decisionResult.explanation
    );

    const eligible = Boolean(matchedRule && decisionResult.outcome === 'APPROVE');
    // Discount rules use declarative object actions — narrow RuleAction to RuleActionObject
    const actionData = (matchedRule && typeof matchedRule.action === 'object' && !Array.isArray(matchedRule.action) && typeof matchedRule.action !== 'function')
      ? ((matchedRule.action as { data?: Record<string, unknown> }).data ?? {})
      : ({} as Record<string, unknown>);
    const discountPercent = eligible ? ((actionData?.discountPercent as number) || 0) : 0;
    const discountType = eligible ? ((actionData?.discountType as DiscountType) || 'none') : 'none';
    const restrictions = eligible ? ((actionData?.restrictions as string[]) || []) : [];
    const campaignCode = eligible ? (actionData?.campaignCode as string | undefined) : undefined;

    // 8. Calculate discount amount
    const discountAmount = this.calculateDiscountAmount(input.totalAmount, discountPercent);
    const finalAmount = input.totalAmount - discountAmount;

    // 9. Calculate execution time
    const endTime = performance.now();
    const executionTime = Number((endTime - startTime).toFixed(2));

    // 10. Return standard DecisionResult
    return {
      eligible,
      discountPercent,
      discountAmount,
      discountType,
      finalAmount,
      reason: decisionResult.explanation || 'No discount applicable',
      matchedRules: matchedRule ? [matchedRule.id] : [],
      restrictions,
      campaignCode,
      confidence: eligible ? 1.0 : 0.0,
      executionTime,
      provider: 'DiscountProvider',
      customerTier,
    };
  }

  /**
   * Map customer status and history to tier
   * 
   * Tier Thresholds:
   * - VIP: ≥50M VND lifetime spending
   * - Loyal: ≥20M VND or 10+ completed bookings
   * - Active: >1 completed booking
   * - New: 0-1 completed bookings
   */
  private mapCustomerTier(
    status: string | null | undefined,
    totalSpending: number,
    completedBookingsCount: number
  ): CustomerTier {
    const normalizedStatus = String(status ?? '').trim().toLowerCase();

    if (totalSpending >= 50000000 || normalizedStatus === 'vip') {
      return 'vip';
    }

    if (totalSpending >= 20000000 || completedBookingsCount >= 10) {
      return 'loyal';
    }

    if (completedBookingsCount > 1) {
      return 'active';
    }

    return 'new';
  }

  /**
   * Calculate discount amount
   * 
   * @param totalAmount - Total amount before discount
   * @param discountPercent - Discount percentage (0-100)
   * @returns Discount amount in VND (rounded)
   */
  private calculateDiscountAmount(totalAmount: number, discountPercent: number): number {
    const clampedPercent = Math.max(0, Math.min(100, discountPercent));
    return Math.round((totalAmount * clampedPercent) / 100);
  }

  /**
   * Check if current date is within campaign period
   * 
   * @param campaignStart - Campaign start date (ISO string)
   * @param campaignEnd - Campaign end date (ISO string)
   * @returns true if within period, false otherwise
   */
  private isWithinCampaignPeriod(
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
   * Convert Platform Rule condition to RuleReasoner condition
   * 
   * Maps Decision Engine Rule format to Sprint 2 RuleReasoner format.
   */
  private convertConditionToReasoner(condition: RuleCondition): Condition {
    if (typeof condition === 'function') {
      throw new Error('Function-based conditions are not supported by convertConditionToReasoner');
    }

    if (condition.type === 'simple') {
      return {
        type: 'comparison',
        field: condition.field,
        operator: this.mapOperator(condition.operator),
        value: condition.value,
      };
    }

    if (condition.type === 'all') {
      return {
        type: 'operator',
        operator: 'and',
        conditions: condition.conditions.map((c) => this.convertConditionToReasoner(c)),
      };
    }

    if (condition.type === 'any') {
      return {
        type: 'operator',
        operator: 'or',
        conditions: condition.conditions.map((c) => this.convertConditionToReasoner(c)),
      };
    }

    throw new Error(`Unsupported condition type: ${(condition as { type: string }).type}`);
  }

  /**
   * Map Platform operator to RuleReasoner operator
   */
  private mapOperator(operator: string): '===' | '!==' | '>' | '>=' | '<' | '<=' {
    const operatorMap: Record<string, '===' | '!==' | '>' | '>=' | '<' | '<='> = {
      equals: '===' as const,
      not_equals: '!==' as const,
      greater_than: '>' as const,
      greater_than_or_equal: '>=' as const,
      greaterThanOrEqual: '>=' as const,
      less_than: '<' as const,
      less_than_or_equal: '<=' as const,
      lessThanOrEqual: '<=' as const,
    };

    return operatorMap[operator] || '===';
  }
}
