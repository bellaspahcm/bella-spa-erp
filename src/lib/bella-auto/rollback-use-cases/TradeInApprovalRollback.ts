/**
 * Bella Auto - Trade-In Approval Rollback Use Case
 * 
 * Business Flow:
 * 1. Customer brings old vehicle for trade-in
 * 2. Appraisal done → Trade-in value determined
 * 3. Approved → Impact: Inventory (add used vehicle), Accounting (trade-in credit), Contract
 * 
 * Rollback Scenario:
 * - Trade-in value miscalculated
 * - Vehicle condition assessed incorrectly
 * - Customer changes mind before delivery
 * - Need to revert inventory and accounting impacts
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessRollbackEngine } from '../engines/BusinessRollbackEngine';

export interface TradeInApprovalData {
  tradeInId: string;
  customerId: string;
  oldVehicleVIN: string;
  oldVehicleBrand: string;
  oldVehicleModel: string;
  oldVehicleYear: number;
  appraisalValue: number;
  condition: 'excellent' | 'good' | 'fair' | 'poor';
  mileage: number;
  newVehicleContractId: string; // Contract customer is buying
  approvedAt: string;
  approvedBy: string;
}

export class TradeInApprovalRollback {
  private engine: BusinessRollbackEngine;

  constructor(private supabase: SupabaseClient) {
    this.engine = new BusinessRollbackEngine(supabase);
  }

  /**
   * Register trade-in approval transaction
   */
  async registerTradeInApproval(
    tenantId: string,
    data: TradeInApprovalData,
    userId: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      // Create transaction
      const { data: transaction, error: txError } = await this.supabase
        .from('auto_business_transactions')
        .insert({
          tenant_id: tenantId,
          transaction_type: 'trade_in_approval',
          entity_type: 'auto_trade_in',
          entity_id: data.tradeInId,
          status: 'completed',
          metadata: {
            customer_id: data.customerId,
            old_vehicle_vin: data.oldVehicleVIN,
            appraisal_value: data.appraisalValue,
            new_contract_id: data.newVehicleContractId,
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

      // Step 1: Create trade-in record
      const tradeInRecord = {
        id: data.tradeInId,
        tenant_id: tenantId,
        customer_id: data.customerId,
        old_vehicle_vin: data.oldVehicleVIN,
        old_vehicle_brand: data.oldVehicleBrand,
        old_vehicle_model: data.oldVehicleModel,
        old_vehicle_year: data.oldVehicleYear,
        appraisal_value: data.appraisalValue,
        condition: data.condition,
        mileage: data.mileage,
        status: 'approved',
        approved_at: data.approvedAt,
        approved_by: data.approvedBy,
      };

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_trade_ins',
        target_record_id: data.tradeInId,
        before_snapshot: null,
        after_snapshot: tradeInRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Step 2: Add old vehicle to used inventory
      const usedVehicleId = crypto.randomUUID();
      const usedVehicleRecord = {
        id: usedVehicleId,
        tenant_id: tenantId,
        vin: data.oldVehicleVIN,
        brand: data.oldVehicleBrand,
        model: data.oldVehicleModel,
        year: data.oldVehicleYear,
        type: 'used',
        status: 'warehouse',
        acquisition_price: data.appraisalValue,
        condition: data.condition,
        mileage: data.mileage,
        acquired_from_customer_id: data.customerId,
        acquired_at: data.approvedAt,
      };

      await this.supabase.from('auto_used_vehicles').insert(usedVehicleRecord);

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_used_vehicles',
        target_record_id: usedVehicleId,
        before_snapshot: null,
        after_snapshot: usedVehicleRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Step 3: Update contract with trade-in credit
      const { data: contract } = await this.supabase
        .from('auto_bookings')
        .select('*')
        .eq('id', data.newVehicleContractId)
        .single();

      if (contract) {
        const beforeSnapshot = { ...contract };
        const afterSnapshot = {
          ...contract,
          trade_in_credit: data.appraisalValue,
          net_payable: contract.total_price - data.appraisalValue,
          updated_at: new Date().toISOString(),
        };

        await this.supabase
          .from('auto_bookings')
          .update({
            trade_in_credit: afterSnapshot.trade_in_credit,
            net_payable: afterSnapshot.net_payable,
          })
          .eq('id', contract.id);

        steps.push({
          transaction_id: transaction.id,
          step_order: stepOrder++,
          action_type: 'UPDATE',
          target_table: 'auto_bookings',
          target_record_id: contract.id,
          before_snapshot: beforeSnapshot,
          after_snapshot: afterSnapshot,
          status: 'executed',
          executed_at: new Date().toISOString(),
        });
      }

      // Step 4: Create accounting entry (trade-in liability)
      const accountingId = crypto.randomUUID();
      const accountingRecord = {
        id: accountingId,
        tenant_id: tenantId,
        transaction_type: 'trade_in_credit',
        entity_id: data.tradeInId,
        debit_account: '1561', // Kho xe cũ
        credit_account: '3312', // Phải trả khách (trade-in credit)
        amount: data.appraisalValue,
        description: `Thu mua xe cũ VIN ${data.oldVehicleVIN} - Giá ${data.appraisalValue.toLocaleString()}đ`,
        transaction_date: data.approvedAt,
        status: 'confirmed',
      };

      await this.supabase.from('auto_accounting_entries').insert(accountingRecord);

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_accounting_entries',
        target_record_id: accountingId,
        before_snapshot: null,
        after_snapshot: accountingRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Step 5: Create journey touchpoint
      const touchpointId = crypto.randomUUID();
      const touchpointRecord = {
        id: touchpointId,
        tenant_id: tenantId,
        customer_id: data.customerId,
        channel: 'trade_in',
        direction: 'inbound',
        title: `Phê duyệt thu mua xe cũ`,
        content: `VIN cũ: ${data.oldVehicleVIN}, Giá thu: ${data.appraisalValue.toLocaleString()}đ`,
        interacted_at: data.approvedAt,
        staff_id: data.approvedBy,
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
   * Rollback trade-in approval
   */
  async rollbackTradeInApproval(
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
