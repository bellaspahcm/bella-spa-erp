import type { SupabaseClient } from '@supabase/supabase-js';
import type { Database, Json } from '../../../types/database.types';
import {
  FinanceChargeReadModel,
  FinanceInvoiceSnapshot,
  FinancePostingLine,
  FinanceReceivableChargeGateway,
  FinanceReceivableChargeMetadata,
  FinanceSemanticAccountMapping,
} from '../services/semantic-receivable-charge.service';

type FinanceInvoiceRow = Pick<
  Database['public']['Tables']['finance_invoices']['Row'],
  'id' | 'invoice_number' | 'status' | 'posting_attempt_id' | 'f1_transaction_id'
>;

type FinancePositionRow = Pick<
  Database['public']['Tables']['finance_receivable_positions']['Row'],
  'id'
>;

export class SupabaseReceivableChargeGateway implements FinanceReceivableChargeGateway {
  constructor(private readonly client: SupabaseClient<Database>) {}

  async resolveSemanticAccount(input: {
    readonly tenantId: string;
    readonly semanticKey: string;
    readonly asOf: string;
  }): Promise<FinanceSemanticAccountMapping | null> {
    const { data, error } = await this.client.rpc('finance_get_accounting_semantic_gl_map_as_of', {
      p_tenant_id: input.tenantId,
      p_semantic_key: input.semanticKey,
      p_as_of: input.asOf,
    });
    if (error) throw new Error(error.message);
    const row = data?.[0];
    if (!row) return null;
    return {
      semanticKey: row.semantic_key,
      accountCode: row.gl_account_code,
      authorityVersion: row.authority_version,
    };
  }

  async findInvoiceByNumber(input: {
    readonly tenantId: string;
    readonly invoiceNumber: string;
  }): Promise<FinanceInvoiceSnapshot | null> {
    const { data, error } = await this.client
      .from('finance_invoices')
      .select('id, invoice_number, status, posting_attempt_id, f1_transaction_id')
      .eq('tenant_id', input.tenantId)
      .eq('invoice_number', input.invoiceNumber)
      .maybeSingle<FinanceInvoiceRow>();
    if (error) throw new Error(error.message);
    if (!data) return null;
    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      status: data.status,
      postingAttemptId: data.posting_attempt_id,
      f1TransactionId: data.f1_transaction_id,
    };
  }

  async createDraftInvoice(input: {
    readonly tenantId: string;
    readonly customerId: string;
    readonly invoiceNumber: string;
    readonly currency: string;
    readonly issueDate: string;
    readonly dueDate: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc('finance_create_draft_invoice', {
      p_tenant_id: input.tenantId,
      p_customer_id: input.customerId,
      p_invoice_number: input.invoiceNumber,
      p_currency: input.currency,
      p_issue_date: input.issueDate,
      p_due_date: input.dueDate,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async saveInvoiceMetadata(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly metadata: FinanceReceivableChargeMetadata;
  }): Promise<void> {
    const { error } = await this.client
      .from('finance_invoices')
      .update({ metadata: input.metadata as unknown as Json })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.invoiceId);
    if (error) throw new Error(error.message);
  }

  async invoiceHasLines(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
  }): Promise<boolean> {
    const { data, error } = await this.client
      .from('finance_invoice_lines')
      .select('id')
      .eq('tenant_id', input.tenantId)
      .eq('invoice_id', input.invoiceId)
      .limit(1);
    if (error) throw new Error(error.message);
    return (data?.length ?? 0) > 0;
  }

  async addInvoiceLine(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly serviceId: string;
    readonly description: string;
    readonly quantity: number;
    readonly unitPriceMinor: number;
    readonly taxRate: number;
    readonly revenueAccountCode: string;
  }): Promise<string> {
    const { data, error } = await this.client.rpc('finance_add_invoice_line', {
      p_tenant_id: input.tenantId,
      p_invoice_id: input.invoiceId,
      p_service_id: input.serviceId,
      p_description: input.description,
      p_quantity: input.quantity,
      p_unit_price_minor: input.unitPriceMinor,
      p_tax_rate: input.taxRate,
      p_revenue_account_code: input.revenueAccountCode,
    });
    if (error) throw new Error(error.message);
    return data;
  }

  async finalizeInvoice(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
    readonly idempotencyKey: string;
    readonly requestHash: string;
    readonly lines: readonly FinancePostingLine[];
  }): Promise<{ readonly transactionId: string; readonly duplicate: boolean }> {
    const { data, error } = await this.client.rpc('finance_finalize_invoice', {
      p_tenant_id: input.tenantId,
      p_invoice_id: input.invoiceId,
      p_idempotency_key: input.idempotencyKey,
      p_request_hash: input.requestHash,
      p_lines_jsonb: input.lines as unknown as Json,
    });
    if (error) throw new Error(error.message);
    if (!this.isFinalizeResult(data)) {
      throw new Error('Invalid finance_finalize_invoice response.');
    }
    return {
      transactionId: data.transaction_id,
      duplicate: data.is_duplicate,
    };
  }

  async readCharge(input: {
    readonly tenantId: string;
    readonly invoiceId: string;
  }): Promise<FinanceChargeReadModel> {
    const invoice = await this.findInvoiceById(input.tenantId, input.invoiceId);
    const position = await this.findReceivablePosition(input.tenantId, input.invoiceId);
    const ledgerCount = await this.countReceivableLedger(input.tenantId, input.invoiceId);
    const transactionLineCount = invoice.f1TransactionId
      ? await this.countTransactionLines(input.tenantId, invoice.f1TransactionId)
      : 0;

    if (!invoice.f1TransactionId) {
      throw new Error('Finalized receivable charge is missing F1 transaction id.');
    }

    return {
      invoiceId: invoice.id,
      invoiceNumber: invoice.invoiceNumber,
      transactionId: invoice.f1TransactionId,
      receivableLedgerEntryCount: ledgerCount,
      receivablePositionId: position.id,
      transactionLineCount,
    };
  }

  private async findInvoiceById(tenantId: string, invoiceId: string): Promise<FinanceInvoiceSnapshot> {
    const { data, error } = await this.client
      .from('finance_invoices')
      .select('id, invoice_number, status, posting_attempt_id, f1_transaction_id')
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .single<FinanceInvoiceRow>();
    if (error) throw new Error(error.message);
    return {
      id: data.id,
      invoiceNumber: data.invoice_number,
      status: data.status,
      postingAttemptId: data.posting_attempt_id,
      f1TransactionId: data.f1_transaction_id,
    };
  }

  private async findReceivablePosition(tenantId: string, invoiceId: string): Promise<FinancePositionRow> {
    const { data, error } = await this.client
      .from('finance_receivable_positions')
      .select('id')
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId)
      .single<FinancePositionRow>();
    if (error) throw new Error(error.message);
    return data;
  }

  private async countReceivableLedger(tenantId: string, invoiceId: string): Promise<number> {
    const { count, error } = await this.client
      .from('finance_receivable_ledger')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId)
      .eq('entry_type', 'DEBIT_ACCRUAL');
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  private async countTransactionLines(tenantId: string, transactionId: string): Promise<number> {
    const { count, error } = await this.client
      .from('finance_transaction_lines')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id', tenantId)
      .eq('transaction_id', transactionId);
    if (error) throw new Error(error.message);
    return count ?? 0;
  }

  private isFinalizeResult(value: Json): value is { transaction_id: string; is_duplicate: boolean } {
    return typeof value === 'object'
      && value !== null
      && !Array.isArray(value)
      && typeof value.transaction_id === 'string'
      && typeof value.is_duplicate === 'boolean';
  }
}
