/**
 * Bella Preschool OS — P7.1 Finance Repository
 * 
 * Data Access Layer for all 8 `edu_fin_*` database tables.
 * Enforces Tenant Isolation and RLS compliance on every database operation.
 */

import { createClient } from '@supabase/supabase-js';
import {
  FeeStructure,
  BillingPeriod,
  StudentDiscountProfile,
  Invoice,
  InvoiceLineItem,
  Payment,
  ReconciliationLedgerEntry,
  PaymentReceipt,
} from '../domain/finance.types';

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'http://127.0.0.1:54321';
const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || '';
const supabase = createClient(supabaseUrl, supabaseKey);

export class PreschoolFinanceRepository {
  // ── FEE STRUCTURES ──
  async createFeeStructure(data: Omit<FeeStructure, 'id' | 'createdAt' | 'updatedAt'>): Promise<FeeStructure> {
    const { data: result, error } = await supabase
      .from('edu_fin_fee_structures')
      .insert({
        tenant_id: data.tenantId,
        program_id: data.programId,
        fee_code: data.feeCode,
        fee_name: data.feeName,
        fee_type: data.feeType,
        amount: data.amount,
        currency: data.currency,
        billing_cycle: data.billingCycle,
        is_active: data.isActive,
      })
      .select()
      .single();

    if (error || !result) {
      throw new Error(`FINANCE_REPOSITORY_ERROR: Failed to create fee structure: ${error?.message}`);
    }

    return this.mapFeeStructure(result);
  }

  async getFeeStructures(tenantId: string, programId: string = 'PRESCHOOL'): Promise<FeeStructure[]> {
    const { data, error } = await supabase
      .from('edu_fin_fee_structures')
      .select()
      .eq('tenant_id', tenantId)
      .eq('program_id', programId)
      .eq('is_active', true);

    if (error) throw new Error(`FINANCE_REPOSITORY_ERROR: ${error.message}`);
    return (data || []).map(this.mapFeeStructure);
  }

  // ── BILLING PERIODS ──
  async createBillingPeriod(data: Omit<BillingPeriod, 'id' | 'createdAt' | 'updatedAt'>): Promise<BillingPeriod> {
    const { data: result, error } = await supabase
      .from('edu_fin_billing_periods')
      .insert({
        tenant_id: data.tenantId,
        period_name: data.periodName,
        start_date: data.startDate,
        end_date: data.endDate,
        due_date: data.dueDate,
        status: data.status,
        created_by: data.createdBy,
      })
      .select()
      .single();

    if (error || !result) {
      throw new Error(`FINANCE_REPOSITORY_ERROR: Failed to create billing period: ${error?.message}`);
    }

    return this.mapBillingPeriod(result);
  }

  async listActiveBillingPeriods(tenantId: string): Promise<BillingPeriod[]> {
    const { data, error } = await supabase
      .from('edu_fin_billing_periods')
      .select()
      .eq('tenant_id', tenantId)
      .eq('status', 'ACTIVE');

    if (error) throw new Error(`FINANCE_REPOSITORY_ERROR: ${error.message}`);
    return (data || []).map(this.mapBillingPeriod);
  }

  // ── DISCOUNT PROFILES ──
  async createDiscountProfile(data: Omit<StudentDiscountProfile, 'id' | 'createdAt'>): Promise<StudentDiscountProfile> {
    const { data: result, error } = await supabase
      .from('edu_fin_student_discount_profiles')
      .insert({
        tenant_id: data.tenantId,
        student_id: data.studentId,
        discount_type: data.discountType,
        discount_name: data.discountName,
        discount_percent: data.discountPercent,
        fixed_amount: data.fixedAmount,
        reason: data.reason,
        valid_from: data.validFrom,
        valid_until: data.validUntil,
        is_active: data.isActive,
      })
      .select()
      .single();

    if (error || !result) {
      throw new Error(`FINANCE_REPOSITORY_ERROR: Failed to create discount profile: ${error?.message}`);
    }

    return this.mapDiscountProfile(result);
  }

  async getActiveDiscountProfiles(tenantId: string, studentId: string): Promise<StudentDiscountProfile[]> {
    const { data, error } = await supabase
      .from('edu_fin_student_discount_profiles')
      .select()
      .eq('tenant_id', tenantId)
      .eq('student_id', studentId)
      .eq('is_active', true);

    if (error) throw new Error(`FINANCE_REPOSITORY_ERROR: ${error.message}`);
    return (data || []).map(this.mapDiscountProfile);
  }

  // ── INVOICES & LINE ITEMS ──
  async createInvoice(
    invoiceData: Omit<Invoice, 'id' | 'createdAt' | 'updatedAt'>,
    lineItems: Omit<InvoiceLineItem, 'id' | 'invoiceId' | 'createdAt'>[]
  ): Promise<Invoice> {
    // 1. Insert Invoice Header
    const { data: invResult, error: invErr } = await supabase
      .from('edu_fin_invoices')
      .insert({
        tenant_id: invoiceData.tenantId,
        student_id: invoiceData.studentId,
        billing_period_id: invoiceData.billingPeriodId,
        invoice_number: invoiceData.invoiceNumber,
        invoice_status: invoiceData.invoiceStatus,
        settlement_status: invoiceData.settlementStatus,
        gross_amount: invoiceData.grossAmount,
        discount_amount: invoiceData.discountAmount,
        net_amount: invoiceData.netAmount,
        paid_amount: invoiceData.paidAmount,
        outstanding_amount: invoiceData.outstandingAmount,
        issued_at: invoiceData.issuedAt,
        due_date: invoiceData.dueDate,
        sha256_checksum: invoiceData.sha256Checksum,
        is_archived: invoiceData.isArchived,
        created_by: invoiceData.createdBy,
      })
      .select()
      .single();

    if (invErr || !invResult) {
      throw new Error(`FINANCE_REPOSITORY_ERROR: Failed to create invoice header: ${invErr?.message}`);
    }

    const invoiceId = invResult.id;

    // 2. Insert Line Items
    if (lineItems.length > 0) {
      const itemsToInsert = lineItems.map((item) => ({
        tenant_id: item.tenantId,
        invoice_id: invoiceId,
        item_type: item.itemType,
        description: item.description,
        unit_price: item.unitPrice,
        quantity: item.quantity,
        subtotal_amount: item.subtotalAmount,
        source_domain: item.sourceDomain,
        source_entity_type: item.sourceEntityType,
        source_entity_id: item.sourceEntityId,
      }));

      const { data: itemResults, error: itemErr } = await supabase
        .from('edu_fin_invoice_line_items')
        .insert(itemsToInsert)
        .select();

      if (itemErr) {
        if (itemErr.message.includes('idx_edu_fin_line_items_source_dedup') || itemErr.code === '23505') {
          throw new Error(`MEAL_CHARGE_DOUBLE_BILLING_ERROR: Attempted to double-bill an existing meal charge source occurrence on invoice.`);
        }
        throw new Error(`FINANCE_REPOSITORY_ERROR: Failed to insert line items: ${itemErr.message}`);
      }

      return {
        ...this.mapInvoice(invResult),
        lineItems: (itemResults || []).map(this.mapLineItem),
      };
    }

    return this.mapInvoice(invResult);
  }

  async listInvoices(tenantId: string, studentId?: string): Promise<Invoice[]> {
    let query = supabase.from('edu_fin_invoices').select().eq('tenant_id', tenantId).order('created_at', { ascending: false });
    if (studentId) {
      query = query.eq('student_id', studentId);
    }
    const { data, error } = await query;
    if (error) throw new Error(`FINANCE_REPOSITORY_ERROR: ${error.message}`);
    return (data || []).map(this.mapInvoice);
  }

  async getInvoiceById(tenantId: string, invoiceId: string): Promise<Invoice | null> {
    const { data: inv, error: invErr } = await supabase
      .from('edu_fin_invoices')
      .select()
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .single();

    if (invErr || !inv) return null;

    const { data: items } = await supabase
      .from('edu_fin_invoice_line_items')
      .select()
      .eq('invoice_id', invoiceId)
      .eq('tenant_id', tenantId);

    return {
      ...this.mapInvoice(inv),
      lineItems: (items || []).map(this.mapLineItem),
    };
  }

  async updateInvoiceStatus(
    tenantId: string,
    invoiceId: string,
    update: {
      invoiceStatus?: Invoice['invoiceStatus'];
      settlementStatus?: Invoice['settlementStatus'];
      grossAmount?: number;
      discountAmount?: number;
      netAmount?: number;
      paidAmount?: number;
      outstandingAmount?: number;
      issuedAt?: string;
      sha256Checksum?: string;
    }
  ): Promise<Invoice> {
    const patch: Record<string, unknown> = { updated_at: new Date().toISOString() };
    if (update.invoiceStatus !== undefined) patch.invoice_status = update.invoiceStatus;
    if (update.settlementStatus !== undefined) patch.settlement_status = update.settlementStatus;
    if (update.grossAmount !== undefined) patch.gross_amount = update.grossAmount;
    if (update.discountAmount !== undefined) patch.discount_amount = update.discountAmount;
    if (update.netAmount !== undefined) patch.net_amount = update.netAmount;
    if (update.paidAmount !== undefined) patch.paid_amount = update.paidAmount;
    if (update.outstandingAmount !== undefined) patch.outstanding_amount = update.outstandingAmount;
    if (update.issuedAt !== undefined) patch.issued_at = update.issuedAt;
    if (update.sha256Checksum !== undefined) patch.sha256_checksum = update.sha256Checksum;

    const { data, error } = await supabase
      .from('edu_fin_invoices')
      .update(patch)
      .eq('id', invoiceId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) {
      if (error?.message.includes('INVOICE_PUBLISHED_IMMUTABLE_ERROR')) {
        throw new Error(`INVOICE_PUBLISHED_IMMUTABLE_ERROR: Issued invoices are immutable and cannot have header amounts or core fields modified.`);
      }
      throw new Error(`FINANCE_REPOSITORY_ERROR: Failed to update invoice: ${error?.message}`);
    }

    return this.getInvoiceById(tenantId, invoiceId) as Promise<Invoice>;
  }

  // ── PAYMENTS & RECONCILIATION ──
  async recordPayment(data: Omit<Payment, 'id' | 'createdAt'>): Promise<Payment> {
    const { data: result, error } = await supabase
      .from('edu_fin_payments')
      .insert({
        tenant_id: data.tenantId,
        payer_party_id: data.payerPartyId,
        student_id: data.studentId,
        payment_number: data.paymentNumber,
        payment_method: data.paymentMethod,
        amount: data.amount,
        allocated_amount: data.allocatedAmount,
        unallocated_amount: data.unallocatedAmount,
        reference_number: data.referenceNumber,
        payment_date: data.paymentDate,
        status: data.status,
        created_by: data.createdBy,
      })
      .select()
      .single();

    if (error || !result) {
      throw new Error(`FINANCE_REPOSITORY_ERROR: Failed to record payment: ${error?.message}`);
    }

    return this.mapPayment(result);
  }

  async updatePaymentAllocation(tenantId: string, paymentId: string, allocatedAmount: number, unallocatedAmount: number, status: Payment['status']): Promise<Payment> {
    const { data, error } = await supabase
      .from('edu_fin_payments')
      .update({
        allocated_amount: allocatedAmount,
        unallocated_amount: unallocatedAmount,
        status,
      })
      .eq('id', paymentId)
      .eq('tenant_id', tenantId)
      .select()
      .single();

    if (error || !data) throw new Error(`FINANCE_REPOSITORY_ERROR: ${error?.message}`);
    return this.mapPayment(data);
  }

  async addReconciliationEntry(data: Omit<ReconciliationLedgerEntry, 'id' | 'createdAt'>): Promise<ReconciliationLedgerEntry> {
    const { data: result, error } = await supabase
      .from('edu_fin_reconciliation_ledger')
      .insert({
        tenant_id: data.tenantId,
        payment_id: data.paymentId,
        invoice_id: data.invoiceId,
        allocated_amount: data.allocatedAmount,
        allocation_date: data.allocationDate,
        reconciled_by_party_id: data.reconciledByPartyId,
        notes: data.notes,
      })
      .select()
      .single();

    if (error || !result) {
      if (error?.message.includes('idx_edu_fin_recon_unique') || error?.code === '23505') {
        throw new Error(`DUPLICATE_RECONCILIATION_ERROR: Reconciling duplicate entry for same payment and invoice is blocked.`);
      }
      throw new Error(`FINANCE_REPOSITORY_ERROR: Failed to add reconciliation entry: ${error?.message}`);
    }

    return this.mapReconciliationEntry(result);
  }

  async getReconciliationEntriesForInvoice(tenantId: string, invoiceId: string): Promise<ReconciliationLedgerEntry[]> {
    const { data, error } = await supabase
      .from('edu_fin_reconciliation_ledger')
      .select()
      .eq('tenant_id', tenantId)
      .eq('invoice_id', invoiceId);

    if (error) throw new Error(`FINANCE_REPOSITORY_ERROR: ${error.message}`);
    return (data || []).map(this.mapReconciliationEntry);
  }

  // ── RECEIPTS ──
  async createReceipt(data: Omit<PaymentReceipt, 'id' | 'createdAt'>): Promise<PaymentReceipt> {
    const { data: result, error } = await supabase
      .from('edu_fin_receipts')
      .insert({
        tenant_id: data.tenantId,
        payment_id: data.paymentId,
        invoice_id: data.invoiceId,
        receipt_number: data.receiptNumber,
        settlement_snapshot: data.settlementSnapshot,
        sha256_fingerprint: data.sha256Fingerprint,
        issued_at: data.issuedAt,
      })
      .select()
      .single();

    if (error || !result) {
      throw new Error(`FINANCE_REPOSITORY_ERROR: Failed to create receipt: ${error?.message}`);
    }

    return this.mapReceipt(result);
  }

  // ── PRIVATE MAPPER HELPERS ──
  private mapFeeStructure(r: Record<string, any>): FeeStructure {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      programId: r.program_id,
      feeCode: r.fee_code,
      feeName: r.fee_name,
      feeType: r.fee_type,
      amount: parseFloat(r.amount),
      currency: r.currency,
      billingCycle: r.billing_cycle,
      isActive: r.is_active,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapBillingPeriod(r: Record<string, any>): BillingPeriod {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      periodName: r.period_name,
      startDate: r.start_date,
      endDate: r.end_date,
      dueDate: r.due_date,
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapDiscountProfile(r: Record<string, any>): StudentDiscountProfile {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      studentId: r.student_id,
      discountType: r.discount_type,
      discountName: r.discount_name,
      discountPercent: parseFloat(r.discount_percent),
      fixedAmount: parseFloat(r.fixed_amount),
      reason: r.reason,
      validFrom: r.valid_from,
      validUntil: r.valid_until,
      isActive: r.is_active,
      createdAt: r.created_at,
    };
  }

  private mapInvoice(r: Record<string, any>): Invoice {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      studentId: r.student_id,
      billingPeriodId: r.billing_period_id,
      invoiceNumber: r.invoice_number,
      invoiceStatus: r.invoice_status,
      settlementStatus: r.settlement_status,
      grossAmount: parseFloat(r.gross_amount),
      discountAmount: parseFloat(r.discount_amount),
      netAmount: parseFloat(r.net_amount),
      paidAmount: parseFloat(r.paid_amount),
      outstandingAmount: parseFloat(r.outstanding_amount),
      issuedAt: r.issued_at,
      dueDate: r.due_date,
      sha256Checksum: r.sha256_checksum,
      isArchived: r.is_archived,
      createdBy: r.created_by,
      createdAt: r.created_at,
      updatedAt: r.updated_at,
    };
  }

  private mapLineItem(r: Record<string, any>): InvoiceLineItem {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      invoiceId: r.invoice_id,
      itemType: r.item_type,
      description: r.description,
      unitPrice: parseFloat(r.unit_price),
      quantity: parseFloat(r.quantity),
      subtotalAmount: parseFloat(r.subtotal_amount),
      sourceDomain: r.source_domain,
      sourceEntityType: r.source_entity_type,
      sourceEntityId: r.source_entity_id,
      createdAt: r.created_at,
    };
  }

  private mapPayment(r: Record<string, any>): Payment {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      payerPartyId: r.payer_party_id,
      studentId: r.student_id,
      paymentNumber: r.payment_number,
      paymentMethod: r.payment_method,
      amount: parseFloat(r.amount),
      allocatedAmount: parseFloat(r.allocated_amount),
      unallocatedAmount: parseFloat(r.unallocated_amount),
      referenceNumber: r.reference_number,
      paymentDate: r.payment_date,
      status: r.status,
      createdBy: r.created_by,
      createdAt: r.created_at,
    };
  }

  private mapReconciliationEntry(r: Record<string, any>): ReconciliationLedgerEntry {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      paymentId: r.payment_id,
      invoiceId: r.invoice_id,
      allocatedAmount: parseFloat(r.allocated_amount),
      allocationDate: r.allocation_date,
      reconciledByPartyId: r.reconciled_by_party_id,
      notes: r.notes,
      createdAt: r.created_at,
    };
  }

  private mapReceipt(r: Record<string, any>): PaymentReceipt {
    return {
      id: r.id,
      tenantId: r.tenant_id,
      paymentId: r.payment_id,
      invoiceId: r.invoice_id,
      receiptNumber: r.receipt_number,
      settlementSnapshot: r.settlement_snapshot,
      sha256Fingerprint: r.sha256_fingerprint,
      issuedAt: r.issued_at,
      createdAt: r.created_at,
    };
  }
}
