/**
 * Freight Audit & Payment - Shared Kernel Types
 * 
 * E3 Economics Experiment
 * Category: B (Pattern Reuse - following Kernel type pattern)
 * 
 * Domain entities for freight audit and payment operations
 */

/**
 * Invoice Status Lifecycle
 * 
 * draft → pending_approval → approved → paid
 *                         ↓
 *                     rejected
 */
export type InvoiceStatus = 
  | 'draft'
  | 'pending_approval'
  | 'approved'
  | 'rejected'
  | 'paid';

/**
 * Freight Invoice (Header)
 */
export interface FreightInvoice {
  invoice_id: string;
  tenant_id: string;
  carrier_id: string;
  invoice_number: string;
  invoice_date: Date;
  due_date: Date;
  status: InvoiceStatus;
  currency: string;
  subtotal_amount: number;
  tax_amount: number;
  total_amount: number;
  approved_amount?: number; // Amount approved for payment (may differ from total)
  approved_by?: string;
  approved_at?: Date;
  paid_amount?: number;
  paid_at?: Date;
  payment_reference?: string;
  rejection_reason?: string;
  rejected_by?: string;
  rejected_at?: Date;
  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at?: Date;
}

/**
 * Invoice Line Item (Charge Detail)
 */
export interface InvoiceLineItem {
  line_item_id: string;
  invoice_id: string;
  tenant_id: string;
  shipment_id: string;
  charge_type: ChargeType;
  description: string;
  quantity: number;
  unit_price: number;
  amount: number;
  expected_amount?: number; // For variance tracking (R2)
  variance?: number; // Actual - Expected (R2)
  variance_reason?: string; // Why variance exists (R2)
  created_at: Date;
}

/**
 * Charge Type Classification
 */
export type ChargeType =
  | 'base_rate'          // Primary transportation charge
  | 'fuel_surcharge'     // Fuel cost adjustment
  | 'accessorial'        // Additional services (detention, liftgate, etc.)
  | 'discount'           // Volume or contract discounts
  | 'tax'                // Tax charges
  | 'other';             // Miscellaneous charges

/**
 * Discrepancy (R5 - not implemented in R1)
 * 
 * Tracks variance between expected and actual charges
 */
export interface Discrepancy {
  discrepancy_id: string;
  tenant_id: string;
  invoice_id: string;
  line_item_id: string;
  expected_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
  reason_code: string;
  status: 'open' | 'under_review' | 'resolved' | 'escalated';
  assigned_to?: string;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: Date;
  created_at: Date;
}

/**
 * Approval History (R6-R8 - not implemented in R1)
 * 
 * Audit trail for approval workflow
 */
export interface ApprovalHistory {
  approval_id: string;
  tenant_id: string;
  invoice_id: string;
  action: 'submitted' | 'approved' | 'rejected' | 'reopened';
  actor_id: string;
  actor_name: string;
  notes?: string;
  created_at: Date;
}

/**
 * Carrier Rate (R2 - Rate Validation)
 * 
 * Contracted carrier pricing for invoice validation
 */
export interface CarrierRate {
  rate_id: string;
  tenant_id: string;
  carrier_id: string;
  origin_location: string;
  destination_location: string;
  service_level: 'standard' | 'express' | 'overnight' | 'same_day';
  weight_min: number;
  weight_max: number;
  base_rate: number;
  fuel_surcharge_rate?: number;
  effective_date: Date;
  expiration_date?: Date;
  currency: string;
  is_active: boolean;
  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at?: Date;
}

/**
 * Rate Validation Result (R2)
 * 
 * Result of comparing invoice charge against contracted rate
 */
export interface RateValidationResult {
  line_item_id: string;
  matched_rate_id?: string;
  expected_amount?: number;
  actual_amount: number;
  absolute_variance?: number;
  percentage_variance?: number;
  threshold_exceeded: boolean;
  validation_status: 'matched' | 'variance_within_threshold' | 'variance_exceeds_threshold' | 'rate_not_found';
  validation_notes?: string;
}

/**
 * Accessorial Charge Types (R3)
 */
export type AccessorialChargeType = 
  | 'fuel_surcharge'
  | 'detention'
  | 'layover'
  | 'redelivery'
  | 'storage'
  | 'liftgate'
  | 'inside_delivery'
  | 'residential_delivery'
  | 'appointment'
  | 'other';

/**
 * Accessorial Rate (R3)
 * 
 * Rate schedule for accessorial charges
 */
export interface AccessorialRate {
  rate_id: string;
  tenant_id: string;
  carrier_id: string;
  charge_type: AccessorialChargeType;
  rate_basis: 'flat' | 'per_hour' | 'per_day' | 'percentage_of_freight';
  rate_amount: number;
  minimum_charge?: number;
  maximum_charge?: number;
  requires_event: boolean; // e.g., detention requires delay event
  event_threshold?: number; // e.g., detention after 2 hours
  effective_date: Date;
  expiration_date?: Date;
  is_active: boolean;
  created_by: string;
  created_at: Date;
}

/**
 * Accessorial Validation Result (R3)
 * 
 * Result of validating accessorial charge legitimacy
 */
export interface AccessorialValidationResult {
  line_item_id: string;
  charge_type: AccessorialChargeType;
  is_legitimate: boolean;
  expected_amount?: number;
  actual_amount: number;
  variance?: number;
  validation_issues: string[];
  matched_rate_id?: string;
  matched_event_id?: string;
}

/**
 * Invoice Variance Summary (R4)
 * 
 * Aggregated variance analysis for entire invoice
 */
export interface InvoiceVarianceSummary {
  invoice_id: string;
  total_expected_amount: number;
  total_actual_amount: number;
  total_variance: number;
  total_variance_percentage: number;
  variance_by_charge_type: {
    charge_type: string;
    expected_amount: number;
    actual_amount: number;
    variance: number;
    variance_percentage: number;
  }[];
  variance_classification: 'within_tolerance' | 'requires_review' | 'reject';
  tolerance_threshold: number;
  line_items_count: number;
  line_items_with_variance: number;
}

/**
 * Discrepancy Status (R5)
 */
export type DiscrepancyStatus = 'open' | 'under_review' | 'resolved' | 'escalated';

/**
 * Discrepancy Record (R5)
 * 
 * Tracks invoice line item discrepancies requiring review
 */
export interface Discrepancy {
  discrepancy_id: string;
  tenant_id: string;
  invoice_id: string;
  line_item_id: string;
  expected_amount: number;
  actual_amount: number;
  variance: number;
  variance_percentage: number;
  reason: string;
  status: DiscrepancyStatus;
  assigned_to?: string;
  assigned_at?: Date;
  resolution_notes?: string;
  resolved_by?: string;
  resolved_at?: Date;
  created_by: string;
  created_at: Date;
  updated_by?: string;
  updated_at?: Date;
}
