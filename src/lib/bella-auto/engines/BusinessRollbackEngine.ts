/**
 * Business Rollback Engine
 * Phase 11: Safe rollback of complex multi-table business transactions
 */

import { getPrimaryClient } from '@/lib/database/read-replica';

export interface RollbackStep {
  id: string;
  table_name: string;
  record_id: string;
  operation: 'delete' | 'update' | 'restore';
  restore_data?: any;
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

export class BusinessRollbackEngine {
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
              .from(step.table_name)
              .delete()
              .eq('id', step.record_id)
              .eq('tenant_id', transaction.tenant_id);

            if (error) throw error;
          } else if (step.operation === 'update' && step.restore_data) {
            const { error } = await supabase
              .from(step.table_name)
              .update(step.restore_data)
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
