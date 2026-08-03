/**
 * Bella Auto - Service Completion Rollback Use Case
 * 
 * Business Flow:
 * 1. Customer brings vehicle for service (10K km, oil change, etc.)
 * 2. Service completed → Create service record
 * 3. Impact: Inventory (parts used), Revenue (service charge), Journey (touchpoint)
 * 
 * Rollback Scenario:
 * - Service marked as completed incorrectly
 * - Parts usage recorded wrong
 * - Need to revert all impacts and re-do service
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessRollbackEngine } from '../engines/BusinessRollbackEngine';

export interface ServiceCompletionData {
  serviceId: string;
  vehicleId: string;
  customerId: string;
  serviceType: string; // '10k', '20k', 'repair', 'warranty'
  partsUsed: Array<{
    productId: string;
    quantity: number;
    unitPrice: number;
  }>;
  laborCharge: number;
  totalCharge: number;
  completedAt: string;
  completedBy: string;
}

export class ServiceCompletionRollback {
  private engine: BusinessRollbackEngine;

  constructor(private supabase: SupabaseClient) {
    this.engine = new BusinessRollbackEngine(supabase);
  }

  /**
   * Register service completion transaction with all impacts
   */
  async registerServiceCompletion(
    tenantId: string,
    data: ServiceCompletionData,
    userId: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      // Create transaction
      const { data: transaction, error: txError } = await this.supabase
        .from('auto_business_transactions')
        .insert({
          tenant_id: tenantId,
          transaction_type: 'service_completion',
          entity_type: 'auto_service',
          entity_id: data.serviceId,
          status: 'completed',
          metadata: {
            vehicle_id: data.vehicleId,
            customer_id: data.customerId,
            service_type: data.serviceType,
            created_by_email: userId,
          },
        })
        .select()
        .single();

      if (txError || !transaction) {
        return { success: false, error: txError?.message || 'Failed to create transaction' };
      }

      const steps = [];
      let stepOrder = 1;

      // Step 1: Create service record
      const serviceRecord = {
        id: data.serviceId,
        tenant_id: tenantId,
        vehicle_id: data.vehicleId,
        customer_id: data.customerId,
        service_type: data.serviceType,
        status: 'completed',
        labor_charge: data.laborCharge,
        total_charge: data.totalCharge,
        completed_at: data.completedAt,
        completed_by: data.completedBy,
      };

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_services',
        target_record_id: data.serviceId,
        before_snapshot: null,
        after_snapshot: serviceRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Step 2-N: Deduct inventory for each part used
      for (const part of data.partsUsed) {
        // Fetch current inventory
        const { data: inventory } = await this.supabase
          .from('auto_inventory')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('product_id', part.productId)
          .single();

        if (inventory) {
          const beforeSnapshot = { ...inventory };
          const afterSnapshot = {
            ...inventory,
            quantity: inventory.quantity - part.quantity,
            updated_at: new Date().toISOString(),
          };

          // Record inventory deduction
          await this.supabase
            .from('auto_inventory')
            .update({ quantity: afterSnapshot.quantity })
            .eq('id', inventory.id);

          steps.push({
            transaction_id: transaction.id,
            step_order: stepOrder++,
            action_type: 'UPDATE',
            target_table: 'auto_inventory',
            target_record_id: inventory.id,
            before_snapshot: beforeSnapshot,
            after_snapshot: afterSnapshot,
            status: 'executed',
            executed_at: new Date().toISOString(),
          });
        }
      }

      // Step N+1: Create revenue record
      const revenueId = crypto.randomUUID();
      const revenueRecord = {
        id: revenueId,
        tenant_id: tenantId,
        transaction_type: 'service',
        entity_id: data.serviceId,
        customer_id: data.customerId,
        amount: data.totalCharge,
        recorded_at: data.completedAt,
        status: 'confirmed',
      };

      await this.supabase.from('auto_revenue').insert(revenueRecord);

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_revenue',
        target_record_id: revenueId,
        before_snapshot: null,
        after_snapshot: revenueRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Step N+2: Create journey touchpoint
      const touchpointId = crypto.randomUUID();
      const touchpointRecord = {
        id: touchpointId,
        tenant_id: tenantId,
        customer_id: data.customerId,
        channel: 'service',
        direction: 'inbound',
        title: `Hoàn thành dịch vụ: ${data.serviceType}`,
        content: `VIN: ${data.vehicleId}, Phí: ${data.totalCharge.toLocaleString()} VND`,
        interacted_at: data.completedAt,
        staff_id: data.completedBy,
      };

      await this.supabase.from('auto_touchpoints').insert(touchpointRecord);

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_touchpoints',
        target_record_id: touchpointId,
        before_snapshot: null,
        after_snapshot: touchpointRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Insert all steps
      const { error: stepsError } = await this.supabase
        .from('auto_transaction_steps')
        .insert(steps);

      if (stepsError) {
        return { success: false, error: stepsError.message };
      }

      return { success: true, transactionId: transaction.id };
    } catch (error) {
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Rollback service completion
   */
  async rollbackServiceCompletion(
    transactionId: string,
    reason: string,
    userId: string,
    userEmail: string
  ): Promise<{ success: boolean; error?: string; stepsRolledBack?: number }> {
    return this.engine.executeRollback({
      transactionId,
      reason,
      executedBy: userId,
      executedByEmail: userEmail,
    });
  }
}
