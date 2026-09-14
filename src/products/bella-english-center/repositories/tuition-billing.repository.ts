/**
 * E7 - English Center Tuition & Billing Repository
 */

import { SupabaseClient } from '@supabase/supabase-js';
import { ClassRow } from '../types/class.types';
import { EnglishCenterEnrollmentRow } from '../types/enrollment.types';
import {
  EnglishCenterTuitionAssignment,
  EnglishCenterTuitionInvoice,
  EnglishCenterTuitionInvoiceLine,
  EnglishCenterTuitionPayment,
  EnglishCenterTuitionPaymentAllocation,
  EnglishCenterTuitionPlan,
  TuitionAssignmentRow,
  TuitionClassContext,
  TuitionEnrollmentContext,
  TuitionInvoiceLineInput,
  TuitionInvoiceLineRow,
  TuitionInvoiceRow,
  TuitionPaymentAllocationRow,
  TuitionPaymentRow,
  TuitionPlanRow,
} from '../types/tuition-billing.types';

export class TuitionBillingRepository {
  constructor(private readonly supabase: SupabaseClient) {}

  async getEnrollmentContext(
    tenantId: string,
    englishEnrollmentId: string
  ): Promise<TuitionEnrollmentContext | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_enrollments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', englishEnrollmentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapEnrollmentRow(row as EnglishCenterEnrollmentRow);
  }

  async getClassContext(tenantId: string, classId: string): Promise<TuitionClassContext | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_classes')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', classId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapClassRow(row as ClassRow);
  }

  async createTuitionPlan(input: {
    tenantId: string;
    branchId?: string | null;
    programId?: string | null;
    classId?: string | null;
    code: string;
    name: string;
    billingCycle: 'monthly' | 'term' | 'course' | 'installment';
    amountMinor: string;
    currency: string;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterTuitionPlan> {
    const { data: row, error } = await this.supabase
      .from('english_center_tuition_plans')
      .insert({
        tenant_id: input.tenantId,
        branch_id: input.branchId || null,
        program_id: input.programId || null,
        class_id: input.classId || null,
        code: input.code,
        name: input.name,
        billing_cycle: input.billingCycle,
        amount_minor: input.amountMinor,
        currency: input.currency,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapPlanRow(row as TuitionPlanRow);
  }

  async getTuitionPlan(tenantId: string, tuitionPlanId: string): Promise<EnglishCenterTuitionPlan | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_tuition_plans')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', tuitionPlanId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapPlanRow(row as TuitionPlanRow);
  }

  async createAssignment(input: {
    tenantId: string;
    branchId: string;
    tuitionPlanId: string;
    englishEnrollmentId: string;
    classId?: string | null;
    startDate: string;
    endDate?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterTuitionAssignment> {
    const { data: row, error } = await this.supabase
      .from('english_center_tuition_assignments')
      .insert({
        tenant_id: input.tenantId,
        branch_id: input.branchId,
        tuition_plan_id: input.tuitionPlanId,
        english_enrollment_id: input.englishEnrollmentId,
        class_id: input.classId || null,
        start_date: input.startDate,
        end_date: input.endDate || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapAssignmentRow(row as TuitionAssignmentRow);
  }

  async getAssignment(tenantId: string, assignmentId: string): Promise<EnglishCenterTuitionAssignment | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_tuition_assignments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', assignmentId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapAssignmentRow(row as TuitionAssignmentRow);
  }

  async createInvoice(input: {
    tenantId: string;
    branchId: string;
    assignmentId: string;
    invoiceNumber: string;
    currency: string;
    grossAmountMinor: string;
    discountAmountMinor: string;
    netAmountMinor: string;
    dueDate: string;
    issuedAt: string;
    financeTransactionId?: string | null;
    metadata?: Record<string, unknown>;
    lines: readonly TuitionInvoiceLineInput[];
  }): Promise<{
    invoice: EnglishCenterTuitionInvoice;
    lines: EnglishCenterTuitionInvoiceLine[];
  }> {
    const { data: invoiceRow, error: invoiceError } = await this.supabase
      .from('english_center_tuition_invoices')
      .insert({
        tenant_id: input.tenantId,
        branch_id: input.branchId,
        assignment_id: input.assignmentId,
        invoice_number: input.invoiceNumber,
        invoice_status: 'issued',
        settlement_status: 'unpaid',
        currency: input.currency,
        gross_amount_minor: input.grossAmountMinor,
        discount_amount_minor: input.discountAmountMinor,
        net_amount_minor: input.netAmountMinor,
        paid_amount_minor: '0',
        outstanding_amount_minor: input.netAmountMinor,
        due_date: input.dueDate,
        issued_at: input.issuedAt,
        finance_transaction_id: input.financeTransactionId || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (invoiceError) throw invoiceError;
    const invoice = this.mapInvoiceRow(invoiceRow as TuitionInvoiceRow);

    const lineRows = input.lines.map((line) => ({
      tenant_id: input.tenantId,
      invoice_id: invoice.id,
      description: line.description,
      quantity: line.quantity,
      unit_amount_minor: line.unitAmountMinor,
      line_amount_minor: (BigInt(line.unitAmountMinor) * BigInt(Math.trunc(line.quantity))).toString(),
      metadata: line.metadata || {},
    }));

    const { data: rows, error: linesError } = await this.supabase
      .from('english_center_tuition_invoice_lines')
      .insert(lineRows)
      .select();

    if (linesError) throw linesError;
    return {
      invoice,
      lines: (rows || []).map((row) => this.mapInvoiceLineRow(row as TuitionInvoiceLineRow)),
    };
  }

  async getInvoice(tenantId: string, invoiceId: string): Promise<EnglishCenterTuitionInvoice | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_tuition_invoices')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('id', invoiceId)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapInvoiceRow(row as TuitionInvoiceRow);
  }

  async getPaymentByIdempotency(
    tenantId: string,
    idempotencyKey: string
  ): Promise<EnglishCenterTuitionPayment | null> {
    const { data: row, error } = await this.supabase
      .from('english_center_tuition_payments')
      .select('*')
      .eq('tenant_id', tenantId)
      .eq('idempotency_key', idempotencyKey)
      .single();

    if (error) {
      if (error.code === 'PGRST116') return null;
      throw error;
    }

    return this.mapPaymentRow(row as TuitionPaymentRow);
  }

  async createPayment(input: {
    tenantId: string;
    branchId: string;
    payerPartyId?: string | null;
    amountMinor: string;
    currency: string;
    method: 'cash' | 'bank_transfer' | 'card' | 'qr_code';
    paymentDate: string;
    idempotencyKey: string;
    externalReference?: string | null;
    financeTransactionId?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterTuitionPayment> {
    const { data: row, error } = await this.supabase
      .from('english_center_tuition_payments')
      .insert({
        tenant_id: input.tenantId,
        branch_id: input.branchId,
        payer_party_id: input.payerPartyId || null,
        amount_minor: input.amountMinor,
        currency: input.currency,
        method: input.method,
        status: 'received',
        payment_date: input.paymentDate,
        idempotency_key: input.idempotencyKey,
        external_reference: input.externalReference || null,
        finance_transaction_id: input.financeTransactionId || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapPaymentRow(row as TuitionPaymentRow);
  }

  async allocatePayment(input: {
    tenantId: string;
    invoiceId: string;
    paymentId: string;
    amountMinor: string;
    allocatedAt: string;
    allocatedBy?: string | null;
    metadata?: Record<string, unknown>;
  }): Promise<EnglishCenterTuitionPaymentAllocation> {
    const { data: row, error } = await this.supabase
      .from('english_center_tuition_payment_allocations')
      .insert({
        tenant_id: input.tenantId,
        invoice_id: input.invoiceId,
        payment_id: input.paymentId,
        amount_minor: input.amountMinor,
        allocated_at: input.allocatedAt,
        allocated_by: input.allocatedBy || null,
        metadata: input.metadata || {},
      })
      .select()
      .single();

    if (error) throw error;
    return this.mapAllocationRow(row as TuitionPaymentAllocationRow);
  }

  async updateInvoiceSettlement(input: {
    tenantId: string;
    invoiceId: string;
    paidAmountMinor: string;
    outstandingAmountMinor: string;
    settlementStatus: 'unpaid' | 'partially_paid' | 'paid' | 'overpaid';
  }): Promise<EnglishCenterTuitionInvoice> {
    const { data: row, error } = await this.supabase
      .from('english_center_tuition_invoices')
      .update({
        paid_amount_minor: input.paidAmountMinor,
        outstanding_amount_minor: input.outstandingAmountMinor,
        settlement_status: input.settlementStatus,
      })
      .eq('tenant_id', input.tenantId)
      .eq('id', input.invoiceId)
      .select()
      .single();

    if (error) throw error;
    return this.mapInvoiceRow(row as TuitionInvoiceRow);
  }

  async markPaymentAllocated(tenantId: string, paymentId: string): Promise<EnglishCenterTuitionPayment> {
    const { data: row, error } = await this.supabase
      .from('english_center_tuition_payments')
      .update({ status: 'allocated' })
      .eq('tenant_id', tenantId)
      .eq('id', paymentId)
      .select()
      .single();

    if (error) throw error;
    return this.mapPaymentRow(row as TuitionPaymentRow);
  }

  private mapEnrollmentRow(row: EnglishCenterEnrollmentRow): TuitionEnrollmentContext {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      canonicalEnrollmentId: row.canonical_enrollment_id,
      branchId: row.branch_id,
      programId: row.program_id,
      classId: row.class_id,
    };
  }

  private mapClassRow(row: ClassRow): TuitionClassContext {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      courseId: row.course_id,
      status: row.status,
    };
  }

  private mapPlanRow(row: TuitionPlanRow): EnglishCenterTuitionPlan {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      programId: row.program_id,
      classId: row.class_id,
      code: row.code,
      name: row.name,
      billingCycle: row.billing_cycle,
      amountMinor: row.amount_minor,
      currency: row.currency,
      status: row.status,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAssignmentRow(row: TuitionAssignmentRow): EnglishCenterTuitionAssignment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      tuitionPlanId: row.tuition_plan_id,
      englishEnrollmentId: row.english_enrollment_id,
      classId: row.class_id,
      startDate: row.start_date,
      endDate: row.end_date,
      status: row.status,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapInvoiceRow(row: TuitionInvoiceRow): EnglishCenterTuitionInvoice {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      assignmentId: row.assignment_id,
      invoiceNumber: row.invoice_number,
      invoiceStatus: row.invoice_status,
      settlementStatus: row.settlement_status,
      currency: row.currency,
      grossAmountMinor: row.gross_amount_minor,
      discountAmountMinor: row.discount_amount_minor,
      netAmountMinor: row.net_amount_minor,
      paidAmountMinor: row.paid_amount_minor,
      outstandingAmountMinor: row.outstanding_amount_minor,
      dueDate: row.due_date,
      issuedAt: row.issued_at,
      financeTransactionId: row.finance_transaction_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapInvoiceLineRow(row: TuitionInvoiceLineRow): EnglishCenterTuitionInvoiceLine {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      invoiceId: row.invoice_id,
      description: row.description,
      quantity: row.quantity,
      unitAmountMinor: row.unit_amount_minor,
      lineAmountMinor: row.line_amount_minor,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }

  private mapPaymentRow(row: TuitionPaymentRow): EnglishCenterTuitionPayment {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id,
      payerPartyId: row.payer_party_id,
      amountMinor: row.amount_minor,
      currency: row.currency,
      method: row.method,
      status: row.status,
      paymentDate: row.payment_date,
      idempotencyKey: row.idempotency_key,
      externalReference: row.external_reference,
      financeTransactionId: row.finance_transaction_id,
      metadata: row.metadata,
      createdAt: row.created_at,
      updatedAt: row.updated_at,
    };
  }

  private mapAllocationRow(row: TuitionPaymentAllocationRow): EnglishCenterTuitionPaymentAllocation {
    return {
      id: row.id,
      tenantId: row.tenant_id,
      invoiceId: row.invoice_id,
      paymentId: row.payment_id,
      amountMinor: row.amount_minor,
      allocatedAt: row.allocated_at,
      allocatedBy: row.allocated_by,
      metadata: row.metadata,
      createdAt: row.created_at,
    };
  }
}
