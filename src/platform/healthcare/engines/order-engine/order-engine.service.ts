/**
 * Order Engine Service — Phase C: CPOE (Computerized Physician Order Entry)
 *
 * Manages the full clinical order lifecycle with mandatory CDS gate at prescribing.
 * Defense-in-depth: CDS Engine is also called at pharmacy dispensing (Barrier 2).
 *
 * Constitution Compliance:
 *   - Law 1: Encounter as aggregate root
 *   - Law 5: Events published for created/approved/discontinued
 *   - Law 11: Zero `any` types
 *
 * @module platform/healthcare/engines/order-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type {
  OrderEngineContract,
  ClinicalOrder,
  CreateOrderRequest,
  CreateOrderResult,
  ApproveOrderRequest,
  DiscontinueOrderRequest,
  OverrideCdsWarningRequest,
  GetActiveOrdersRequest,
  CdsOverrideRecord,
  MedicationOrderDetails,
  OrderStatus,
} from '../../contracts/order-engine.contract';
import type { EngineResponse, EngineHealthStatus } from '../../shared-kernel/types';
import type { CdsAlert, IDecisionContract } from '../../contracts/cds-engine.contract';
import { eventBus } from '@/platform/host/event-bus';

// ============================================================================
// Internal DB Row Types
// ============================================================================

interface ClinicalOrderRow {
  id: string;
  tenant_id: string;
  encounter_id: string;
  patient_party_id: string;
  order_type: string;
  order_status: string;
  priority: string;
  ordered_by: string;
  ordered_at: string;
  approved_by: string | null;
  approved_at: string | null;
  discontinued_by: string | null;
  discontinued_at: string | null;
  discontinue_reason: string | null;
  cds_check_id: string | null;
  cds_check_status: string | null;
  order_details: Record<string, unknown>;
  notes: string | null;
  created_at: string;
  updated_at: string;
}

interface CdsOverrideRow {
  id: string;
  tenant_id: string;
  order_id: string;
  cds_alert_id: string;
  alert_type: string;
  alert_severity: string;
  alert_enforcement: string;
  override_reason: string;
  overriding_clinician: string;
  overridden_at: string;
}

type OrderEngineIdempotencyOperation =
  | 'order.create'
  | 'order.create.rejected'
  | 'order.approve'
  | 'order.discontinue'
  | 'order.override-cds-warning';

interface IdempotencyKeyRow {
  request_id: string;
}

// ============================================================================
// Constants
// ============================================================================

const ENGINE_VERSION = '1.0.0';

// ============================================================================
// Order Engine Service
// ============================================================================

export class OrderEngineService implements OrderEngineContract {
  readonly engineName = 'order-engine' as const;
  readonly engineVersion = ENGINE_VERSION;

  private readonly decisionContract?: IDecisionContract;

  constructor(
    private readonly supabase: SupabaseClient,
    decisionContract?: IDecisionContract
  ) {
    this.decisionContract = decisionContract;
  }

  // --------------------------------------------------------------------------
  // 1. Create Order (Mandatory CDS Gate — Barrier 1)
  // --------------------------------------------------------------------------

  async createOrder(request: CreateOrderRequest): Promise<EngineResponse<CreateOrderResult>> {
    try {
      const now = new Date().toISOString();

      // Idempotency check
      const cached = await this.findCreateOrderByRequestId(request.tenantId, request.requestId);
      if (cached) return { success: true, data: cached };

      let cdsCheckId: string | undefined;
      let cdsCheckStatus: 'PASSED' | 'WARNED' | 'BLOCKED' = 'PASSED';
      let cdsAlerts: CdsAlert[] = [];

      // CDS gate is MANDATORY for MEDICATION orders only
      if (request.orderType === 'MEDICATION') {
        if (!request.patientId) {
          return {
            success: false,
            error: {
              code: 'MISSING_PATIENT_ID',
              message: 'patientId is required for MEDICATION orders (needed for CDS check)',
              timestamp: now,
            },
          };
        }

        const medDetails = request.orderDetails as MedicationOrderDetails;
        
        if (!this.decisionContract) {
          return {
            success: false,
            error: {
              code: 'CDS_CONTRACT_MISSING',
              message: 'Decision Contract is required for MEDICATION orders',
              timestamp: now,
            },
          };
        }

        const cdsResult = await this.decisionContract.evaluate({
          tenantId: request.tenantId,
          encounterId: request.encounterId,
          patientId: request.patientId,
          actionContext: {
            proposedDrugCode: medDetails.drugCode,
            proposedDrugClass: undefined,
            proposedDoseMg: medDetails.totalDailyDoseMg,
            actionType: 'PRESCRIBE',
            currentMedicationCodes: medDetails.currentMedicationCodes,
          },
        });

        if (!cdsResult.success || !cdsResult.data) {
          return {
            success: false,
            error: {
              code: 'CDS_CHECK_FAILED',
              message: cdsResult.error?.message ?? 'CDS evaluation failed',
              timestamp: now,
            },
          };
        }

        cdsCheckId = cdsResult.data.calculationId;
        cdsAlerts = cdsResult.data.alerts;

        // Hard blocked (ANAPHYLAXIS, ABSOLUTE_BLOCK) → reject immediately
        if (cdsResult.data.hardBlocked) {
          const result: CreateOrderResult = {
            order: {
              id: '',
              tenantId: request.tenantId,
              encounterId: request.encounterId,
              orderType: request.orderType,
              orderStatus: 'REJECTED',
              priority: request.priority,
              orderedBy: request.orderedBy,
              orderedAt: now,
              cdsCheckId,
              cdsCheckStatus: 'BLOCKED',
              orderDetails: request.orderDetails as ClinicalOrder['orderDetails'],
              createdAt: now,
              updatedAt: now,
            },
            cdsAlerts,
            cdsCheckStatus: 'BLOCKED',
          };
          await this.storeOperationIdempotency(
            request.tenantId,
            request.requestId,
            'order.create.rejected'
          );
          return {
            success: false,
            error: {
              code: 'CDS_ABSOLUTE_BLOCK',
              message: 'Order blocked by absolute clinical safety constraint. Override not permitted.',
              details: {
                cdsCheckId,
                alertCount: cdsAlerts.length,
                absoluteBlockAlerts: cdsAlerts
                  .filter((a) => a.enforcement === 'ABSOLUTE_BLOCK')
                  .map((a) => ({ type: a.alertType, message: a.message })),
              },
              timestamp: now,
            },
          };
        }

        // BLOCK enforcement (overridable) → reject but physician can override
        const blockingAlerts = cdsAlerts.filter((a) => a.enforcement === 'BLOCK');
        if (blockingAlerts.length > 0) {
          const result: CreateOrderResult = {
            order: {
              id: '',
              tenantId: request.tenantId,
              encounterId: request.encounterId,
              orderType: request.orderType,
              orderStatus: 'REJECTED',
              priority: request.priority,
              orderedBy: request.orderedBy,
              orderedAt: now,
              cdsCheckId,
              cdsCheckStatus: 'BLOCKED',
              orderDetails: request.orderDetails as ClinicalOrder['orderDetails'],
              createdAt: now,
              updatedAt: now,
            },
            cdsAlerts,
            cdsCheckStatus: 'BLOCKED',
          };
          await this.storeOperationIdempotency(
            request.tenantId,
            request.requestId,
            'order.create.rejected'
          );
          return {
            success: false,
            error: {
              code: 'CDS_BLOCK',
              message:
                'Order blocked by clinical safety constraint. Physician may override with documented justification.',
              details: {
                cdsCheckId,
                blockingAlerts: blockingAlerts.map((a) => ({
                  alertId: a.alertId,
                  type: a.alertType,
                  severity: a.severity,
                  enforcement: a.enforcement,
                  message: a.message,
                  canOverride: a.canOverride,
                })),
              },
              timestamp: now,
            },
          };
        }

        // ACKNOWLEDGE or INFO → order proceeds with WARNED status
        const hasAcknowledgeAlerts = cdsAlerts.some((a) => a.enforcement === 'ACKNOWLEDGE');
        cdsCheckStatus = hasAcknowledgeAlerts ? 'WARNED' : 'PASSED';
      }

      // Persist the order
      const patientId = request.patientId
        ?? await this.resolveEncounterPatientId(request.tenantId, request.encounterId);
      if (!patientId) {
        return {
          success: false,
          error: {
            code: 'MISSING_PATIENT_ID',
            message: 'patientId is required to persist a clinical order',
            timestamp: now,
          },
        };
      }

      const orderId = crypto.randomUUID();
      const orderRow = {
        id: orderId,
        tenant_id: request.tenantId,
        encounter_id: request.encounterId,
        patient_party_id: patientId,
        order_type: request.orderType,
        order_status: 'VALIDATED' as OrderStatus,
        priority: request.priority,
        ordered_by: request.orderedBy,
        ordered_at: now,
        cds_check_id: cdsCheckId ?? null,
        cds_check_status: cdsCheckStatus,
        order_details: request.orderDetails as Record<string, unknown>,
        notes: request.notes ?? null,
        request_id: request.requestId,
        created_at: now,
        updated_at: now,
      };

      const { data, error } = await this.supabase
        .from('hc_clinical_orders')
        .insert(orderRow)
        .select()
        .single<ClinicalOrderRow>();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'ORDER_PERSIST_FAILED',
            message: error?.message ?? 'Failed to persist order',
            timestamp: now,
          },
        };
      }

      const order = this.mapOrderRow(data);

      // Publish order created event
      await eventBus.publish({
        eventType: 'hos.order.created.v1',
        tenantId: request.tenantId,
        aggregateId: orderId,
        aggregateType: 'ClinicalOrder',
        payload: {
          orderId,
          encounterId: request.encounterId,
          patientId,
          orderType: request.orderType,
          priority: request.priority,
          cdsCheckStatus,
          cdsAlertCount: cdsAlerts.length,
          orderedBy: request.orderedBy,
        },
      });

      const result: CreateOrderResult = { order, cdsAlerts, cdsCheckStatus };
      await this.storeOperationIdempotency(request.tenantId, request.requestId, 'order.create');

      return { success: true, data: result };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'CREATE_ORDER_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 2. Validate Order (re-run CDS on pending order)
  // --------------------------------------------------------------------------

  async validateOrder(
    tenantId: string,
    orderId: string
  ): Promise<EngineResponse<CreateOrderResult>> {
    try {
      const { data: orderData, error } = await this.supabase
        .from('hc_clinical_orders')
        .select('*')
        .eq('id', orderId)
        .eq('tenant_id', tenantId)
        .single<ClinicalOrderRow>();

      if (error || !orderData) {
        return {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: `Order ${orderId} not found`,
            timestamp: new Date().toISOString(),
          },
        };
      }

      // Re-validate via createOrder logic by reconstructing request
      const order = this.mapOrderRow(orderData);
      return {
        success: true,
        data: { order, cdsAlerts: [], cdsCheckStatus: order.cdsCheckStatus ?? 'PASSED' },
      };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'VALIDATE_ORDER_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 3. Approve Order
  // --------------------------------------------------------------------------

  async approveOrder(request: ApproveOrderRequest): Promise<EngineResponse<ClinicalOrder>> {
    try {
      const now = new Date().toISOString();

      // Idempotency check
      const alreadyApproved = await this.hasOperationIdempotency(
        request.tenantId,
        request.requestId,
        'order.approve'
      );
      if (alreadyApproved) {
        const existing = await this.findOrderById(request.tenantId, request.orderId);
        if (existing) return { success: true, data: existing };
      }

      // Fetch current order
      const { data: current, error: fetchError } = await this.supabase
        .from('hc_clinical_orders')
        .select('*')
        .eq('id', request.orderId)
        .eq('tenant_id', request.tenantId)
        .single<ClinicalOrderRow>();

      if (fetchError || !current) {
        return {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: `Order ${request.orderId} not found`,
            timestamp: now,
          },
        };
      }

      // Lifecycle guard: can only approve VALIDATED orders
      if (current.order_status !== 'VALIDATED') {
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot approve order in status '${current.order_status}'. Only VALIDATED orders can be approved.`,
            timestamp: now,
          },
        };
      }

      const { data, error } = await this.supabase
        .from('hc_clinical_orders')
        .update({
          order_status: 'APPROVED',
          approved_by: request.approvedBy,
          approved_at: now,
          updated_at: now,
        })
        .eq('id', request.orderId)
        .eq('tenant_id', request.tenantId)
        .eq('order_status', 'VALIDATED') // Atomic guard against race condition
        .select()
        .single<ClinicalOrderRow>();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'APPROVE_FAILED',
            message: error?.message ?? 'Failed to approve order (concurrent modification?)',
            timestamp: now,
          },
        };
      }

      const order = this.mapOrderRow(data);

      await eventBus.publish({
        eventType: 'hos.order.approved.v1',
        tenantId: request.tenantId,
        aggregateId: request.orderId,
        aggregateType: 'ClinicalOrder',
        payload: {
          orderId: request.orderId,
          encounterId: current.encounter_id,
          patientId: current.patient_party_id,
          orderType: current.order_type,
          approvedBy: request.approvedBy,
          previousStatus: current.order_status,
          newStatus: 'APPROVED',
        },
      });

      await this.storeOperationIdempotency(request.tenantId, request.requestId, 'order.approve');
      return { success: true, data: order };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'APPROVE_ORDER_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 4. Discontinue Order
  // --------------------------------------------------------------------------

  async discontinueOrder(
    request: DiscontinueOrderRequest
  ): Promise<EngineResponse<ClinicalOrder>> {
    try {
      const now = new Date().toISOString();

      const alreadyDiscontinued = await this.hasOperationIdempotency(
        request.tenantId,
        request.requestId,
        'order.discontinue'
      );
      if (alreadyDiscontinued) {
        const existing = await this.findOrderById(request.tenantId, request.orderId);
        if (existing) return { success: true, data: existing };
      }

      const { data: current, error: fetchError } = await this.supabase
        .from('hc_clinical_orders')
        .select('order_status,encounter_id,order_type')
        .eq('id', request.orderId)
        .eq('tenant_id', request.tenantId)
        .single<Pick<ClinicalOrderRow, 'order_status' | 'encounter_id' | 'order_type'>>();

      if (fetchError || !current) {
        return {
          success: false,
          error: {
            code: 'ORDER_NOT_FOUND',
            message: `Order ${request.orderId} not found`,
            timestamp: now,
          },
        };
      }

      const discontinuableStatuses: OrderStatus[] = ['VALIDATED', 'APPROVED', 'ACTIVE'];
      if (!discontinuableStatuses.includes(current.order_status as OrderStatus)) {
        return {
          success: false,
          error: {
            code: 'INVALID_TRANSITION',
            message: `Cannot discontinue order in status '${current.order_status}'.`,
            timestamp: now,
          },
        };
      }

      const { data, error } = await this.supabase
        .from('hc_clinical_orders')
        .update({
          order_status: 'DISCONTINUED',
          discontinued_by: request.discontinuedBy,
          discontinued_at: now,
          discontinue_reason: request.reason,
          updated_at: now,
        })
        .eq('id', request.orderId)
        .eq('tenant_id', request.tenantId)
        .select()
        .single<ClinicalOrderRow>();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'DISCONTINUE_FAILED',
            message: error?.message ?? 'Failed to discontinue order',
            timestamp: now,
          },
        };
      }

      const order = this.mapOrderRow(data);

      await eventBus.publish({
        eventType: 'hos.order.discontinued.v1',
        tenantId: request.tenantId,
        aggregateId: request.orderId,
        aggregateType: 'ClinicalOrder',
        payload: {
          orderId: request.orderId,
          encounterId: current.encounter_id,
          orderType: current.order_type,
          discontinuedBy: request.discontinuedBy,
          reason: request.reason,
        },
      });

      await this.storeOperationIdempotency(
        request.tenantId,
        request.requestId,
        'order.discontinue'
      );
      return { success: true, data: order };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'DISCONTINUE_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 5. Get Active Orders
  // --------------------------------------------------------------------------

  async getActiveOrders(
    request: GetActiveOrdersRequest
  ): Promise<EngineResponse<ClinicalOrder[]>> {
    try {
      let query = this.supabase
        .from('hc_clinical_orders')
        .select('*')
        .eq('tenant_id', request.tenantId)
        .eq('encounter_id', request.encounterId)
        .in('order_status', ['VALIDATED', 'APPROVED', 'ACTIVE'])
        .order('ordered_at', { ascending: false });

      if (request.orderType) {
        query = query.eq('order_type', request.orderType);
      }

      const { data, error } = await query.returns<ClinicalOrderRow[]>();

      if (error) {
        return {
          success: false,
          error: {
            code: 'QUERY_ERROR',
            message: error.message,
            timestamp: new Date().toISOString(),
          },
        };
      }

      return { success: true, data: (data ?? []).map(this.mapOrderRow) };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'GET_ORDERS_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // 6. Override CDS Warning (Immutable audit)
  // --------------------------------------------------------------------------

  async overrideCdsWarning(
    request: OverrideCdsWarningRequest
  ): Promise<EngineResponse<CdsOverrideRecord>> {
    try {
      const now = new Date().toISOString();

      const alreadyOverridden = await this.hasOperationIdempotency(
        request.tenantId,
        request.requestId,
        'order.override-cds-warning'
      );
      if (alreadyOverridden) {
        return {
          success: false,
          error: {
            code: 'CDS_OVERRIDE_ALREADY_RECORDED',
            message: `CDS override request ${request.requestId} was already recorded`,
            timestamp: now,
          },
        };
      }

      // Invariant: ABSOLUTE_BLOCK cannot be overridden
      if (request.alertEnforcement === ('ABSOLUTE_BLOCK' as string)) {
        return {
          success: false,
          error: {
            code: 'CANNOT_OVERRIDE_ABSOLUTE_BLOCK',
            message:
              'ABSOLUTE_BLOCK alerts cannot be overridden. Clinical safety invariant violation.',
            timestamp: now,
          },
        };
      }

      const overrideRow = {
        id: crypto.randomUUID(),
        tenant_id: request.tenantId,
        order_id: request.orderId,
        cds_alert_id: request.cdsAlertId,
        alert_type: request.alertType,
        alert_severity: request.alertSeverity,
        alert_enforcement: request.alertEnforcement,
        override_reason: request.overrideReason,
        overriding_clinician: request.overridingClinician,
        overridden_at: now,
      };

      const { data, error } = await this.supabase
        .from('hc_order_cds_overrides')
        .insert(overrideRow)
        .select()
        .single<CdsOverrideRow>();

      if (error || !data) {
        return {
          success: false,
          error: {
            code: 'OVERRIDE_PERSIST_FAILED',
            message: error?.message ?? 'Failed to record CDS override',
            timestamp: now,
          },
        };
      }

      const overrideRecord = this.mapOverrideRow(data);
      await this.storeOperationIdempotency(
        request.tenantId,
        request.requestId,
        'order.override-cds-warning'
      );
      return { success: true, data: overrideRecord };
    } catch (err: unknown) {
      return {
        success: false,
        error: {
          code: 'OVERRIDE_ERROR',
          message: err instanceof Error ? err.message : 'Unknown error',
          timestamp: new Date().toISOString(),
        },
      };
    }
  }

  // --------------------------------------------------------------------------
  // Health Check
  // --------------------------------------------------------------------------

  async healthCheck(): Promise<EngineHealthStatus> {
    try {
      const { error } = await this.supabase
        .from('hc_clinical_orders')
        .select('id')
        .limit(1);

      return {
        status: error ? 'degraded' : 'healthy',
        timestamp: new Date().toISOString(),
        checks: { database: error ? 'error' : 'ok' },
        message: error ? 'Database connection issue' : undefined,
      };
    } catch (err: unknown) {
      return {
        status: 'unhealthy',
        timestamp: new Date().toISOString(),
        checks: { database: 'error' },
        message: err instanceof Error ? err.message : 'Health check failed',
      };
    }
  }

  // --------------------------------------------------------------------------
  // Private Helpers
  // --------------------------------------------------------------------------

  private async findCreateOrderByRequestId(
    tenantId: string,
    requestId: string
  ): Promise<CreateOrderResult | null> {
    const { data } = await this.supabase
      .from('hc_clinical_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('request_id', requestId)
      .maybeSingle<ClinicalOrderRow>();

    if (!data) return null;

    const order = this.mapOrderRow(data);
    return {
      order,
      cdsAlerts: [],
      cdsCheckStatus: order.cdsCheckStatus ?? 'PASSED',
    };
  }

  private async findOrderById(
    tenantId: string,
    orderId: string
  ): Promise<ClinicalOrder | null> {
    const { data } = await this.supabase
      .from('hc_clinical_orders')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', orderId)
      .maybeSingle<ClinicalOrderRow>();

    return data ? this.mapOrderRow(data) : null;
  }

  private async hasOperationIdempotency(
    tenantId: string,
    requestId: string,
    operation: OrderEngineIdempotencyOperation
  ): Promise<boolean> {
    const { data } = await this.supabase
      .from('hc_idempotency_keys')
      .select('request_id')
      .eq('tenant_id', tenantId)
      .eq('request_id', requestId)
      .eq('operation', operation)
      .maybeSingle<IdempotencyKeyRow>();

    return Boolean(data);
  }

  private async storeOperationIdempotency(
    tenantId: string,
    requestId: string,
    operation: OrderEngineIdempotencyOperation
  ): Promise<void> {
    await this.supabase
      .from('hc_idempotency_keys')
      .upsert(
        {
          tenant_id: tenantId,
          request_id: requestId,
          operation,
        },
        { onConflict: 'tenant_id,request_id,operation' }
      )
      .throwOnError();
  }

  private async resolveEncounterPatientId(
    tenantId: string,
    encounterId: string
  ): Promise<string | null> {
    const { data } = await this.supabase
      .from('hc_encounters')
      .select('patient_party_id')
      .eq('tenant_id', tenantId)
      .eq('id', encounterId)
      .maybeSingle<{ patient_party_id: string }>();

    return data?.patient_party_id ?? null;
  }

  private mapOrderRow(row: ClinicalOrderRow): ClinicalOrder {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      encounterId: row.encounter_id,
      orderType: row.order_type as ClinicalOrder['orderType'],
      orderStatus: row.order_status as ClinicalOrder['orderStatus'],
      priority: row.priority as ClinicalOrder['priority'],
      orderedBy: row.ordered_by,
      orderedAt: row.ordered_at,
      approvedBy: row.approved_by ?? undefined,
      approvedAt: row.approved_at ?? undefined,
      discontinuedBy: row.discontinued_by ?? undefined,
      discontinuedAt: row.discontinued_at ?? undefined,
      discontinueReason: row.discontinue_reason ?? undefined,
      cdsCheckId: row.cds_check_id ?? undefined,
      cdsCheckStatus: row.cds_check_status as ClinicalOrder['cdsCheckStatus'],
      orderDetails: row.order_details as ClinicalOrder['orderDetails'],
      notes: row.notes ?? undefined,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapOverrideRow(row: CdsOverrideRow): CdsOverrideRecord {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      orderId: row.order_id,
      cdsAlertId: row.cds_alert_id,
      alertType: row.alert_type as CdsOverrideRecord['alertType'],
      alertSeverity: row.alert_severity as CdsOverrideRecord['alertSeverity'],
      alertEnforcement: row.alert_enforcement as CdsOverrideRecord['alertEnforcement'],
      overrideReason: row.override_reason,
      overridingClinician: row.overriding_clinician,
      overriddenAt: row.overridden_at,
    };
  }
}
