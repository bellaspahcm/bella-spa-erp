/**
 * F5.6 C7-H1 Finance OS — Semantic Resolver Implementation
 * 
 * Resolves business events → Canonical Financial Semantic (C.2)
 * 
 * Architecture Boundary:
 * - Input: Business event from Vertical OS (Hospital, Beauty, etc.)
 * - Output: Canonical semantic (regime-independent)
 * 
 * CRITICAL: Semantic resolution is REGIME-NEUTRAL
 * - Does NOT contain TT99/TT133 specific logic
 * - Does NOT contain account codes
 * - ONLY resolves financial meaning
 * 
 * @see docs/architecture/F5_6_C2_ACCOUNTING_INTENT_BOUNDARY.md
 */

import type { SemanticResolver, CanonicalSemantic } from '../finance-event-handler';
import type { FinanceEventEnvelope } from '../../integration-hub/finance-event-contract.types';

/**
 * Default Semantic Resolver
 * 
 * Maps Vertical OS event types → Canonical Financial Semantic
 * 
 * Example:
 * - PATIENT_SERVICE_COMPLETED → PATIENT_SERVICE_REVENUE
 * - MEDICATION_DISPENSED → INVENTORY_CONSUMED
 * - SUPPLIER_PAYMENT_MADE → CASH_PAYMENT
 */
export class DefaultSemanticResolver implements SemanticResolver {
  /**
   * Semantic mapping table (regime-neutral)
   * 
   * Key: Vertical OS event type
   * Value: Canonical semantic + category
   */
  private readonly semanticMappings: Record<string, CanonicalSemantic> = {
    // ========== Hospital: Patient Service & Revenue ==========
    'PATIENT_SERVICE_COMPLETED': {
      canonical_semantic: 'PATIENT_SERVICE_REVENUE',
      semantic_category: 'REVENUE',
      description: 'Patient service revenue recognition (outpatient/inpatient)',
    },
    
    'PATIENT_PAYMENT_RECEIVED': {
      canonical_semantic: 'CASH_RECEIPT',
      semantic_category: 'CASH',
      description: 'Cash receipt from patient payment',
    },
    
    'PATIENT_REFUND_ISSUED': {
      canonical_semantic: 'CASH_REFUND',
      semantic_category: 'CASH',
      description: 'Cash refund to patient (service cancellation/overpayment)',
    },
    
    // ========== Hospital: Pharmacy & Inventory ==========
    'MEDICATION_DISPENSED': {
      canonical_semantic: 'INVENTORY_CONSUMED',
      semantic_category: 'COGS',
      description: 'Inventory consumed (medication dispensed to patient)',
    },
    
    'MEDICATION_STOCK_RECEIVED': {
      canonical_semantic: 'INVENTORY_PURCHASE',
      semantic_category: 'INVENTORY',
      description: 'Inventory purchase (medication stock received from supplier)',
    },
    
    // ========== Hospital: Procurement & Supplier ==========
    'SUPPLIER_PREPAYMENT_MADE': {
      canonical_semantic: 'VENDOR_PREPAYMENT',
      semantic_category: 'PREPAYMENT',
      description: 'Vendor prepayment (advance payment to supplier)',
    },
    
    'SUPPLIER_PAYMENT_MADE': {
      canonical_semantic: 'CASH_PAYMENT',
      semantic_category: 'CASH',
      description: 'Cash payment to supplier (AP settlement)',
    },
    
    'GOODS_RECEIVED': {
      canonical_semantic: 'INVENTORY_PURCHASE',
      semantic_category: 'INVENTORY',
      description: 'Goods received from supplier (inventory + AP)',
    },
    
    // ========== Hospital: Insurance ==========
    'INSURANCE_SERVICE_COMPLETED': {
      canonical_semantic: 'INSURANCE_SERVICE_REVENUE',
      semantic_category: 'REVENUE',
      description: 'Insurance-covered service revenue recognition',
    },
    
    'INSURANCE_CLAIM_SUBMITTED': {
      canonical_semantic: 'INSURANCE_CLAIM',
      semantic_category: 'RECEIVABLE',
      description: 'Insurance claim submitted (no financial transaction, tracking only)',
    },
    
    'INSURANCE_SETTLEMENT_RECEIVED': {
      canonical_semantic: 'INSURANCE_PAYMENT',
      semantic_category: 'CASH',
      description: 'Insurance payment received (claim settlement)',
    },
    
    // ========== Future: Beauty OS ==========
    // 'BEAUTY_SERVICE_COMPLETED': {
    //   canonical_semantic: 'SERVICE_REVENUE',
    //   semantic_category: 'REVENUE',
    //   description: 'Beauty service revenue',
    // },
    
    // ========== Future: Retail OS ==========
    // 'PRODUCT_SALE_COMPLETED': {
    //   canonical_semantic: 'PRODUCT_SALE_REVENUE',
    //   semantic_category: 'REVENUE',
    //   description: 'Product sale revenue',
    // },
  };
  
  /**
   * Resolve business event → Canonical semantic
   * 
   * @param envelope Finance event envelope from Vertical OS
   * @returns Canonical semantic (regime-independent)
   * @throws Error if event type is unknown
   */
  async resolve(envelope: FinanceEventEnvelope): Promise<CanonicalSemantic> {
    const semantic = this.semanticMappings[envelope.event_type];
    
    if (!semantic) {
      throw new SemanticResolutionError(
        `Unknown event type: ${envelope.event_type}`,
        envelope.event_type,
        envelope.source_system
      );
    }
    
    // Log for observability
    console.log('[SemanticResolver] Resolved:', {
      event_type: envelope.event_type,
      canonical_semantic: semantic.canonical_semantic,
      category: semantic.semantic_category,
      source_system: envelope.source_system,
      tenant_id: envelope.tenant_id,
    });
    
    return semantic;
  }
  
  /**
   * Get all supported event types
   * 
   * Useful for documentation and validation
   */
  getSupportedEventTypes(): string[] {
    return Object.keys(this.semanticMappings);
  }
  
  /**
   * Check if event type is supported
   */
  isEventTypeSupported(eventType: string): boolean {
    return eventType in this.semanticMappings;
  }
}

/**
 * Semantic Resolution Error
 * 
 * Thrown when event type cannot be resolved to canonical semantic
 */
export class SemanticResolutionError extends Error {
  constructor(
    message: string,
    public readonly eventType: string,
    public readonly sourceSystem: string
  ) {
    super(message);
    this.name = 'SemanticResolutionError';
  }
}
