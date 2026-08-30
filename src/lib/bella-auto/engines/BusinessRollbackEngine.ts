/**
 * Business Rollback Engine
 * Phase 11: Safe rollback of complex multi-table business transactions
 */

import { getPrimaryClient } from '@/lib/database/read-replica';
import { SupabaseClient } from '@supabase/supabase-js';

export interface RollbackStep {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'delete' | 'update' | 'restore';
  restore_data?: unknown;
  depends_on_step_id?: string;
  order: number;
}

export interface RollbackTransaction {
  id: string;
  tenant_id: string;
  entity_type: string;
  entity_id: string;
  reason: string;
  steps: RollbackStep[];
  status: 'pending' | 'in_progress' | 'completed' | 'failed';
}

export interface RollbackResult {
  success: boolean;
  transaction_id: string;
  steps_executed: number;
  steps_failed: number;
  error_message?: string;
}

interface AutoTransactionStepRow {
  id: string;
  action_type: 'INSERT' | 'UPDATE' | string;
  target_table: string;
  target_record_id: string;
  before_snapshot?: Record<string, unknown> | null;
}

export class BusinessRollbackEngine {
  private supabaseClient?: SupabaseClient;

  constructor(supabase?: SupabaseClient) {
    this.supabaseClient = supabase;
  }

  async executeRollback(params: {
    transactionId: string;
    reason: string;
    executedBy: string;
    executedByEmail: string;
  }): Promise<{ success: boolean; error?: string; stepsRolledBack?: number }> {
    const client = this.supabaseClient || getPrimaryClient();
    try {
      // 1. Fetch steps for the transaction
      const { data: steps, error: stepsError } = await client
        .from('auto_transaction_steps')
        .select('*')
        .eq('transaction_id', params.transactionId)
        .order('step_order', { ascending: false }); // execute in reverse order

      if (stepsError) throw stepsError;
      if (!steps || steps.length === 0) {
        return { success: false, error: 'No steps found for transaction' };
      }

      // 2. Perform compensating action for each step
      for (const step of steps as unknown as AutoTransactionStepRow[]) {
        // If action_type is INSERT, compensating action is to DELETE the record
        if (step.action_type === 'INSERT') {
          const { error } = await client
            .from(step.target_table as unknown as 'tenants')
            .delete()
            .eq('id', step.target_record_id);
          if (error) throw error;
        } 
        // If action_type is UPDATE, compensating action is to RESTORE before_snapshot
        else if (step.action_type === 'UPDATE' && step.before_snapshot) {
          const { error } = await client
            .from(step.target_table as unknown as 'tenants')
            .update(step.before_snapshot as never)
            .eq('id', step.target_record_id);
          if (error) throw error;
        }

        // Update step status to rolled_back
        await client
          .from('auto_transaction_steps')
          .update({ status: 'rolled_back', rolled_back_at: new Date().toISOString() } as never)
          .eq('id', step.id);
      }

      // 3. Update business transaction status to rolled_back
      await client
        .from('auto_business_transactions')
        .update({
          status: 'rolled_back',
          rollback_reason: params.reason,
          rolled_back_at: new Date().toISOString(),
          rolled_back_by: params.executedBy,
        })
        .eq('id', params.transactionId);

      return { success: true, stepsRolledBack: steps.length };
    } catch (err) {
      return {
        success: false,
        error: err instanceof Error ? err.message : 'Unknown error during rollback',
      };
    }
  }

  /**
   * Analyze dependent cascades for a given entity
   */
  static async analyzeDependentCascades(
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<RollbackStep[]> {
    const steps: RollbackStep[] = [];
    let order = 0;

    // Define cascade rules by entity type
    const cascadeRules: Record<string, Array<{ table: string; fk: string }>> = {
      booking: [
        { table: 'auto_vehicle_allocations', fk: 'booking_id' },
        { table: 'auto_deposits', fk: 'booking_id' },
        { table: 'auto_commissions', fk: 'booking_id' },
      ],
      quotation: [
        { table: 'auto_quotation_items', fk: 'quotation_id' },
        { table: 'auto_deposits', fk: 'quotation_id' },
      ],
      service: [
        { table: 'auto_service_items', fk: 'service_id' },
        { table: 'auto_parts_usage', fk: 'service_id' },
      ],
    };

    const rules = cascadeRules[entityType] || [];

    for (const rule of rules) {
      steps.push({
        id: `${rule.table}-${order}`,
        table_name: rule.table,
        record_id: entityId,
        operation: 'delete',
        order: order++,
      });
    }

    // Main entity (last step)
    steps.push({
      id: `${entityType}-${order}`,
      table_name: `auto_${entityType}s`,
      record_id: entityId,
      operation: 'delete',
      order: order,
    });

    return steps;
  }

  /**
   * Execute rollback transaction
   */
  static async executeRollback(
    transaction: RollbackTransaction
  ): Promise<RollbackResult> {
    const supabase = getPrimaryClient();
    let stepsExecuted = 0;
    let stepsFailed = 0;

    try {
      // Update transaction status
      await supabase
        .from('auto_rollback_transactions')
        .update({ status: 'in_progress' })
        .eq('id', transaction.id);

      // Execute steps in order
      const sortedSteps = [...transaction.steps].sort((a, b) => a.order - b.order);

      for (const step of sortedSteps) {
        try {
          if (step.operation === 'delete') {
            const { error } = await supabase
              .from(step.table_name as unknown as 'tenants')
              .delete()
              .eq('id', step.record_id)
              .eq('tenant_id', transaction.tenant_id);

            if (error) throw error;
          } else if (step.operation === 'update' && step.restore_data) {
            const { error } = await supabase
              .from(step.table_name as unknown as 'tenants')
              .update(step.restore_data as never)
              .eq('id', step.record_id)
              .eq('tenant_id', transaction.tenant_id);

            if (error) throw error;
          }

          // Log step success
          await supabase.from('auto_rollback_steps').insert({
            rollback_transaction_id: transaction.id,
            table_name: step.table_name,
            record_id: step.record_id,
            operation: step.operation,
            status: 'completed',
            executed_at: new Date().toISOString(),
          });

          stepsExecuted++;
        } catch (stepError) {
          stepsFailed++;
          
          // Log step failure
          await supabase.from('auto_rollback_steps').insert({
            rollback_transaction_id: transaction.id,
            table_name: step.table_name,
            record_id: step.record_id,
            operation: step.operation,
            status: 'failed',
            error_message: stepError instanceof Error ? stepError.message : 'Unknown error',
            executed_at: new Date().toISOString(),
          });

          throw stepError;
        }
      }

      // Update transaction status to completed
      await supabase
        .from('auto_rollback_transactions')
        .update({ 
          status: 'completed',
          completed_at: new Date().toISOString(),
        })
        .eq('id', transaction.id);

      // Create audit log entry
      await supabase.from('auto_rollback_audit_log').insert({
        tenant_id: transaction.tenant_id,
        rollback_transaction_id: transaction.id,
        entity_type: transaction.entity_type,
        entity_id: transaction.entity_id,
        steps_executed: stepsExecuted,
        status: 'completed',
        executed_at: new Date().toISOString(),
      });

      return {
        success: true,
        transaction_id: transaction.id,
        steps_executed: stepsExecuted,
        steps_failed: stepsFailed,
      };
    } catch (error) {
      // Update transaction status to failed
      await supabase
        .from('auto_rollback_transactions')
        .update({ 
          status: 'failed',
          error_message: error instanceof Error ? error.message : 'Unknown error',
        })
        .eq('id', transaction.id);

      // Create audit log entry
      await supabase.from('auto_rollback_audit_log').insert({
        tenant_id: transaction.tenant_id,
        rollback_transaction_id: transaction.id,
        entity_type: transaction.entity_type,
        entity_id: transaction.entity_id,
        steps_executed: stepsExecuted,
        status: 'failed',
        error_message: error instanceof Error ? error.message : 'Unknown error',
        executed_at: new Date().toISOString(),
      });

      return {
        success: false,
        transaction_id: transaction.id,
        steps_executed: stepsExecuted,
        steps_failed: stepsFailed,
        error_message: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Create rollback transaction (prepare but don't execute)
   */
  static async createRollbackTransaction(
    tenantId: string,
    entityType: string,
    entityId: string,
    reason: string,
    userId: string
  ): Promise<RollbackTransaction> {
    const supabase = getPrimaryClient();

    // Analyze cascades
    const steps = await this.analyzeDependentCascades(tenantId, entityType, entityId);

    // Create transaction record
    const { data, error } = await supabase
      .from('auto_rollback_transactions')
      .insert({
        tenant_id: tenantId,
        entity_type: entityType,
        entity_id: entityId,
        reason,
        status: 'pending',
        created_by: userId,
      })
      .select()
      .single();

    if (error || !data) {
      throw new Error(`Failed to create rollback transaction: ${error?.message}`);
    }

    return {
      id: data.id,
      tenant_id: tenantId,
      entity_type: entityType,
      entity_id: entityId,
      reason,
      steps,
      status: 'pending',
    };
  }

  /**
   * Validate rollback safety (check for conflicts)
   */
  static async validateRollback(
    tenantId: string,
    entityType: string,
    entityId: string
  ): Promise<{ canRollback: boolean; conflicts: string[] }> {
    const conflicts: string[] = [];

    // Example validation rules
    if (entityType === 'booking') {
      // Check if booking has been invoiced
      const supabase = getPrimaryClient();
      const { data: invoices } = await supabase
        .from('auto_invoices')
        .select('id')
        .eq('booking_id', entityId)
        .eq('tenant_id', tenantId)
        .eq('status', 'paid');

      if (invoices && invoices.length > 0) {
        conflicts.push('Booking has been invoiced and paid. Cannot rollback.');
      }
    }

    return {
      canRollback: conflicts.length === 0,
      conflicts,
    };
  }
}
