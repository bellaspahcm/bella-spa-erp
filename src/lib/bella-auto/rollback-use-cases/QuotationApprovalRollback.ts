/**
 * Bella Auto - Quotation Approval Rollback Use Case
 * 
 * Business Flow:
 * 1. Customer requests quotation for vehicle + accessories
 * 2. Sales creates quotation with pricing, discounts, extras
 * 3. Manager approves → Impact: Quotation locked, Vehicle allocated (soft), Next Best Action triggered
 * 
 * Rollback Scenario:
 * - Pricing error discovered after approval
 * - Vehicle allocation conflict (double-booked)
 * - Customer requests changes after approval
 * - Need to unlock quotation and free vehicle allocation
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { BusinessRollbackEngine } from '../engines/BusinessRollbackEngine';

export interface QuotationApprovalData {
  quotationId: string;
  customerId: string;
  vehicleVariantId: string;
  basePrice: number;
  accessories: Array<{
    accessoryId: string;
    name: string;
    price: number;
  }>;
  discount: number;
  totalPrice: number;
  validUntil: string;
  approvedAt: string;
  approvedBy: string;
  salesPersonId: string;
}

export class QuotationApprovalRollback {
  private engine: BusinessRollbackEngine;

  constructor(private supabase: SupabaseClient) {
    this.engine = new BusinessRollbackEngine(supabase);
  }

  /**
   * Register quotation approval transaction
   */
  async registerQuotationApproval(
    tenantId: string,
    data: QuotationApprovalData,
    userId: string
  ): Promise<{ success: boolean; transactionId?: string; error?: string }> {
    try {
      // Create transaction
      const { data: transaction, error: txError } = await this.supabase
        .from('auto_business_transactions')
        .insert({
          tenant_id: tenantId,
          transaction_type: 'quotation_approval',
          entity_type: 'auto_quotation',
          entity_id: data.quotationId,
          status: 'completed',
          metadata: {
            customer_id: data.customerId,
            vehicle_variant_id: data.vehicleVariantId,
            total_price: data.totalPrice,
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

      // Step 1: Update quotation status to approved
      const { data: quotation } = await this.supabase
        .from('auto_quotations')
        .select('*')
        .eq('id', data.quotationId)
        .single();

      if (quotation) {
        const beforeSnapshot = { ...quotation };
        const afterSnapshot = {
          ...quotation,
          status: 'approved',
          approved_at: data.approvedAt,
          approved_by: data.approvedBy,
          is_locked: true,
          updated_at: new Date().toISOString(),
        };

        await this.supabase
          .from('auto_quotations')
          .update({
            status: afterSnapshot.status,
            approved_at: afterSnapshot.approved_at,
            approved_by: afterSnapshot.approved_by,
            is_locked: afterSnapshot.is_locked,
          })
          .eq('id', quotation.id);

        steps.push({
          transaction_id: transaction.id,
          step_order: stepOrder++,
          action_type: 'UPDATE',
          target_table: 'auto_quotations',
          target_record_id: quotation.id,
          before_snapshot: beforeSnapshot,
          after_snapshot: afterSnapshot,
          status: 'executed',
          executed_at: new Date().toISOString(),
        });
      }

      // Step 2: Soft-allocate vehicle (mark as reserved, not yet delivered)
      const { data: availableVehicles } = await this.supabase
        .from('auto_vehicles')
        .select('*')
        .eq('tenant_id', tenantId)
        .eq('variant_id', data.vehicleVariantId)
        .eq('status', 'showroom')
        .limit(1);

      if (availableVehicles && availableVehicles.length > 0) {
        const vehicle = availableVehicles[0];
        const beforeSnapshot = { ...vehicle };
        const afterSnapshot = {
          ...vehicle,
          status: 'reserved',
          reserved_for_quotation_id: data.quotationId,
          reserved_at: data.approvedAt,
          updated_at: new Date().toISOString(),
        };

        await this.supabase
          .from('auto_vehicles')
          .update({
            status: afterSnapshot.status,
            reserved_for_quotation_id: afterSnapshot.reserved_for_quotation_id,
            reserved_at: afterSnapshot.reserved_at,
          })
          .eq('id', vehicle.id);

        steps.push({
          transaction_id: transaction.id,
          step_order: stepOrder++,
          action_type: 'UPDATE',
          target_table: 'auto_vehicles',
          target_record_id: vehicle.id,
          before_snapshot: beforeSnapshot,
          after_snapshot: afterSnapshot,
          status: 'executed',
          executed_at: new Date().toISOString(),
        });
      }

      // Step 3: Create AI event for next best action
      const aiEventId = crypto.randomUUID();
      const aiEventRecord = {
        id: aiEventId,
        tenant_id: tenantId,
        event_type: 'quotation_approved',
        entity_type: 'quotation',
        entity_id: data.quotationId,
        customer_id: data.customerId,
        triggered_at: data.approvedAt,
        next_best_action: 'schedule_test_drive',
        priority: 'high',
        metadata: {
          quotation_value: data.totalPrice,
          vehicle_variant_id: data.vehicleVariantId,
          sales_person_id: data.salesPersonId,
        },
      };

      await this.supabase.from('auto_ai_events').insert(aiEventRecord);

      steps.push({
        transaction_id: transaction.id,
        step_order: stepOrder++,
        action_type: 'INSERT',
        target_table: 'auto_ai_events',
        target_record_id: aiEventId,
        before_snapshot: null,
        after_snapshot: aiEventRecord,
        status: 'executed',
        executed_at: new Date().toISOString(),
      });

      // Step 4: Update customer journey stage
      const { data: journey } = await this.supabase
        .from('auto_customer_journeys')
        .select('*, current_stage:auto_journey_stages(*)')
        .eq('customer_id', data.customerId)
        .single();

      if (journey) {
        // Get "quotation_approved" stage
        const { data: newStage } = await this.supabase
          .from('auto_journey_stages')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('code', 'quotation_approved')
          .single();

        if (newStage) {
          const beforeSnapshot = { ...journey };
          const afterSnapshot = {
            ...journey,
            current_stage_id: newStage.id,
            entered_stage_at: data.approvedAt,
            sla_deadline: new Date(
              new Date(data.approvedAt).getTime() + newStage.sla_hours * 60 * 60 * 1000
            ).toISOString(),
            sla_status: 'on_time',
            updated_at: new Date().toISOString(),
          };

          await this.supabase
            .from('auto_customer_journeys')
            .update({
              current_stage_id: afterSnapshot.current_stage_id,
              entered_stage_at: afterSnapshot.entered_stage_at,
              sla_deadline: afterSnapshot.sla_deadline,
              sla_status: afterSnapshot.sla_status,
            })
            .eq('id', journey.id);

          steps.push({
            transaction_id: transaction.id,
            step_order: stepOrder++,
            action_type: 'UPDATE',
            target_table: 'auto_customer_journeys',
            target_record_id: journey.id,
            before_snapshot: beforeSnapshot,
            after_snapshot: afterSnapshot,
            status: 'executed',
            executed_at: new Date().toISOString(),
          });
        }
      }

      // Step 5: Create journey touchpoint
      const touchpointId = crypto.randomUUID();
      const touchpointRecord = {
        id: touchpointId,
        tenant_id: tenantId,
        customer_id: data.customerId,
        channel: 'quotation',
        direction: 'outbound',
        title: `Phê duyệt báo giá`,
        content: `Tổng giá: ${data.totalPrice.toLocaleString()}đ, Giảm giá: ${data.discount.toLocaleString()}đ`,
        interacted_at: data.approvedAt,
        staff_id: data.salesPersonId,
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
   * Rollback quotation approval
   */
  async rollbackQuotationApproval(
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
