/**
 * Procurement Escalation Policy
 * 
 * Determines if and how a procurement requisition should be escalated.
 * 
 * Universal escalation rules:
 * - Multiple rejections → auto-escalate
 * - Critical urgency → escalate immediately
 * - High-value items → escalate to senior management
 */

import type {
  ProcurementDecisionContext,
  EscalationResult,
} from '@/lib/decision-engine/types/procurement-types';
import type { ProcurementPolicy } from './validation-policy';

export class EscalationPolicy implements ProcurementPolicy<EscalationResult> {
  readonly name = 'EscalationPolicy';
  readonly version = '1.0.0';
  readonly decisionType = 'procurement-escalation';

  async evaluate(
    context: ProcurementDecisionContext
  ): Promise<EscalationResult> {
    const { requisition, rules, metadata } = context;
    const matchedRules: string[] = [];

    // Rule 1: Critical urgency → escalate immediately
    if (requisition.urgency === 'critical') {
      matchedRules.push('critical-urgency-escalation');
      return {
        shouldEscalate: true,
        escalationLevel: 'urgent',
        escalateTo: ['cfo', 'ceo'],
        reason: 'Critical urgency requires immediate executive attention',
        matchedRules,
      };
    }

    // Rule 2: Multiple rejections → escalate
    const rejectionCount = (metadata?.rejectionCount as number) || 0;
    if (rejectionCount >= rules.maxRejections) {
      matchedRules.push('max-rejections-escalation');
      return {
        shouldEscalate: true,
        escalationLevel: 'priority',
        escalateTo: ['director', 'cfo'],
        reason: `Rejected ${rejectionCount} times, escalating to senior management`,
        matchedRules,
      };
    }

    // Rule 3: High value → escalate for review
    if (requisition.totalAmount >= 100000000) { // 100M
      matchedRules.push('high-value-escalation');
      return {
        shouldEscalate: true,
        escalationLevel: 'priority',
        escalateTo: ['cfo'],
        reason: 'High-value requisition requires CFO review',
        matchedRules,
      };
    }

    // Default: No escalation needed
    matchedRules.push('no-escalation-required');
    return {
      shouldEscalate: false,
      escalationLevel: 'standard',
      escalateTo: [],
      reason: 'Standard processing, no escalation required',
      matchedRules,
    };
  }
}
