/**
 * Finance OS Kernel — F1 Ledger Engine Service Implementation
 *
 * Implements the ILedgerEngine contract. Employs PL/pgSQL database transaction functions
 * for transaction safety, strict double-entry balance validation, multi-currency conversions
 * using string-minor units, and transactional outbox mapping.
 *
 * Constitution Compliance:
 * - Engineering Quality Rule: TypeSafety-NoAny (Zero any type usage is enforced).
 * - Invariant F-I-2: Immutability of posted financial fields.
 * - Invariant F-I-3: Idempotency check with request hash fingerprint.
 *
 * @module platform/finance/engines/ledger-engine/ledger.service
 */

import { createHash } from 'crypto';
import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import type {
  ILedgerEngine,
  PostTransactionRequest,
  ReversalRequest,
  OpenPeriodRequest,
  BalanceResult,
  TrialBalance,
  TrialBalanceLine
} from '../../contracts/ledger-engine.contract';
import type {
  FinancialTransaction,
  FinancialTransactionLine,
  AccountingPeriod,
  Money,
  ExchangeRate,
  FinanceEngineResponse,
  FinanceEngineError
} from '../../shared-kernel/types';
import { isValidIntegerString } from '../../shared-kernel/validators';

export class LedgerEngineService implements ILedgerEngine {
  public readonly engineName = 'LedgerEngine';
  public readonly engineVersion = '1.0.0';

  constructor(private readonly supabase: SupabaseClient<Database>) {}

  // Typed client accessor for database operations  
  private get client(): SupabaseClient<Database> {
    // Cast to typed client for dynamic table/RPC access
    // All public methods remain strictly typed via their return types
    return this.supabase as unknown as SupabaseClient<Database>;
  }


  private mapSqlStateToCode(sqlState: string): string {
    const mapping: Record<string, string> = {
      'A0001': 'ACCOUNT_NOT_FOUND',
      'A0002': 'ACCOUNT_INACTIVE',
      'P0001': 'PERIOD_NOT_FOUND',
      'P0002': 'PERIOD_NOT_OPEN',
      'P0003': 'IDEMPOTENCY_KEY_REUSE_CONFLICT',
      'D0001': 'DOUBLE_ENTRY_IMBALANCE',
      'T0002': 'TRANSACTION_IMMUTABLE',
      'T0003': 'TRANSACTION_EMPTY',
      'T0004': 'INVALID_STATUS_TRANSITION'
    };
    return mapping[sqlState] || sqlState;
  }


  /**
   * Helper: Calculates the request hash of the transaction lines to prevent idempotency key reuse conflicts.
   */
  private calculateRequestHash(req: PostTransactionRequest): string {
    const normalizedLines = req.lines.map(line => ({
      account_code: line.account_code,
      debit_amount_minor: line.debit_amount_minor,
      credit_amount_minor: line.credit_amount_minor,
      memo: line.memo,
      dimensions: line.dimensions
    }));

    const payload = {
      tenant_id: req.tenant_id,
      idempotency_key: req.idempotency_key,
      source_type: req.source_type,
      source_id: req.source_id,
      transaction_type: req.transaction_type,
      posted_at: req.posted_at instanceof Date ? req.posted_at.toISOString() : req.posted_at,
      transaction_currency: req.transaction_currency,
      functional_currency: req.functional_currency,
      description: req.description,
      reference_type: req.reference_type,
      reference_id: req.reference_id,
      document_date: req.document_date,
      lines: normalizedLines
    };

    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  /**
   * Helper: Converts minor unit string amount to functional currency using ROUND_HALF_UP with BigInt.
   */
  private convertToFunctionalAmount(amountMinor: string, rate: string): string {
    const rateScale = 6;
    const rateFactor = BigInt(10 ** rateScale); // 1000000

    const rateParts = rate.split('.');
    let rateIntStr = rateParts[0];
    if (rateParts[1]) {
      const decimals = rateParts[1].padEnd(rateScale, '0').slice(0, rateScale);
      rateIntStr += decimals;
    } else {
      rateIntStr += '0'.repeat(rateScale);
    }

    const rateInteger = BigInt(rateIntStr);
    const transAmount = BigInt(amountMinor);

    const halfFactor = rateFactor / BigInt(2);
    const sign = transAmount < BigInt(0) ? BigInt(-1) : BigInt(1);
    const absTransAmount = transAmount < BigInt(0) ? -transAmount : transAmount;

    // ROUND_HALF_UP division
    const absFuncAmount = (absTransAmount * rateInteger + halfFactor) / rateFactor;
    const funcAmount = absFuncAmount * sign;

    return funcAmount.toString();
  }


  /**
   * Posts a double-entry transaction to the Ledger.
   */
  public async postTransaction(
    req: PostTransactionRequest
  ): Promise<FinanceEngineResponse<FinancialTransaction>> {
    try {
      const requestHash = this.calculateRequestHash(req);

      // 1. Resolve Exchange Rate (or default to 1.0 if same currency)
      let exchangeRate: ExchangeRate = {
        rate: '1.000000',
        source_currency: req.transaction_currency,
        target_currency: req.functional_currency,
        effective_at: req.posted_at
      };

      if (req.transaction_currency !== req.functional_currency) {
        // F1 Kernel does NOT own exchange_rates table — caller must supply rate (F3 Treasury scope)
        if (!req.exchange_rate_override) {
          return this.createErrorResponse(
            'CURRENCY_MISMATCH',
            `Exchange rate required for ${req.transaction_currency} → ${req.functional_currency}. ` +
            `Provide exchange_rate_override in PostTransactionRequest (F3 Treasury is responsible for rate provisioning).`
          );
        }

        exchangeRate = {
          rate: req.exchange_rate_override.rate,
          source_currency: req.transaction_currency,
          target_currency: req.functional_currency,
          effective_at: req.exchange_rate_override.effective_at
        };
      }

      // 2. Pre-calculate functional currency lines to validate on application layer
      const preparedLines = req.lines.map(line => {
        if (!isValidIntegerString(line.debit_amount_minor) || !isValidIntegerString(line.credit_amount_minor)) {
          throw new Error('INVALID_AMOUNT');
        }

        const debitFunctional = req.transaction_currency === req.functional_currency
            ? line.debit_amount_minor
            : this.convertToFunctionalAmount(line.debit_amount_minor, exchangeRate.rate);

        const creditFunctional = req.transaction_currency === req.functional_currency
            ? line.credit_amount_minor
            : this.convertToFunctionalAmount(line.credit_amount_minor, exchangeRate.rate);

        return {
          account_code: line.account_code,
          debit_amount_minor: line.debit_amount_minor,
          debit_currency: req.transaction_currency,
          credit_amount_minor: line.credit_amount_minor,
          credit_currency: req.transaction_currency,
          debit_functional_amount: debitFunctional,
          debit_functional_currency: req.functional_currency,
          credit_functional_amount: creditFunctional,
          credit_functional_currency: req.functional_currency,
          cost_center_id: line.dimensions?.cost_center_id || null,
          business_unit_id: line.dimensions?.business_unit_id || null,
          location_id: line.dimensions?.location_id || null,
          project_id: line.dimensions?.project_id || null,
          department_id: line.dimensions?.department_id || null,
          custom_dimension_type: line.dimensions?.custom_dimension_type || null,
          custom_dimension_id: line.dimensions?.custom_dimension_id || null,
          memo: line.memo
        };
      });

      // 3. Invoke PL/pgSQL transaction post procedurially
      const { data, error } = await this.client.rpc('finance_post_transaction', {
        p_tenant_id: req.tenant_id,
        p_idempotency_key: req.idempotency_key,
        p_request_hash: requestHash,
        p_source_type: req.source_type,
        p_source_id: req.source_id,
        p_transaction_type: req.transaction_type,
        p_posted_at: req.posted_at.toISOString(),
        p_transaction_currency: req.transaction_currency,
        p_functional_currency: req.functional_currency,
        p_exchange_rate_rate: Number(exchangeRate.rate),
        p_exchange_rate_source: exchangeRate.source_currency,
        p_exchange_rate_target: exchangeRate.target_currency,
        p_exchange_rate_effective: exchangeRate.effective_at.toISOString(),
        p_description: req.description,
        p_reference_type: req.reference_type,
        p_reference_id: req.reference_id,
        p_lines: preparedLines,
        p_document_date: req.document_date || undefined
      });

      if (error) {
        return this.createErrorResponse(error.code || 'POST_TRANSACTION_FAILED', error.message);
      }

      const response = data as Record<string, unknown>;

      // 4. Retrieve complete transaction details to return DTO
      const { data: tx, error: txErr } = await this.client
          .from('finance_transactions')
          .select('*, lines:finance_transaction_lines(*)')
          .eq('id', String(response.transaction_id))
          .single();

      if (txErr || !tx) {
        return this.createErrorResponse('TRANSACTION_NOT_FOUND', 'Failed to retrieve posted transaction details');
      }


      // Map DB row to DTO structure strictly
      const mappedTx = this.mapToTransactionDTO(tx as Record<string, unknown>);

      return {
        success: true,
        data: mappedTx
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse('LEDGER_POST_ERROR', msg);
    }
  }

  /**
   * Reverses a POSTED transaction.
   */
  public async reverseTransaction(
    req: ReversalRequest
  ): Promise<FinanceEngineResponse<FinancialTransaction>> {
    try {
      const { data, error } = await this.client.rpc('finance_reverse_transaction', {
        p_tenant_id: req.tenant_id,
        p_transaction_id: req.transaction_id,
        p_idempotency_key: req.idempotency_key,
        p_reason: req.reason,
        p_reversal_date: req.reversal_date?.toISOString()
      });

      if (error) {
        return this.createErrorResponse(error.code || 'REVERSAL_FAILED', error.message);
      }

      const response = data as Record<string, unknown>;

      const { data: tx, error: txErr } = await this.client
          .from('finance_transactions')
          .select('*, lines:finance_transaction_lines(*)')
          .eq('id', String(response.transaction_id))
          .single();

      if (txErr || !tx) {
        return this.createErrorResponse('TRANSACTION_NOT_FOUND', 'Failed to retrieve reversal transaction details');
      }


      return {
        success: true,
        data: this.mapToTransactionDTO(tx as Record<string, unknown>)
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse('LEDGER_REVERSAL_ERROR', msg);
    }
  }

  /**
   * Voids a DRAFT transaction.
   */
  public async voidTransaction(
    tenantId: string,
    transactionId: string,
    reason: string
  ): Promise<FinanceEngineResponse<void>> {
    try {
      // Retrieve state first
      const { data: tx, error: findErr } = await this.client
          .from('finance_transactions')
          .select('status')
          .eq('tenant_id', tenantId)
          .eq('id', transactionId)
          .single();

      if (findErr || !tx) {
        return this.createErrorResponse('TRANSACTION_NOT_FOUND', 'Transaction not found');
      }

      if ((tx as Record<string, unknown>).status !== 'DRAFT') {
        return this.createErrorResponse('TRANSACTION_IMMUTABLE', 'Only DRAFT transactions can be voided');
      }

      // Update in place (DRAFT is not financially posted, lifecycle status only mutable)
      const { error: updateErr } = await this.client
          .from('finance_transactions')
          .update({ status: 'VOIDED', updated_at: new Date().toISOString() })
          .eq('tenant_id', tenantId)
          .eq('id', transactionId);

      if (updateErr) {
        return this.createErrorResponse('VOID_FAILED', updateErr.message);
      }

      // Record audit log
      await this.client.from('finance_audit_trail').insert({
        tenant_id: tenantId,
        action: 'VOID_TRANSACTION',
        reference_type: 'finance_transactions',
        reference_id: transactionId,
        before_state: { status: 'DRAFT' },
        after_state: { status: 'VOIDED', reason },
        occurred_at: new Date().toISOString()
      });

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse('LEDGER_VOID_ERROR', msg);
    }
  }

  /**
   * Resolves the normal balance of an account and computes totals.
   */
  public async getBalance(
    tenantId: string,
    accountId: string,
    asOf?: Date
  ): Promise<FinanceEngineResponse<BalanceResult>> {
    try {
      // 1. Resolve target account code and currency
      const { data: account, error: accErr } = await this.client
          .from('finance_accounts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('id', accountId)
          .single();

      if (accErr || !account) {
        return this.createErrorResponse('ACCOUNT_NOT_FOUND', 'Account not found');
      }

      const accData = account as Record<string, unknown>;

      // 2. Sum debits and credits for this account code
      let query = this.client
          .from('finance_transaction_lines')
          .select('debit_amount, credit_amount, finance_transactions!inner(status, posted_at)')
          .eq('tenant_id', tenantId)
          .eq('account_id', accountId)
          .eq('finance_transactions.status', 'POSTED');

      if (asOf) {
        query = query.lte('finance_transactions.posted_at', asOf.toISOString());
      }

      const { data: lines, error: linesErr } = await query;


      if (linesErr) {
        return this.createErrorResponse('BALANCE_QUERY_FAILED', linesErr.message);
      }

      let totalDebit = BigInt(0);
      let totalCredit = BigInt(0);

      for (const line of (lines || [])) {
        totalDebit += BigInt(String(line.debit_amount));
        totalCredit += BigInt(String(line.credit_amount));
      }

      const balanceType = accData.normal_balance as 'DEBIT' | 'CREDIT';
      let balance = BigInt(0);

      if (balanceType === 'DEBIT') {
        balance = totalDebit - totalCredit;
      } else {
        balance = totalCredit - totalDebit;
      }

      return {
        success: true,
        data: {
          account_id: accountId,
          account_code: String(accData.code),
          tenant_id: tenantId,
          currency: String(accData.currency),
          total_debit: { amount_minor: totalDebit.toString(), currency: String(accData.currency) },
          total_credit: { amount_minor: totalCredit.toString(), currency: String(accData.currency) },
          balance: { amount_minor: balance.toString(), currency: String(accData.currency) }
        }
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse('LEDGER_BALANCE_ERROR', msg);
    }
  }

  /**
   * Generates the Trial Balance sheet as of a target timestamp.
   */
  public async getTrialBalance(
    tenantId: string,
    asOf: Date
  ): Promise<FinanceEngineResponse<TrialBalance>> {
    try {
      // 1. Fetch Chart of Accounts
      const { data: accounts, error: accErr } = await this.client
          .from('finance_accounts')
          .select('*')
          .eq('tenant_id', tenantId)
          .eq('is_active', true);

      if (accErr || !accounts) {
        return this.createErrorResponse('TRIAL_BALANCE_FAILED', accErr?.message || 'Failed to fetch accounts');
      }


      const lines: TrialBalanceLine[] = [];
      let grandDebit = BigInt(0);
      let grandCredit = BigInt(0);

      // 2. Loop accounts and calculate balance functional (Trial balance standard is functional base currency)
      for (const acc of accounts) {
        const accData = acc as Record<string, unknown>;
        const balanceRes = await this.getBalance(tenantId, String(accData.id), asOf);
        if (!balanceRes.success || !balanceRes.data) {
          return this.createErrorResponse('TRIAL_BALANCE_FAILED', balanceRes.error?.message || 'Failed to query account balance');
        }

        const debitAmt = BigInt(balanceRes.data.total_debit.amount_minor);
        const creditAmt = BigInt(balanceRes.data.total_credit.amount_minor);

        grandDebit += debitAmt;
        grandCredit += creditAmt;

        lines.push({
          account_id: String(accData.id),
          account_code: String(accData.code),
          account_name: String(accData.name),
          account_type: String(accData.type),
          debit: { amount_minor: debitAmt.toString(), currency: String(accData.currency) },
          credit: { amount_minor: creditAmt.toString(), currency: String(accData.currency) }
        });
      }

      const isBalanced = grandDebit === grandCredit;

      return {
        success: true,
        data: {
          tenant_id: tenantId,
          as_of: asOf,
          lines,
          total_debit: { amount_minor: grandDebit.toString(), currency: 'VND' }, // Functional is base VND
          total_credit: { amount_minor: grandCredit.toString(), currency: 'VND' },
          is_balanced: isBalanced
        }
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse('LEDGER_TB_ERROR', msg);
    }
  }

  /**
   * Opens a new accounting period.
   */
  public async openPeriod(
    req: OpenPeriodRequest
  ): Promise<FinanceEngineResponse<AccountingPeriod>> {
    try {
      const { data, error } = await this.client
          .from('finance_accounting_periods')
          .insert({
            tenant_id: req.tenant_id,
            name: req.name,
            period_start: req.period_start.toISOString(),
            period_end: req.period_end.toISOString(),
            status: 'OPEN'
          })
          .select('*')
          .single();

      if (error || !data) {
        return this.createErrorResponse('PERIOD_CREATE_FAILED', error?.message || 'Failed to open period');
      }


      return {
        success: true,
        data: this.mapToPeriodDTO(data as Record<string, unknown>)
      };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse('LEDGER_PERIOD_OPEN_ERROR', msg);
    }
  }

  /**
   * Closes an accounting period (blocking further postings, but allowed to adjust).
   */
  public async closePeriod(
    tenantId: string,
    periodId: string,
    userId: string
  ): Promise<FinanceEngineResponse<void>> {
    try {
      const { error } = await this.client
          .from('finance_accounting_periods')
          .update({
            status: 'CLOSED',
            closed_by: userId,
            closed_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', tenantId)
          .eq('id', periodId);

      if (error) {
        return this.createErrorResponse('PERIOD_CLOSE_FAILED', error.message);
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse('LEDGER_PERIOD_CLOSE_ERROR', msg);
    }
  }

  /**
   * Permanently locks an accounting period (absolutely final, no reopen allowed).
   */
  public async lockPeriod(
    tenantId: string,
    periodId: string,
    userId: string
  ): Promise<FinanceEngineResponse<void>> {
    try {
      const { error } = await this.client
          .from('finance_accounting_periods')
          .update({
            status: 'LOCKED',
            locked_by: userId,
            locked_at: new Date().toISOString(),
            updated_at: new Date().toISOString()
          })
          .eq('tenant_id', tenantId)
          .eq('id', periodId);

      if (error) {
        return this.createErrorResponse('PERIOD_LOCK_FAILED', error.message);
      }

      return { success: true };
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      return this.createErrorResponse('LEDGER_PERIOD_LOCK_ERROR', msg);
    }
  }


  // =========================================================================
  // Mappers & Helpers
  // =========================================================================

  private mapToTransactionDTO(row: Record<string, unknown>): FinancialTransaction {
    const rawLines = (row.lines as Array<Record<string, unknown>>) || [];
    const lines: FinancialTransactionLine[] = rawLines.map(line => ({
      id: String(line.id),
      tenant_id: String(line.tenant_id),
      transaction_id: String(line.transaction_id),
      account_id: String(line.account_id),
      debit: { amount_minor: String(line.debit_amount), currency: String(line.debit_currency) },
      credit: { amount_minor: String(line.credit_amount), currency: String(line.credit_currency) },
      debit_functional: { amount_minor: String(line.debit_functional_amount), currency: String(line.debit_functional_currency) },
      credit_functional: { amount_minor: String(line.credit_functional_amount), currency: String(line.credit_functional_currency) },
      dimensions: {
        cost_center_id: line.cost_center_id ? String(line.cost_center_id) : undefined,
        business_unit_id: line.business_unit_id ? String(line.business_unit_id) : undefined,
        location_id: line.location_id ? String(line.location_id) : undefined,
        project_id: line.project_id ? String(line.project_id) : undefined,
        department_id: line.department_id ? String(line.department_id) : undefined,
        custom_dimension_type: line.custom_dimension_type ? String(line.custom_dimension_type) : undefined,
        custom_dimension_id: line.custom_dimension_id ? String(line.custom_dimension_id) : undefined
      },
      memo: String(line.memo)
    }));

    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      idempotency_key: String(row.idempotency_key),
      source_type: String(row.source_type),
      source_id: String(row.source_id),
      status: row.status as FinancialTransaction['status'],
      transaction_type: row.transaction_type as FinancialTransaction['transaction_type'],
      accounting_period_id: String(row.accounting_period_id),
      posted_at: row.posted_at ? new Date(String(row.posted_at)) : null,
      transaction_currency: String(row.transaction_currency),
      functional_currency: String(row.functional_currency),
      exchange_rate: {
        rate: String(row.exchange_rate_rate),
        source_currency: String(row.exchange_rate_source),
        target_currency: String(row.exchange_rate_target),
        effective_at: new Date(String(row.exchange_rate_effective))
      },
      description: String(row.description),
      reference_type: String(row.reference_type),
      reference_id: String(row.reference_id),
      document_date: row.document_date ? String(row.document_date) : null,
      reversal_of: row.reversal_of ? String(row.reversal_of) : null,
      lines
    };
  }

  private mapToPeriodDTO(row: Record<string, unknown>): AccountingPeriod {
    return {
      id: String(row.id),
      tenant_id: String(row.tenant_id),
      name: String(row.name),
      period_start: new Date(String(row.period_start)),
      period_end: new Date(String(row.period_end)),
      status: row.status as AccountingPeriod['status'],
      closed_by: row.closed_by ? String(row.closed_by) : undefined,
      closed_at: row.closed_at ? new Date(String(row.closed_at)) : undefined,
      locked_by: row.locked_by ? String(row.locked_by) : undefined,
      locked_at: row.locked_at ? new Date(String(row.locked_at)) : undefined
    };
  }

  private createErrorResponse(code: string, message: string): FinanceEngineResponse<never> {
    const mappedCode = this.mapSqlStateToCode(code);
    const error: FinanceEngineError = {
      code: mappedCode,
      message,
      timestamp: new Date().toISOString()
    };
    return {
      success: false,
      error
    };
  }
}
