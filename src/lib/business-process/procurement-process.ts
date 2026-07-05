/**
 * Procurement Business Process
 * 
 * Composes 3 independent policies to process a procurement requisition:
 * 1. Validation Policy - Is requisition valid?
 * 2. Approval Policy - Who needs to approve?
 * 3. Escalation Policy - Should it be escalated?
 * 
 * Universal process that works across industries:
 * - Manufacturing (raw materials)
 * - Retail (inventory)
 * - Construction (materials)
 * - IT (hardware/software)
 */

import { BaseBusinessProcess } from './executor';
import type { ProcessConfig, PolicyExecutionResult } from './types';
import type {
  ProcurementDecisionContext,
  ProcurementResult,
  ValidationResult,
  ApprovalRoutingResult,
  EscalationResult,
} from '@/lib/decision-engine/types/procurement-types';
import { ValidationPolicy } from '@/services/policies/procurement/validation-policy';
import { ApprovalPolicy } from '@/services/policies/procurement/approval-policy';
import { EscalationPolicy } from '@/services/policies/procurement/escalation-policy';

export class ProcurementProcess extends BaseBusinessProcess<
  ProcurementDecisionContext,
  ProcurementResult
> {
  config: ProcessConfig = {
    name: 'ProcurementProcess',
    version: '1.0.0',
    executionMode: 'sequential', // Validation → Approval → Escalation
    continueOnFailure: true,
    timeout: 5000,
  };

  policies = [
    new ValidationPolicy(),
    new ApprovalPolicy(),
    new EscalationPolicy(),
  ];

  protected async aggregate(
    context: ProcurementDecisionContext,
    policyResults: PolicyExecutionResult[]
  ): Promise<ProcurementResult> {
    const components: Array<
      ValidationResult | ApprovalRoutingResult | EscalationResult
    > = [];

    let valid = false;
    let requiredApprovers: string[] = [];
    let autoApproved = false;
    let shouldEscalate = false;
    let estimatedCompletionTime = '';
    let reason = '';

    for (const result of policyResults) {
      if (result.status === 'success' && result.data) {
        const data = result.data;
        components.push(data);

        switch (result.policyType) {
          case 'procurement-validation': {
            const validationData = data as ValidationResult;
            valid = validationData.valid;
            if (!valid) {
              reason = validationData.reason;
            }
            break;
          }

          case 'procurement-approval': {
            const approvalData = data as ApprovalRoutingResult;
            requiredApprovers = approvalData.requiredApprovers;
            autoApproved = approvalData.autoApproved;
            estimatedCompletionTime = approvalData.estimatedApprovalTime;
            if (!reason) {
              reason = approvalData.reason;
            }
            break;
          }

          case 'procurement-escalation': {
            const escalationData = data as EscalationResult;
            shouldEscalate = escalationData.shouldEscalate;
            if (shouldEscalate && !reason) {
              reason = escalationData.reason;
            }
            break;
          }
        }
      }
    }

    // Determine status
    let status: 'approved' | 'pending_approval' | 'rejected' | 'escalated';
    
    if (!valid) {
      status = 'rejected';
    } else if (shouldEscalate) {
      status = 'escalated';
    } else if (autoApproved) {
      status = 'approved';
    } else {
      status = 'pending_approval';
    }

    return {
      requisitionId: context.requisition.id,
      valid,
      requiredApprovers,
      autoApproved,
      shouldEscalate,
      estimatedCompletionTime,
      status,
      reason,
      components,
      metadata: {
        processName: this.config.name,
        processVersion: this.config.version,
        executionTime: 0,
        policyComposition: policyResults.map(
          (r) => `${r.policyName}:${r.policyType}`
        ),
      },
    };
  }
}

export function createProcurementProcess(): ProcurementProcess {
  return new ProcurementProcess();
}
