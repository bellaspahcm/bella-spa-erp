/**
 * Booking Decision Service
 * 
 * Integrates Decision Engine with booking flow for auto-approval,
 * deposit requirements, and manual review decisions.
 * 
 * Phase 0.5: Production Integration & Architecture Validation
 * 
 * @module services/booking-decision
 */

import {
  bootstrapDecisionEngine,
  bootstrapForTesting,
  createDecisionContext,
  type DecisionResult,
  type DecisionContext,
  type IfThenRule,
} from '@/lib/decision-engine';
import { metricsCollector, auditTrail, type DecisionMetric, type AuditRecord, generateDecisionId } from '@/lib/decision-engine/observability';
import {
  getBookingApprovalRules,
  mapCustomerTier,
  calculateDepositAmount,
} from '@/lib/decision-engine/rules/booking-approval-rules';
import type { Database } from '@/types/database.types';

type CustomerRow = Database['public']['Tables']['customers']['Row'];

/**
 * Booking decision input
 */
export interface BookingDecisionInput {
  /** Booking total amount (after discount) */
  totalAmount: number;
  
  /** Customer information */
  customer: {
    id: string;
    status: CustomerRow['status'];
    completedBookingsCount: number;
  };
  
  /** Optional: Tenant ID for multi-tenant setup */
  tenantId?: string;
  
  /** Optional: Additional context for decision */
  metadata?: Record<string, unknown>;
}

/**
 * Booking decision output
 */
export interface BookingDecisionOutput {
  /** Whether booking is approved */
  approved: boolean;
  
  /** Whether deposit is required */
  requiresDeposit: boolean;
  
  /** Deposit amount in VND (if requiresDeposit is true) */
  depositAmount: number;
  
  /** Deposit percentage (if requiresDeposit is true) */
  depositPercent: number;
  
  /** Whether manual review is required */
  requiresManualReview: boolean;
  
  /** Whether verification is required */
  requiresVerification: boolean;
  
  /** Decision reason (human-readable) */
  reason: string;
  
  /** Matched rules (for audit trail) */
  matchedRules: string[];
  
  /** Decision confidence (0.0 - 1.0) */
  confidence: number;
  
  /** Execution time in milliseconds */
  executionTime: number;
  
  /** Provider used */
  provider: string;
  
  /** Full decision result (for debugging/audit) */
  _raw: DecisionResult;
}

/**
 * Evaluate booking approval decision using Decision Engine
 * 
 * **Process:**
 * 1. Map customer to tier (new/active/loyal/vip)
 * 2. Create decision context with booking data
 * 3. Evaluate rules in priority order
 * 4. Return first matching rule's decision
 * 5. If no rules match, apply default (manual review)
 * 
 * **Rules Priority** (high to low):
 * - 100: Auto-approve small bookings (<5M)
 * - 90: Auto-approve VIP customers (<20M)
 * - 85: Auto-approve loyal customers (<15M)
 * - 80: Require deposit for medium bookings (5M-10M)
 * - 70: Require deposit for large bookings (>=10M)
 * - 60: Manual review for new customers + large bookings
 * - 50: Reject suspicious bookings (>=50M)
 * 
 * @param input - Booking decision input
 * @returns Booking decision output with approval status and requirements
 * 
 * @example
 * ```typescript
 * // Small booking - auto-approved
 * const result1 = await evaluateBookingApproval({
 *   totalAmount: 3000000,
 *   customer: {
 *     id: 'cust-123',
 *     status: 'new',
 *     completedBookingsCount: 0,
 *   },
 * });
 * // result1.approved = true, result1.requiresDeposit = false
 * 
 * // Medium booking - requires deposit
 * const result2 = await evaluateBookingApproval({
 *   totalAmount: 7000000,
 *   customer: {
 *     id: 'cust-456',
 *     status: 'active',
 *     completedBookingsCount: 2,
 *   },
 * });
 * // result2.approved = true, result2.requiresDeposit = true, result2.depositPercent = 30
 * 
 * // VIP customer - auto-approved without deposit
 * const result3 = await evaluateBookingApproval({
 *   totalAmount: 15000000,
 *   customer: {
 *     id: 'cust-789',
 *     status: 'vip',
 *     completedBookingsCount: 50,
 *   },
 * });
 * // result3.approved = true, result3.requiresDeposit = false
 * ```
 */
export async function evaluateBookingApproval(
  input: BookingDecisionInput
): Promise<BookingDecisionOutput> {
  const startTime = Date.now();
  const decisionId = generateDecisionId();
  const decisionStartTime = performance.now();
  
  // Bootstrap Decision Engine with testing mode (no events to avoid validation errors)
  const { engine } = bootstrapForTesting();
  
  // Map customer to tier for decision rules
  const customerTier = mapCustomerTier(
    input.customer.status,
    input.customer.completedBookingsCount
  );
  
  // Get all booking approval rules
  const rules = getBookingApprovalRules();
  
  // Evaluate each rule in priority order until one matches
  for (const rule of rules) {
    try {
      // Create decision context
      const context: DecisionContext = createDecisionContext({
        tenantId: input.tenantId || 'bella-spa-vn',
        module: 'booking',
        decisionType: 'auto-approval',
        ruleType: 'if-then',
        rule,
        data: {
          totalAmount: input.totalAmount,
          customerTier,
          customerId: input.customer.id,
          completedBookingsCount: input.customer.completedBookingsCount,
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
        decisionType: 'booking_approval',
        executionTime,
        confidence: result.confidence,
        provider: 'RuleProvider',
        rulesMatched: result.confidence > 0 ? 1 : 0,
        approved: result.approved,
        requiresManualReview: Boolean(result.action && (result.action as any).requiresManualReview),
        cacheHit: false,
        failed: false,
        usedFallback: false,
        tenantId: input.tenantId || 'bella-spa-vn',
      };
      metricsCollector.record(metric);
      
      // Record audit trail
      const auditRecord: AuditRecord = {
        decisionId,
        decisionType: 'booking_approval',
        timestamp: new Date(startTime),
        tenantId: input.tenantId || 'bella-spa-vn',
        provider: 'RuleProvider',
        matchedRules: result.confidence > 0 ? [{
          ruleId: rule.id || 'unknown',
          priority: 0,
          condition: JSON.stringify(rule.condition),
          action: result.action,
        }] : [],
        executionTime,
        confidence: result.confidence,
        actions: result.action ? [result.action] : [],
        reason: result.reason || 'No reason provided',
        context,
        result,
        cacheHit: false,
        failed: false,
        usedFallback: false,
      };
      auditTrail.record(auditRecord);
      
      // If rule matched (confidence > 0), use this decision
      if (result.confidence > 0 && result.action) {
        const action = result.action.data as Record<string, unknown>;
        const approved = Boolean(action.approved);
        const requiresDeposit = Boolean(action.requiresDeposit);
        const depositPercent = Number(action.depositPercent || 0);
        const depositAmount = requiresDeposit
          ? calculateDepositAmount(input.totalAmount, depositPercent)
          : 0;
        
        return {
          approved,
          requiresDeposit,
          depositAmount,
          depositPercent,
          requiresManualReview: Boolean(action.requiresManualReview),
          requiresVerification: Boolean(action.requiresVerification),
          reason: result.reason || 'No reason provided',
          matchedRules: result.matchedRules || (rule.id ? [rule.id] : []),
          confidence: result.confidence,
          executionTime: Date.now() - startTime,
          provider: result.provider,
          _raw: result,
        };
      }
    } catch (error) {
      console.error('[evaluateBookingApproval] Error evaluating rule:', rule.id, error);
      // Continue to next rule on error
    }
  }
  
  // No rules matched - apply default (manual review for safety)
  return {
    approved: false,
    requiresDeposit: false,
    depositAmount: 0,
    depositPercent: 0,
    requiresManualReview: true,
    requiresVerification: false,
    reason: 'Không có quy tắc nào phù hợp - yêu cầu duyệt thủ công',
    matchedRules: [],
    confidence: 0.5, // Low confidence default
    executionTime: Date.now() - startTime,
    provider: 'fallback',
    _raw: {
      approved: false,
      confidence: 0.5,
      reason: 'No matching rules',
      executionTime: Date.now() - startTime,
      provider: 'fallback',
      timestamp: new Date(),
    },
  };
}

/**
 * Evaluate booking approval (batch mode)
 * 
 * Evaluates multiple bookings in parallel for performance.
 * Useful for bulk operations or reports.
 * 
 * @param inputs - Array of booking decision inputs
 * @returns Array of booking decision outputs
 * 
 * @example
 * ```typescript
 * const bookings = [
 *   { totalAmount: 3000000, customer: { id: '1', status: 'new', completedBookingsCount: 0 } },
 *   { totalAmount: 7000000, customer: { id: '2', status: 'active', completedBookingsCount: 3 } },
 *   { totalAmount: 15000000, customer: { id: '3', status: 'vip', completedBookingsCount: 20 } },
 * ];
 * 
 * const results = await evaluateBookingApprovalBatch(bookings);
 * // results[0].approved = true (small)
 * // results[1].approved = true, results[1].requiresDeposit = true (medium)
 * // results[2].approved = true, results[2].requiresDeposit = false (VIP)
 * ```
 */
export async function evaluateBookingApprovalBatch(
  inputs: BookingDecisionInput[]
): Promise<BookingDecisionOutput[]> {
  return Promise.all(inputs.map(input => evaluateBookingApproval(input)));
}

/**
 * Helper: Get suggested booking status based on decision
 * 
 * **Status Mapping:**
 * - approved=false, requiresManualReview=true → 'inquiry' (awaiting manager review)
 * - approved=false, requiresVerification=true → 'inquiry' (need verification)
 * - approved=true, requiresDeposit=true → 'deposit_pending' (awaiting deposit)
 * - approved=true, requiresDeposit=false → 'booked' (ready to go)
 * 
 * **Valid Database Status Values:**
 * 'inquiry', 'deposit_pending', 'booked', 'in_progress', 'completed', 'cancelled'
 * 
 * @param decision - Booking decision output
 * @returns Suggested booking status (one of valid database status values)
 */
export function getSuggestedBookingStatus(
  decision: BookingDecisionOutput
): 'inquiry' | 'deposit_pending' | 'booked' {
  if (!decision.approved) {
    // Not approved → inquiry (manager will review and change status)
    return 'inquiry';
  }
  
  if (decision.requiresDeposit) {
    // Approved but needs deposit → deposit_pending
    return 'deposit_pending';
  }
  
  // Approved without deposit → booked (ready for service)
  return 'booked';
}

/**
 * Helper: Format decision reason for customer-facing message
 * 
 * Converts internal decision reason to friendly customer message.
 * 
 * @param decision - Booking decision output
 * @returns Customer-facing message
 * 
 * @example
 * ```typescript
 * const decision = await evaluateBookingApproval({ ... });
 * const message = formatCustomerMessage(decision);
 * // "Đơn hàng của bạn đã được xác nhận! Vui lòng đặt cọc 2,100,000đ để hoàn tất."
 * ```
 */
export function formatCustomerMessage(decision: BookingDecisionOutput): string {
  if (!decision.approved) {
    if (decision.requiresManualReview) {
      return 'Đơn hàng của bạn đang được xem xét. Chúng tôi sẽ liên hệ trong 24 giờ.';
    }
    if (decision.requiresVerification) {
      return 'Vui lòng cung cấp thêm thông tin để xác minh đơn hàng.';
    }
    return 'Đơn hàng của bạn đang được xử lý.';
  }
  
  if (decision.requiresDeposit) {
    const depositFormatted = decision.depositAmount.toLocaleString('vi-VN');
    return `Đơn hàng của bạn đã được xác nhận! Vui lòng đặt cọc ${depositFormatted}đ (${decision.depositPercent}%) để hoàn tất.`;
  }
  
  return 'Đơn hàng của bạn đã được xác nhận thành công!';
}
