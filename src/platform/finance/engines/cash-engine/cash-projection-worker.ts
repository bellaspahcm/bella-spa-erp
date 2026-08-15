/**
 * Finance OS F2.2 — Cash Projection Worker
 *
 * Subscribes to F1 Ledger outbox v2 events (posted/reversed) and projects cash
 * candidates atomically to F2 Cash & Treasury database layer via trusted RPCs.
 *
 * Strict Architectural Guardrails Enforced:
 * - F2.2.1: Uses host eventBus singleton, no parallel scheduler/queue.
 * - F2.2.5: No direct SQL or ORM writes (RPC-only mutation).
 * - F2.2.9: Technical Identity (service_role) only for execution, not permissioning.
 * - F2.2.10: Case 1 (Ignore) vs Case 2 & 3 (Quarantine + Signal).
 * - F2.2.12: One transaction -> one PostgreSQL atomic boundary.
 * - TypeSafety-NoAny: Strict typing, zero any/implicit any.
 *
 * @module platform/finance/engines/cash-engine/cash-projection-worker
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import { eventBus } from '@/platform/host/event-bus';
import type {
  DomainEvent,
  FinanceTransactionPostedV2Payload,
  FinanceTransactionReversedV2Payload,
  CandidateCashLeg
} from '@/platform/host/event-bus/types';

export class CashProjectionWorker {
  private client: SupabaseClient<Database>;
  private unsubscribe: (() => void) | null = null;

  constructor(client: SupabaseClient<Database>) {
    this.client = client;
  }

  /**
   * Starts the worker by subscribing to F1 transaction posted and reversed v2 events.
   * Returns an unsubscribe callback for clean shutdown.
   */
  public start(): () => void {
    if (this.unsubscribe) {
      return this.unsubscribe;
    }

    const unsubPost = eventBus.subscribe<FinanceTransactionPostedV2Payload>(
      'finance.transaction.posted.v2',
      async (event) => {
        await this.handleEventSafe(
          event,
          async (ev) => this.handlePostedV2(ev)
        );
      }
    );

    const unsubRev = eventBus.subscribe<FinanceTransactionReversedV2Payload>(
      'finance.transaction.reversed.v2',
      async (event) => {
        await this.handleEventSafe(
          event,
          async (ev) => this.handleReversedV2(ev)
        );
      }
    );

    this.unsubscribe = () => {
      unsubPost();
      unsubRev();
      this.unsubscribe = null;
    };

    return this.unsubscribe;
  }

  /**
   * Helper to classify liquidity accounts (starts with '11')
   * In F3+ this can be swapped with metadata checks.
   */
  public classifyLiquidityAccount(accountCode: string): boolean {
    return accountCode.startsWith('11');
  }

  /**
   * Safe wrapper around handler to isolate transient errors (which are rethrown to trigger outbox retries)
   * from terminal errors (which are immediately quarantined and logged as security signals).
   */
  private async handleEventSafe<T extends { tenant_id: string; transaction_id: string; event_id: string }>(
    event: DomainEvent<T>,
    handler: (event: DomainEvent<T>) => Promise<void>
  ): Promise<void> {
    try {
      await handler(event);
    } catch (err: unknown) {
      const error = err as Error & { code?: string; isTerminal?: boolean; failureCode?: string };
      
      // Determine if error is terminal (should quarantine)
      const isTerminal = error.isTerminal || this.isPgTerminalError(error.code);

      if (isTerminal) {
        const failureCode = error.failureCode || error.code || 'TERMINAL_ERROR';
        const failureReason = error.message || 'Unknown terminal failure';

        // Case 3 (Security/Integrity) alerts get stderr logs with special prefix
        if (
          failureCode === 'SECURITY_TENANT_MISMATCH' || 
          failureCode === 'F2020' || // F1 transaction missing or tenant mismatch
          failureCode === 'F2001' || // Direct mutation guard
          failureCode === 'SECURITY_INTEGRITY_VIOLATION'
        ) {
          console.error(
            `[SECURITY_AUDIT_SIGNAL] Terminal security integrity violation detected: ${failureReason} [Event: ${event.eventId}, Tenant: ${event.tenantId}, F1-Tx: ${event.payload.transaction_id}]`
          );
        } else {
          console.error(
            `[CASH_PROJECTION_WORKER_TERMINAL] Event quarantined: ${failureReason} [Event: ${event.eventId}]`
          );
        }

        // Project the entire event to quarantine atomically
        await this.quarantineEvent(
          event.payload.tenant_id,
          event.payload.event_id,
          event.eventType,
          event.payload,
          failureReason,
          failureCode
        );
      } else {
        // Rethrow transient errors so the outbox dispatcher retry loop is activated
        console.error(
          `[CASH_PROJECTION_WORKER_TRANSIENT] Retryable exception encountered: ${error.message} [Event: ${event.eventId}]. Rethrowing...`
        );
        throw error;
      }
    }
  }

  /**
   * Detects PostgreSQL terminal error codes that should not be retried.
   */
  private isPgTerminalError(code?: string): boolean {
    if (!code) return false;
    // Common postgres terminal constraints/failures:
    // 22003 (Numeric value out of range), 23502 (Not null violation), 23503 (Foreign key violation),
    // 23505 (Unique violation — business layer check), 23514 (Check violation), 22023 (Invalid parameter)
    // F2xxx codes represent custom F2 RPC validation failures
    return (
      code.startsWith('22') ||
      code.startsWith('23') ||
      code.startsWith('F2') ||
      code.startsWith('A0') ||
      code.startsWith('T0') ||
      code.startsWith('Q0')
    );
  }

  /**
   * Handle posted.v2 event: projects candidate cash legs atomically.
   */
  private async handlePostedV2(event: DomainEvent<FinanceTransactionPostedV2Payload>): Promise<void> {
    const payload = event.payload;

    // A. Validate Event Envelope
    if (!payload.tenant_id || !payload.transaction_id || !payload.event_id) {
      throw this.createTerminalError(
        'Envelope missing mandatory identity fields',
        'ENVELOPE_INVALID'
      );
    }

    // B. Tenant match check (Event envelope vs host platform context)
    if (payload.tenant_id !== event.tenantId) {
      throw this.createTerminalError(
        `Event tenant context mismatch: Envelope tenant '${payload.tenant_id}' does not match context tenant '${event.tenantId}'`,
        'SECURITY_TENANT_MISMATCH'
      );
    }

    // C & D. Validate F1 origin, posted state, and tenant match in database
    const { data: f1Tx, error: f1Err } = await this.client
      .from('finance_transactions')
      .select('status, tenant_id')
      .eq('id', payload.transaction_id)
      .single();

    if (f1Err || !f1Tx) {
      // Transaction missing is a terminal failure (outbox processed but ledger transaction gone)
      throw this.createTerminalError(
        `Authoritative F1 Transaction not found in ledger: ${f1Err?.message || payload.transaction_id}`,
        'F2020'
      );
    }

    if (f1Tx.tenant_id !== payload.tenant_id) {
      throw this.createTerminalError(
        `Authoritative F1 tenant mismatch: Ledger header tenant '${f1Tx.tenant_id}' does not match event tenant '${payload.tenant_id}'`,
        'SECURITY_TENANT_MISMATCH'
      );
    }

    if (f1Tx.status !== 'POSTED') {
      throw this.createTerminalError(
        `Authoritative F1 transaction status is invalid: Expected 'POSTED', received '${f1Tx.status}'`,
        'SECURITY_INTEGRITY_VIOLATION'
      );
    }

    // E. Extract candidate legs and classify them (Case 1 vs Case 2 & 3)
    const candidateLegs = payload.candidate_cash_legs || [];
    const liquidityLegs = candidateLegs.filter((leg) =>
      this.classifyLiquidityAccount(leg.account_code)
    );

    // Case 1: Non-cash asset/transaction -> Silently ignore. No quarantine, no positioning.
    if (liquidityLegs.length === 0) {
      return;
    }

    // F & G. Resolve bank mappings & Validate ALL projected legs before calling projection RPC
    const projectionLegs = [];
    
    for (const leg of liquidityLegs) {
      // E-1. Leg validation
      if (leg.amount_minor <= 0) {
        throw this.createTerminalError(
          `Invalid negative or zero cash amount: ${leg.amount_minor}`,
          'F2024'
        );
      }

      // F-1. Resolve bank mapping
      const { data: bankAccount, error: bankErr } = await this.client
        .from('finance_bank_accounts')
        .select('id, is_active, currency')
        .eq('tenant_id', payload.tenant_id)
        .eq('linked_finance_account_id', leg.account_id)
        .maybeSingle();

      if (bankErr) {
        // Query failing transiently is retryable
        throw bankErr;
      }

      // Case 2: Cash/Bank Account but missing configuration/mapping -> QUARANTINE
      if (!bankAccount) {
        throw this.createTerminalError(
          `Liquidity account '${leg.account_code}' (id: ${leg.account_id}) is missing an active F2 bank account mapping`,
          'F2010'
        );
      }

      if (!bankAccount.is_active) {
        throw this.createTerminalError(
          `Target bank account number is inactive for liquidity account '${leg.account_code}'`,
          'F2010'
        );
      }

      if (bankAccount.currency !== leg.currency) {
        throw this.createTerminalError(
          `Leg currency '${leg.currency}' desynchronized with bank account currency '${bankAccount.currency}'`,
          'F2023'
        );
      }

      // Project leg record
      projectionLegs.push({
        bank_account_id: bankAccount.id,
        cash_leg_reference: leg.account_code,
        direction: leg.direction,
        amount_minor: leg.amount_minor,
        currency: leg.currency,
        functional_amount_minor: leg.functional_amount_minor,
        functional_currency: leg.functional_currency,
        valuation_rate: leg.exchange_rate,
        source_type: payload.source_type || 'F1_POST',
        source_id: payload.source_id || payload.transaction_id,
        description: `Projected cash leg for F1 transaction ${payload.transaction_id}`
      });
    }

    // H, I & J. Invoke single atomic database RPC (F2.2.12 P0 compliant)
    // Deterministic base key = eventId
    await this.projectCashTransaction(
      payload.tenant_id,
      payload.transaction_id,
      payload.event_id,
      projectionLegs
    );
  }

  /**
   * Handle reversed.v2 event: projects compensating cash movements maintaining lineage.
   */
  private async handleReversedV2(event: DomainEvent<FinanceTransactionReversedV2Payload>): Promise<void> {
    const payload = event.payload;

    // A. Validate Event Envelope
    if (!payload.tenant_id || !payload.transaction_id || !payload.event_id || !payload.reversal_of_transaction_id) {
      throw this.createTerminalError(
        'Reversal envelope missing mandatory identity fields',
        'ENVELOPE_INVALID'
      );
    }

    // B. Tenant match check
    if (payload.tenant_id !== event.tenantId) {
      throw this.createTerminalError(
        `Reversal tenant context mismatch: Envelope tenant '${payload.tenant_id}' does not match context tenant '${event.tenantId}'`,
        'SECURITY_TENANT_MISMATCH'
      );
    }

    // C. Validate F1 origin, state, and tenant match in database
    const { data: f1Tx, error: f1Err } = await this.client
      .from('finance_transactions')
      .select('status, tenant_id')
      .eq('id', payload.transaction_id)
      .single();

    if (f1Err || !f1Tx) {
      throw this.createTerminalError(
        `Authoritative F1 Reversal Transaction not found in ledger: ${payload.transaction_id}`,
        'F2020'
      );
    }

    if (f1Tx.tenant_id !== payload.tenant_id) {
      throw this.createTerminalError(
        `Authoritative F1 Reversal tenant mismatch: Ledger header tenant '${f1Tx.tenant_id}' does not match event tenant '${payload.tenant_id}'`,
        'SECURITY_TENANT_MISMATCH'
      );
    }

    // D. Validate candidate legs and classify
    const candidateLegs = payload.candidate_cash_legs || [];
    const liquidityLegs = candidateLegs.filter((leg) =>
      this.classifyLiquidityAccount(leg.account_code)
    );

    // Case 1: Non-cash -> Silently ignore.
    if (liquidityLegs.length === 0) {
      return;
    }

    // Query original F2 movements for reversal_of_transaction_id to establish lineage
    const { data: origMovements, error: origErr } = await this.client
      .from('finance_cash_movements')
      .select('id, bank_account_id, amount_minor, currency, idempotency_key')
      .eq('tenant_id', payload.tenant_id)
      .eq('f1_transaction_id', payload.reversal_of_transaction_id);

    if (origErr) {
      throw origErr; // Transient DB failure -> retry
    }

    const projectionLegs = [];

    for (const leg of liquidityLegs) {
      if (leg.amount_minor <= 0) {
        throw this.createTerminalError(
          `Invalid negative or zero cash amount in reversal: ${leg.amount_minor}`,
          'F2024'
        );
      }

      // Resolve bank mapping
      const { data: bankAccount, error: bankErr } = await this.client
        .from('finance_bank_accounts')
        .select('id, is_active, currency')
        .eq('tenant_id', payload.tenant_id)
        .eq('linked_finance_account_id', leg.account_id)
        .maybeSingle();

      if (bankErr) {
        throw bankErr;
      }

      // Case 2: Missing configuration/mapping
      if (!bankAccount) {
        throw this.createTerminalError(
          `Reversal liquidity account '${leg.account_code}' (id: ${leg.account_id}) is missing an active F2 bank account mapping`,
          'F2010'
        );
      }

      if (!bankAccount.is_active) {
        throw this.createTerminalError(
          `Target bank account number is inactive for reversal liquidity account '${leg.account_code}'`,
          'F2010'
        );
      }

      if (bankAccount.currency !== leg.currency) {
        throw this.createTerminalError(
          `Reversal leg currency '${leg.currency}' desynchronized with bank account currency '${bankAccount.currency}'`,
          'F2023'
        );
      }

      // E. Establish Reversal Lineage (F2.2.11 Compliance)
      // Match the original cash movement that is being reversed
      const originalMovement = origMovements?.find(
        (m) =>
          m.bank_account_id === bankAccount.id &&
          Number(m.amount_minor) === Number(leg.amount_minor) &&
          m.currency === leg.currency
      );

      if (!originalMovement) {
        throw this.createTerminalError(
          `Original cash movement lineage not found for reversal leg: bank_account=${bankAccount.id}, amount=${leg.amount_minor}`,
          'SECURITY_INTEGRITY_VIOLATION'
        );
      }

      projectionLegs.push({
        bank_account_id: bankAccount.id,
        cash_leg_reference: leg.account_code,
        direction: leg.direction,
        amount_minor: leg.amount_minor,
        currency: leg.currency,
        functional_amount_minor: leg.functional_amount_minor,
        functional_currency: leg.functional_currency,
        valuation_rate: leg.exchange_rate,
        source_type: 'REVERSAL',
        source_id: originalMovement.id, // lineage to original F2 movement
        description: `Reversal of F1 Transaction ${payload.reversal_of_transaction_id}`
      });
    }

    // Call atomic projection RPC
    // For reversal, base idempotency key starts with 'REV-' prefixing event_id
    await this.projectCashTransaction(
      payload.tenant_id,
      payload.transaction_id,
      `REV-${payload.event_id}`,
      projectionLegs
    );
  }

  /**
   * Helper to execute the database atomic projection RPC using service_role connection
   */
  private async projectCashTransaction(
    tenantId: string,
    f1TransactionId: string,
    baseIdempotency: string,
    legs: Record<string, unknown>[]
  ): Promise<void> {
    const { data, error } = await this.client.rpc(
      'finance_internal_project_cash_transaction',
      {
        p_tenant_id: tenantId,
        p_f1_transaction_id: f1TransactionId,
        p_base_idempotency: baseIdempotency,
        p_legs: legs
      }
    );

    if (error) {
      throw error; // Rethrow to let event handler decide transient/terminal routing
    }

    const result = data as { success: boolean; results?: Record<string, unknown>[] };
    if (!result?.success) {
      throw this.createTerminalError(
        'PostgreSQL RPC projection reported failure without exception',
        'PROJECTION_RPC_FAILED'
      );
    }
  }

  /**
   * Helper to execute the database quarantine RPC using service_role connection
   */
  private async quarantineEvent(
    tenantId: string,
    eventId: string,
    eventType: string,
    payload: Record<string, unknown>,
    failureReason: string,
    failureCode: string
  ): Promise<void> {
    const { error } = await this.client.rpc(
      'finance_internal_quarantine_cash_event',
      {
        p_tenant_id: tenantId,
        p_event_id: eventId,
        p_event_type: eventType,
        p_payload: payload,
        p_failure_reason: failureReason,
        p_failure_code: failureCode
      }
    );

    if (error) {
      // If logging quarantine fails, log to stderr as a critical fallthrough
      console.error(
        `[CRITICAL_FALLTHROUGH_QUARANTINE_FAILED] Failed to record event quarantine in DB: ${error.message} [Event: ${eventId}]`
      );
    }
  }

  /**
   * Factory method to create a strongly typed Terminal error
   */
  private createTerminalError(message: string, failureCode: string): Error & { isTerminal: boolean; failureCode: string } {
    const error = new Error(message) as Error & { isTerminal: boolean; failureCode: string };
    error.isTerminal = true;
    error.failureCode = failureCode;
    return error;
  }
}
