/**
 * Freight Audit & Payment Contract
 * 
 * E3 Economics Experiment - R1: Create Freight Invoice
 * Category: B (Pattern Reuse - following Contract pattern)
 * 
 * Domain: Financial reconciliation and payment processing
 * Boundary: Freight audit operations isolated from operational logistics
 */

import { EngineResponse, EngineHealthStatus } from '@/core/types/engine';
import { 
  FreightInvoice, 
  InvoiceLineItem, 
  InvoiceStatus 
} from '../shared-kernel/types/freight-audit.types';

// ============================================================================
// REQUEST/RESPONSE TYPES
// ============================================================================

/**
 * R1: Create Freight Invoice
 */
export interface CreateInvoiceRequest {
  tenant_id: string;
  carrier_id: string;
  invoice_number: string;
  invoice_date: Date;
  due_date: Date;
  currency: string;
  line_items: InvoiceLineItemInput[];
  idempotency_key?: string;
}

export interface InvoiceLineItemInput {
  shipment_id: string;
  charge_type: string; // 'base_rate' | 'fuel_surcharge' | 'accessorial' | 'other'
  amount: number;
  description: string;
  quantity?: number;
  unit_price?: number;
}

export interface CreateInvoiceResult {
  invoice: FreightInvoice;
  line_items: InvoiceLineItem[];
}

/**
 * Query Operations
 */
export interface GetInvoiceRequest {
  tenant_id: string;
  invoice_id: string;
}

export interface GetInvoicesByStatusRequest {
  tenant_id: string;
  status: InvoiceStatus;
  limit?: number;
  offset?: number;
}

export interface GetInvoicesByCarrierRequest {
  tenant_id: string;
  carrier_id: string;
  from_date?: Date;
  to_date?: Date;
  limit?: number;
  offset?: number;
}

export interface GetInvoicesByShipmentRequest {
  tenant_id: string;
  shipment_id: string;
}

/**
 * Invoice Metrics
 */
export interface GetInvoiceMetricsRequest {
  tenant_id: string;
  from_date?: Date;
  to_date?: Date;
  carrier_id?: string;
}

export interface InvoiceMetrics {
  total_invoices: number;
  total_amount: number;
  by_status: {
    status: InvoiceStatus;
    count: number;
    total_amount: number;
  }[];
  by_carrier: {
    carrier_id: string;
    count: number;
    total_amount: number;
  }[];
  average_processing_days: number;
}

// ============================================================================
// DOMAIN EVENTS (R1 scope)
// ============================================================================

export interface InvoiceCreatedPayload {
  tenant_id: string;
  invoice_id: string;
  carrier_id: string;
  invoice_number: string;
  invoice_date: Date;
  total_amount: number;
  line_item_count: number;
  created_by: string;
  created_at: Date;
}

// ============================================================================
// CONTRACT INTERFACE
// ============================================================================

/**
 * Freight Audit & Payment Contract
 * 
 * R1 Scope: Create invoice, query operations, basic metrics
 * Future R2-R15: Rate validation, approval workflow, payment tracking
 */
export interface FreightAuditContract {
  /**
   * R1: Create Freight Invoice
   * 
   * Creates invoice header and line items with:
   * - Tenant isolation (RLS enforced)
   * - Idempotency (duplicate detection)
   * - Audit trail (created_by, created_at)
   * - Domain event publication (InvoiceCreated)
   */
  createInvoice(
    request: CreateInvoiceRequest
  ): Promise<EngineResponse<CreateInvoiceResult>>;

  /**
   * Get invoice by ID with all line items
   */
  getInvoice(
    request: GetInvoiceRequest
  ): Promise<EngineResponse<FreightInvoice>>;

  /**
   * Query invoices by status
   */
  getInvoicesByStatus(
    request: GetInvoicesByStatusRequest
  ): Promise<EngineResponse<FreightInvoice[]>>;

  /**
   * Query invoices by carrier
   */
  getInvoicesByCarrier(
    request: GetInvoicesByCarrierRequest
  ): Promise<EngineResponse<FreightInvoice[]>>;

  /**
   * Query invoices by shipment
   */
  getInvoicesByShipment(
    request: GetInvoicesByShipmentRequest
  ): Promise<EngineResponse<FreightInvoice[]>>;

  /**
   * Get invoice metrics
   */
  getInvoiceMetrics(
    request: GetInvoiceMetricsRequest
  ): Promise<EngineResponse<InvoiceMetrics>>;

  /**
   * R2: Validate Rate Against Contract
   * 
   * Match invoice line items against contracted carrier rates:
   * - Multi-dimensional rate lookup (origin, destination, service, weight)
   * - Calculate absolute and percentage variance
   * - Flag discrepancies exceeding threshold
   * - Store validation results in line items
   */
  validateRate(
    request: ValidateRateRequest
  ): Promise<EngineResponse<ValidateRateResult>>;

  /**
   * R3: Validate Accessorial Charges
   * 
   * Verify accessorial charge legitimacy:
   * - Identify charge types (fuel, detention, layover, etc.)
   * - Validate against shipment events (e.g., detention requires delay event)
   * - Validate amount against accessorial rate schedule
   * - Flag unauthorized or excessive charges
   */
  validateAccessorials(
    request: ValidateAccessorialsRequest
  ): Promise<EngineResponse<ValidateAccessorialsResult>>;

  /**
   * R4: Calculate Total Invoice Variance
   * 
   * Aggregate line-item variances into invoice-level summary:
   * - Sum all line-item variances
   * - Group variance by charge type
   * - Calculate percentage variance
   * - Classify variance (within tolerance, requires review, reject)
   */
  calculateVariance(
    request: CalculateVarianceRequest
  ): Promise<EngineResponse<CalculateVarianceResult>>;

  /**
   * R5: Create Discrepancy Record
   * 
   * Create discrepancy for line items with excessive variance:
   * - Record expected vs actual amounts
   * - Track variance reason
   * - Assign to reviewer (optional)
   * - Publish DiscrepancyCreated event
   * - State: open (initial)
   */
  createDiscrepancy(
    request: CreateDiscrepancyRequest
  ): Promise<EngineResponse<CreateDiscrepancyResult>>;

  /**
   * R6: Submit Invoice for Approval
   * 
   * Transition invoice to approval workflow:
   * - Validate prerequisite (variance calculated)
   * - Status transition: draft → pending_approval
   * - Apply business rule (variance/threshold)
   * - Publish InvoiceSubmitted event
   */
  submitInvoiceForApproval(
    request: SubmitInvoiceForApprovalRequest
  ): Promise<EngineResponse<SubmitInvoiceForApprovalResult>>;

  /**
   * R7: Approve Invoice
   * 
   * Approve invoice for payment:
   * - Authorization check (only authorized users)
   * - Status transition: pending_approval → approved
   * - Record approval timestamp and approver
   * - Publish InvoiceApproved event
   */
  approveInvoice(
    request: ApproveInvoiceRequest
  ): Promise<EngineResponse<ApproveInvoiceResult>>;

  /**
   * R8: Reject Invoice
   * 
   * Reject invoice with reason:
   * - Status transition: pending_approval → rejected
   * - Record rejection reason and rejector
   * - Publish InvoiceRejected event
   */
  rejectInvoice(
    request: RejectInvoiceRequest
  ): Promise<EngineResponse<RejectInvoiceResult>>;

  /**
   * R9: Mark Invoice as Paid
   * 
   * Record payment completion:
   * - Status transition: approved → paid (terminal state)
   * - Record payment date and reference
   * - Lock invoice (immutable after payment)
   * - Publish InvoicePaid event
   */
  markInvoicePaid(
    request: MarkInvoicePaidRequest
  ): Promise<EngineResponse<MarkInvoicePaidResult>>;

  /**
   * R12: Reopen Invoice
   * 
   * Reopen rejected invoice for resubmission:
   * - Status transition: rejected → draft
   * - Audit trail (reopened_by, reopened_at)
   * - Publish InvoiceReopened event
   */
  reopenInvoice(
    request: ReopenInvoiceRequest
  ): Promise<EngineResponse<ReopenInvoiceResult>>;

  /**
   * R13: Bulk Approve Invoices
   * 
   * Approve multiple invoices in bulk:
   * - Reuse R7 approval logic per invoice
   * - Collect successes and failures
   * - Publish event per successful approval
   */
  bulkApproveInvoices(
    request: BulkApproveInvoicesRequest
  ): Promise<EngineResponse<BulkApproveInvoicesResult>>;

  /**
   * R13: Bulk Reject Invoices
   * 
   * Reject multiple invoices in bulk:
   * - Reuse R8 rejection logic per invoice
   * - Collect successes and failures
   * - Publish event per successful rejection
   */
  bulkRejectInvoices(
    request: BulkRejectInvoicesRequest
  ): Promise<EngineResponse<BulkRejectInvoicesResult>>;

  /**
   * Health check
   */
  healthCheck(): Promise<EngineHealthStatus>;
}

// ============================================================================
// R2: RATE VALIDATION
// ============================================================================

/**
 * Validate invoice line items against contracted rates
 */
export interface ValidateRateRequest {
  tenant_id: string;
  invoice_id: string;
  variance_threshold_percentage?: number; // Default: 5%
}

export interface ValidateRateResult {
  invoice_id: string;
  line_items_validated: number;
  line_items_matched: number;
  line_items_variance_within_threshold: number;
  line_items_variance_exceeds_threshold: number;
  line_items_rate_not_found: number;
  total_expected_amount: number;
  total_actual_amount: number;
  total_variance: number;
  validation_details: import('../shared-kernel/types/freight-audit.types').RateValidationResult[];
}

// ============================================================================
// R3: ACCESSORIAL VALIDATION
// ============================================================================

/**
 * Validate accessorial charges legitimacy
 */
export interface ValidateAccessorialsRequest {
  tenant_id: string;
  invoice_id: string;
}

export interface ValidateAccessorialsResult {
  invoice_id: string;
  accessorials_validated: number;
  accessorials_legitimate: number;
  accessorials_unauthorized: number;
  accessorials_excessive: number;
  total_accessorial_variance: number;
  validation_details: import('../shared-kernel/types/freight-audit.types').AccessorialValidationResult[];
}

// ============================================================================
// R4: VARIANCE AGGREGATION
// ============================================================================

/**
 * Calculate total invoice variance (aggregate all line items)
 */
export interface CalculateVarianceRequest {
  tenant_id: string;
  invoice_id: string;
  tolerance_percentage?: number; // Default: 5%
}

export interface CalculateVarianceResult {
  variance_summary: import('../shared-kernel/types/freight-audit.types').InvoiceVarianceSummary;
}

// ============================================================================
// R5: DISCREPANCY MANAGEMENT
// ============================================================================

/**
 * Create discrepancy record for line items with excessive variance
 */
export interface CreateDiscrepancyRequest {
  tenant_id: string;
  invoice_id: string;
  line_item_id: string;
  expected_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
  reason: string;
  assigned_to?: string;
}

export interface CreateDiscrepancyResult {
  discrepancy: import('../shared-kernel/types/freight-audit.types').Discrepancy;
}

/**
 * DiscrepancyCreated event payload
 */
export interface DiscrepancyCreatedPayload {
  tenant_id: string;
  discrepancy_id: string;
  invoice_id: string;
  line_item_id: string;
  variance: number;
  variance_percentage: number;
  status: 'open';
  assigned_to?: string;
  created_by: string;
  created_at: Date;
}

// ============================================================================
// R6: APPROVAL WORKFLOW - SUBMIT FOR APPROVAL
// ============================================================================

/**
 * Submit invoice for approval (R6)
 * Transitions invoice from draft → pending_approval
 */
export interface SubmitInvoiceForApprovalRequest {
  tenant_id: string;
  invoice_id: string;
  approval_threshold?: number; // Default: any variance requires approval
}

export interface SubmitInvoiceForApprovalResult {
  invoice: import('../shared-kernel/types/freight-audit.types').FreightInvoice;
  requires_approval: boolean;
  approval_reason: string;
}

/**
 * InvoiceSubmitted event payload (R6)
 */
export interface InvoiceSubmittedPayload {
  tenant_id: string;
  invoice_id: string;
  carrier_id: string;
  total_amount: number;
  total_variance: number;
  requires_approval: boolean;
  approval_reason: string;
  submitted_by: string;
  submitted_at: Date;
}

// ============================================================================
// R7: APPROVAL WORKFLOW - APPROVE INVOICE
// ============================================================================

/**
 * Approve invoice for payment (R7)
 * Transitions invoice from pending_approval → approved
 */
export interface ApproveInvoiceRequest {
  tenant_id: string;
  invoice_id: string;
  approver_id: string;
  approval_notes?: string;
}

export interface ApproveInvoiceResult {
  invoice: import('../shared-kernel/types/freight-audit.types').FreightInvoice;
}

/**
 * InvoiceApproved event payload (R7)
 */
export interface InvoiceApprovedPayload {
  tenant_id: string;
  invoice_id: string;
  carrier_id: string;
  total_amount: number;
  approved_amount: number;
  approved_by: string;
  approved_at: Date;
}

// ============================================================================
// R8: APPROVAL WORKFLOW - REJECT INVOICE
// ============================================================================

/**
 * Reject invoice with reason (R8)
 * Transitions invoice from pending_approval → rejected
 */
export interface RejectInvoiceRequest {
  tenant_id: string;
  invoice_id: string;
  rejected_by: string;
  rejection_reason: string;
}

export interface RejectInvoiceResult {
  invoice: import('../shared-kernel/types/freight-audit.types').FreightInvoice;
}

/**
 * InvoiceRejected event payload (R8)
 */
export interface InvoiceRejectedPayload {
  tenant_id: string;
  invoice_id: string;
  carrier_id: string;
  rejection_reason: string;
  rejected_by: string;
  rejected_at: Date;
}

// ============================================================================
// R9: PAYMENT WORKFLOW - MARK INVOICE AS PAID
// ============================================================================

/**
 * Mark invoice as paid (R9)
 * Transitions invoice from approved → paid (terminal state)
 */
export interface MarkInvoicePaidRequest {
  tenant_id: string;
  invoice_id: string;
  payment_date: Date;
  payment_reference: string;
  paid_amount?: number; // Optional, defaults to approved_amount
}

export interface MarkInvoicePaidResult {
  invoice: import('../shared-kernel/types/freight-audit.types').FreightInvoice;
}

/**
 * InvoicePaid event payload (R9)
 */
export interface InvoicePaidPayload {
  tenant_id: string;
  invoice_id: string;
  carrier_id: string;
  paid_amount: number;
  payment_reference: string;
  paid_at: Date;
}

// ============================================================================
// R12: STATE MANAGEMENT - REOPEN INVOICE
// ============================================================================

/**
 * Reopen rejected invoice (R12)
 * Transitions invoice from rejected → draft for resubmission
 */
export interface ReopenInvoiceRequest {
  tenant_id: string;
  invoice_id: string;
  reopened_by: string;
  reopen_reason?: string;
}

export interface ReopenInvoiceResult {
  invoice: import('../shared-kernel/types/freight-audit.types').FreightInvoice;
}

/**
 * InvoiceReopened event payload (R12)
 */
export interface InvoiceReopenedPayload {
  tenant_id: string;
  invoice_id: string;
  carrier_id: string;
  previous_status: 'rejected';
  new_status: 'draft';
  reopened_by: string;
  reopened_at: Date;
  reopen_reason?: string;
}

// ============================================================================
// R13: BULK OPERATIONS
// ============================================================================

/**
 * Bulk approve invoices (R13)
 */
export interface BulkApproveInvoicesRequest {
  tenant_id: string;
  invoice_ids: string[];
  approver_id: string;
  approval_notes?: string;
}

export interface BulkApproveInvoicesResult {
  succeeded: string[]; // invoice_ids that were approved
  failed: { invoice_id: string; reason: string }[];
  total_processed: number;
}

/**
 * Bulk reject invoices (R13)
 */
export interface BulkRejectInvoicesRequest {
  tenant_id: string;
  invoice_ids: string[];
  rejected_by: string;
  rejection_reason: string;
}

export interface BulkRejectInvoicesResult {
  succeeded: string[];
  failed: { invoice_id: string; reason: string }[];
  total_processed: number;
}
