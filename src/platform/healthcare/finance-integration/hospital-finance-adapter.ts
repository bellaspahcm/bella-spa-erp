/**
 * F5.6 C7-H1 Hospital Finance Integration — Hospital Finance Adapter
 * 
 * Hospital OS adapter for publishing finance events
 * 
 * Used by Hospital engines (billing, pharmacy, etc.) to publish finance events
 * 
 * Responsibilities:
 * - Create finance events from Hospital business events
 * - Map Hospital context to finance event envelope
 * - Publish to Finance OS via event publisher
 * 
 * Does NOT:
 * - Resolve accounting semantic
 * - Generate debit/credit entries
 * - Apply accounting policy
 * 
 * @see docs/architecture/F5_6_C7_H1_HOSPITAL_FINANCE_INTEGRATION.md
 */

import {
  FinanceEventPublisher,
  PublishFinanceEventParams,
} from '../../integration-hub/finance-event-publisher';
import {
  FinanceEventResult,
  PatientContext,
  EncounterContext,
  ServiceContext,
  BillingContext,
  PharmacyContext,
  ProcurementContext,
} from '../../integration-hub/finance-event-contract.types';
import { 
  FinanceOutboxWriter,
  FinanceOutboxWriteResult,
} from '../../integration-hub/finance-outbox-writer';
import { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '../../../types/database.types';

/**
 * Hospital Finance Adapter
 * 
 * N1-HARDENED: Uses durable outbox pattern instead of synchronous HTTP
 * 
 * Example usage:
 * ```typescript
 * const adapter = new HospitalFinanceAdapter(supabase, outboxWriter);
 * 
 * // Flow H1: Patient service completed
 * const result = await adapter.publishPatientServiceCompleted({
 *   tenantId: 'tenant_a',
 *   patientId: 'PAT-001',
 *   encounterId: 'ENC-001',
 *   serviceId: 'SRV-001',
 *   amount: '500000',
 *   currency: 'VND'
 * });
 * // Returns immediately (outboxId), async worker handles Finance OS POST
 * ```
 */
export class HospitalFinanceAdapter {
  constructor(
    private supabase: SupabaseClient<Database>,
    private outboxWriter: FinanceOutboxWriter
  ) {}
  
  // ========== Flow H1: Patient Service → Revenue → AR/Cash ==========
  
  /**
   * Publish PATIENT_SERVICE_COMPLETED event
   * 
   * Triggered when: Clinical service is delivered and ready for billing
   * Finance Impact: Revenue + AR (Patient)
   * 
   * N1-HARDENED: Writes to outbox (async delivery)
   */
  async publishPatientServiceCompleted(params: PatientServiceCompletedParams): Promise<FinanceOutboxWriteResult> {
    return this.outboxWriter.writeToOutbox({
      eventType: 'PATIENT_SERVICE_COMPLETED',
      tenantId: params.tenantId,
      amount: params.amount,
      currency: params.currency,
      businessContext: {
        patient: {
          patient_id: params.patientId,
          patient_type: params.patientType || 'OUTPATIENT',
        },
        encounter: {
          encounter_id: params.encounterId,
          encounter_type: params.encounterType || 'CONSULTATION',
          encounter_date: params.encounterDate || new Date().toISOString(),
          provider_id: params.providerId,
        },
        service: {
          service_id: params.serviceId,
          service_type: params.serviceType || 'CONSULTATION',
          service_code: params.serviceCode,
          quantity: params.quantity || 1,
        },
      },
      businessReferences: [
        { entity_type: 'encounter', entity_id: params.encounterId },
        { entity_type: 'service', entity_id: params.serviceId, parent_id: params.encounterId },
      ],
      idempotencyKey: params.idempotencyKey,
      correlationId: params.correlationId,
      metadata: params.metadata,
    });
  }
  
  /**
   * Publish PATIENT_PAYMENT_RECEIVED event
   * 
   * Triggered when: Patient pays bill
   * Finance Impact: Cash + AR Settlement
   * 
   * N1-HARDENED: Writes to outbox (async delivery)
   */
  async publishPatientPaymentReceived(params: PatientPaymentReceivedParams): Promise<FinanceOutboxWriteResult> {
    return this.outboxWriter.writeToOutbox({
      eventType: 'PATIENT_PAYMENT_RECEIVED',
      tenantId: params.tenantId,
      amount: params.amount,
      currency: params.currency,
      businessContext: {
        patient: {
          patient_id: params.patientId,
          patient_type: params.patientType || 'OUTPATIENT',
        },
        billing: {
          bill_id: params.billId,
          bill_date: params.billDate || new Date().toISOString(),
          payer_type: 'PATIENT',
        },
      },
      businessReferences: [
        { entity_type: 'bill', entity_id: params.billId },
        { entity_type: 'patient', entity_id: params.patientId },
      ],
      idempotencyKey: params.idempotencyKey,
      correlationId: params.correlationId,
      metadata: params.metadata,
    });
  }
  
  /**
   * Publish PATIENT_REFUND_ISSUED event
   * 
   * Triggered when: Refund issued to patient
   * Finance Impact: Cash reduction + Revenue reversal
   * 
   * N1-HARDENED: Writes to outbox (async delivery)
   */
  async publishPatientRefundIssued(params: PatientRefundIssuedParams): Promise<FinanceOutboxWriteResult> {
    return this.outboxWriter.writeToOutbox({
      eventType: 'PATIENT_REFUND_ISSUED',
      tenantId: params.tenantId,
      amount: params.amount,
      currency: params.currency,
      businessContext: {
        patient: {
          patient_id: params.patientId,
          patient_type: params.patientType || 'OUTPATIENT',
        },
        billing: {
          bill_id: params.billId,
          bill_date: params.billDate || new Date().toISOString(),
          payer_type: 'PATIENT',
        },
      },
      businessReferences: [
        { entity_type: 'bill', entity_id: params.billId },
        { entity_type: 'refund', entity_id: params.refundId },
      ],
      idempotencyKey: params.idempotencyKey,
      metadata: {
        ...params.metadata,
        refund_reason: params.refundReason,
      },
    });
  }
  
  // ========== Flow H2: Pharmacy/Inventory → COGS/Inventory ==========
  
  /**
   * Publish MEDICATION_DISPENSED event
   * 
   * Triggered when: Medication is dispensed to patient
   * Finance Impact: COGS + Inventory reduction
   */
  async publishMedicationDispensed(params: MedicationDispensedParams): Promise<FinanceOutboxWriteResult> {
    return this.outboxWriter.writeToOutbox({
      eventType: 'MEDICATION_DISPENSED',
      tenantId: params.tenantId,
      amount: params.amount, // Cost value (not selling price)
      currency: params.currency,
      businessContext: {
        patient: params.patientId ? {
          patient_id: params.patientId,
          patient_type: params.patientType || 'OUTPATIENT',
        } : undefined,
        encounter: params.encounterId ? {
          encounter_id: params.encounterId,
          encounter_type: params.encounterType || 'CONSULTATION',
          encounter_date: new Date().toISOString(),
        } : undefined,
        pharmacy: {
          medication_id: params.medicationId,
          medication_name: params.medicationName,
          quantity: params.quantity,
          unit: params.unit,
          batch_number: params.batchNumber,
        },
      },
      businessReferences: [
        { entity_type: 'medication', entity_id: params.medicationId },
        ...(params.encounterId ? [{ entity_type: 'encounter', entity_id: params.encounterId }] : []),
      ],
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }
  
  /**
   * Publish MEDICATION_STOCK_RECEIVED event
   * 
   * Triggered when: Medication stock received from supplier
   * Finance Impact: Inventory + AP
   */
  async publishMedicationStockReceived(params: MedicationStockReceivedParams): Promise<FinanceOutboxWriteResult> {
    return this.outboxWriter.writeToOutbox({
      eventType: 'MEDICATION_STOCK_RECEIVED',
      tenantId: params.tenantId,
      amount: params.amount,
      currency: params.currency,
      businessContext: {
        pharmacy: {
          medication_id: params.medicationId,
          medication_name: params.medicationName,
          quantity: params.quantity,
          unit: params.unit,
          batch_number: params.batchNumber,
        },
        procurement: {
          purchase_order_id: params.purchaseOrderId,
          supplier_id: params.supplierId,
          supplier_name: params.supplierName,
          goods_receipt_id: params.goodsReceiptId,
        },
      },
      businessReferences: [
        { entity_type: 'purchase_order', entity_id: params.purchaseOrderId || 'DIRECT' },
        { entity_type: 'goods_receipt', entity_id: params.goodsReceiptId },
      ],
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }
  
  // ========== Flow H3: Procurement → AP → Payment ==========
  
  /**
   * Publish SUPPLIER_PREPAYMENT_MADE event
   * 
   * Triggered when: Prepayment made to supplier
   * Finance Impact: Vendor Prepayment + Cash reduction
   */
  async publishSupplierPrepaymentMade(params: SupplierPrepaymentMadeParams): Promise<FinanceOutboxWriteResult> {
    return this.outboxWriter.writeToOutbox({
      eventType: 'SUPPLIER_PREPAYMENT_MADE',
      tenantId: params.tenantId,
      amount: params.amount,
      currency: params.currency,
      businessContext: {
        procurement: {
          purchase_order_id: params.purchaseOrderId,
          supplier_id: params.supplierId,
          supplier_name: params.supplierName,
        },
      },
      businessReferences: [
        { entity_type: 'purchase_order', entity_id: params.purchaseOrderId },
        { entity_type: 'supplier', entity_id: params.supplierId },
      ],
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }
  
  /**
   * Publish SUPPLIER_PAYMENT_MADE event
   * 
   * Triggered when: Payment made to supplier (AP settlement)
   * Finance Impact: AP reduction + Cash reduction
   */
  async publishSupplierPaymentMade(params: SupplierPaymentMadeParams): Promise<FinanceOutboxWriteResult> {
    return this.outboxWriter.writeToOutbox({
      eventType: 'SUPPLIER_PAYMENT_MADE',
      tenantId: params.tenantId,
      amount: params.amount,
      currency: params.currency,
      businessContext: {
        procurement: {
          supplier_id: params.supplierId,
          supplier_name: params.supplierName,
          goods_receipt_id: params.goodsReceiptId,
        },
        billing: {
          bill_id: params.invoiceId,
          bill_date: params.invoiceDate || new Date().toISOString(),
          payer_type: 'PATIENT', // Placeholder
        },
      },
      businessReferences: [
        { entity_type: 'supplier_invoice', entity_id: params.invoiceId },
        ...(params.goodsReceiptId ? [{ entity_type: 'goods_receipt', entity_id: params.goodsReceiptId }] : []),
      ],
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }
  
  // ========== Flow H4: Insurance (Complex Scenario) ==========
  
  /**
   * Publish INSURANCE_SERVICE_COMPLETED event
   * 
   * Triggered when: Service completed with insurance coverage
   * Finance Impact: Revenue + AR (Insurance)
   */
  async publishInsuranceServiceCompleted(params: InsuranceServiceCompletedParams): Promise<FinanceOutboxWriteResult> {
    return this.outboxWriter.writeToOutbox({
      eventType: 'INSURANCE_SERVICE_COMPLETED',
      tenantId: params.tenantId,
      amount: params.amount, // Insurance-covered portion
      currency: params.currency,
      businessContext: {
        patient: {
          patient_id: params.patientId,
          patient_type: params.patientType || 'INPATIENT',
        },
        encounter: {
          encounter_id: params.encounterId,
          encounter_type: params.encounterType || 'ADMISSION',
          encounter_date: params.encounterDate || new Date().toISOString(),
        },
        service: {
          service_id: params.serviceId,
          service_type: params.serviceType || 'PROCEDURE',
          service_code: params.serviceCode,
        },
        billing: {
          bill_id: params.billId,
          bill_date: params.billDate || new Date().toISOString(),
          payer_type: 'INSURANCE',
          insurance_plan_id: params.insurancePlanId,
        },
      },
      businessReferences: [
        { entity_type: 'encounter', entity_id: params.encounterId },
        { entity_type: 'bill', entity_id: params.billId },
      ],
      idempotencyKey: params.idempotencyKey,
      metadata: params.metadata,
    });
  }
  
  /**
   * Publish INSURANCE_SETTLEMENT_RECEIVED event
   * 
   * Triggered when: Insurance payment received
   * Finance Impact: Cash + AR (Insurance) settlement
   */
  async publishInsuranceSettlementReceived(params: InsuranceSettlementReceivedParams): Promise<FinanceOutboxWriteResult> {
    return this.outboxWriter.writeToOutbox({
      eventType: 'INSURANCE_SETTLEMENT_RECEIVED',
      tenantId: params.tenantId,
      amount: params.settledAmount, // Actual settlement (may differ from claim)
      currency: params.currency,
      businessContext: {
        patient: {
          patient_id: params.patientId,
          patient_type: params.patientType || 'INPATIENT',
        },
        billing: {
          bill_id: params.billId,
          bill_date: params.billDate || new Date().toISOString(),
          payer_type: 'INSURANCE',
          insurance_plan_id: params.insurancePlanId,
        },
      },
      businessReferences: [
        { entity_type: 'insurance_claim', entity_id: params.claimId },
        { entity_type: 'bill', entity_id: params.billId },
      ],
      idempotencyKey: params.idempotencyKey,
      metadata: {
        ...params.metadata,
        claim_id: params.claimId,
        claimed_amount: params.claimedAmount,
        settled_amount: params.settledAmount,
        adjustment_amount: params.adjustmentAmount,
        adjustment_reason: params.adjustmentReason,
      },
    });
  }
}

// ========== Parameter Types ==========

interface BaseFinanceEventParams {
  tenantId: string;
  amount: string;
  currency: string;
  idempotencyKey?: string;
  correlationId?: string;
  metadata?: Record<string, unknown>;
}

export interface PatientServiceCompletedParams extends BaseFinanceEventParams {
  patientId: string;
  patientType?: 'INPATIENT' | 'OUTPATIENT' | 'EMERGENCY';
  encounterId: string;
  encounterType?: 'CONSULTATION' | 'ADMISSION' | 'PROCEDURE' | 'EMERGENCY';
  encounterDate?: string;
  providerId?: string;
  serviceId: string;
  serviceType?: 'CONSULTATION' | 'PROCEDURE' | 'LAB' | 'IMAGING' | 'PHARMACY';
  serviceCode?: string;
  quantity?: number;
}

export interface PatientPaymentReceivedParams extends BaseFinanceEventParams {
  patientId: string;
  patientType?: 'INPATIENT' | 'OUTPATIENT' | 'EMERGENCY';
  billId: string;
  billDate?: string;
}

export interface PatientRefundIssuedParams extends BaseFinanceEventParams {
  patientId: string;
  patientType?: 'INPATIENT' | 'OUTPATIENT' | 'EMERGENCY';
  billId: string;
  billDate?: string;
  refundId: string;
  refundReason?: string;
}

export interface MedicationDispensedParams extends BaseFinanceEventParams {
  medicationId: string;
  medicationName: string;
  quantity: number;
  unit: string;
  batchNumber?: string;
  patientId?: string;
  patientType?: 'INPATIENT' | 'OUTPATIENT' | 'EMERGENCY';
  encounterId?: string;
  encounterType?: 'CONSULTATION' | 'ADMISSION' | 'PROCEDURE' | 'EMERGENCY';
}

export interface MedicationStockReceivedParams extends BaseFinanceEventParams {
  medicationId: string;
  medicationName: string;
  quantity: number;
  unit: string;
  batchNumber?: string;
  purchaseOrderId?: string;
  supplierId: string;
  supplierName?: string;
  goodsReceiptId: string;
}

export interface SupplierPrepaymentMadeParams extends BaseFinanceEventParams {
  purchaseOrderId: string;
  supplierId: string;
  supplierName?: string;
}

export interface SupplierPaymentMadeParams extends BaseFinanceEventParams {
  supplierId: string;
  supplierName?: string;
  invoiceId: string;
  invoiceDate?: string;
  goodsReceiptId?: string;
}

export interface InsuranceServiceCompletedParams extends BaseFinanceEventParams {
  patientId: string;
  patientType?: 'INPATIENT' | 'OUTPATIENT' | 'EMERGENCY';
  encounterId: string;
  encounterType?: 'CONSULTATION' | 'ADMISSION' | 'PROCEDURE' | 'EMERGENCY';
  encounterDate?: string;
  serviceId: string;
  serviceType?: 'CONSULTATION' | 'PROCEDURE' | 'LAB' | 'IMAGING';
  serviceCode?: string;
  billId: string;
  billDate?: string;
  insurancePlanId: string;
}

export interface InsuranceSettlementReceivedParams extends BaseFinanceEventParams {
  patientId: string;
  patientType?: 'INPATIENT' | 'OUTPATIENT' | 'EMERGENCY';
  billId: string;
  billDate?: string;
  insurancePlanId: string;
  claimId: string;
  claimedAmount: string;
  settledAmount: string;
  adjustmentAmount?: string;
  adjustmentReason?: string;
}
