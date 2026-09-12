/**
 * F3 Accounts Receivable Engine
 * 
 * Wraps F3 DB RPCs and implements IF3AccountsReceivable contract.
 * Enforces Party-native identity semantics.
 * 
 * @module F3AccountsReceivableEngine
 * @owner Platform Finance
 */

import { createClient, SupabaseClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  IF3AccountsReceivable,
  CreateInvoiceInput,
  AddInvoiceLineInput,
  FinalizeInvoiceInput,
  VoidInvoiceInput,
  GetInvoiceInput,
  InvoiceResult,
  InvoiceView,
  InvoiceHeader,
  InvoiceLine,
  ReceivablePosition,
  F3InvoiceNotFoundError,
  F3InvoiceNotDraftError,
  F3InvoiceNumberDuplicateError,
  F3InvoiceEmptyError,
  F3ZeroValueInvoiceError,
  F3InvalidRevenueAccountError,
  F3InvoiceNotFinalizedError,
  F3InvoiceHasAllocationsError,
  F3PostingFailedError,
  F3InvalidInputError
} from '@/platform/finance/contracts/f3-ar.contract';
import { createHash } from 'crypto';

export class F3AccountsReceivableEngine implements IF3AccountsReceivable {
  private supabase: SupabaseClient<Database>;

  constructor(supabaseUrl: string, serviceRoleKey: string) {
    this.supabase = createClient<Database>(supabaseUrl, serviceRoleKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    });
  }

  async createDraftInvoice(input: CreateInvoiceInput): Promise<InvoiceResult> {
    try {
      // 1. Validate Party exists and belongs to tenant
      await this.validatePartyExists(input.tenantId, input.partyId);

      // 2. Validate dates
      if (new Date(input.dueDate) < new Date(input.issueDate)) {
        throw new F3InvalidInputError('dueDate', 'Due date must be >= issue date');
      }

      // 3. Call RPC (map partyId → customer_id)
      const { data, error } = await this.supabase.rpc('finance_create_draft_invoice', {
        p_tenant_id: input.tenantId,
        p_customer_id: input.partyId,  // ← Party semantic enforcement
        p_invoice_number: input.invoiceNumber,
        p_currency: input.currency,
        p_issue_date: input.issueDate,
        p_due_date: input.dueDate
      });

      if (error) throw this.mapError(error, { invoiceId: 'unknown' });

      return {
        invoiceId: data as string,
        status: 'DRAFT',
        totalInvoiceAmountMinor: 0
      };
    } catch (err) {
      if (err instanceof Error && err.name.startsWith('F3')) throw err;
      throw this.mapError(err, { invoiceId: 'unknown' });
    }
  }

  async addInvoiceLine(input: AddInvoiceLineInput): Promise<InvoiceResult> {
    try {
      // 1. Validate quantity and price
      if (input.quantity <= 0) {
        throw new F3InvalidInputError('quantity', 'Quantity must be > 0');
      }
      if (input.unitPriceMinor < 0) {
        throw new F3InvalidInputError('unitPriceMinor', 'Unit price cannot be negative');
      }
      if (input.taxRate < 0 || input.taxRate > 1) {
        throw new F3InvalidInputError('taxRate', 'Tax rate must be between 0.0 and 1.0');
      }

      // 2. Call RPC
      const { data, error } = await this.supabase.rpc('finance_add_invoice_line', {
        p_tenant_id: input.tenantId,
        p_invoice_id: input.invoiceId,
        p_service_id: input.serviceId || null,
        p_description: input.description,
        p_quantity: input.quantity,
        p_unit_price_minor: input.unitPriceMinor,
        p_tax_rate: input.taxRate,
        p_revenue_account_code: input.revenueAccountCode
      });

      if (error) throw this.mapError(error, { invoiceId: input.invoiceId });

      // 3. Get updated invoice totals
      const invoice = await this.getInvoiceHeader(input.tenantId, input.invoiceId);

      return {
        invoiceId: input.invoiceId,
        status: invoice.status,
        totalInvoiceAmountMinor: invoice.totalInvoiceAmountMinor
      };
    } catch (err) {
      if (err instanceof Error && err.name.startsWith('F3')) throw err;
      throw this.mapError(err, { invoiceId: input.invoiceId });
    }
  }

  async finalizeInvoice(input: FinalizeInvoiceInput): Promise<InvoiceResult> {
    try {
      // 1. Get invoice header (need posting_attempt_id)
      const invoice = await this.getInvoiceHeader(input.tenantId, input.invoiceId);

      // Idempotency: if already FINALIZED, return existing result
      if (invoice.status === 'FINALIZED') {
        return {
          invoiceId: input.invoiceId,
          status: 'FINALIZED',
          totalInvoiceAmountMinor: invoice.totalInvoiceAmountMinor,
          f1TransactionId: invoice.f1TransactionId || undefined,
          isDuplicate: true
        };
      }

      if (invoice.status !== 'DRAFT') {
        throw new F3InvoiceNotDraftError(input.invoiceId, invoice.status);
      }

      // 2. Get invoice lines (for F1 payload)
      const lines = await this.getInvoiceLines(input.tenantId, input.invoiceId);

      if (lines.length === 0) {
        throw new F3InvoiceEmptyError(input.invoiceId);
      }

      // 3. Build F1 hạch toán payload
      const linesJsonb = this.buildF1Payload(invoice, lines);
      const requestHash = this.computeHash(JSON.stringify(linesJsonb));

      // 4. Get persistent idempotency key
      const postingAttemptId = await this.getPostingAttemptId(input.tenantId, input.invoiceId);

      // 5. Call finalize RPC
      const { data, error } = await this.supabase.rpc('finance_finalize_invoice', {
        p_tenant_id: input.tenantId,
        p_invoice_id: input.invoiceId,
        p_idempotency_key: postingAttemptId,
        p_request_hash: requestHash,
        p_lines_jsonb: linesJsonb as any
      });

      if (error) throw this.mapError(error, { invoiceId: input.invoiceId });

      const result = data as { success: boolean; transaction_id: string; is_duplicate: boolean };

      return {
        invoiceId: input.invoiceId,
        status: 'FINALIZED',
        totalInvoiceAmountMinor: invoice.totalInvoiceAmountMinor,
        f1TransactionId: result.transaction_id,
        isDuplicate: result.is_duplicate || false
      };
    } catch (err) {
      if (err instanceof Error && err.name.startsWith('F3')) throw err;
      throw this.mapError(err, { invoiceId: input.invoiceId });
    }
  }

  async voidInvoice(input: VoidInvoiceInput): Promise<InvoiceResult> {
    try {
      // 1. Call void RPC
      const { data, error } = await this.supabase.rpc('finance_void_invoice', {
        p_tenant_id: input.tenantId,
        p_invoice_id: input.invoiceId
      });

      if (error) throw this.mapError(error, { invoiceId: input.invoiceId });

      const reversalTxId = data as string;

      // 2. Get updated invoice
      const invoice = await this.getInvoiceHeader(input.tenantId, input.invoiceId);

      return {
        invoiceId: input.invoiceId,
        status: 'VOIDED',
        totalInvoiceAmountMinor: invoice.totalInvoiceAmountMinor,
        f1ReversalTransactionId: reversalTxId
      };
    } catch (err) {
      if (err instanceof Error && err.name.startsWith('F3')) throw err;
      throw this.mapError(err, { invoiceId: input.invoiceId });
    }
  }

  async getInvoice(input: GetInvoiceInput): Promise<InvoiceView> {
    try {
      // 1. Get invoice header
      const header = await this.getInvoiceHeader(input.tenantId, input.invoiceId);

      // 2. Get invoice lines
      const lines = await this.getInvoiceLines(input.tenantId, input.invoiceId);

      // 3. Get AR position (if finalized)
      let position: ReceivablePosition | undefined;
      if (header.status === 'FINALIZED' || header.status === 'VOIDED' || header.status === 'ADJUSTED') {
        position = await this.getReceivablePosition(input.tenantId, input.invoiceId);
      }

      return { header, lines, position };
    } catch (err) {
      if (err instanceof Error && err.name.startsWith('F3')) throw err;
      throw this.mapError(err, { invoiceId: input.invoiceId });
    }
  }

  // ========================================================================
  // PRIVATE: VALIDATORS
  // ========================================================================

  private async validatePartyExists(tenantId: string, partyId: string): Promise<void> {
    const { data, error } = await this.supabase
      .from('party_parties')
      .select('id, tenant_id')
      .eq('id', partyId)
      .single();

    if (error || !data) {
      throw new F3InvalidInputError('partyId', `Party ${partyId} does not exist`);
    }

    // Verify party belongs to tenant
    if (data.tenant_id !== tenantId) {
      throw new F3InvalidInputError('partyId', `Party ${partyId} does not belong to tenant ${tenantId}`);
    }
  }

  // ========================================================================
  // PRIVATE: BOUNDED READ PATHS
  // ========================================================================

  private async getInvoiceHeader(tenantId: string, invoiceId: string): Promise<InvoiceHeader> {
    const { data, error } = await this.supabase
      .from('finance_invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .single();

    if (error || !data) {
      throw new F3InvoiceNotFoundError(invoiceId);
    }

    return this.mapInvoiceHeader(data);
  }

  private async getInvoiceLines(tenantId: string, invoiceId: string): Promise<InvoiceLine[]> {
    const { data, error } = await this.supabase
      .from('finance_invoice_lines')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId)
      .order('created_at', { ascending: true });

    if (error) throw new F3PostingFailedError(`Failed to fetch invoice lines: ${error.message}`);

    return (data || []).map(row => this.mapInvoiceLine(row));
  }

  private async getReceivablePosition(tenantId: string, invoiceId: string): Promise<ReceivablePosition | undefined> {
    const { data, error } = await this.supabase
      .from('finance_receivable_positions')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId)
      .single();

    if (error || !data) return undefined;

    return this.mapReceivablePosition(data);
  }

  private async getPostingAttemptId(tenantId: string, invoiceId: string): Promise<string> {
    const { data, error } = await this.supabase
      .from('finance_invoices')
      .select('posting_attempt_id')
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .single();

    if (error || !data) {
      throw new F3InvoiceNotFoundError(invoiceId);
    }

    return data.posting_attempt_id;
  }

  // ========================================================================
  // PRIVATE: MAPPERS (DB → Contract types)
  // ========================================================================

  private mapInvoiceHeader(dbRow: any): InvoiceHeader {
    return {
      id: dbRow.id,
      tenantId: dbRow.tenant_id,
      partyId: dbRow.customer_id,  // ← Map customer_id → partyId
      invoiceNumber: dbRow.invoice_number,
      status: dbRow.status,
      issueDate: dbRow.issue_date,
      dueDate: dbRow.due_date,
      currency: dbRow.currency,
      totalPretaxAmountMinor: parseInt(dbRow.total_pretax_amount_minor || '0'),
      taxAmountMinor: parseInt(dbRow.tax_amount_minor || '0'),
      totalInvoiceAmountMinor: parseInt(dbRow.total_invoice_amount_minor || '0'),
      f1TransactionId: dbRow.f1_transaction_id || undefined,
      postingStatus: dbRow.posting_status,
      createdAt: dbRow.created_at,
      updatedAt: dbRow.updated_at
    };
  }

  private mapInvoiceLine(dbRow: any): InvoiceLine {
    return {
      id: dbRow.id,
      invoiceId: dbRow.invoice_id,
      serviceId: dbRow.service_id || undefined,
      description: dbRow.description,
      quantity: parseFloat(dbRow.quantity),
      unitPriceMinor: parseInt(dbRow.unit_price_minor || '0'),
      taxRate: parseFloat(dbRow.tax_rate),
      amountMinor: parseInt(dbRow.amount_minor || '0'),
      revenueAccountCode: dbRow.revenue_account_code,
      createdAt: dbRow.created_at
    };
  }

  private mapReceivablePosition(dbRow: any): ReceivablePosition {
    return {
      invoiceId: dbRow.invoice_id,
      partyId: dbRow.customer_id,  // ← Map customer_id → partyId
      currency: dbRow.currency,
      originalAmountMinor: parseInt(dbRow.original_amount_minor || '0'),
      allocatedAmountMinor: parseInt(dbRow.allocated_amount_minor || '0'),
      adjustedAmountMinor: parseInt(dbRow.adjusted_amount_minor || '0'),
      outstandingAmountMinor: parseInt(dbRow.outstanding_amount_minor || '0'),
      lastReconstructedAt: dbRow.last_reconstructed_at || undefined,
      version: dbRow.version || 0
    };
  }

  // ========================================================================
  // PRIVATE: F1 PAYLOAD BUILDER
  // ========================================================================

  private buildF1Payload(invoice: InvoiceHeader, lines: InvoiceLine[]): any[] {
    // Build hạch toán lines for F1 GL posting
    const payload: any[] = [];

    // DR: Receivables Control (131)
    payload.push({
      account_code: '131',
      debit_functional_amount: invoice.totalInvoiceAmountMinor,
      credit_functional_amount: 0,
      debit_amount_minor: invoice.totalInvoiceAmountMinor,
      credit_amount_minor: 0,
      debit_currency: invoice.currency,
      credit_currency: invoice.currency,
      debit_functional_currency: invoice.currency,
      credit_functional_currency: invoice.currency,
      memo: `AR Debit - ${invoice.invoiceNumber}`
    });

    // CR: Revenue accounts (per line)
    for (const line of lines) {
      payload.push({
        account_code: line.revenueAccountCode,
        debit_functional_amount: 0,
        credit_functional_amount: line.amountMinor,
        debit_amount_minor: 0,
        credit_amount_minor: line.amountMinor,
        debit_currency: invoice.currency,
        credit_currency: invoice.currency,
        debit_functional_currency: invoice.currency,
        credit_functional_currency: invoice.currency,
        memo: line.description
      });
    }

    // CR: VAT Payable (3331) if tax exists
    if (invoice.taxAmountMinor > 0) {
      payload.push({
        account_code: '3331',
        debit_functional_amount: 0,
        credit_functional_amount: invoice.taxAmountMinor,
        debit_amount_minor: 0,
        credit_amount_minor: invoice.taxAmountMinor,
        debit_currency: invoice.currency,
        credit_currency: invoice.currency,
        debit_functional_currency: invoice.currency,
        credit_functional_currency: invoice.currency,
        memo: 'VAT Payable'
      });
    }

    return payload;
  }

  private computeHash(payload: string): string {
    return createHash('sha256').update(payload).digest('hex');
  }

  // ========================================================================
  // PRIVATE: ERROR MAPPER
  // ========================================================================

  private mapError(error: any, context: { invoiceId: string }): Error {
    const msg = error?.message || '';
    const code = error?.code || '';

    // PostgreSQL unique constraint violation
    if (code === '23505') {
      if (msg.includes('uq_invoice_number_per_tenant')) {
        const match = msg.match(/Key \(.*?\)=\(.*?, (.*?)\)/);
        const invoiceNumber = match?.[1] || 'unknown';
        return new F3InvoiceNumberDuplicateError(invoiceNumber);
      }
    }

    // F3 RPC errors (ERRCODE format)
    if (code === 'F3002' || msg.includes('INVOICE_NOT_FOUND')) {
      return new F3InvoiceNotFoundError(context.invoiceId);
    }

    if (code === 'F3003' || msg.includes('INVOICE_NOT_DRAFT')) {
      const match = msg.match(/current: (\w+)/);
      const status = match?.[1] || 'unknown';
      return new F3InvoiceNotDraftError(context.invoiceId, status);
    }

    if (code === 'F3012' || msg.includes('INVOICE_EMPTY')) {
      return new F3InvoiceEmptyError(context.invoiceId);
    }

    if (code === 'F3013' || msg.includes('INVOICE_NOT_FINALIZED')) {
      const match = msg.match(/current: (\w+)/);
      const status = match?.[1] || 'unknown';
      return new F3InvoiceNotFinalizedError(context.invoiceId, status);
    }

    if (code === 'F3014' || msg.includes('INVOICE_HAS_ALLOCATIONS')) {
      const match = msg.match(/(\d+) minor units/);
      const allocated = match?.[1] ? parseInt(match[1]) : 0;
      return new F3InvoiceHasAllocationsError(context.invoiceId, allocated);
    }

    if (code === 'F3015' || msg.includes('INVALID_REVENUE_ACCOUNT')) {
      const match = msg.match(/account: (\w+)/);
      const accountCode = match?.[1] || 'unknown';
      return new F3InvalidRevenueAccountError(accountCode);
    }

    if (code === 'F3016' || msg.includes('INVALID_INVOICE_NUMBER')) {
      return new F3InvalidInputError('invoiceNumber', 'Invoice number cannot be empty');
    }

    if (code === 'F3018' || msg.includes('ZERO_VALUE_INVOICE')) {
      return new F3ZeroValueInvoiceError(context.invoiceId);
    }

    // Fallback
    return new F3PostingFailedError(msg || 'Unknown error');
  }
}

// ============================================================================
// FACTORY
// ============================================================================

export function createF3AREngine(): IF3AccountsReceivable {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!url || !key) {
    throw new Error('F3 AR Engine: Supabase credentials missing (NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)');
  }

  return new F3AccountsReceivableEngine(url, key);
}
