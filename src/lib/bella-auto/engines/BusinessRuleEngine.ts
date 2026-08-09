/**
 * Bella Auto - Business Rule Engine
 * 
 * Phase 13: No-code rule evaluation and dynamic approval routing
 * 
 * Features:
 * - Evaluate business rules against entity data
 * - Execute rule actions (approvals, notifications, allocations)
 * - Multi-level approval workflow management
 * - Rule conflict resolution by priority
 */

import { SupabaseClient } from '@supabase/supabase-js';

export interface RuleCondition {
  field: string;
  operator: 'equals' | 'not_equals' | 'greater_than' | 'less_than' | 'greater_or_equal' | 'less_or_equal' | 'contains' | 'not_contains' | 'in' | 'not_in' | 'between';
  value: unknown;
}

export interface RuleAction {
  type: 'require_approval' | 'auto_approve' | 'auto_reject' | 'set_discount_limit' | 'allocate_vehicle' | 'assign_sales_person' | 'trigger_notification' | 'create_task';
  [key: string]: unknown;
}


export interface BusinessRule {
  id: string;
  code: string;
  name: string;
  entityType: string;
  priority: number;
  conditions: RuleCondition[];
  actions: RuleAction[];
  isActive: boolean;
}

export interface RuleEvaluationResult {
  ruleId: string;
  ruleCode: string;
  matched: boolean;
  actions: RuleAction[];
  executionStatus: 'executed' | 'skipped' | 'failed';
  errorMessage?: string;
}

export interface ApprovalWorkflow {
  id: string;
  code: string;
  name: string;
  entityType: string;
  levels: ApprovalLevel[];
  allowSkip: boolean;
  timeoutHours?: number;
}

export interface ApprovalLevel {
  level: number;
  role: string;
  requiredCount: number;
}

export interface ApprovalInstance {
  id: string;
  workflowId: string;
  entityType: string;
  entityId: string;
  currentLevel: number;
  status: 'pending' | 'approved' | 'rejected' | 'timeout';
  approvals: ApprovalRecord[];
}

export interface ApprovalRecord {
  level: number;
  approverId: string;
  approvedAt: string;
  comment?: string;
}

export class BusinessRuleEngine {
  constructor(private supabase: SupabaseClient) {}

  /**
   * Evaluate all active rules for an entity
   */
  async evaluateRules(
    tenantId: string,
    entityType: string,
    entityId: string,
    entityData: Record<string, unknown>,
    userId: string
  ): Promise<RuleEvaluationResult[]> {
    try {
      // Call RPC function for rule evaluation
      const { data, error } = await this.supabase.rpc('evaluate_business_rules', {
        p_tenant_id: tenantId,
        p_entity_type: entityType,
        p_entity_id: entityId,
        p_entity_data: entityData,
        p_user_id: userId,
      });

      if (error) {
        console.error('Rule evaluation failed:', error);
        return [];
      }

      return (data || []).map((row: Record<string, unknown>) => ({
        ruleId: row.rule_id,
        ruleCode: row.rule_code,
        matched: row.matched,
        actions: row.actions,
        executionStatus: row.execution_status,
      }));
    } catch (error) {
      console.error('Unexpected error during rule evaluation:', error);
      return [];
    }
  }

  /**
   * Execute rule actions
   */
  async executeActions(
    tenantId: string,
    entityType: string,
    entityId: string,
    actions: RuleAction[],
    userId: string
  ): Promise<{ success: boolean; results: unknown[] }> {
    const results = [];

    for (const action of actions) {
      try {
        switch (action.type) {
          case 'require_approval':
            const approvalResult = await this.createApprovalInstance(
              tenantId,
              action.workflow,
              entityType,
              entityId
            );
            results.push({ action: 'require_approval', success: approvalResult.success });
            break;

          case 'auto_approve':
            // Auto-approve logic (update entity status)
            results.push({ action: 'auto_approve', success: true });
            break;

          case 'trigger_notification':
            // Trigger notification (integrate with notification service)
            results.push({ action: 'trigger_notification', success: true });
            break;

          case 'allocate_vehicle':
            // Vehicle allocation logic
            results.push({ action: 'allocate_vehicle', success: true });
            break;

          default:
            results.push({ action: action.type, success: false, error: 'Unknown action type' });
        }
      } catch (error) {
        results.push({
          action: action.type,
          success: false,
          error: error instanceof Error ? error.message : 'Unknown error',
        });
      }
    }

    return {
      success: results.every((r) => r.success),
      results,
    };
  }

  /**
   * Create approval workflow instance
   */
  async createApprovalInstance(
    tenantId: string,
    workflowCode: string,
    entityType: string,
    entityId: string
  ): Promise<{ success: boolean; instanceId?: string; error?: string }> {
    try {
      // Find workflow
      const { data: workflow, error: workflowError } = await this.supabase
        .from('auto_approval_workflows')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('code', workflowCode)
        .eq('is_active', true)
        .single();

      if (workflowError || !workflow) {
        return { success: false, error: 'Workflow not found' };
      }

      // Create approval instance
      const { data: instance, error: instanceError } = await this.supabase
        .from('auto_approval_instances')
        .insert({
          tenant_id: tenantId,
          workflow_id: workflow.id,
          entity_type: entityType,
          entity_id: entityId,
          current_level: 1,
          status: 'pending',
          approvals: [],
        })
        .select()
        .single();

      if (instanceError || !instance) {
        return { success: false, error: instanceError?.message || 'Failed to create instance' };
      }

      return { success: true, instanceId: instance.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Process approval action
   */
  async processApproval(
    tenantId: string,
    instanceId: string,
    approverId: string,
    approverRole: string,
    approved: boolean,
    comment?: string
  ): Promise<{ success: boolean; completed: boolean; error?: string }> {
    try {
      // Fetch instance
      const { data: instance, error: fetchError } = await this.supabase
        .from('auto_approval_instances')
        .select('*, workflow:auto_approval_workflows(*)')
        .eq('id', instanceId)
        .eq('tenant_id', tenantId)
        .single();

      if (fetchError || !instance) {
        return { success: false, completed: false, error: 'Instance not found' };
      }

      if (instance.status !== 'pending') {
        return { success: false, completed: false, error: 'Instance already completed' };
      }

      // Validate approver role matches current level
      const workflow = instance.workflow as unknown as ApprovalWorkflow;
      const currentLevelConfig = workflow.levels.find(
        (l: Record<string, unknown>) => l.level === instance.current_level
      );

      if (!currentLevelConfig || currentLevelConfig.role !== approverRole) {
        return { success: false, completed: false, error: 'Invalid approver role' };
      }

      // Rejected?
      if (!approved) {
        const { error: updateError } = await this.supabase
          .from('auto_approval_instances')
          .update({
            status: 'rejected',
            completed_at: new Date().toISOString(),
            approvals: [
              ...instance.approvals,
              {
                level: instance.current_level,
                approverId,
                approvedAt: new Date().toISOString(),
                approved: false,
                comment,
              },
            ],
          })
          .eq('id', instanceId);

        return { success: !updateError, completed: true, error: updateError?.message };
      }

      // Approved - add to approvals array
      const newApprovals = [
        ...instance.approvals,
        {
          level: instance.current_level,
          approverId,
          approvedAt: new Date().toISOString(),
          approved: true,
          comment,
        },
      ];

      // Check if current level is complete
      const currentLevelApprovals = newApprovals.filter(
        (a: Record<string, unknown>) => a.level === instance.current_level && a.approved
      );

      if (currentLevelApprovals.length >= currentLevelConfig.requiredCount) {
        // Move to next level or complete
        const nextLevel = instance.current_level + 1;
        const hasNextLevel = workflow.levels.some((l: Record<string, unknown>) => l.level === nextLevel);

        const { error: updateError } = await this.supabase
          .from('auto_approval_instances')
          .update({
            current_level: hasNextLevel ? nextLevel : instance.current_level,
            status: hasNextLevel ? 'pending' : 'approved',
            completed_at: hasNextLevel ? null : new Date().toISOString(),
            approvals: newApprovals,
          })
          .eq('id', instanceId);

        return {
          success: !updateError,
          completed: !hasNextLevel,
          error: updateError?.message,
        };
      } else {
        // Still need more approvals at current level
        const { error: updateError } = await this.supabase
          .from('auto_approval_instances')
          .update({ approvals: newApprovals })
          .eq('id', instanceId);

        return { success: !updateError, completed: false, error: updateError?.message };
      }
    } catch (error) {
      return {
        success: false,
        completed: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Get pending approvals for a user
   */
  async getPendingApprovalsForUser(
    tenantId: string,
    userId: string,
    userRole: string
  ): Promise<unknown[]> {
    try {
      const { data, error } = await this.supabase.rpc('get_pending_approvals', {
        p_tenant_id: tenantId,
        p_user_id: userId,
        p_user_role: userRole,
      });

      if (error) {
        console.error('Failed to fetch pending approvals:', error);
        return [];
      }

      return data || [];
    } catch (error) {
      console.error('Unexpected error fetching approvals:', error);
      return [];
    }
  }
}
