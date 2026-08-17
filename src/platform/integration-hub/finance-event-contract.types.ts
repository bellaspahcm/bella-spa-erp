/**
 * F5.6 C7-H1 Hospital Finance Integration — Finance Event Contract Types
 * 
 * Standard event envelope for ALL Vertical OS → Finance OS integration
 * 
 * Architecture:
 * - Hospital OS: Business events (domain context)
 * - Finance OS: Financial meaning (semantic/intent/COA)
 * - F1-F4 Kernel: Immutable truth
 * 
 * @see docs/architecture/F5_6_C7_H1_HOSPITAL_FINANCE_INTEGRATION.md
 */

/**
 * Standard Finance Event Envelope (v1.0)
 * 
 * Used by ALL Vertical OS (Healthcare, Beauty, Land, Auto, Retail)
 * Contract guarantees:
 * - Idempotency (same key → same result)
 * - Tenant isolation (P0 Gate)
 * - Domain independence (no account codes/debit/credit)
 * - Failure isolation (events persist even if Finance OS down)
 */
export interface FinanceEventEnvelope {
  // ========== Event Identity ==========
  /** Unique event ID (UUID) */
  event_id: string;
  
  /** Business event type (e.g., "PATIENT_SERVICE_COMPLETED") */
  event_type: string;
  
  /** Idempotency key - prevents duplicate processing */
  idempotency_key: string;
  
  // ========== Temporal Context ==========
  /** When business event occurred (ISO 8601) */
  occurred_at: string;
  
  /** When event was created (ISO 8601) */
  created_at: string;
  
  // ========== Tenant Context ==========
  /** Tenant identifier (P0 Gate - MANDATORY) */
  tenant_id: string;
  
  /** Optional organizational unit */
  org_unit_id?: string;
  
  // ========== Source Context ==========
  /** Source system identifier (e.g., "HOSPITAL_OS", "BEAUTY_OS") */
  source_system: string;
  
  /** Source system version */
  source_version: string;
  
  /** Correlation ID for distributed tracing */
  correlation_id: string;
  
  // ========== Financial Context ==========
  /** Amount (required, decimal precision) */
  amount: string; // Decimal as string to avoid floating-point errors
  
  /** ISO 4217 currency code (e.g., "VND", "USD") */
  currency: string;
  
  // ========== Business Context ==========
  /** Vertical-specific business context */
  business_context: BusinessContext;
  
  // ========== References ==========
  /** Business entity references (encounter, bill, service, etc.) */
  business_references: BusinessReference[];
  
  // ========== Metadata ==========
  /** Additional context (optional, extensible) */
  metadata?: Record<string, unknown>;
}

/**
 * Business Context - Vertical-specific structure
 * 
 * Each Vertical OS provides domain-specific context
 * Finance OS does NOT interpret business rules, only financial meaning
 */
export interface BusinessContext {
  /** Patient context (Healthcare only) */
  patient?: PatientContext;
  
  /** Encounter context (Healthcare only) */
  encounter?: EncounterContext;
  
  /** Service context (Healthcare, Beauty, Auto) */
  service?: ServiceContext;
  
  /** Billing context (Healthcare, Retail) */
  billing?: BillingContext;
  
  /** Pharmacy context (Healthcare only) */
  pharmacy?: PharmacyContext;
  
  /** Procurement context (Healthcare, Beauty, Retail, Auto) */
  procurement?: ProcurementContext;
  
  // Future: Beauty, Land, Auto, Retail-specific contexts
}

/**
 * Patient Context (Healthcare)
 */
export interface PatientContext {
  patient_id: string;
  patient_type: 'INPATIENT' | 'OUTPATIENT' | 'EMERGENCY';
}

/**
 * Encounter Context (Healthcare)
 */
export interface EncounterContext {
  encounter_id: string;
  encounter_type: 'CONSULTATION' | 'ADMISSION' | 'PROCEDURE' | 'EMERGENCY';
  encounter_date: string; // ISO 8601
  provider_id?: string;
}

/**
 * Service Context
 */
export interface ServiceContext {
  service_id: string;
  service_type: 'CONSULTATION' | 'PROCEDURE' | 'LAB' | 'IMAGING' | 'PHARMACY' | 'BEAUTY_SERVICE' | 'AUTO_SERVICE';
  service_code?: string; // Internal service code
  quantity?: number;
}

/**
 * Billing Context
 */
export interface BillingContext {
  bill_id: string;
  bill_date: string; // ISO 8601
  payer_type: 'PATIENT' | 'INSURANCE' | 'CUSTOMER' | 'CORPORATE';
  insurance_plan_id?: string;
}

/**
 * Pharmacy Context (Healthcare)
 */
export interface PharmacyContext {
  medication_id: string;
  medication_name: string;
  quantity: number;
  unit: string;
  batch_number?: string;
}

/**
 * Procurement Context
 */
export interface ProcurementContext {
  purchase_order_id?: string;
  supplier_id: string;
  supplier_name?: string;
  goods_receipt_id?: string;
}

/**
 * Business Reference
 */
export interface BusinessReference {
  entity_type: string; // "encounter", "bill", "service", "patient", "purchase_order"
  entity_id: string;
  parent_id?: string; // Parent entity (e.g., encounter for service)
}

// ========== Finance Event Types (Hospital OS) ==========

/**
 * Hospital Finance Event Types
 * 
 * Category 1: Patient Service & Revenue
 */
export type HospitalFinanceEventType =
  | 'PATIENT_SERVICE_COMPLETED'
  | 'PATIENT_PAYMENT_RECEIVED'
  | 'PATIENT_REFUND_ISSUED'
  
  // Category 2: Pharmacy & Inventory
  | 'MEDICATION_DISPENSED'
  | 'MEDICATION_STOCK_RECEIVED'
  
  // Category 3: Procurement & Supplier
  | 'SUPPLIER_PREPAYMENT_MADE'
  | 'SUPPLIER_PAYMENT_MADE'
  | 'GOODS_RECEIVED'
  
  // Category 4: Insurance
  | 'INSURANCE_SERVICE_COMPLETED'
  | 'INSURANCE_CLAIM_SUBMITTED'
  | 'INSURANCE_SETTLEMENT_RECEIVED';

// ========== Finance OS Response ==========

/**
 * Finance Event Processing Result
 * 
 * Returned by Finance OS after processing event
 */
export interface FinanceEventResult {
  /** Event ID (from request) */
  event_id: string;
  
  /** Idempotency key (from request) */
  idempotency_key: string;
  
  /** Processing status */
  status: 'CREATED' | 'ALREADY_PROCESSED' | 'FAILED' | 'PENDING';
  
  /** Finance transaction ID (if created) */
  transaction_id?: string;
  
  /** Error message (if failed) */
  error?: string;
  
  /** Processing timestamp */
  processed_at: string; // ISO 8601
  
  /** Additional metadata */
  metadata?: Record<string, unknown>;
}

/**
 * Idempotency Store Entry
 * 
 * Prevents duplicate processing
 */
export interface IdempotencyEntry {
  idempotency_key: string;
  event_id: string;
  transaction_id: string;
  status: 'COMPLETED' | 'PROCESSING' | 'FAILED';
  created_at: string;
  updated_at: string;
  tenant_id: string;
}

// ========== Finance Event Validation ==========

/**
 * Finance Event Validation Error
 */
export interface FinanceEventValidationError {
  field: string;
  message: string;
  code: string;
}

/**
 * Finance Event Validation Result
 */
export interface FinanceEventValidationResult {
  valid: boolean;
  errors: FinanceEventValidationError[];
}
