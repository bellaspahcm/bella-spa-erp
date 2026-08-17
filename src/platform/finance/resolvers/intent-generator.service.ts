/**
 * F5.6 C7-H1 Finance OS — Intent Generator Implementation
 * 
 * Generates Accounting Intents from Canonical Semantic (C.2)
 * 
 * Architecture Boundary:
 * - Input: Canonical semantic + event envelope
 * - Output: Accounting intents (what to recognize)
 * 
 * CRITICAL: Intent generation is REGIME-NEUTRAL
 * - Does NOT contain TT99/TT133 specific logic
 * - Does NOT contain account codes (that's COA resolver)
 * - ONLY defines financial recognition actions
 * 
 * Intent Types:
 * - RECOGNIZE_REVENUE
 * - RECOGNIZE_RECEIVABLE
 * - RECOGNIZE_CASH
 * - SETTLE_RECEIVABLE
 * - RECOGNIZE_COGS
 * - REDUCE_INVENTORY
 * - RECOGNIZE_INVENTORY
 * - RECOGNIZE_PAYABLE
 * - SETTLE_PAYABLE
 * - RECOGNIZE_PREPAYMENT
 * - REDUCE_CASH
 * 
 * @see docs/architecture/F5_6_C2_ACCOUNTING_INTENT_BOUNDARY.md
 */

import type { IntentGenerator, CanonicalSemantic, AccountingIntent } from '../finance-event-handler';
import type { FinanceEventEnvelope } from '../../integration-hub/finance-event-contract.types';

/**
 * Default Intent Generator
 * 
 * Generates balanced accounting intents from canonical semantic
 * 
 * Example:
 * - PATIENT_SERVICE_REVENUE → [RECOGNIZE_REVENUE (Cr), RECOGNIZE_RECEIVABLE (Dr)]
 * - CASH_RECEIPT → [RECOGNIZE_CASH (Dr), SETTLE_RECEIVABLE (Cr)]
 * - INVENTORY_CONSUMED → [RECOGNIZE_COGS (Dr), REDUCE_INVENTORY (Cr)]
 */
export class DefaultIntentGenerator implements IntentGenerator {
  /**
   * Generate accounting intents from semantic
   * 
   * @param semantic Canonical semantic
   * @param envelope Finance event envelope (for amount, etc.)
   * @returns Array of accounting intents (always balanced)
   */
  async generate(
    semantic: CanonicalSemantic,
    envelope: FinanceEventEnvelope
  ): Promise<AccountingIntent[]> {
    // Route to specific generator based on semantic
    switch (semantic.canonical_semantic) {
      // ========== Revenue Recognition ==========
      case 'PATIENT_SERVICE_REVENUE':
      case 'INSURANCE_SERVICE_REVENUE':
        return this.generateRevenueRecognitionIntents(envelope);
      
      // ========== Cash Receipt ==========
      case 'CASH_RECEIPT':
      case 'INSURANCE_PAYMENT':
        return this.generateCashReceiptIntents(envelope);
      
      // ========== Cash Refund ==========
      case 'CASH_REFUND':
        return this.generateCashRefundIntents(envelope);
      
      // ========== Inventory Consumed (COGS) ==========
      case 'INVENTORY_CONSUMED':
        return this.generateInventoryConsumedIntents(envelope);
      
      // ========== Inventory Purchase ==========
      case 'INVENTORY_PURCHASE':
        return this.generateInventoryPurchaseIntents(envelope);
      
      // ========== Vendor Prepayment ==========
      case 'VENDOR_PREPAYMENT':
        return this.generateVendorPrepaymentIntents(envelope);
      
      // ========== Cash Payment (AP Settlement) ==========
      case 'CASH_PAYMENT':
        return this.generateCashPaymentIntents(envelope);
      
      // ========== Insurance Claim (No Financial Transaction) ==========
      case 'INSURANCE_CLAIM':
        // Claims are tracked but don't generate financial transactions
        // Revenue already recognized on service completion
        return [];
      
      default:
        throw new IntentGenerationError(
          `No intent generator for semantic: ${semantic.canonical_semantic}`,
          semantic.canonical_semantic
        );
    }
  }
  
  /**
   * Revenue Recognition Intents
   * 
   * Dr. AR (Patient/Insurance)
   * Cr. Revenue
   */
  private generateRevenueRecognitionIntents(envelope: FinanceEventEnvelope): AccountingIntent[] {
    return [
      {
        intent_type: 'RECOGNIZE_RECEIVABLE',
        debit_amount: envelope.amount,
        description: `Recognize receivable: ${envelope.business_context.service?.service_type || 'service'}`,
      },
      {
        intent_type: 'RECOGNIZE_REVENUE',
        credit_amount: envelope.amount,
        description: `Recognize revenue: ${envelope.business_context.service?.service_type || 'service'}`,
      },
    ];
  }
  
  /**
   * Cash Receipt Intents (AR Settlement)
   * 
   * Dr. Cash
   * Cr. AR
   */
  private generateCashReceiptIntents(envelope: FinanceEventEnvelope): AccountingIntent[] {
    return [
      {
        intent_type: 'RECOGNIZE_CASH',
        debit_amount: envelope.amount,
        description: 'Recognize cash receipt',
      },
      {
        intent_type: 'SETTLE_RECEIVABLE',
        credit_amount: envelope.amount,
        description: 'Settle accounts receivable',
      },
    ];
  }
  
  /**
   * Cash Refund Intents
   * 
   * Dr. Revenue (reversal)
   * Cr. Cash
   */
  private generateCashRefundIntents(envelope: FinanceEventEnvelope): AccountingIntent[] {
    return [
      {
        intent_type: 'REVERSE_REVENUE',
        debit_amount: envelope.amount,
        description: `Revenue reversal: ${envelope.metadata?.refund_reason || 'refund'}`,
      },
      {
        intent_type: 'REDUCE_CASH',
        credit_amount: envelope.amount,
        description: 'Cash refund',
      },
    ];
  }
  
  /**
   * Inventory Consumed Intents (Medication Dispensed)
   * 
   * Dr. COGS
   * Cr. Inventory
   */
  private generateInventoryConsumedIntents(envelope: FinanceEventEnvelope): AccountingIntent[] {
    const medication = envelope.business_context.pharmacy;
    return [
      {
        intent_type: 'RECOGNIZE_COGS',
        debit_amount: envelope.amount,
        description: `COGS: ${medication?.medication_name || 'medication'} (${medication?.quantity} ${medication?.unit})`,
      },
      {
        intent_type: 'REDUCE_INVENTORY',
        credit_amount: envelope.amount,
        description: `Inventory reduction: ${medication?.medication_name || 'medication'}`,
      },
    ];
  }
  
  /**
   * Inventory Purchase Intents (Stock Received)
   * 
   * Dr. Inventory
   * Cr. AP
   */
  private generateInventoryPurchaseIntents(envelope: FinanceEventEnvelope): AccountingIntent[] {
    const procurement = envelope.business_context.procurement;
    return [
      {
        intent_type: 'RECOGNIZE_INVENTORY',
        debit_amount: envelope.amount,
        description: `Inventory purchase: ${procurement?.supplier_name || 'supplier'}`,
      },
      {
        intent_type: 'RECOGNIZE_PAYABLE',
        credit_amount: envelope.amount,
        description: `AP: ${procurement?.supplier_name || 'supplier'}`,
      },
    ];
  }
  
  /**
   * Vendor Prepayment Intents
   * 
   * Dr. Prepayment
   * Cr. Cash
   */
  private generateVendorPrepaymentIntents(envelope: FinanceEventEnvelope): AccountingIntent[] {
    const procurement = envelope.business_context.procurement;
    return [
      {
        intent_type: 'RECOGNIZE_PREPAYMENT',
        debit_amount: envelope.amount,
        description: `Vendor prepayment: ${procurement?.supplier_name || 'supplier'}`,
      },
      {
        intent_type: 'REDUCE_CASH',
        credit_amount: envelope.amount,
        description: 'Cash payment (prepayment)',
      },
    ];
  }
  
  /**
   * Cash Payment Intents (AP Settlement)
   * 
   * Dr. AP
   * Cr. Cash
   */
  private generateCashPaymentIntents(envelope: FinanceEventEnvelope): AccountingIntent[] {
    const procurement = envelope.business_context.procurement;
    return [
      {
        intent_type: 'SETTLE_PAYABLE',
        debit_amount: envelope.amount,
        description: `AP settlement: ${procurement?.supplier_name || 'supplier'}`,
      },
      {
        intent_type: 'REDUCE_CASH',
        credit_amount: envelope.amount,
        description: 'Cash payment',
      },
    ];
  }
}

/**
 * Intent Generation Error
 * 
 * Thrown when intents cannot be generated for semantic
 */
export class IntentGenerationError extends Error {
  constructor(
    message: string,
    public readonly semantic: string
  ) {
    super(message);
    this.name = 'IntentGenerationError';
  }
}
