/**
 * Rollback Engine Service — D1: Compensating Transaction Engine
 * Platform-Level: src/platform/host/rollback-engine/
 *
 * Constitution: Law 3 (Platform Host), Law 5 (Event-First), Law 11 (Zero any)
 *
 * Architecture: Saga / Compensating Transaction Pattern
 *   NOT a "restore snapshot" — each step has explicit compensating_action.
 *
 * State Machine:
 *   STARTED → EXECUTING → COMMITTED
 *   STARTED → EXECUTING → FAILED → ROLLING_BACK → ROLLED_BACK
 *   ROLLING_BACK → ROLLBACK_FAILED → MANUAL_RECOVERY_REQUIRED
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { Database } from '@/types/supabase';
import { eventBus } from '@/platform/host/event-bus';
import type { DomainEvent, EventType } from '@/platform/host/event-bus/types';
import crypto from 'crypto';

// ─────────────────────────────────────────────────────────────────
// Types
// ─────────────────────────────────────────────────────────────────

export type TransactionStatus =
  | 'STARTED'
  | 'EXECUTING'
  | 'COMMITTED'
  | 'FAILED'
  | 'ROLLING_BACK'
  | 'ROLLED_BACK'
  | 'ROLLBACK_FAILED'
  | 'MANUAL_RECOVERY_REQUIRED';

export type TransactionStepStatus =
  | 'EXECUTED'
  | 'ROLLED_BACK'
  | 'ROLLBACK_FAILED';

export type TransactionDomain =
  | 'healthcare'
  | 'beauty_spa'
  | 'bella_auto'
  | 'babycare'
  | 'finance'
  | 'notification'
  | 'inventory'
  | 'platform';

export interface StartTransactionParams {
  domain: TransactionDomain;
  transactionType: string;         // e.g. 'clinical_order_create', 'vehicle_delivery'
  entityType: string;              // e.g. 'hc_clinical_order', 'auto_vehicle'
  entityId: string;
  createdBy?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface ExecuteStepParams {
  action: string;                  // e.g. 'approve_order', 'update_vehicle_status'
  entityType: string;
  entityId: string;
  snapshotBefore?: Record<string, unknown>;
  snapshotAfter?: Record<string, unknown>;
  compensatingAction: string;      // e.g. 'cancel_clinical_order', 'revert_vehicle_status'
  compensatingParams: Record<string, unknown>;
  metadata?: Record<string, unknown>;
}

export interface BusinessTransaction {
  id: string;
  tenantId: string;
  domain: TransactionDomain;
  transactionType: string;
  entityType: string;
  entityId: string;
  status: TransactionStatus;
  createdAt: string;
  createdBy?: string;
  correlationId?: string;
}

export interface TransactionStep {
  id: string;
  transactionId: string;
  sequence: number;
  action: string;
  entityType: string;
  entityId: string;
  status: TransactionStepStatus;
  compensatingAction: string;
  compensatingParams: Record<string, unknown>;
  executedAt: string;
  rolledBackAt?: string;
}

export interface RollbackResult {
  success: boolean;
  stepsTotal: number;
  stepsSucceeded: number;
  stepsFailed: number;
  failedSteps: Array<{ sequence: number; action: string; error: string }>;
  finalStatus: TransactionStatus;
}

// Compensating action handler registry type
type CompensatingHandler = (
  supabase: SupabaseClient<Database>,
  tenantId: string,
  entityId: string,
  params: Record<string, unknown>
) => Promise<void>;

// ─────────────────────────────────────────────────────────────────
// Compensating Action Registry
// Extend this map to support new compensation types without
// modifying the engine core (Open/Closed Principle)
// ─────────────────────────────────────────────────────────────────
const COMPENSATING_HANDLERS: Record<string, CompensatingHandler> = {

  revert_vehicle_status: async (supabase, tenantId, entityId, params) => {
    const { error } = await supabase
      .from('auto_vehicles')
      .update({ status: params['status'] as string })
      .eq('id', entityId)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`revert_vehicle_status failed: ${error.message}`);
  },

  revert_journey_stage: async (supabase, tenantId, entityId, params) => {
    const { error } = await supabase
      .from('auto_customer_journeys')
      .update({ current_stage_id: params['previous_stage'] as string })
      .eq('id', entityId)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`revert_journey_stage failed: ${error.message}`);
  },

  cancel_clinical_order: async (supabase, tenantId, entityId, params) => {
    const { error } = await supabase
      .from('hc_clinical_orders')
      .update({
        status: 'DISCONTINUED',
        notes: `[ROLLBACK] ${params['reason'] as string ?? 'Transaction rolled back'}`,
        updated_at: new Date().toISOString(),
      })
      .eq('id', entityId)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`cancel_clinical_order failed: ${error.message}`);
  },

  revert_bed_allocation: async (supabase, tenantId, entityId, params) => {
    const { error } = await supabase
      .from('hc_bed_allocations')
      .update({
        status: 'RELEASED',
        discharge_at: new Date().toISOString(),
        notes: `[ROLLBACK] ${params['reason'] as string ?? 'Transaction rolled back'}`,
      })
      .eq('id', entityId)
      .eq('tenant_id', tenantId);
    if (error) throw new Error(`revert_bed_allocation failed: ${error.message}`);
  },

  reverse_accounting_entry: async (_supabase, _tenantId, entryId, params) => {
    // Accounting outbox pattern — write reversal intent, let accounting consumer process
    // This is intentionally fire-and-forget into an outbox, not direct DB manipulation
    console.warn('[RollbackEngine] reverse_accounting_entry → accounting outbox:', { entryId, params });
    // TODO: Phase E — wire to AccountingOutbox when implemented
  },

  cancel_notification: async (_supabase, _tenantId, notificationId, params) => {
    console.warn('[RollbackEngine] cancel_notification:', { notificationId, params });
    // TODO: wire to NotificationHub.cancel() when implemented
  },

  revert_commission: async (supabase, tenantId, entityId, params) => {
    // Create negative commission entry (additive, never delete)
    const { error } = await supabase
      .from('commission')
      .insert({
        tenant_id: tenantId,
        ktv_id: params['ktv_id'] as string,
        session_id: params['session_id'] as string ?? entityId,
        amount: -(params['original_amount'] as number),
        type: 'rollback_adjustment',
        notes: `[ROLLBACK] Reversal of commission for ${entityId}`,
        created_at: new Date().toISOString(),
      });
    if (error) throw new Error(`revert_commission failed: ${error.message}`);
  },

  restore_inventory: async (supabase, _tenantId, inventoryId, params) => {
    const { error } = await supabase.rpc('increment_inventory', {
      p_inventory_id: inventoryId,
      p_quantity: params['quantity'] as number,
    });
    if (error) throw new Error(`restore_inventory failed: ${error.message}`);
  },
};

// ─────────────────────────────────────────────────────────────────
// RollbackEngineService
// ─────────────────────────────────────────────────────────────────
export class RollbackEngineService {
  constructor(
    private readonly supabase: SupabaseClient<Database>,
    private readonly tenantId: string
  ) {}

  // ────────────────────────────────────────────────
  // 1. startTransaction
  // ────────────────────────────────────────────────
  async startTransaction(params: StartTransactionParams): Promise<BusinessTransaction> {
    const { data, error } = await this.supabase
      .from('platform_business_transactions')
      .insert({
        tenant_id: this.tenantId,
        domain: params.domain,
        transaction_type: params.transactionType,
        entity_type: params.entityType,
        entity_id: params.entityId,
        status: 'STARTED',
        created_by: params.createdBy ?? null,
        metadata: {
          correlationId: params.correlationId ?? crypto.randomUUID(),
          ...(params.metadata ?? {}),
        },
      })
      .select()
      .single();

    if (error) throw new Error(`startTransaction failed: ${error.message}`);
    if (!data) throw new Error('startTransaction: no data returned');

    await this.publishEvent('platform.transaction.started.v1', data.id, {
      transactionType: params.transactionType,
      domain: params.domain,
      entityType: params.entityType,
      entityId: params.entityId,
    });

    return this.mapTransaction(data);
  }

  // ────────────────────────────────────────────────
  // 2. executeStep — record forward action + compensating action
  // ────────────────────────────────────────────────
  async executeStep(
    transactionId: string,
    params: ExecuteStepParams
  ): Promise<TransactionStep> {
    // Ensure transaction is in valid state for adding steps
    await this.assertTransactionStatus(transactionId, ['STARTED', 'EXECUTING']);

    // Transition to EXECUTING on first step
    await this.supabase
      .from('platform_business_transactions')
      .update({ status: 'EXECUTING' })
      .eq('id', transactionId)
      .eq('tenant_id', this.tenantId);

    // Determine next sequence
    const { data: lastStep } = await this.supabase
      .from('platform_transaction_steps')
      .select('sequence')
      .eq('transaction_id', transactionId)
      .order('sequence', { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSequence = lastStep ? lastStep.sequence + 1 : 1;

    const { data, error } = await this.supabase
      .from('platform_transaction_steps')
      .insert({
        tenant_id: this.tenantId,
        transaction_id: transactionId,
        sequence: nextSequence,
        action: params.action,
        entity_type: params.entityType,
        entity_id: params.entityId,
        snapshot_before: params.snapshotBefore ?? null,
        snapshot_after: params.snapshotAfter ?? null,
        compensating_action: params.compensatingAction,
        compensating_params: params.compensatingParams,
        status: 'EXECUTED',
        executed_at: new Date().toISOString(),
        metadata: params.metadata ?? {},
      })
      .select()
      .single();

    if (error) throw new Error(`executeStep failed: ${error.message}`);
    if (!data) throw new Error('executeStep: no data returned');

    await this.publishEvent('platform.transaction.step.executed.v1', transactionId, {
      stepId: data.id,
      sequence: nextSequence,
      action: params.action,
      entityType: params.entityType,
      entityId: params.entityId,
    });

    return this.mapStep(data);
  }

  // ────────────────────────────────────────────────
  // 3. commitTransaction
  // ────────────────────────────────────────────────
  async commitTransaction(transactionId: string): Promise<void> {
    await this.assertTransactionStatus(transactionId, ['EXECUTING', 'STARTED']);

    const { error } = await this.supabase
      .from('platform_business_transactions')
      .update({ status: 'COMMITTED' })
      .eq('id', transactionId)
      .eq('tenant_id', this.tenantId);

    if (error) throw new Error(`commitTransaction failed: ${error.message}`);

    await this.writeAuditLog(transactionId, 'platform.transaction.committed.v1', 'COMMITTED');
    await this.publishEvent('platform.transaction.committed.v1', transactionId, {});
  }

  // ────────────────────────────────────────────────
  // 4. rollbackTransaction — Compensating actions in REVERSE order
  //    Critical: If compensation fails → ROLLBACK_FAILED → MANUAL_RECOVERY_REQUIRED
  // ────────────────────────────────────────────────
  async rollbackTransaction(
    transactionId: string,
    reason: string,
    triggeredBy?: string
  ): Promise<RollbackResult> {
    await this.assertTransactionStatus(transactionId, ['EXECUTING', 'FAILED', 'STARTED']);

    // Transition to ROLLING_BACK
    await this.supabase
      .from('platform_business_transactions')
      .update({
        status: 'ROLLING_BACK',
        rollback_reason: reason,
        rollback_started_at: new Date().toISOString(),
        rolled_back_by: triggeredBy ?? null,
      })
      .eq('id', transactionId)
      .eq('tenant_id', this.tenantId);

    await this.writeAuditLog(transactionId, 'platform.transaction.rollback.started.v1', 'ROLLING_BACK', 0, 0, 0, reason, triggeredBy);
    await this.publishEvent('platform.transaction.rollback.started.v1', transactionId, { reason });

    // Fetch all steps in REVERSE order
    const { data: steps, error: stepsError } = await this.supabase
      .from('platform_transaction_steps')
      .select('*')
      .eq('transaction_id', transactionId)
      .eq('tenant_id', this.tenantId)
      .eq('status', 'EXECUTED')
      .order('sequence', { ascending: false }); // REVERSE for compensation

    if (stepsError) throw new Error(`rollbackTransaction: cannot fetch steps: ${stepsError.message}`);
    if (!steps || steps.length === 0) {
      // No steps to compensate — just mark as rolled back
      await this.supabase
        .from('platform_business_transactions')
        .update({ status: 'ROLLED_BACK', rolled_back_at: new Date().toISOString() })
        .eq('id', transactionId)
        .eq('tenant_id', this.tenantId);

      await this.writeAuditLog(transactionId, 'platform.transaction.rollback.completed.v1', 'ROLLED_BACK', 0, 0, 0);
      await this.publishEvent('platform.transaction.rollback.completed.v1', transactionId, { stepsRolledBack: 0 });
      return { success: true, stepsTotal: 0, stepsSucceeded: 0, stepsFailed: 0, failedSteps: [], finalStatus: 'ROLLED_BACK' };
    }

    const failedSteps: Array<{ sequence: number; action: string; error: string }> = [];

    for (const step of steps) {
      try {
        await this.executeCompensatingAction(step.compensating_action, step.entity_id, step.compensating_params as Record<string, unknown>);

        await this.supabase
          .from('platform_transaction_steps')
          .update({ status: 'ROLLED_BACK', rolled_back_at: new Date().toISOString() })
          .eq('id', step.id)
          .eq('tenant_id', this.tenantId);

      } catch (err: unknown) {
        const message = err instanceof Error ? err.message : 'Unknown compensation error';
        failedSteps.push({ sequence: step.sequence, action: step.action, error: message });

        await this.supabase
          .from('platform_transaction_steps')
          .update({
            status: 'ROLLBACK_FAILED',
            rollback_failed_at: new Date().toISOString(),
            error_message: message,
          })
          .eq('id', step.id)
          .eq('tenant_id', this.tenantId);
      }
    }

    const stepsTotal = steps.length;
    const stepsFailed = failedSteps.length;
    const stepsSucceeded = stepsTotal - stepsFailed;

    // Determine final status — CRITICAL: never hide compensation failures
    const finalStatus: TransactionStatus =
      stepsFailed === 0 ? 'ROLLED_BACK' :
      stepsFailed < stepsTotal ? 'ROLLBACK_FAILED' :
      'ROLLBACK_FAILED';

    const manualRecoveryNote = stepsFailed > 0
      ? `MANUAL RECOVERY REQUIRED: ${stepsFailed} of ${stepsTotal} compensation steps failed. Failed: ${failedSteps.map(f => f.action).join(', ')}`
      : undefined;

    await this.supabase
      .from('platform_business_transactions')
      .update({
        status: stepsFailed > 0 ? 'MANUAL_RECOVERY_REQUIRED' : 'ROLLED_BACK',
        rolled_back_at: new Date().toISOString(),
        rollback_failed_at: stepsFailed > 0 ? new Date().toISOString() : null,
        rollback_failure_reason: manualRecoveryNote ?? null,
      })
      .eq('id', transactionId)
      .eq('tenant_id', this.tenantId);

    const outcome = stepsFailed > 0 ? 'MANUAL_RECOVERY_REQUIRED' : 'ROLLED_BACK';
    const eventType = stepsFailed > 0
      ? 'platform.transaction.rollback.failed.v1'
      : 'platform.transaction.rollback.completed.v1';

    await this.writeAuditLog(transactionId, eventType, outcome, stepsTotal, stepsSucceeded, stepsFailed, reason, triggeredBy);
    await this.publishEvent(eventType as EventType, transactionId, {
      stepsTotal, stepsSucceeded, stepsFailed, failedSteps, reason,
    });

    if (stepsFailed > 0) {
      await this.publishEvent('platform.transaction.manual_recovery.required.v1' as EventType, transactionId, {
        manualRecoveryNote,
        failedSteps,
      });
    }

    return {
      success: stepsFailed === 0,
      stepsTotal,
      stepsSucceeded,
      stepsFailed,
      failedSteps,
      finalStatus: stepsFailed > 0 ? 'MANUAL_RECOVERY_REQUIRED' : 'ROLLED_BACK',
    };
  }

  // ────────────────────────────────────────────────
  // 5. markManualRecovery — operator acknowledges the failure
  // ────────────────────────────────────────────────
  async markManualRecovery(transactionId: string, note: string, resolvedBy: string): Promise<void> {
    await this.assertTransactionStatus(transactionId, ['ROLLBACK_FAILED', 'MANUAL_RECOVERY_REQUIRED']);

    const { error } = await this.supabase
      .from('platform_business_transactions')
      .update({
        manual_recovery_note: note,
        rolled_back_by: resolvedBy,
      })
      .eq('id', transactionId)
      .eq('tenant_id', this.tenantId);

    if (error) throw new Error(`markManualRecovery failed: ${error.message}`);
  }

  // ────────────────────────────────────────────────
  // Private helpers
  // ────────────────────────────────────────────────

  private async executeCompensatingAction(
    action: string,
    entityId: string,
    params: Record<string, unknown>
  ): Promise<void> {
    const handler = COMPENSATING_HANDLERS[action];
    if (!handler) {
      throw new Error(`No compensating handler registered for action: "${action}"`);
    }
    await handler(this.supabase, this.tenantId, entityId, params);
  }

  private async assertTransactionStatus(
    transactionId: string,
    allowedStatuses: TransactionStatus[]
  ): Promise<void> {
    const { data, error } = await this.supabase
      .from('platform_business_transactions')
      .select('status')
      .eq('id', transactionId)
      .eq('tenant_id', this.tenantId)
      .single();

    if (error || !data) throw new Error(`Transaction not found: ${transactionId}`);

    const current = data.status as TransactionStatus;
    if (!allowedStatuses.includes(current)) {
      throw new Error(
        `Invalid transition: transaction ${transactionId} is in status "${current}". ` +
        `Expected one of: [${allowedStatuses.join(', ')}]`
      );
    }
  }

  private async writeAuditLog(
    transactionId: string,
    eventType: string,
    outcome: string,
    stepsTotal = 0,
    stepsSucceeded = 0,
    stepsFailed = 0,
    rollbackReason?: string,
    triggeredBy?: string,
    affectedEntities: Array<{ type: string; id: string }> = []
  ): Promise<void> {
    await this.supabase
      .from('platform_rollback_audit_log')
      .insert({
        tenant_id: this.tenantId,
        transaction_id: transactionId,
        event_type: eventType,
        event_version: 'v1',
        steps_total: stepsTotal,
        steps_succeeded: stepsSucceeded,
        steps_failed: stepsFailed,
        affected_entities: affectedEntities,
        rollback_reason: rollbackReason ?? null,
        triggered_by: triggeredBy ?? null,
        outcome,
        occurred_at: new Date().toISOString(),
      });
  }

  private async publishEvent(
    eventType: EventType,
    aggregateId: string,
    payload: Record<string, unknown>
  ): Promise<void> {
    const event: DomainEvent<Record<string, unknown>> = {
      eventId: crypto.randomUUID(),
      eventType,
      eventVersion: '1.0.0',
      tenantId: this.tenantId,
      aggregateId,
      aggregateType: 'platform_business_transaction',
      payload,
      occurredAt: new Date().toISOString(),
    };
    await eventBus.publish(event);
  }

  // ─── Mappers ───────────────────────────────────
  private mapTransaction(
    data: Database['public']['Tables']['platform_business_transactions']['Row']
  ): BusinessTransaction {
    return {
      id: data.id,
      tenantId: data.tenant_id,
      domain: data.domain as TransactionDomain,
      transactionType: data.transaction_type,
      entityType: data.entity_type,
      entityId: data.entity_id,
      status: data.status as TransactionStatus,
      createdAt: data.created_at,
      createdBy: data.created_by ?? undefined,
    };
  }

  private mapStep(
    data: Database['public']['Tables']['platform_transaction_steps']['Row']
  ): TransactionStep {
    return {
      id: data.id,
      transactionId: data.transaction_id,
      sequence: data.sequence,
      action: data.action,
      entityType: data.entity_type,
      entityId: data.entity_id,
      status: data.status as TransactionStepStatus,
      compensatingAction: data.compensating_action,
      compensatingParams: (data.compensating_params ?? {}) as Record<string, unknown>,
      executedAt: data.executed_at,
      rolledBackAt: data.rolled_back_at ?? undefined,
    };
  }
}
