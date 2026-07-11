/**
 * Procurement Approval Policy
 * 
 * Routes procurement requisition to appropriate approver(s) based on amount.
 * 
 * Universal approval tiers:
 * - < 10M: Manager approval
 * - < 50M: Director approval
 * - < 200M: CFO approval
 * - >= 200M: CEO approval
 * 
 * Same tiers, different thresholds per company/industry.
 */

import type {
  ProcurementDecisionContext,
  ApprovalRoutingResult,
} from '@/lib/decision-engine/types/procurement-types';
import type { ProcurementPolicy } from './validation-policy';

export class ApprovalPolicy
  implements ProcurementPolicy<ApprovalRoutingResult>
{
  readonly name = 'ApprovalPolicy';
  readonly version = '1.0.0';
  readonly decisionType = 'procurement-approval';

  async evaluate(
    context: ProcurementDecisionContext
  ): Promise<ApprovalRoutingResult> {
    const requisition = context.requisition;
    const approvalChain = context.approvalChain || {
      manager: { threshold: 10000000, name: 'Manager' },
      director: { threshold: 50000000, name: 'Director' },
      cfo: { threshold: 200000000, name: 'CFO' },
      ceo: { threshold: Infinity, name: 'CEO' },
    };
    const rules = context.rules || {};
    const maxAmountWithoutApproval = rules.maxAmountWithoutApproval ?? 1000000;

    const matchedRules: string[] = [];
    const amount = requisition.totalAmount;

    // Rule 1: Auto-approve if below threshold
    if (amount < maxAmountWithoutApproval) {
      matchedRules.push('auto-approve-low-amount');
      return {
        requiredApprovers: [],
        autoApproved: true,
        approvalLevel: 'none',
        estimatedApprovalTime: 'Immediate',
        requiresMultipleQuotes: false,
        reason: `Amount ${amount.toLocaleString()}đ is below auto-approval threshold`,
        matchedRules,
      };
    }

    // Rule 2: Determine approval level based on amount
    let approvalLevel: 'manager' | 'director' | 'cfo' | 'ceo';
    let requiredApprovers: string[];
    let estimatedTime: string;

    if (amount < approvalChain.manager.threshold) {
      approvalLevel = 'manager';
      requiredApprovers = [approvalChain.manager.name];
      estimatedTime = '4 hours';
      matchedRules.push('manager-approval-required');
    } else if (amount < approvalChain.director.threshold) {
      approvalLevel = 'director';
      requiredApprovers = [
        approvalChain.manager.name,
        approvalChain.director.name,
      ];
      estimatedTime = '24 hours';
      matchedRules.push('director-approval-required');
    } else if (amount < approvalChain.cfo.threshold) {
      approvalLevel = 'cfo';
      requiredApprovers = [
        approvalChain.manager.name,
        approvalChain.director.name,
        approvalChain.cfo.name,
      ];
      estimatedTime = '48 hours';
      matchedRules.push('cfo-approval-required');
    } else {
      approvalLevel = 'ceo';
      requiredApprovers = [
        approvalChain.manager.name,
        approvalChain.director.name,
        approvalChain.cfo.name,
        approvalChain.ceo.name,
      ];
      estimatedTime = '1 week';
      matchedRules.push('ceo-approval-required');
    }

    // Rule 3: Check if multiple quotes required
    const requiresMultipleQuotes =
      !!rules.requiresMultipleQuotes &&
      amount >= (rules.multipleQuotesThreshold ?? 20000000);

    if (requiresMultipleQuotes) {
      matchedRules.push('multiple-quotes-required');
    }

    // Rule 4: Urgent requisitions get priority routing
    if (requisition.urgency === 'critical') {
      estimatedTime = this.reducedTime(estimatedTime);
      matchedRules.push('urgent-priority-routing');
    }

    return {
      requiredApprovers,
      autoApproved: false,
      approvalLevel,
      estimatedApprovalTime: estimatedTime,
      requiresMultipleQuotes,
      reason: `Amount ${amount.toLocaleString()}đ requires ${approvalLevel} approval`,
      matchedRules,
    };
  }

  private reducedTime(normalTime: string): string {
    const timeMap: Record<string, string> = {
      '4 hours': '2 hours',
      '24 hours': '12 hours',
      '48 hours': '24 hours',
      '1 week': '3 days',
    };
    return timeMap[normalTime] || normalTime;
  }
}
