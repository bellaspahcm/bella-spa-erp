/**
 * F3 AR Engine Integration Tests (Runtime with Real DB/RPCs)
 * 
 * Proves Contract works with deployed F3 schema/RPCs.
 * Uses real Supabase connection, not mocks.
 * 
 * @requires F3 AR schema (finance_invoices, finance_invoice_lines, etc.)
 * @requires F3 RPCs (finance_create_draft_invoice, etc.)
 * @requires F1 GL schema (finance_accounts, finance_accounting_periods)
 * @requires Party system (party_parties)
 */

import { createF3AREngine } from '../f3-ar-engine';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import { createClient } from '@supabase/supabase-js';
import type { Database } from '@/types/database.types';
import {
  IF3AccountsReceivable,
  F3InvoiceNotDraftError,
  F3InvalidInputError,
  F3InvoiceNumberDuplicateError,
  F3InvoiceEmptyError,
  F3InvoiceNotFinalizedError
} from '@/platform/finance/contracts/f3-ar.contract';

jest.setTimeout(60000);

describe('F3 AR Engine Integration Tests', () => {
  let engine: IF3AccountsReceivable;
  let supabaseAdmin: ReturnType<typeof createClient<Database>>;

  const RUN_ID = Date.now().toString(36).toUpperCase();
  const TENANT_NAME = `F3-INTEGRATION-${RUN_ID}`;

  let testTenantId: string;
  let testPartyId: string;

  beforeAll(async () => {
    // Initialize engine
    engine = createF3AREngine();

    // Initialize Supabase admin client (bypasses RLS with service_role)
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

    // Create test Party
    const { data: party, error: pErr } = await supabaseAdmin
      .from('party_parties')
      .insert({
        tenant_id: testTenantId,
        party_type: 'person',  // lowercase per CHECK constraint
        display_name: 'Test Student'
      })
      .select('id')
      .single();

    if (pErr || !party) throw pErr || new Error('Party creation failed');
    testPartyId = party.id;

    // Seed F1 Chart of Accounts using Supabase client
    const accountsToSeed = [
      { code: '131', name: 'Receivables Control', type: 'ASSET', normal_balance: 'DEBIT' },
      { code: '5111', name: 'Revenue Packages', type: 'REVENUE', normal_balance: 'CREDIT' },
      { code: '5112', name: 'Revenue Retail', type: 'REVENUE', normal_balance: 'CREDIT' },
      { code: '3331', name: 'VAT Payable', type: 'LIABILITY', normal_balance: 'CREDIT' },
      { code: '9999', name: 'Inactive Revenue', type: 'REVENUE', normal_balance: 'CREDIT', is_active: false }
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
          is_active: account.is_active ?? true
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
  // R3.1: CREATE DRAFT INVOICE RUNTIME
  // ========================================================================

  describe('R3.1: createDraftInvoice runtime', () => {
    it('should create DRAFT invoice with real RPC', async () => {
      const result = await engine.createDraftInvoice({
        tenantId: testTenantId,
        partyId: testPartyId,
        invoiceNumber: `INV-${RUN_ID}-001`,
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });

      expect(result.invoiceId).toBeDefined();
      expect(result.status).toBe('DRAFT');
      expect(result.totalInvoiceAmountMinor).toBe(0);

      // Verify invoice persisted in DB
      const { data: invoice } = await supabaseAdmin
        .from('finance_invoices')
        .select('*')
        .eq('id', result.invoiceId)
        .single();

      expect(invoice).toBeDefined();
      expect(invoice?.customer_id).toBe(testPartyId);  // ← Verify partyId stored as customer_id
      expect(invoice?.status).toBe('DRAFT');
    });

    it('should reject invalid Party (does not exist)', async () => {
      const fakePartyId = '00000000-0000-0000-0000-000000000000';

      await expect(
        engine.createDraftInvoice({
          tenantId: testTenantId,
          partyId: fakePartyId,
          invoiceNumber: `INV-${RUN_ID}-invalid`,
          currency: 'VND',
          issueDate: '2026-09-01',
          dueDate: '2026-09-30'
        })
      ).rejects.toThrow(F3InvalidInputError);
    });

    it('should reject duplicate invoice number', async () => {
      const duplicateNumber = `INV-${RUN_ID}-DUP`;

      // Create first invoice
      await engine.createDraftInvoice({
        tenantId: testTenantId,
        partyId: testPartyId,
        invoiceNumber: duplicateNumber,
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });

      // Attempt duplicate
      await expect(
        engine.createDraftInvoice({
          tenantId: testTenantId,
          partyId: testPartyId,
          invoiceNumber: duplicateNumber,
          currency: 'VND',
          issueDate: '2026-09-01',
          dueDate: '2026-09-30'
        })
      ).rejects.toThrow(F3InvoiceNumberDuplicateError);
    });
  });

  // ========================================================================
  // R3.2: ADD INVOICE LINE RUNTIME
  // ========================================================================

  describe('R3.2: addInvoiceLine runtime', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const result = await engine.createDraftInvoice({
        tenantId: testTenantId,
        partyId: testPartyId,
        invoiceNumber: `INV-${RUN_ID}-LINE`,
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });
      invoiceId = result.invoiceId;
    });

    it('should add line and update header totals', async () => {
      const result = await engine.addInvoiceLine({
        tenantId: testTenantId,
        invoiceId,
        description: 'Monthly Tuition Fee',
        quantity: 1,
        unitPriceMinor: 5000000,  // 5,000,000 VND
        taxRate: 0.1,  // 10% VAT
        revenueAccountCode: '5111'
      });

      expect(result.status).toBe('DRAFT');
      expect(result.totalInvoiceAmountMinor).toBeGreaterThan(0);

      // Verify line persisted
      const { data: lines } = await supabaseAdmin
        .from('finance_invoice_lines')
        .select('*')
        .eq('invoice_id', invoiceId);

      expect(lines).toHaveLength(1);
      expect(lines?.[0].description).toBe('Monthly Tuition Fee');
      expect(parseInt(lines?.[0].amount_minor)).toBe(5000000);
    });

    it('should reject adding line to non-existent invoice', async () => {
      const fakeInvoiceId = '00000000-0000-0000-0000-000000000000';

      await expect(
        engine.addInvoiceLine({
          tenantId: testTenantId,
          invoiceId: fakeInvoiceId,
          description: 'Test',
          quantity: 1,
          unitPriceMinor: 1000,
          taxRate: 0.1,
          revenueAccountCode: '5111'
        })
      ).rejects.toThrow();
    });
  });

  // ========================================================================
  // R3.3: FINALIZE INVOICE RUNTIME
  // ========================================================================

  describe('R3.3: finalizeInvoice runtime', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const result = await engine.createDraftInvoice({
        tenantId: testTenantId,
        partyId: testPartyId,
        invoiceNumber: `INV-${RUN_ID}-FINALIZE`,
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });
      invoiceId = result.invoiceId;

      await engine.addInvoiceLine({
        tenantId: testTenantId,
        invoiceId,
        description: 'Course Fee',
        quantity: 1,
        unitPriceMinor: 10000000,
        taxRate: 0.1,
        revenueAccountCode: '5111'
      });
    });

    it('should finalize invoice and create F1 transaction', async () => {
      const result = await engine.finalizeInvoice({
        tenantId: testTenantId,
        invoiceId
      });

      expect(result.status).toBe('FINALIZED');
      expect(result.f1TransactionId).toBeDefined();

      // Verify invoice status updated
      const { data: invoice } = await supabaseAdmin
        .from('finance_invoices')
        .select('*')
        .eq('id', invoiceId)
        .single();

      expect(invoice?.status).toBe('FINALIZED');
      expect(invoice?.f1_transaction_id).toBeDefined();

      // Verify F1 transaction created
      const { data: f1Tx } = await supabaseAdmin
        .from('finance_transactions')
        .select('*')
        .eq('id', invoice!.f1_transaction_id!)
        .single();

      expect(f1Tx).toBeDefined();
      expect(f1Tx?.status).toBe('POSTED');

      // Verify AR subledger entry created
      const { data: ledger } = await supabaseAdmin
        .from('finance_receivable_ledger')
        .select('*')
        .eq('invoice_id', invoiceId)
        .eq('entry_type', 'DEBIT_ACCRUAL');

      expect(ledger).toHaveLength(1);
      expect(parseInt(ledger?.[0].amount_minor)).toBeGreaterThan(0);

      // Verify AR position created
      const { data: position } = await supabaseAdmin
        .from('finance_receivable_positions')
        .select('*')
        .eq('invoice_id', invoiceId)
        .single();

      expect(position).toBeDefined();
      expect(parseInt(position!.outstanding_amount_minor)).toBeGreaterThan(0);
    });

    it('should reject finalizing empty invoice', async () => {
      const emptyResult = await engine.createDraftInvoice({
        tenantId: testTenantId,
        partyId: testPartyId,
        invoiceNumber: `INV-${RUN_ID}-EMPTY`,
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });

      await expect(
        engine.finalizeInvoice({
          tenantId: testTenantId,
          invoiceId: emptyResult.invoiceId
        })
      ).rejects.toThrow(F3InvoiceEmptyError);
    });

    it('should be idempotent (retry returns success)', async () => {
      const result1 = await engine.finalizeInvoice({
        tenantId: testTenantId,
        invoiceId
      });

      const result2 = await engine.finalizeInvoice({
        tenantId: testTenantId,
        invoiceId
      });

      expect(result2.f1TransactionId).toBe(result1.f1TransactionId);
      expect(result2.isDuplicate).toBe(true);

      // Verify no duplicate F1 transactions
      const { data: transactions } = await supabaseAdmin
        .from('finance_transactions')
        .select('*')
        .eq('id', result1.f1TransactionId!);

      expect(transactions).toHaveLength(1);
    });
  });

  // ========================================================================
  // R3.4: VOID INVOICE RUNTIME
  // ========================================================================

  describe('R3.4: voidInvoice runtime', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const result = await engine.createDraftInvoice({
        tenantId: testTenantId,
        partyId: testPartyId,
        invoiceNumber: `INV-${RUN_ID}-VOID`,
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });
      invoiceId = result.invoiceId;

      await engine.addInvoiceLine({
        tenantId: testTenantId,
        invoiceId,
        description: 'Service Fee',
        quantity: 1,
        unitPriceMinor: 3000000,
        taxRate: 0.1,
        revenueAccountCode: '5111'
      });

      await engine.finalizeInvoice({
        tenantId: testTenantId,
        invoiceId
      });
    });

    it('should void finalized invoice and create F1 reversal', async () => {
      const result = await engine.voidInvoice({
        tenantId: testTenantId,
        invoiceId
      });

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

      // Verify AR subledger CREDIT_ADJUSTMENT entry created
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

    it('should reject voiding DRAFT invoice', async () => {
      const draftResult = await engine.createDraftInvoice({
        tenantId: testTenantId,
        partyId: testPartyId,
        invoiceNumber: `INV-${RUN_ID}-DRAFT-VOID`,
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });

      await expect(
        engine.voidInvoice({
          tenantId: testTenantId,
          invoiceId: draftResult.invoiceId
        })
      ).rejects.toThrow(F3InvoiceNotFinalizedError);
    });
  });

  // ========================================================================
  // R3.5: GET INVOICE RUNTIME
  // ========================================================================

  describe('R3.5: getInvoice runtime', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const result = await engine.createDraftInvoice({
        tenantId: testTenantId,
        partyId: testPartyId,
        invoiceNumber: `INV-${RUN_ID}-GET`,
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });
      invoiceId = result.invoiceId;

      await engine.addInvoiceLine({
        tenantId: testTenantId,
        invoiceId,
        description: 'Item 1',
        quantity: 1,
        unitPriceMinor: 1000000,
        taxRate: 0.1,
        revenueAccountCode: '5111'
      });

      await engine.addInvoiceLine({
        tenantId: testTenantId,
        invoiceId,
        description: 'Item 2',
        quantity: 2,
        unitPriceMinor: 500000,
        taxRate: 0.1,
        revenueAccountCode: '5112'
      });
    });

    it('should retrieve invoice with header + lines', async () => {
      const view = await engine.getInvoice({
        tenantId: testTenantId,
        invoiceId
      });

      expect(view.header).toBeDefined();
      expect(view.header.partyId).toBe(testPartyId);  // ← Verify customer_id mapped to partyId
      expect(view.header.status).toBe('DRAFT');
      expect((view.header as any).customer_id).toBeUndefined();  // customer_id NOT exposed

      expect(view.lines).toHaveLength(2);
      expect(view.lines[0].description).toBe('Item 1');
      expect(view.lines[1].description).toBe('Item 2');

      expect(view.position).toBeUndefined();  // No position for DRAFT invoice
    });

    it('should include AR position for finalized invoice', async () => {
      await engine.finalizeInvoice({
        tenantId: testTenantId,
        invoiceId
      });

      const view = await engine.getInvoice({
        tenantId: testTenantId,
        invoiceId
      });

      expect(view.header.status).toBe('FINALIZED');
      expect(view.position).toBeDefined();
      expect(view.position?.partyId).toBe(testPartyId);
      expect(view.position?.outstandingAmountMinor).toBeGreaterThan(0);
    });
  });

  // ========================================================================
  // R3.6: PARTY + TENANT NEGATIVE TESTS
  // ========================================================================

  describe('R3.6: Party + tenant isolation', () => {
    let otherTenantId: string;
    let otherPartyId: string;

    beforeAll(async () => {
      // Create second tenant
      const { data: tenant2 } = await supabaseAdmin
        .from('tenants')
        .insert({ name: `${TENANT_NAME}-OTHER`, status: 'active' })
        .select('id')
        .single();

      otherTenantId = tenant2!.id;

      // Create Party in second tenant
      const { data: party2 } = await supabaseAdmin
        .from('party_parties')
        .insert({
          tenant_id: otherTenantId,
          party_type: 'person',
          display_name: 'Other Student'
        })
        .select('id')
        .single();

      otherPartyId = party2!.id;
    });

    afterAll(async () => {
      if (otherTenantId) {
        await supabaseAdmin.from('tenants').delete().eq('id', otherTenantId);
      }
    });

    it('should reject Party from different tenant', async () => {
      await expect(
        engine.createDraftInvoice({
          tenantId: testTenantId,
          partyId: otherPartyId,  // Party belongs to otherTenantId
          invoiceNumber: `INV-${RUN_ID}-CROSS-TENANT`,
          currency: 'VND',
          issueDate: '2026-09-01',
          dueDate: '2026-09-30'
        })
      ).rejects.toThrow(F3InvalidInputError);
    });
  });

  // ========================================================================
  // R3.7: TYPED ERROR MAPPING (REAL DB BEHAVIOR)
  // ========================================================================

  describe('R3.7: Typed error mapping', () => {
    let invoiceId: string;

    beforeAll(async () => {
      const result = await engine.createDraftInvoice({
        tenantId: testTenantId,
        partyId: testPartyId,
        invoiceNumber: `INV-${RUN_ID}-ERROR`,
        currency: 'VND',
        issueDate: '2026-09-01',
        dueDate: '2026-09-30'
      });
      invoiceId = result.invoiceId;

      await engine.addInvoiceLine({
        tenantId: testTenantId,
        invoiceId,
        description: 'Test',
        quantity: 1,
        unitPriceMinor: 1000000,
        taxRate: 0.1,
        revenueAccountCode: '5111'
      });

      await engine.finalizeInvoice({
        tenantId: testTenantId,
        invoiceId
      });
    });

    it('should throw F3InvoiceNotDraftError when adding line to finalized invoice', async () => {
      try {
        await engine.addInvoiceLine({
          tenantId: testTenantId,
          invoiceId,
          description: 'Late line',
          quantity: 1,
          unitPriceMinor: 500000,
          taxRate: 0.1,
          revenueAccountCode: '5111'
        });
        fail('Should have thrown');
      } catch (err) {
        expect(err).toBeInstanceOf(F3InvoiceNotDraftError);
        expect((err as F3InvoiceNotDraftError).code).toBe('F3003');
      }
    });
  });
});
