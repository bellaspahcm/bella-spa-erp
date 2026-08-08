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
// Order Engine Contract Interface
// ============================================================================

export const ORDER_ENGINE_CONTRACT = {
  engineId: 'order-engine',
  version: '1.0.0',
  description: 'CPOE Order Engine — clinical order lifecycle with mandatory CDS gate at prescribing',
};

export interface OrderEngineContract {
  readonly engineName: 'order-engine';
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
