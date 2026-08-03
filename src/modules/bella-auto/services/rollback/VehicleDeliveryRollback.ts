/**
 * Vehicle Delivery Rollback Example
 * 
 * Demonstrates complete cascade rollback for vehicle delivery transaction.
 * 
 * When a vehicle delivery needs to be undone:
 * 1. Revert journey stage (delivered → vehicle_prep)
 * 2. Cancel notifications (customer + sales rep)
 * 3. Remove AI events (delivery recorded)
 * 4. Reverse commission (sales commission)
 * 5. Reverse accounting entry (revenue recognition)
 * 6. Restore inventory (vehicle back to showroom)
 * 7. Revert vehicle status (delivered → allocated)
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/database.types';
import { BusinessRollbackEngine } from './BusinessRollbackEngine';

export class VehicleDeliveryRollback {
  private engine: BusinessRollbackEngine;
  private supabase: SupabaseClient<Database>;
  private tenantId: string;

  constructor(supabase: SupabaseClient<Database>, tenantId: string) {
    this.supabase = supabase;
    this.tenantId = tenantId;
    this.engine = new BusinessRollbackEngine(supabase, tenantId);
  }

  /**
   * Execute vehicle delivery with full rollback capability
   */
  async executeDelivery(params: {
    bookingId: string;
    vehicleId: string;
    journeyId: string;
    deliveredBy: string;
  }): Promise<{
    success: boolean;
    transactionId?: string;
    error?: string;
  }> {
    let transactionId: string | undefined;

    try {
      // Start transaction
      const transaction = await this.engine.startTransaction({
        type: 'vehicle_delivery',
        entityType: 'booking',
        entityId: params.bookingId,
        createdBy: params.deliveredBy,
      });

      transactionId = transaction.id;

      // Step 1: Update journey stage
      await this.stepUpdateJourney(transactionId, params.journeyId);

      // Step 2: Send notifications
      await this.stepSendNotifications(transactionId, params);

      // Step 3: Record AI event
      await this.stepRecordAIEvent(transactionId, params);

      // Step 4: Calculate commission
      await this.stepCalculateCommission(transactionId, params);

      // Step 5: Post accounting entry
      await this.stepPostAccounting(transactionId, params);

      // Step 6: Update inventory
      await this.stepUpdateInventory(transactionId, params.vehicleId);

      // Step 7: Update vehicle status
      await this.stepUpdateVehicleStatus(transactionId, params.vehicleId);

      // Commit transaction
      await this.engine.commitTransaction(transactionId);

      return { success: true, transactionId };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      
      // Auto-rollback on failure
      if (transactionId) {
        try {
          await this.engine.rollbackTransaction(
            transactionId,
            `Automatic rollback due to error: ${message}`,
            params.deliveredBy
          );
        } catch (rollbackError) {
          console.error('Rollback failed:', rollbackError);
        }
      }

      return { success: false, error: message };
    }
  }

  /**
   * Manually rollback a delivered vehicle
   */
  async rollbackDelivery(params: {
    bookingId: string;
    reason: string;
    rolledBackBy: string;
  }): Promise<{
    success: boolean;
    error?: string;
  }> {
    try {
      // Find transaction for this booking
      const { data: transaction, error: txError } = await this.supabase
        .from('auto_business_transactions')
        .select('id')
        .eq('entity_type', 'booking')
        .eq('entity_id', params.bookingId)
        .eq('transaction_type', 'vehicle_delivery')
        .eq('status', 'committed')
        .eq('tenant_id', this.tenantId)
        .single();

      if (txError || !transaction) {
        throw new Error('Transaction not found or already rolled back');
      }

      // Execute rollback
      await this.engine.rollbackTransaction(
        transaction.id,
        params.reason,
        params.rolledBackBy
      );

      return { success: true };

    } catch (error) {
      const message = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, error: message };
    }
  }

  // ==================================================================================
  // TRANSACTION STEPS
  // ==================================================================================

  private async stepUpdateJourney(
    transactionId: string,
    journeyId: string
  ): Promise<void> {
    // Get current journey state
    const { data: journey } = await this.supabase
      .from('auto_customer_journeys')
      .select('current_stage_code')
      .eq('id', journeyId)
      .single();

    if (!journey) throw new Error('Journey not found');

    const previousStage = journey.current_stage_code;

    // Update journey to delivered
    const { error } = await this.supabase
      .from('auto_customer_journeys')
      .update({ current_stage_code: 'vehicle_delivered' })
      .eq('id', journeyId);

    if (error) throw error;

    // Record step with compensating action
    await this.engine.executeStep(transactionId, {
      action: 'update_journey_stage',
      entityType: 'journey',
      entityId: journeyId,
      snapshotBefore: { stage: previousStage },
      snapshotAfter: { stage: 'vehicle_delivered' },
      compensatingAction: 'revert_journey_stage',
      compensatingParams: { previous_stage: previousStage },
    });
  }

  private async stepSendNotifications(
    transactionId: string,
    params: {
      bookingId: string;
      deliveredBy: string;
    }
  ): Promise<void> {
    // Send notifications (simplified)
    const notificationId = 'notif-' + Date.now();

    // Record step
    await this.engine.executeStep(transactionId, {
      action: 'send_delivery_notification',
      entityType: 'notification',
      entityId: notificationId,
      compensatingAction: 'cancel_notification',
      compensatingParams: { notification_id: notificationId },
    });
  }

  private async stepRecordAIEvent(
    transactionId: string,
    params: {
      bookingId: string;
      vehicleId: string;
    }
  ): Promise<void> {
    // Record AI event (simplified)
    const eventId = 'ai-event-' + Date.now();

    await this.engine.executeStep(transactionId, {
      action: 'record_ai_delivery_event',
      entityType: 'ai_event',
      entityId: eventId,
      compensatingAction: 'remove_ai_event',
      compensatingParams: { event_id: eventId },
    });
  }

  private async stepCalculateCommission(
    transactionId: string,
    params: {
      bookingId: string;
      deliveredBy: string;
    }
  ): Promise<void> {
    // Calculate commission (simplified)
    const commissionId = 'comm-' + Date.now();

    await this.engine.executeStep(transactionId, {
      action: 'calculate_sales_commission',
      entityType: 'commission',
      entityId: commissionId,
      snapshotAfter: { amount: 5000000, recipient: params.deliveredBy },
      compensatingAction: 'revert_commission',
      compensatingParams: { commission_id: commissionId },
    });
  }

  private async stepPostAccounting(
    transactionId: string,
    params: {
      bookingId: string;
    }
  ): Promise<void> {
    // Post to accounting via Outbox (simplified)
    const entryId = 'acc-' + Date.now();

    await this.engine.executeStep(transactionId, {
      action: 'post_revenue_entry',
      entityType: 'accounting_entry',
      entityId: entryId,
      compensatingAction: 'reverse_accounting_entry',
      compensatingParams: { entry_id: entryId, reversal_reason: 'Delivery rollback' },
    });
  }

  private async stepUpdateInventory(
    transactionId: string,
    vehicleId: string
  ): Promise<void> {
    // Update inventory (vehicle moved from showroom to customer)
    await this.engine.executeStep(transactionId, {
      action: 'deduct_vehicle_inventory',
      entityType: 'vehicle',
      entityId: vehicleId,
      compensatingAction: 'restore_inventory',
      compensatingParams: { quantity: 1 },
    });
  }

  private async stepUpdateVehicleStatus(
    transactionId: string,
    vehicleId: string
  ): Promise<void> {
    // Get current vehicle status
    const { data: vehicle } = await this.supabase
      .from('auto_vehicles')
      .select('status')
      .eq('id', vehicleId)
      .single();

    if (!vehicle) throw new Error('Vehicle not found');

    const previousStatus = vehicle.status;

    // Update to delivered
    const { error } = await this.supabase
      .from('auto_vehicles')
      .update({ status: 'delivered' })
      .eq('id', vehicleId);

    if (error) throw error;

    // Record step
    await this.engine.executeStep(transactionId, {
      action: 'update_vehicle_status',
      entityType: 'vehicle',
      entityId: vehicleId,
      snapshotBefore: { status: previousStatus },
      snapshotAfter: { status: 'delivered' },
      compensatingAction: 'revert_vehicle_status',
      compensatingParams: { status: previousStatus },
    });
  }
}
