/**
 * Leave Approval Decision Integration
 * 
 * Integrates Decision Engine with Leave Approval workflow.
 * Phase B - Real Integration.
 * 
 * Responsibilities:
 * - Fetch employee leave balance from database
 * - Build DecisionContext with proper data
 * - Execute decision via Decision Engine
 * - Map DecisionResult to business outcome
 * - Handle errors gracefully
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { DecisionEngine } from '../../core/DecisionEngine';
import { DecisionProviderRegistry } from '../../core/DecisionProviderRegistry';
import { RuleProvider } from '../../providers/RuleProvider';
import { ResilientDecisionAuditLoggerBridge } from '../../audit/ResilientDecisionAuditLoggerBridge';
import { auditLoggerRegistry } from '../../audit/AuditLoggerRegistry';
import { createDecisionContext } from '../../types/DecisionContext';
import type { DecisionResult } from '../../types';
import { leaveApprovalRules, prepareLeaveApprovalData } from './rules';

export interface LeaveApprovalInput {
  requestId: string;
  approverId: string;
  approverRole: string;
  tenantId: string;
}

export interface LeaveApprovalResult {
  success: boolean;
  approved: boolean;
  reason: string;
  decisionId?: string;
  metadata?: {
    confidence: number;
    executionTimeMs: number;
    autoApproved?: boolean;
    requiresEscalation?: boolean;
    blackoutPeriod?: string;
  };
}

/**
 * Leave Approval Integration Service
 * 
 * Bridges Decision Engine with Leave Approval business logic.
 */
export class LeaveApprovalIntegration {
  private engine: DecisionEngine;
  private registry: DecisionProviderRegistry;

  constructor(private supabase: SupabaseClient) {
    // 1. Create audit logger (RESILIENT version with circuit breaker, retry queue, DLQ)
    const auditLogger = new ResilientDecisionAuditLoggerBridge(supabase);
    
    // 2. Register for health monitoring
    auditLoggerRegistry.register(auditLogger);

    // 3. Create provider registry
    this.registry = new DecisionProviderRegistry();

    // 4. Register RuleProvider
    const ruleProvider = new RuleProvider();
    this.registry.register(ruleProvider); // Provider declares its own supportedRuleTypes

    // 5. Create Decision Engine
    this.engine = new DecisionEngine({
      registry: this.registry,
      auditLogger,
      timeoutMs: 5000,
      fallbackStrategy: 'SAFE_DEFAULT', // Reject on error (safe for leave approval)
    });
  }

  /**
   * Evaluate leave request approval decision
   */
  async evaluateLeaveApproval(
    input: LeaveApprovalInput
  ): Promise<LeaveApprovalResult> {
    try {
      // 1. Fetch leave request
      const { data: request, error: requestError } = await this.supabase
        .from('leave_requests')
        .select('*')
        .eq('id', input.requestId)
        .single();

      if (requestError || !request) {
        return {
          success: false,
          approved: false,
          reason: 'Leave request not found',
        };
      }

      // 2. Fetch employee data
      const { data: employee, error: employeeError } = await this.supabase
        .from('users')
        .select('id, full_name, leave_balance')
        .eq('id', request.employee_id)
        .single();

      if (employeeError || !employee) {
        return {
          success: false,
          approved: false,
          reason: 'Employee not found',
        };
      }

      // 3. Prepare input data for rules
      const ruleData = prepareLeaveApprovalData({
        employeeLeaveBalance: employee.leave_balance || 0,
        leaveType: request.leave_type,
        requestedDays: request.days,
        startDate: request.start_date,
        endDate: request.end_date,
        approverRole: input.approverRole,
      });

      console.log('[LeaveApproval] Rule data prepared:', {
        employeeLeaveBalance: employee.leave_balance,
        requestedDays: request.days,
        insufficientBalance: ruleData.insufficientBalance,
        leaveType: request.leave_type,
        startDate: request.start_date,
      });

      // 4. Execute decision through each rule until one matches
      let finalResult: DecisionResult | null = null;

      for (const rule of leaveApprovalRules) {
        const context = createDecisionContext({
          tenantId: input.tenantId,
          module: 'hr', // HR module
          decisionType: 'leave-request-approval',
          ruleType: 'if-then',
          rule,
          data: ruleData,
          user: {
            id: input.approverId,
            role: input.approverRole,
          },
          correlationId: `leave-${input.requestId}`,
          metadata: {
            requestId: input.requestId,
            employeeId: request.employee_id,
            employeeName: employee.full_name,
          },
        });

        const result = await this.engine.evaluate(context);

        // If rule matched (approved or rejected), use this result
        if (result.action && result.action.data.approve !== undefined) {
          finalResult = result;
          break; // Stop at first matching rule
        }
      }

      if (!finalResult) {
        // Should never happen (default rule always matches)
        return {
          success: false,
          approved: false,
          reason: 'No rule matched (configuration error)',
        };
      }

      // 5. Map DecisionResult to business outcome
      return {
        success: true,
        approved: finalResult.action?.data.approve === true,
        reason: finalResult.reason || 'No reason provided',
        decisionId: `leave-${input.requestId}`, // Use correlation ID as decision ID
        metadata: {
          confidence: finalResult.confidence,
          executionTimeMs: finalResult.executionTime,
          autoApproved: finalResult.action?.data.autoApproved as boolean | undefined,
          requiresEscalation: finalResult.action?.data.requiresEscalation as boolean | undefined,
          blackoutPeriod: finalResult.action?.data.blackoutPeriod as string | undefined,
        },
      };
    } catch (error) {
      console.error('Leave approval decision failed:', error);
      return {
        success: false,
        approved: false,
        reason:
          'Decision engine error: ' +
          (error instanceof Error ? error.message : 'Unknown'),
      };
    }
  }

  /**
   * Apply decision result to database
   * 
   * Updates leave request status based on decision.
   */
  async applyDecision(
    requestId: string,
    decision: LeaveApprovalResult,
    approverId: string
  ): Promise<{ success: boolean; error?: string }> {
    try {
      if (!decision.success) {
        return {
          success: false,
          error: decision.reason,
        };
      }

      // Update leave request status
      const { error: updateError } = await this.supabase
        .from('leave_requests')
        .update({
          status: decision.approved ? 'approved' : 'rejected',
          approved_by: approverId,
          approval_reason: decision.reason,
          approved_at: new Date().toISOString(),
          decision_id: decision.decisionId,
          decision_confidence: decision.metadata?.confidence,
        })
        .eq('id', requestId);

      if (updateError) {
        return {
          success: false,
          error: `Database update failed: ${updateError.message}`,
        };
      }

      // TODO: Side effects (Phase C)
      // - If approved, create attendance record
      // - Send notification to employee
      // - Update leave balance

      return { success: true };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Full workflow: Evaluate + Apply
   */
  async approveLeaveRequest(
    input: LeaveApprovalInput
  ): Promise<LeaveApprovalResult> {
    // 1. Evaluate decision
    const decision = await this.evaluateLeaveApproval(input);

    if (!decision.success) {
      return decision;
    }

    // 2. Apply decision to database
    const applyResult = await this.applyDecision(
      input.requestId,
      decision,
      input.approverId
    );

    if (!applyResult.success) {
      return {
        ...decision,
        success: false,
        reason: applyResult.error || 'Failed to apply decision',
      };
    }

    return decision;
  }
}
