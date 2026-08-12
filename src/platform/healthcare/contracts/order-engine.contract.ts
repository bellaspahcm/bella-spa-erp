/**
 * Order Engine Contract — Phase C: CPOE (Computerized Physician Order Entry)
 *
 * Defines the public API for the clinical order lifecycle.
 * The Order Engine is the primary consumer of the CDS Engine —
 * CDS check is a mandatory gate at createOrder().
 *
 * Order Lifecycle:
 *   PENDING → [CDS Gate] → VALIDATED / REJECTED
 *   VALIDATED → APPROVED (physician sign-off)
 *   APPROVED → ACTIVE (pharmacy accepts)
 *   ACTIVE → COMPLETED | DISCONTINUED
 *
 * Constitution:
 *   - Law 1: encounterId as aggregate root
 *   - Law 5: Events published for created/approved/discontinued
 *   - Law 11: Zero `any` types
 *
 * @module platform/healthcare/contracts/order-engine.contract
 */

import type { EngineResponse, EngineHealthStatus } from '../shared-kernel/types';

// ============================================================================
// Order Domain Types
// ============================================================================

export type OrderType = 'MEDICATION' | 'LAB' | 'IMAGING' | 'PROCEDURE' | 'DIET' | 'NURSING';

export type OrderStatus =
  | 'PENDING'
  | 'VALIDATED'
  | 'APPROVED'
  | 'ACTIVE'
  | 'COMPLETED'
  | 'DISCONTINUED'
  | 'REJECTED';

export type OrderPriority = 'STAT' | 'URGENT' | 'ROUTINE';

export type CdsCheckStatus = 'PASSED' | 'WARNED' | 'BLOCKED';

/** Full clinical order record */
export interface ClinicalOrder {
  id: string;
  tenantId: string;
  encounterId: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  priority: OrderPriority;
  orderedBy: string;
  orderedAt: string;
  approvedBy?: string;
  approvedAt?: string;
  discontinuedBy?: string;
  discontinuedAt?: string;
  discontinueReason?: string;
  cdsCheckId?: string;
  cdsCheckStatus?: CdsCheckStatus;
  orderDetails: MedicationOrderDetails | LabOrderDetails | ImagingOrderDetails | GenericOrderDetails;
  notes?: string;
  createdAt: string;
  updatedAt: string;
}

// ============================================================================
// Order Detail Types (strongly typed per order type)
// ============================================================================

/** Medication order details — used when orderType = 'MEDICATION' */
export interface MedicationOrderDetails {
  drugCode: string;                        // ATC code of the drug
  drugName: string;
  genericName?: string;
  dose: number;
  doseUnit: 'mg' | 'mcg' | 'g' | 'mL' | 'units' | 'IU';
  route: 'PO' | 'IV' | 'IM' | 'SC' | 'SL' | 'INH' | 'TOP' | 'PR' | 'NG';
  frequency: string;                       // e.g. 'QD', 'BID', 'TID', 'Q8H', 'PRN'
  durationDays?: number;
  totalDailyDoseMg?: number;               // Computed for protocol adherence checks
  // CDS context — required for MEDICATION orders
  currentMedicationCodes: string[];        // Active meds for DDI check
  patientAgeYears?: number;
  patientWeightKg?: number;
  patientEgfr?: number;
  patientHepaticClass?: 'A' | 'B' | 'C';
  patientPregnant?: boolean;
}

/** Lab order details */
export interface LabOrderDetails {
  testCode: string;
  testName: string;
  specimenType?: string;
  collectionTime?: string;
}

/** Imaging order details */
export interface ImagingOrderDetails {
  modalityCode: string;                    // 'CT', 'MRI', 'XR', 'US', 'NM', 'PET'
  bodyRegion: string;
  withContrast: boolean;
  clinicalIndication: string;
}

/** Generic order details for PROCEDURE, DIET, NURSING */
export interface GenericOrderDetails {
  description: string;
  instructions?: string;
  [key: string]: string | number | boolean | undefined;
}

/** CDS override record (immutable audit) */
export interface CdsOverrideRecord {
  id: string;
  tenantId: string;
  orderId: string;
  cdsAlertId: string;
  alertType: 'DRUG_INTERACTION' | 'ALLERGY' | 'PROTOCOL';
  alertSeverity: 'CRITICAL' | 'WARNING' | 'INFO';
  alertEnforcement: 'BLOCK' | 'ACKNOWLEDGE' | 'INFORMATIONAL';
  overrideReason: string;
  overridingClinician: string;
  overriddenAt: string;
}

// ============================================================================
// Order Request Types
// ============================================================================

export interface CreateOrderRequest {
  /** Idempotency key — prevents duplicate order creation */
  requestId: string;
  tenantId: string;
  encounterId: string;
  orderType: OrderType;
  priority: OrderPriority;
  orderedBy: string;
  orderDetails: MedicationOrderDetails | LabOrderDetails | ImagingOrderDetails | GenericOrderDetails;
  notes?: string;
  /** Required for MEDICATION orders: patient identifier for CDS checks */
  patientId?: string;
}

export interface ApproveOrderRequest {
  /** Idempotency key — prevents double approval */
  requestId: string;
  tenantId: string;
  orderId: string;
  approvedBy: string;
}

export interface DiscontinueOrderRequest {
  /** Idempotency key — prevents double discontinuation */
  requestId: string;
  tenantId: string;
  orderId: string;
  discontinuedBy: string;
  reason: string;
}

export interface OverrideCdsWarningRequest {
  /** Idempotency key — prevents duplicate override records */
  requestId: string;
  tenantId: string;
  orderId: string;
  cdsAlertId: string;
  alertType: 'DRUG_INTERACTION' | 'ALLERGY' | 'PROTOCOL';
  alertSeverity: 'CRITICAL' | 'WARNING' | 'INFO';
  alertEnforcement: 'BLOCK' | 'ACKNOWLEDGE' | 'INFORMATIONAL';
  overrideReason: string;
  overridingClinician: string;
}

export interface GetActiveOrdersRequest {
  tenantId: string;
  encounterId: string;
  orderType?: OrderType;
}

export interface CreateOrderResult {
  order: ClinicalOrder;
  /** CDS alerts that were found (empty if fully passed) */
  cdsAlerts: import('./cds-engine.contract').CdsAlert[];
  /** Whether the order was created (VALIDATED/WARNED) or rejected (REJECTED) */
  cdsCheckStatus: CdsCheckStatus;
}

// ============================================================================
// Order Domain Events (7 events for Contract Registry)
// ============================================================================

export interface OrderCreatedPayload {
  orderId: string;
  tenantId: string;
  encounterId: string;
  patientId: string;
  orderType: OrderType;
  orderStatus: OrderStatus;
  priority: OrderPriority;
  orderedBy: string;
  orderedAt: string;
  cdsCheckStatus?: CdsCheckStatus;
  correlationId: string;
  causationId: string;
}

export interface OrderValidatedPayload {
  orderId: string;
  tenantId: string;
  encounterId: string;
  orderStatus: OrderStatus; // Should be 'VALIDATED'
  cdsCheckStatus: CdsCheckStatus;
  cdsAlertsCount: number;
  validatedAt: string;
  correlationId: string;
  causationId: string;
}

export interface OrderApprovedPayload {
  orderId: string;
  tenantId: string;
  encounterId: string;
  orderStatus: OrderStatus; // Should be 'APPROVED'
  approvedBy: string;
  approvedAt: string;
  correlationId: string;
  causationId: string;
}

export interface OrderActivatedPayload {
  orderId: string;
  tenantId: string;
  encounterId: string;
  orderType: OrderType;
  orderStatus: OrderStatus; // Should be 'ACTIVE'
  activatedAt: string;
  correlationId: string;
  causationId: string;
}

export interface OrderCompletedPayload {
  orderId: string;
  tenantId: string;
  encounterId: string;
  orderStatus: OrderStatus; // Should be 'COMPLETED'
  completedAt: string;
  correlationId: string;
  causationId: string;
}

export interface OrderDiscontinuedPayload {
  orderId: string;
  tenantId: string;
  encounterId: string;
  orderStatus: OrderStatus; // Should be 'DISCONTINUED'
  discontinuedBy: string;
  discontinuedAt: string;
  discontinueReason: string;
  correlationId: string;
  causationId: string;
}

export interface OrderRejectedPayload {
  orderId: string;
  tenantId: string;
  encounterId: string;
  orderStatus: OrderStatus; // Should be 'REJECTED'
  cdsCheckStatus: CdsCheckStatus; // Should be 'BLOCKED'
  blockingAlertsCount: number;
  rejectedAt: string;
  correlationId: string;
  causationId: string;
}

// ============================================================================
// Order Engine Contract Metadata (for Contract Registry)
// ============================================================================

import type { ContractMetadata } from '../../host/contract-registry/types';

export const ORDER_ENGINE_CONTRACT: ContractMetadata = {
  name: 'order-engine',
  version: '1.0.0',
  type: 'engine',
  description: 'CPOE Order Engine — clinical order lifecycle with mandatory CDS gate at prescribing',
  owner: 'Healthcare Platform Team',
  status: 'active',
  
  // API endpoints (to be implemented in service layer)
  endpoints: [
    {
      path: '/api/order-engine/create',
      method: 'POST',
      operationId: 'createOrder',
      summary: 'Create a new clinical order with CDS validation',
      requestSchema: {
        schemaId: 'create-order-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['requestId', 'tenantId', 'encounterId', 'orderType', 'priority', 'orderedBy', 'orderDetails'],
          properties: {
            requestId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            orderType: { type: 'string', enum: ['MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'DIET', 'NURSING'] },
            priority: { type: 'string', enum: ['STAT', 'URGENT', 'ROUTINE'] },
            orderedBy: { type: 'string', format: 'uuid' },
            orderDetails: { type: 'object' },
            notes: { type: 'string' },
            patientId: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'create-order-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['doctor', 'nurse', 'admin'] }],
    },
    {
      path: '/api/order-engine/approve',
      method: 'POST',
      operationId: 'approveOrder',
      summary: 'Approve a validated clinical order',
      requestSchema: {
        schemaId: 'approve-order-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['requestId', 'tenantId', 'orderId', 'approvedBy'],
          properties: {
            requestId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            orderId: { type: 'string', format: 'uuid' },
            approvedBy: { type: 'string', format: 'uuid' },
          },
        },
      },
      responseSchema: {
        schemaId: 'order-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['doctor', 'admin'] }],
    },
    {
      path: '/api/order-engine/discontinue',
      method: 'POST',
      operationId: 'discontinueOrder',
      summary: 'Discontinue an active or approved order',
      requestSchema: {
        schemaId: 'discontinue-order-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['requestId', 'tenantId', 'orderId', 'discontinuedBy', 'reason'],
          properties: {
            requestId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            orderId: { type: 'string', format: 'uuid' },
            discontinuedBy: { type: 'string', format: 'uuid' },
            reason: { type: 'string' },
          },
        },
      },
      responseSchema: {
        schemaId: 'order-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer', roles: ['doctor', 'admin'] }],
    },
    {
      path: '/api/order-engine/active',
      method: 'POST',
      operationId: 'getActiveOrders',
      summary: 'Get all active orders for an encounter',
      requestSchema: {
        schemaId: 'get-active-orders-request',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['tenantId', 'encounterId'],
          properties: {
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            orderType: { type: 'string', enum: ['MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'DIET', 'NURSING'] },
          },
        },
      },
      responseSchema: {
        schemaId: 'orders-list-response',
        version: '1.0.0',
        inline: false,
      },
      authentication: [{ type: 'bearer' }],
    },
  ],
  
  // Domain events (7 events)
  events: [
    {
      eventType: 'OrderCreated',
      version: '1.0.0',
      summary: 'Published when a new clinical order is created',
      description: 'Triggers downstream workflows: pharmacy notification (if MEDICATION), lab notification (if LAB), billing activation',
      payloadSchema: {
        schemaId: 'order-created-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['orderId', 'tenantId', 'encounterId', 'patientId', 'orderType', 'orderStatus', 'priority', 'orderedBy', 'orderedAt', 'correlationId', 'causationId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            patientId: { type: 'string', format: 'uuid' },
            orderType: { type: 'string', enum: ['MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'DIET', 'NURSING'] },
            orderStatus: { type: 'string', enum: ['PENDING', 'VALIDATED', 'REJECTED'] },
            priority: { type: 'string', enum: ['STAT', 'URGENT', 'ROUTINE'] },
            orderedBy: { type: 'string', format: 'uuid' },
            orderedAt: { type: 'string', format: 'date-time' },
            cdsCheckStatus: { type: 'string', enum: ['PASSED', 'WARNED', 'BLOCKED'] },
            correlationId: { type: 'string', format: 'uuid' },
            causationId: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'order-engine',
      subscribers: ['pharmacy-engine', 'laboratory-engine', 'billing-engine', 'notification-hub'],
    },
    {
      eventType: 'OrderValidated',
      version: '1.0.0',
      summary: 'Published when order passes CDS validation',
      description: 'Triggers: awaiting physician approval workflow',
      payloadSchema: {
        schemaId: 'order-validated-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['orderId', 'tenantId', 'encounterId', 'orderStatus', 'cdsCheckStatus', 'cdsAlertsCount', 'validatedAt', 'correlationId', 'causationId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            orderStatus: { type: 'string', const: 'VALIDATED' },
            cdsCheckStatus: { type: 'string', enum: ['PASSED', 'WARNED'] },
            cdsAlertsCount: { type: 'integer', minimum: 0 },
            validatedAt: { type: 'string', format: 'date-time' },
            correlationId: { type: 'string', format: 'uuid' },
            causationId: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'order-engine',
      subscribers: ['notification-hub', 'analytics-engine'],
    },
    {
      eventType: 'OrderApproved',
      version: '1.0.0',
      summary: 'Published when physician approves order',
      description: 'Triggers: pharmacy dispensing workflow (if MEDICATION), lab collection workflow (if LAB)',
      payloadSchema: {
        schemaId: 'order-approved-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['orderId', 'tenantId', 'encounterId', 'orderStatus', 'approvedBy', 'approvedAt', 'correlationId', 'causationId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            orderStatus: { type: 'string', const: 'APPROVED' },
            approvedBy: { type: 'string', format: 'uuid' },
            approvedAt: { type: 'string', format: 'date-time' },
            correlationId: { type: 'string', format: 'uuid' },
            causationId: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'order-engine',
      subscribers: ['pharmacy-engine', 'laboratory-engine', 'notification-hub'],
    },
    {
      eventType: 'OrderActivated',
      version: '1.0.0',
      summary: 'Published when order becomes active (ready for fulfillment)',
      description: 'Triggers: fulfillment workflow activation, resource allocation',
      payloadSchema: {
        schemaId: 'order-activated-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['orderId', 'tenantId', 'encounterId', 'orderType', 'orderStatus', 'activatedAt', 'correlationId', 'causationId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            orderType: { type: 'string', enum: ['MEDICATION', 'LAB', 'IMAGING', 'PROCEDURE', 'DIET', 'NURSING'] },
            orderStatus: { type: 'string', const: 'ACTIVE' },
            activatedAt: { type: 'string', format: 'date-time' },
            correlationId: { type: 'string', format: 'uuid' },
            causationId: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'order-engine',
      subscribers: ['pharmacy-engine', 'laboratory-engine'],
    },
    {
      eventType: 'OrderCompleted',
      version: '1.0.0',
      summary: 'Published when order is fulfilled',
      description: 'Triggers: final billing, quality metrics update, encounter completion check',
      payloadSchema: {
        schemaId: 'order-completed-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['orderId', 'tenantId', 'encounterId', 'orderStatus', 'completedAt', 'correlationId', 'causationId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            orderStatus: { type: 'string', const: 'COMPLETED' },
            completedAt: { type: 'string', format: 'date-time' },
            correlationId: { type: 'string', format: 'uuid' },
            causationId: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'order-engine',
      subscribers: ['billing-engine', 'analytics-engine', 'encounter-engine'],
    },
    {
      eventType: 'OrderDiscontinued',
      version: '1.0.0',
      summary: 'Published when order is cancelled by physician',
      description: 'Triggers: cancellation fee processing (if applicable), resource release, inventory return',
      payloadSchema: {
        schemaId: 'order-discontinued-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['orderId', 'tenantId', 'encounterId', 'orderStatus', 'discontinuedBy', 'discontinuedAt', 'discontinueReason', 'correlationId', 'causationId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            orderStatus: { type: 'string', const: 'DISCONTINUED' },
            discontinuedBy: { type: 'string', format: 'uuid' },
            discontinuedAt: { type: 'string', format: 'date-time' },
            discontinueReason: { type: 'string' },
            correlationId: { type: 'string', format: 'uuid' },
            causationId: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'order-engine',
      subscribers: ['pharmacy-engine', 'billing-engine', 'notification-hub', 'analytics-engine'],
    },
    {
      eventType: 'OrderRejected',
      version: '1.0.0',
      summary: 'Published when order fails CDS validation (BLOCK enforcement)',
      description: 'Triggers: notification to ordering physician, quality assurance review, safety reporting',
      payloadSchema: {
        schemaId: 'order-rejected-payload',
        version: '1.0.0',
        inline: true,
        schema: {
          type: 'object',
          required: ['orderId', 'tenantId', 'encounterId', 'orderStatus', 'cdsCheckStatus', 'blockingAlertsCount', 'rejectedAt', 'correlationId', 'causationId'],
          properties: {
            orderId: { type: 'string', format: 'uuid' },
            tenantId: { type: 'string', format: 'uuid' },
            encounterId: { type: 'string', format: 'uuid' },
            orderStatus: { type: 'string', const: 'REJECTED' },
            cdsCheckStatus: { type: 'string', const: 'BLOCKED' },
            blockingAlertsCount: { type: 'integer', minimum: 1 },
            rejectedAt: { type: 'string', format: 'date-time' },
            correlationId: { type: 'string', format: 'uuid' },
            causationId: { type: 'string', format: 'uuid' },
          },
        },
      },
      publisher: 'order-engine',
      subscribers: ['notification-hub', 'analytics-engine', 'quality-assurance-engine'],
    },
  ],
  
  registeredAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

export interface OrderEngineContract {
  readonly engineName: string;
  readonly engineVersion: string;

  /**
   * Create a new clinical order.
   *
   * For MEDICATION orders:
   * 1. Runs generateCdsSummary() through CDS Engine (mandatory gate)
   * 2. If hardBlocked → reject order, publish hos.cds.allergy.blocked.v1 or hos.cds.drug_interaction.detected.v1
   * 3. If any BLOCK enforcement → reject order unless override provided
   * 4. If only ACKNOWLEDGE/INFORMATIONAL → persist with cds_check_status = WARNED
   * 5. If all PASSED → persist with cds_check_status = PASSED
   *
   * For non-MEDICATION orders: validates required fields, no CDS check.
   *
   * Idempotent: same requestId returns same result without creating duplicate orders.
   */
  createOrder(request: CreateOrderRequest): Promise<EngineResponse<CreateOrderResult>>;

  /**
   * Re-validate an existing PENDING order.
   * Useful when new allergy or medication has been added since order creation.
   */
  validateOrder(tenantId: string, orderId: string): Promise<EngineResponse<CreateOrderResult>>;

  /**
   * Approve a VALIDATED order (physician sign-off).
   * Transitions order: VALIDATED → APPROVED.
   * Cannot approve REJECTED or DISCONTINUED orders.
   *
   * Idempotent: same requestId returns same result.
   */
  approveOrder(request: ApproveOrderRequest): Promise<EngineResponse<ClinicalOrder>>;

  /**
   * Discontinue an ACTIVE or APPROVED order.
   * Transitions order: ACTIVE/APPROVED → DISCONTINUED.
   * Requires documented reason.
   *
   * Idempotent: same requestId returns same result.
   */
  discontinueOrder(request: DiscontinueOrderRequest): Promise<EngineResponse<ClinicalOrder>>;

  /**
   * Get all active orders for an encounter.
   * Filters by ACTIVE and APPROVED status (orders that need clinical action).
   */
  getActiveOrders(request: GetActiveOrdersRequest): Promise<EngineResponse<ClinicalOrder[]>>;

  /**
   * Record a clinician's justification for overriding a CDS warning.
   * Creates an immutable audit record in hc_order_cds_overrides.
   *
   * Rules:
   * - Cannot override ABSOLUTE_BLOCK alerts (returns error)
   * - Override is logged immutably regardless of outcome
   *
   * Idempotent: same requestId returns same override record.
   */
  overrideCdsWarning(request: OverrideCdsWarningRequest): Promise<EngineResponse<CdsOverrideRecord>>;

  healthCheck(): Promise<EngineHealthStatus>;
}
