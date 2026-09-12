/**
 * English Center Billing Service — Integration Test
 * 
 * Proves English Center can consume Platform Finance F3 AR via public contract.
 * Uses real F3 engine, real DB, real F1 side effects.
 * 
 * Evidence:
 * - English Center → Platform Finance (NOT direct DB/RPC)
 * - Invoice creation end-to-end
 * - F1 posting verified
 * - Receivable position verified
 */

import { createEnglishBillingService } from '../ar-service';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';

jest.setTimeout(60000);

describe('English Center Billing Integration', () => {
  let service: ReturnType<typeof createEnglishBillingService>;
  let supabaseAdmin: ReturnType<typeof createClient<Database>>;

  const RUN_ID = Date.now().toString(36).toUpperCase();
  const TENANT_NAME = `EC-BILLING-${RUN_ID}`;

  let testTenantId: string;
  let testStudentPartyId: string;

  beforeAll(async () => {
    // Initialize English Center Billing Service
    service = createEnglishBillingService();

    // Initialize Supabase admin client
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabaseAdmin = createClient<Database>(url, adminKey);

    // Create test tenant
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from('tenants')
      .insert({ name: TENANT_NAME, status: 'active' })
      .select('id')
      .single();

    if (tErr || !tenant) throw tErr || new Error('Tenant creation failed');
    testTenantId = tenant.id;

    // Create test student Party
    const { data: party, error: pErr } = await supabaseAdmin
      .from('party_parties')
      .insert({
        tenant_id: testTenantId,
        party_type: 'person',
        display_name: 'Test Student - Integration'
      })
      .select('id')
      .single();

    if (pErr || !party) throw pErr || new Error('Party creation failed');
    testStudentPartyId = party.id;

    // Seed F1 Chart of Accounts
    const accountsToSeed = [
      { code: '131', name: 'Receivables Control', type: 'ASSET', normal_balance: 'DEBIT' },
      { code: '5111', name: 'Revenue Packages', type: 'REVENUE', normal_balance: 'CREDIT' },
      { code: '5112', name: 'Revenue Retail', type: 'REVENUE', normal_balance: 'CREDIT' },
      { code: '3331', name: 'VAT Payable', type: 'LIABILITY', normal_balance: 'CREDIT' }
    ];

    for (const account of accountsToSeed) {
      const { error: acctErr } = await supabaseAdmin
        .from('finance_accounts')
        .insert({
          tenant_id: testTenantId,
          code: account.code,
          name: account.name,
          type: account.type,
          normal_balance: account.normal_balance,
          currency: 'VND',
          is_active: true
        });

      if (acctErr) throw acctErr;
    }

    // Seed F1 Accounting Period
    const { error: periodErr } = await supabaseAdmin
      .from('finance_accounting_periods')
      .insert({
        tenant_id: testTenantId,
        name: '2026-09',
        period_start: '2026-09-01T00:00:00Z',
        period_end: '2026-09-30T23:59:59Z',
        status: 'OPEN'
      });

    if (periodErr) throw periodErr;
  });

  afterAll(async () => {
    // Cleanup: Delete test tenant (cascades to all related records)
    if (testTenantId) {
      await supabaseAdmin.from('tenants').delete().eq('id', testTenantId);
    }
  });

  // ========================================================================
  // R5.1: ENROLLMENT INVOICE CREATION (END-TO-END)
  // ========================================================================

  describe('R5.1: Enrollment Invoice Creation', () => {
    it('should create invoice end-to-end via Platform Finance', async () => {
      const enrollmentId = `ENR-${RUN_ID}-001`;

      // English Center creates invoice via public Platform API
      const result = await service.createEnrollmentInvoice({
        tenantId: testTenantId,
        enrollmentId,
        studentPartyId: testStudentPartyId,
        courseId: 'COURSE-A1',
        courseName: 'English Elementary A1',
        courseFeeMinor: 5000000,  // 5,000,000 VND
        materialsFeeMinor: 500000,  // 500,000 VND
        taxRate: 0.1,  // 10% VAT
        startDate: '2026-09-01',
        paymentDueDate: '2026-09-15'
      });

      // Verify invoice finalized
      expect(result.status).toBe('FINALIZED');
      expect(result.f1TransactionId).toBeDefined();
      expect(result.totalInvoiceAmountMinor).toBeGreaterThan(0);

      // Evidence 1: Invoice persisted in finance_invoices
      const { data: invoice } = await supabaseAdmin
        .from('finance_invoices')
        .select('*')
        .eq('id', result.invoiceId)
        .single();

      expect(invoice).toBeDefined();
      expect(invoice?.invoice_number).toBe(`ENR-${enrollmentId}`);
      expect(invoice?.customer_id).toBe(testStudentPartyId);  // Party-native identity
      expect(invoice?.status).toBe('FINALIZED');

      // Evidence 2: Invoice lines persisted
      const { data: lines } = await supabaseAdmin
        .from('finance_invoice_lines')
        .select('*')
        .eq('invoice_id', result.invoiceId);

      expect(lines).toHaveLength(2);  // Tuition + Materials
      expect(lines?.find(l => l.description.includes('Tuition'))).toBeDefined();
      expect(lines?.find(l => l.description.includes('Materials'))).toBeDefined();

      // Evidence 3: F1 GL transaction created
      const { data: transaction } = await supabaseAdmin
        .from('finance_transactions')
        .select('*')
        .eq('id', result.f1TransactionId!)
        .single();

      expect(transaction).toBeDefined();
      expect(transaction?.status).toBe('POSTED');
      expect(transaction?.tenant_id).toBe(testTenantId);

      // Evidence 4: F1 transaction lines created
      const { data: txLines } = await supabaseAdmin
        .from('finance_transaction_lines')
        .select(`
          *,
          finance_accounts!finance_transaction_lines_account_id_fkey (
            code
          )
        `)
        .eq('transaction_id', result.f1TransactionId!);

      expect(txLines).toBeDefined();
      expect(txLines!.length).toBeGreaterThan(0);

      // Verify DR to Receivables Control (131)
      const drLine = txLines?.find(l => 
        (l.finance_accounts as any)?.code === '131'
      );
      expect(drLine).toBeDefined();
      expect(parseInt(drLine!.debit_amount)).toBeGreaterThan(0);
      expect(parseInt(drLine!.credit_amount)).toBe(0);

      // Verify CR to Revenue accounts (5111, 5112)
      const revenueLines = txLines?.filter(l => {
        const code = (l.finance_accounts as any)?.code;
        return code === '5111' || code === '5112';
      });
      expect(revenueLines?.length).toBeGreaterThan(0);

      // Evidence 5: AR subledger entry created
      const { data: ledger } = await supabaseAdmin
        .from('finance_receivable_ledger')
        .select('*')
        .eq('invoice_id', result.invoiceId)
        .eq('entry_type', 'DEBIT_ACCRUAL');

      expect(ledger).toHaveLength(1);
      expect(parseInt(ledger![0].amount_minor)).toBeGreaterThan(0);

      // Evidence 6: AR position created
      const { data: position } = await supabaseAdmin
        .from('finance_receivable_positions')
        .select('*')
        .eq('invoice_id', result.invoiceId)
        .single();

      expect(position).toBeDefined();
      expect(position?.customer_id).toBe(testStudentPartyId);
      expect(parseInt(position!.original_amount_minor)).toBeGreaterThan(0);
      expect(parseInt(position!.outstanding_amount_minor)).toBeGreaterThan(0);
    });

    it('should create invoice with tuition only (no materials)', async () => {
      const enrollmentId = `ENR-${RUN_ID}-002`;

      const result = await service.createEnrollmentInvoice({
        tenantId: testTenantId,
        enrollmentId,
        studentPartyId: testStudentPartyId,
        courseId: 'COURSE-B1',
        courseName: 'Business English',
        courseFeeMinor: 3000000,
        materialsFeeMinor: 0,  // No materials
        taxRate: 0.1,
        startDate: '2026-09-05',
        paymentDueDate: '2026-09-20'
      });

      expect(result.status).toBe('FINALIZED');

      // Verify only 1 line (tuition)
      const { data: lines } = await supabaseAdmin
        .from('finance_invoice_lines')
        .select('*')
        .eq('invoice_id', result.invoiceId);

      expect(lines).toHaveLength(1);
      expect(lines?.[0].description).toContain('Business English');
      expect(lines?.[0].revenue_account_code).toBe('5111');
    });
  });

  // ========================================================================
  // R5.2: GET INVOICE VIEW
  // ========================================================================

  describe('R5.2: Get Invoice View', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const result = await service.createEnrollmentInvoice({
        tenantId: testTenantId,
        enrollmentId: `ENR-${RUN_ID}-VIEW`,
        studentPartyId: testStudentPartyId,
        courseId: 'COURSE-C1',
        courseName: 'IELTS Prep',
        courseFeeMinor: 8000000,
        materialsFeeMinor: 1000000,
        taxRate: 0.1,
        startDate: '2026-09-10',
        paymentDueDate: '2026-09-25'
      });
      invoiceId = result.invoiceId;
    });

    it('should retrieve invoice view with header + lines + position', async () => {
      const view = await service.getEnrollmentInvoice(testTenantId, invoiceId);

      // Header verification
      expect(view.header).toBeDefined();
      expect(view.header.partyId).toBe(testStudentPartyId);  // ← Party-native
      expect(view.header.status).toBe('FINALIZED');
      expect(view.header.f1TransactionId).toBeDefined();
      expect((view.header as any).customer_id).toBeUndefined();  // NOT exposed to Product

      // Lines verification
      expect(view.lines).toHaveLength(2);
      expect(view.lines.find(l => l.description.includes('IELTS Prep'))).toBeDefined();
      expect(view.lines.find(l => l.description.includes('Materials'))).toBeDefined();

      // Position verification
      expect(view.position).toBeDefined();
      expect(view.position?.partyId).toBe(testStudentPartyId);
      expect(view.position?.outstandingAmountMinor).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // R5.3: VOID ENROLLMENT INVOICE
  // ========================================================================

  describe('R5.3: Void Enrollment Invoice', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const result = await service.createEnrollmentInvoice({
        tenantId: testTenantId,
        enrollmentId: `ENR-${RUN_ID}-VOID`,
        studentPartyId: testStudentPartyId,
        courseId: 'COURSE-D1',
        courseName: 'TOEIC Prep',
        courseFeeMinor: 6000000,
        materialsFeeMinor: 800000,
        taxRate: 0.1,
        startDate: '2026-09-01',
        paymentDueDate: '2026-09-15'
      });
      invoiceId = result.invoiceId;
    });

    it('should void invoice and create F1 reversal', async () => {
      const result = await service.voidEnrollmentInvoice(testTenantId, invoiceId);

      expect(result.status).toBe('VOIDED');
      expect(result.f1ReversalTransactionId).toBeDefined();

      // Verify invoice status updated
      const { data: invoice } = await supabaseAdmin
        .from('finance_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      expect(invoice?.status).toBe('VOIDED');

      // Verify F1 reversal transaction created
      const { data: reversalTx } = await supabaseAdmin
        .from('finance_transactions')
        .select('*')
        .eq('id', result.f1ReversalTransactionId!)
        .single();

      expect(reversalTx).toBeDefined();
      expect(reversalTx?.status).toBe('POSTED');

      // Verify AR subledger CREDIT_ADJUSTMENT entry
      const { data: ledger } = await supabaseAdmin
        .from('finance_receivable_ledger')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('entry_type', 'CREDIT_ADJUSTMENT');

      expect(ledger).toHaveLength(1);

      // Verify AR position outstanding = 0
      const { data: position } = await supabaseAdmin
        .from('finance_receivable_positions')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single();

      expect(parseInt(position!.outstanding_amount_minor)).toBe(0);
    });
  });

  // ========================================================================
  // R5.4: OWNERSHIP BOUNDARY VERIFICATION
  // ========================================================================

  describe('R5.4: Ownership Boundary Compliance', () => {
    it('should NOT access finance_* tables directly from Product code', () => {
      // This test verifies by inspection that ar-service.ts uses:
      // - '@/platform/finance' imports only
      // - NO direct 'finance_invoices', 'finance_invoice_lines', etc.
      // - NO direct RPC calls ('finance_create_draft_invoice', etc.)

      const serviceCode = require('fs').readFileSync(
        require.resolve('../ar-service'),
        'utf-8'
      );

      // Verify Platform Finance import exists
      expect(serviceCode).toContain("from '@/platform/finance'");

      // Verify NO direct table access
      expect(serviceCode).not.toContain('finance_invoices');
      expect(serviceCode).not.toContain('finance_invoice_lines');
      expect(serviceCode).not.toContain('finance_receivable_ledger');
      expect(serviceCode).not.toContain('finance_receivable_positions');

      // Verify NO direct RPC calls
      expect(serviceCode).not.toContain('finance_create_draft_invoice');
      expect(serviceCode).not.toContain('finance_add_invoice_line');
      expect(serviceCode).not.toContain('finance_finalize_invoice');
      expect(serviceCode).not.toContain('finance_void_invoice');

      // Verify uses contract methods only
      expect(serviceCode).toContain('createDraftInvoice');
      expect(serviceCode).toContain('addInvoiceLine');
      expect(serviceCode).toContain('finalizeInvoice');
      expect(serviceCode).toContain('voidInvoice');
      expect(serviceCode).toContain('getInvoice');
    });

    it('should propagate Party-native identity (NOT customer_id)', async () => {
      const result = await service.createEnrollmentInvoice({
        tenantId: testTenantId,
        enrollmentId: `ENR-${RUN_ID}-PARTY`,
        studentPartyId: testStudentPartyId,
        courseId: 'COURSE-E1',
        courseName: 'Conversation Practice',
        courseFeeMinor: 2000000,
        taxRate: 0.1,
        startDate: '2026-09-01',
        paymentDueDate: '2026-09-15'
      });

      // Product sees partyId in result/view
      const view = await service.getEnrollmentInvoice(testTenantId, result.invoiceId);
      expect(view.header.partyId).toBe(testStudentPartyId);

      // Product does NOT see customer_id
      expect((view.header as any).customer_id).toBeUndefined();

      // But DB has customer_id (internal mapping)
      const { data: invoice } = await supabaseAdmin
        .from('finance_invoices')
        .select('customer_id')
        .eq('id', result.invoiceId)
        .single();

      expect(invoice?.customer_id).toBe(testStudentPartyId);
    });
  });
});
