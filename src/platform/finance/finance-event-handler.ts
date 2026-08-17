/**
 * F5.6 C7-H1 Hospital Finance Integration — Finance OS Event Handler
 * 
 * Receives events from Vertical OS and processes them through Finance OS layers:
 * 1. Semantic Resolution (C.2)
 * 2. Intent Generation (C.2)
 * 3. Policy Context (A.4)
 * 4. COA Resolution (C.3)
 * 5. Posting Instruction Generation
 * 6. F1-F4 Kernel Persistence
 * 
 * Architecture:
 * - Vertical OS: Business events
 * - Finance OS: Financial meaning (THIS LAYER)
 * - F1-F4 Kernel: Immutable truth
 * 
 * @see docs/architecture/F5_6_C7_H1_HOSPITAL_FINANCE_INTEGRATION.md
 * @see docs/architecture/F5_6_C2_ACCOUNTING_INTENT_BOUNDARY.md
 * @see docs/architecture/F5_6_C3_TENANT_COA_BOUNDARY.md
 */

import {
  FinanceEventEnvelope,
  FinanceEventResult,
  IdempotencyEntry,
} from '../integration-hub/finance-event-contract.types';

/**
 * Finance Event Handler
 * 
 * Processes finance events from Vertical OS
 * 
 * Flow:
 * ```
 * Vertical Event
 *     ↓
 * Idempotency Check
 *     ↓
 * Semantic Resolution (C.2)
 *     ↓
 * Intent Generation (C.2)
 *     ↓
 * Policy Context (A.4)
 *     ↓
 * COA Resolution (C.3)
 *     ↓
 * Posting Instruction
 *     ↓
 * F1-F4 Kernel
 *     ↓
 * Finance Event Result
 * ```
 */
export class FinanceEventHandler {
  constructor(
    private semanticResolver: SemanticResolver,
    private intentGenerator: IntentGenerator,
    private policyContextResolver: PolicyContextResolver,
    private coaResolver: COAResolver,
    private kernelClient: FinanceKernelClient,
    private idempotencyStore: IdempotencyStore
  ) {}
  
  /**
   * Handle finance event
   * 
   * @param envelope Finance event envelope from Vertical OS
   * @returns Finance event result
   */
  async handle(envelope: FinanceEventEnvelope): Promise<FinanceEventResult> {
    try {
      // Step 1: Check idempotency
      const existingEntry = await this.idempotencyStore.get(envelope.idempotency_key);
      if (existingEntry) {
        return {
          event_id: envelope.event_id,
          idempotency_key: envelope.idempotency_key,
          status: 'ALREADY_PROCESSED',
          transaction_id: existingEntry.transaction_id,
          processed_at: existingEntry.created_at,
        };
      }
      
      // Step 2: Semantic Resolution (C.2)
      const semantic = await this.semanticResolver.resolve(envelope);
      
      // Step 3: Intent Generation (C.2)
      const intents = await this.intentGenerator.generate(semantic, envelope);
      
      // Step 4: Policy Context Resolution (A.4)
      const policyContext = await this.policyContextResolver.resolve(
        envelope.tenant_id,
        envelope.occurred_at
      );
      
      // Step 5: COA Resolution (C.3)
      const accountMappings = await this.coaResolver.resolve(
        envelope.tenant_id,
        intents,
        policyContext
      );
      
      // Step 6: Generate Posting Instruction
      const postingInstruction = this.generatePostingInstruction(
        envelope,
        intents,
        accountMappings,
        semantic,
        policyContext
      );
      
      // Step 7: Persist to F1-F4 Kernel
      const transaction = await this.kernelClient.persist(postingInstruction);
      
      // Step 8: Store idempotency entry
      console.log('[Handler] About to store idempotency:', {
        idempotencyStoreType: this.idempotencyStore?.constructor?.name,
        hasStore: typeof this.idempotencyStore?.store,
        store: this.idempotencyStore,
      });
      
      await this.idempotencyStore.store({
        idempotency_key: envelope.idempotency_key,
        event_id: envelope.event_id,
        transaction_id: transaction.transaction_id,
        status: 'COMPLETED',
        created_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
        tenant_id: envelope.tenant_id,
      });
      
      // Step 9: Return result
      return {
        event_id: envelope.event_id,
        idempotency_key: envelope.idempotency_key,
        status: 'CREATED',
        transaction_id: transaction.transaction_id,
        processed_at: new Date().toISOString(),
        metadata: {
          semantic: semantic.canonical_semantic,
          intents: intents.map(i => i.intent_type),
          policy_version: policyContext.version,
        },
      };
      
    } catch (error) {
      // Error handling
      return {
        event_id: envelope.event_id,
        idempotency_key: envelope.idempotency_key,
        status: 'FAILED',
        error: error instanceof Error ? error.message : 'Unknown error',
        processed_at: new Date().toISOString(),
      };
    }
  }
  
  /**
   * Generate posting instruction (balanced entries)
   */
  private generatePostingInstruction(
    envelope: FinanceEventEnvelope,
    intents: AccountingIntent[],
    accountMappings: AccountMapping[],
    semantic?: CanonicalSemantic,
    policyContext?: PolicyContext
  ): PostingInstruction {
    const entries: JournalEntry[] = [];
    
    // Generate entries from intents
    for (const intent of intents) {
      const mapping = accountMappings.find(m => m.intent_type === intent.intent_type);
      if (!mapping) {
        throw new Error(`No account mapping found for intent: ${intent.intent_type}`);
      }
      
      entries.push({
        account_id: mapping.account_code,
        debit: intent.debit_amount || '0',
        credit: intent.credit_amount || '0',
        description: intent.description,
      });
    }
    
    // Validate balance
    const totalDebit = entries.reduce((sum, e) => sum + parseFloat(e.debit), 0);
    const totalCredit = entries.reduce((sum, e) => sum + parseFloat(e.credit), 0);
    
    if (Math.abs(totalDebit - totalCredit) > 0.01) {
      throw new Error(`Posting instruction not balanced: debit=${totalDebit}, credit=${totalCredit}`);
    }
    
    return {
      tenant_id: envelope.tenant_id,
      transaction_date: envelope.occurred_at,
      entries,
      source_event_id: envelope.event_id,
      source_system: envelope.source_system,
      correlation_id: envelope.correlation_id,
      business_context: envelope.business_context,
      business_references: envelope.business_references,
      metadata: {
        canonical_semantic: semantic?.canonical_semantic,
        semantic_category: semantic?.semantic_category,
        accounting_intents: intents,
        policy_version: policyContext?.version,
        policy_regime: policyContext?.regime,
        coa_version: 'v1.0',
        account_mappings: accountMappings,
        source_version: envelope.source_version,
      },
    };
  }
}

// ========== Supporting Types ==========

/**
 * Canonical Semantic (C.2)
 * 
 * Result of semantic resolution
 */
export interface CanonicalSemantic {
  canonical_semantic: string; // e.g., "PATIENT_SERVICE_REVENUE"
  semantic_category: string; // e.g., "REVENUE"
  description: string;
}

/**
 * Accounting Intent (C.2)
 * 
 * What to recognize financially
 */
export interface AccountingIntent {
  intent_type: string; // e.g., "RECOGNIZE_REVENUE"
  debit_amount?: string;
  credit_amount?: string;
  description: string;
}

/**
 * Policy Context (A.4)
 * 
 * Policy version and rules applicable at event time
 */
export interface PolicyContext {
  version: string; // e.g., "v1.0"
  regime: string; // e.g., "TT133"
  recognition_rules: Record<string, unknown>;
}

/**
 * Account Mapping (C.3)
 * 
 * Intent → Account Code resolution
 */
export interface AccountMapping {
  intent_type: string;
  account_code: string;
  account_name: string;
}

/**
 * Journal Entry
 */
export interface JournalEntry {
  account_id: string;
  debit: string;
  credit: string;
  description?: string;
}

/**
 * Posting Instruction
 * 
 * Sent to F1-F4 Kernel for persistence
 */
export interface PostingInstruction {
  tenant_id: string;
  transaction_date: string;
  entries: JournalEntry[];
  source_event_id: string;
  source_system: string;
  correlation_id: string;
  business_context: unknown;
  business_references: unknown[];
  metadata?: {
    canonical_semantic?: string;
    semantic_category?: string;
    accounting_intents?: AccountingIntent[];
    policy_version?: string;
    policy_regime?: string;
    coa_version?: string;
    account_mappings?: AccountMapping[];
    source_version?: string;
  };
}

/**
 * Finance Transaction (from Kernel)
 */
export interface FinanceTransaction {
  transaction_id: string;
  status: 'COMMITTED' | 'PENDING' | 'FAILED';
}

// ========== Service Interfaces ==========

/**
 * Semantic Resolver (C.2)
 * 
 * Resolves business event → canonical semantic
 */
export interface SemanticResolver {
  resolve(envelope: FinanceEventEnvelope): Promise<CanonicalSemantic>;
}

/**
 * Intent Generator (C.2)
 * 
 * Generates accounting intents from semantic
 */
export interface IntentGenerator {
  generate(semantic: CanonicalSemantic, envelope: FinanceEventEnvelope): Promise<AccountingIntent[]>;
}

/**
 * Policy Context Resolver (A.4)
 * 
 * Resolves policy version applicable at event time
 */
export interface PolicyContextResolver {
  resolve(tenantId: string, occurredAt: string): Promise<PolicyContext>;
}

/**
 * COA Resolver (C.3)
 * 
 * Resolves intent → account code for tenant
 */
export interface COAResolver {
  resolve(
    tenantId: string,
    intents: AccountingIntent[],
    policyContext: PolicyContext
  ): Promise<AccountMapping[]>;
}

/**
 * Finance Kernel Client (F1-F4)
 * 
 * Persists posting instructions to Kernel
 */
export interface FinanceKernelClient {
  persist(instruction: PostingInstruction): Promise<FinanceTransaction>;
}

/**
 * Idempotency Store
 * 
 * Stores idempotency keys to prevent duplicate processing
 */
export interface IdempotencyStore {
  get(key: string): Promise<IdempotencyEntry | null>;
  store(entry: IdempotencyEntry): Promise<void>;
}
