/**
 * F5.6 C7-H1 Finance OS — Finance Kernel Client Implementation
 * 
 * Wraps F1-F4 Finance Kernel (Ledger Engine) for Finance OS
 * 
 * Architecture Boundary:
 * - Input: Posting instruction (balanced entries)
 * - Output: Finance transaction (from Kernel)
 * 
 * Responsibilities:
 * - Convert posting instruction → PostTransactionRequest (Kernel format)
 * - Call existing Ledger Engine
 * - Handle Kernel responses/errors
 * 
 * Does NOT:
 * - Modify Kernel
 * - Validate business logic (that's Finance OS responsibility)
 * - Resolve semantic/intent/COA (done upstream)
 * 
 * @see src/platform/finance/engines/ledger-engine
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { LedgerEngineService } from '../engines/ledger-engine/ledger.service';
import type { PostTransactionRequest } from '../contracts/ledger-engine.contract';
import type { FinanceKernelClient, PostingInstruction, FinanceTransaction } from '../finance-event-handler';

/**
 * Default Finance Kernel Client
 * 
 * Wraps existing F1-F4 Ledger Engine
 * 
 * Converts Finance OS posting instruction → Kernel transaction request
 */
export class DefaultFinanceKernelClient implements FinanceKernelClient {
  private readonly ledger: LedgerEngineService;

  constructor(supabase: SupabaseClient<Database>) {
    this.ledger = new LedgerEngineService(supabase);
  }
  
  /**
   * Persist posting instruction to F1-F4 Kernel
   * 
   * @param instruction Posting instruction (from Finance OS)
   * @returns Finance transaction (from Kernel)
   */
  async persist(instruction: PostingInstruction): Promise<FinanceTransaction> {
    const kernelRequest = await this.convertToKernelRequest(instruction);

    const response = await this.ledger.postTransaction(kernelRequest);

    if (!response.success || !response.data) {
      throw new KernelPersistenceError(
        `Failed to post Finance OS ledger transaction: ${response.error?.message ?? 'unknown ledger error'}`,
        instruction,
        response.error
      );
    }

    return {
      transaction_id: response.data.id,
      status: 'COMMITTED',
    };
  }
  
  /**
   * Convert posting instruction → Finance OS canonical ledger request format
   * 
   * CRITICAL:
   * - source_id uses source_event_id because F5 F1_GL:v1 casts it to UUID.
   * - account_id in PostingInstruction is the resolved account code.
   * - amounts are preserved as minor-unit integer strings for LedgerEngineService.
   */
  private async convertToKernelRequest(instruction: PostingInstruction): Promise<PostTransactionRequest> {
    return {
      tenant_id: instruction.tenant_id,
      idempotency_key: instruction.source_event_id,
      source_type: 'FINANCE_EVENT',
      source_id: instruction.source_event_id,
      transaction_type: 'ACCRUAL',
      posted_at: new Date(instruction.transaction_date),
      transaction_currency: instruction.currency,
      functional_currency: instruction.currency,
      description: `${this.generateDescription(instruction)} [Event: ${instruction.source_event_id}]`,
      reference_type: 'FINANCE_EVENT',
      reference_id: instruction.source_event_id,
      lines: instruction.entries.map((entry) => ({
        account_code: entry.account_id,
        debit_amount_minor: normalizeMinorAmount(entry.debit),
        credit_amount_minor: normalizeMinorAmount(entry.credit),
        memo: entry.description || '',
      })),
    };
  }
  
  /**
   * Generate transaction description
   */
  private generateDescription(instruction: PostingInstruction): string {
    const context = instruction.business_context as Record<string, unknown>;
    
    // Try to extract meaningful description from business context
    if (context?.patient) {
      const patient = context.patient as Record<string, unknown>;
      return `Patient service (${patient.patient_id})`;
    }
    
    if (context?.pharmacy) {
      const pharmacy = context.pharmacy as Record<string, unknown>;
      return `Medication: ${pharmacy.medication_name}`;
    }
    
    if (context?.procurement) {
      const procurement = context.procurement as Record<string, unknown>;
      return `Supplier: ${procurement.supplier_name || 'N/A'}`;
    }
    
    return `Finance transaction (${instruction.source_system})`;
  }
}

function normalizeMinorAmount(amount: string): string {
  if (/^\d+$/.test(amount)) {
    return amount;
  }

  const parsed = Number(amount);
  if (!Number.isFinite(parsed) || parsed < 0) {
    throw new Error(`INVALID_LEDGER_AMOUNT: ${amount}`);
  }

  if (!Number.isInteger(parsed)) {
    throw new Error(`INVALID_LEDGER_MINOR_UNIT_AMOUNT: ${amount}`);
  }

  return parsed.toString();
}

/**
 * Kernel Persistence Error
 * 
 * Thrown when Kernel fails to persist transaction
 */
export class KernelPersistenceError extends Error {
  constructor(
    message: string,
    public readonly instruction: PostingInstruction,
    public readonly kernelError?: { code: string; message: string }
  ) {
    super(message);
    this.name = 'KernelPersistenceError';
  }
}
