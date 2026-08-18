/**
 * Financial Intent Types
 * 
 * Core contract for Industry OS → Finance OS communication
 * 
 * CRITICAL BOUNDARIES:
 * - Financial Intent is SEMANTIC (business event → financial consequence)
 * - Financial Intent does NOT contain ACCOUNTING TREATMENT (GL account, DR/CR)
 * - Finance OS interprets intent and applies accounting rules
 * 
 * PROHIBITED FIELDS (Finance Protection):
 * - glAccount, debit, credit, journalEntry
 * - chartOfAccountsMapping, revenueRecognitionMethod, cogsCalculationMethod
 * - Any field that makes Runtime an accounting authority
 * 
 * Version: 1.0.0
 * Architecture: Runtime Architecture v1.1 (FROZEN)
 */

import { z } from 'zod';

/**
 * Financial Intent Type
 * 
 * Semantic description of financial consequence from business event
 * Extensible (open enum) for new industries
 */
export type FinancialIntentType =
  // Hospital
  | 'REVENUE_RECOGNIZED'
  | 'ACCOUNTS_RECEIVABLE_DUE'
  | 'PAYMENT_RECEIVED'
  | 'INSURANCE_CLAIM_APPROVED'
  | 'INSURANCE_CLAIM_PAID'
  | 'WRITE_OFF_APPLIED'
  // Education
  | 'TUITION_OBLIGATION_RECOGNIZED'
  | 'SCHOLARSHIP_APPLIED'
  | 'REFUND_DUE'
  // Retail
  | 'COST_OF_GOODS_RECOGNIZED'
  | 'INVENTORY_RESTORED'
  | 'SALES_RETURN_RECOGNIZED'
  | 'ACCOUNTS_PAYABLE_DUE'
  | 'SUPPLIER_PAYMENT_MADE'
  // Extensible for new industries
  | string;

/**
 * Financial Intent
 * 
 * BOUNDARY OBJECT: Validated at Runtime boundary
 * Finance OS is sole consumer of this contract
 */
export interface FinancialIntent {
  // Intent identification
  intentType: FinancialIntentType;
  
  // Tenant context (required for isolation)
  tenantId: string;
  
  // Business entity reference
  entityId: string;
  entityType: string;
  
  // Financial amount (semantic, not accounting)
  amount: number;
  currency: string;  // ISO 4217
  
  // Timing
  effectiveDate: Date;
  
  // Source system/module
  source: string;
  
  // Tracing & correlation
  correlationId: string;
  
  // Optional fields
  metadata?: Record<string, unknown>;
  policyReference?: string;
}

/**
 * Prohibited Fields (Finance Protection)
 * 
 * These fields MUST NOT appear in Financial Intent
 * Runtime validation REJECTS intents with these fields
 */
export const PROHIBITED_FIELDS = [
  'glAccount',
  'debit',
  'credit',
  'journalEntry',
  'chartOfAccountsMapping',
  'revenueRecognitionMethod',
  'cogsCalculationMethod',
  'postingRules',
  'ledgerEntry',
  'accountingTreatment',
] as const;

/**
 * Financial Intent Zod Schema
 * 
 * STRICT MODE: Rejects unknown fields
 * Runtime enforcement (not just TypeScript compile-time)
 */
export const FinancialIntentSchema = z.object({
  intentType: z.string().min(1),
  tenantId: z.string().min(1),
  entityId: z.string().min(1),
  entityType: z.string().min(1),
  amount: z.number(),
  currency: z.string().length(3),  // ISO 4217
  effectiveDate: z.date(),
  source: z.string().min(1),
  correlationId: z.string().min(1),
  metadata: z.record(z.unknown()).optional(),
  policyReference: z.string().optional(),
}).strict();  // ✅ STRICT: Reject unknown fields

/**
 * Validate No Prohibited Fields
 * 
 * Runtime enforcement: Reject intents with accounting authority fields
 * 
 * @throws ValidationError if prohibited field present
 */
export function validateNoProhibitedFields(intent: unknown): void {
  if (typeof intent !== 'object' || intent === null) {
    return;
  }
  
  for (const field of PROHIBITED_FIELDS) {
    if (field in intent) {
      throw new ValidationError(
        `Prohibited field '${field}' detected (Finance Protection violation). ` +
        `Financial Intent must NOT contain accounting authority fields. ` +
        `Finance OS determines accounting treatment.`
      );
    }
  }
}

/**
 * Validation Error
 * 
 * Thrown when Financial Intent validation fails
 */
export class ValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'ValidationError';
  }
}

/**
 * Publish Result
 * 
 * Result of publishIntent() operation
 */
export interface PublishResult {
  status: 'SUCCESS' | 'DUPLICATE' | 'INVALID';
  outboxId?: string;
  idempotencyKey?: string;
  error?: string;
}

/**
 * Audit Log Entry
 * 
 * Immutable audit trail record
 */
export interface AuditLogEntry {
  id: string;
  timestamp: Date;
  tenantId: string;
  intentType: string;
  entityId: string;
  entityType: string;
  amount: number;
  correlationId: string;
  source: string;
  status: 'SUCCESS' | 'RETRYING' | 'INVALID' | 'DUPLICATE' | 'QUARANTINED';
  deliveryAttempts?: number;
  failureReason?: string;
  quarantinedAt?: Date;
}

/**
 * Quarantined Intent
 * 
 * Poison message in quarantine
 */
export interface QuarantinedIntent extends FinancialIntent {
  quarantineId: string;
  quarantinedAt: Date;
  failureReason: string;
  attempts: number;
  lastError: string;
  reviewed: boolean;
  reviewedAt?: Date;
  reviewedBy?: string;
  resolution?: 'REPLAYED' | 'DISCARDED' | 'FIXED';
}
