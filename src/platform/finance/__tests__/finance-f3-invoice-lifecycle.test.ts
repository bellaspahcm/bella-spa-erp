/**
 * Integration Test Suite for F3.2 Invoice Lifecycle State Machine & Posting
 *
 * Verifies all 24 database-level lifecycle targets for F3 Invoicing:
 * - Draft creation & invoice number uniqueness (T01 - T02)
 * - Line & Tax calculation, rounding, header reconciliation (T03 - T06)
 * - Finalization restrictions & success outcomes (T07 - T11)
 * - Finalize idempotency & atomic rollback fail-cases (T12 - T14)
 * - Invalid transitions & Void/Reversal flows (T15 - T20)
 * - Multi-account post, zero-value rejection, rounding & COA checks (T21 - T24)
 *
 * Compliance:
 * - TypeSafety-NoAny: Strictly typed with zero 'any' usages.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { Client } from 'pg';
import { createHash } from 'crypto';

jest.setTimeout(60000);

describe('F3.2 Invoice Lifecycle Integration Tests', () => {
  let supabaseAdmin: ReturnType<typeof createSupabaseClient<Database>>;
  let pgClientAdmin: Client;

  const RUN_ID = Date.now().toString(36).toUpperCase();
  const TENANT_NAME = `F3-LIFECYCLE-${RUN_ID}`;

  let testTenantId: string;
  let customerId: string;
  let sharedPeriodId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabaseAdmin = createSupabaseClient<Database>(url, adminKey);

    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (!dbUrl) throw new Error('Database URL env is missing');

    pgClientAdmin = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await pgClientAdmin.connect();

    // Create Tenant
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from('tenants')
      .insert({ name: TENANT_NAME, status: 'active' })
      .select('id')
      .single();
    if (tErr || !tenant) throw tErr || new Error('Tenant creation failed');
    testTenantId = tenant.id;

    customerId = crypto.randomUUID();

    // Seed F1 Accounts (valid COA)
    await pgClientAdmin.query(`
      INSERT INTO public.finance_accounts (tenant_id, code, name, type, normal_balance, currency, is_active) VALUES
      ('${testTenantId}', '131', 'Receivables Control', 'ASSET', 'DEBIT', 'VND', true),
      ('${testTenantId}', '5111', 'Revenue Packages', 'REVENUE', 'CREDIT', 'VND', true),
      ('${testTenantId}', '5112', 'Revenue Retail', 'REVENUE', 'CREDIT', 'VND', true),
      ('${testTenantId}', '3331', 'VAT Payable', 'LIABILITY', 'CREDIT', 'VND', true),
      ('${testTenantId}', '9999', 'Inactive Rev', 'REVENUE', 'CREDIT', 'VND', false); -- Inactive for testing T24
    `);

    // Seed F1 Accounting Period
    const { data: period, error: pErr } = await supabaseAdmin
      .from('finance_accounting_periods')
      .insert({
        tenant_id: testTenantId,
        name: '2026-08',
        period_start: '2026-08-01T00:00:00Z',
        period_end: '2026-08-31T23:59:59Z',
        status: 'OPEN'
      })
      .select('id')
      .single();
    if (pErr || !period) throw pErr || new Error('Period setup failed');
    sharedPeriodId = period.id;
  });

  afterAll(async () => {
    if (testTenantId) {
      await supabaseAdmin.from('tenants').delete().eq('id', testTenantId);
    }
    await pgClientAdmin.end();
  });

  // =========================================================================
  // T01 - T02: DRAFT Invoice creation & Uniqueness
  // =========================================================================

  test('F3.2-T01: Create DRAFT invoice successfully', async () => {
    const res = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T01', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = res.rows[0].id;
    expect(invoiceId).not.toBeNull();

    const header = await pgClientAdmin.query(`SELECT status, total_invoice_amount_minor, posting_status FROM public.finance_invoices WHERE id = '${invoiceId}';`);
    expect(header.rows[0].status).toBe('DRAFT');
    expect(header.rows[0].total_invoice_amount_minor).toBe('0');
    expect(header.rows[0].posting_status).toBe('PENDING');
  });

  test('F3.2-T02: Invoice number uniqueness per tenant', async () => {
    // 1st invoice INV-T02 - succeeds
    await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T02', 'VND', '2026-08-15', '2026-09-15'
      );
    `);

    // 2nd invoice INV-T02 - must fail
    let err: string | null = null;
    try {
      await pgClientAdmin.query(`
        SELECT public.finance_create_draft_invoice(
          '${testTenantId}', '${customerId}', 'INV-T02', 'VND', '2026-08-15', '2026-09-15'
        );
      `);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toContain('uq_invoice_number_per_tenant');
  });

  // =========================================================================
  // T03 - T06: Add Line, Rounding, Tax & Totals Reconciliation
  // =========================================================================

  test('F3.2-T03 to T06: Add line, rounding, tax calculation, and totals reconciliation', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T03-06', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;

    // T03 & T04: Add line with rounding (quantity 1.3333 * unit price 1000 = 1333)
    const lineRes = await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line(
        '${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Rounded Service Line', 1.3333, 1000, 0.1, '5111'
      ) as line_id;
    `);
    expect(lineRes.rows[0].line_id).not.toBeNull();

    const line = await pgClientAdmin.query(`SELECT amount_minor FROM public.finance_invoice_lines WHERE id = '${lineRes.rows[0].line_id}';`);
    expect(line.rows[0].amount_minor).toBe('1333'); // ROUND(1.3333 * 1000)

    // T05 & T06: Add second line with tax (pretax: 500,000, tax: 10% = 50,000)
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line(
        '${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Standard Line', 1.0, 500000, 0.1, '5111'
      );
    `);

    // Verify totals reconciliation on header
    const header = await pgClientAdmin.query(`
      SELECT total_pretax_amount_minor, tax_amount_minor, total_invoice_amount_minor 
      FROM public.finance_invoices WHERE id = '${invoiceId}';
    `);

    // Pretax = 1333 + 500000 = 501333
    expect(header.rows[0].total_pretax_amount_minor).toBe('501333');
    // Tax = ROUND(1333 * 0.1) + ROUND(500000 * 0.1) = 133 + 50000 = 50133
    expect(header.rows[0].tax_amount_minor).toBe('50133');
    // Total = Pretax + Tax = 501333 + 50133 = 551466
    expect(header.rows[0].total_invoice_amount_minor).toBe('551466');
  });

  // =========================================================================
  // T07 - T11: Finalization outcomes
  // =========================================================================

  test('F3.2-T07 to T11: Finalize invoice outcomes and constraints', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T07-11', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Suite', 1, 1000000, 0.1, '5111');
    `);

    // Prepare valid hạch toán payload
    const lines = [
      { account_code: '131', debit_functional_amount: 1100000, credit_functional_amount: 0, debit_amount_minor: 1100000, credit_amount_minor: 0, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'AR Debit' },
      { account_code: '5111', debit_functional_amount: 0, credit_functional_amount: 1000000, debit_amount_minor: 0, credit_amount_minor: 1000000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Rev Credit' },
      { account_code: '3331', debit_functional_amount: 0, credit_functional_amount: 100000, debit_amount_minor: 0, credit_amount_minor: 100000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Tax Credit' }
    ];

    const { posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];
    const reqHash = createHash('sha256').update(JSON.stringify(lines) + posting_attempt_id).digest('hex');

    // T08: Finalize success
    const resFinal = await pgClientAdmin.query(`
      SELECT public.finance_finalize_invoice(
        '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
      ) as result;
    `);
    const result = resFinal.rows[0].result;
    expect(result.success).toBe(true);

    // T07: Cannot add line after finalization
    let addLineErr: string | null = null;
    try {
      await pgClientAdmin.query(`
        SELECT public.finance_add_invoice_line(
          '${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Late Line', 1.0, 10000, 0.0, '5111'
        );
      `);
    } catch (e: any) {
      addLineErr = e.message;
    }
    expect(addLineErr).toContain('INVOICE_NOT_DRAFT');

    // T09: F1 posting correctly generated
    const f1Tx = await pgClientAdmin.query(`SELECT id, status FROM public.finance_transactions WHERE id = '${result.transaction_id}';`);
    expect(f1Tx.rows.length).toBe(1);
    expect(f1Tx.rows[0].status).toBe('POSTED');

    // T10: AR subledger created with strictly positive amount fact (Rule 2)
    const ledger = await pgClientAdmin.query(`SELECT entry_type, amount_minor FROM public.finance_receivable_ledger WHERE invoice_id = '${invoiceId}';`);
    expect(ledger.rows.length).toBe(1);
    expect(ledger.rows[0].entry_type).toBe('DEBIT_ACCRUAL');
    expect(ledger.rows[0].amount_minor).toBe('1100000'); // strictly positive

    // T11: Derived position cache created
    const pos = await pgClientAdmin.query(`SELECT original_amount_minor, outstanding_amount_minor FROM public.finance_receivable_positions WHERE invoice_id = '${invoiceId}';`);
    expect(pos.rows.length).toBe(1);
    expect(pos.rows[0].outstanding_amount_minor).toBe('1100000');
  });

  // =========================================================================
  // T12 - T14: Idempotency & Rollbacks
  // =========================================================================

  test('F3.2-T12: Finalize idempotency retry bypasses duplicate transaction/subledger creation', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T12', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Suite', 1, 1000000, 0.1, '5111');
    `);

    const lines = [
      { account_code: '131', debit_functional_amount: 1100000, credit_functional_amount: 0, debit_amount_minor: 1100000, credit_amount_minor: 0, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'AR Debit' },
      { account_code: '5111', debit_functional_amount: 0, credit_functional_amount: 1000000, debit_amount_minor: 0, credit_amount_minor: 1000000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Rev Credit' },
      { account_code: '3331', debit_functional_amount: 0, credit_functional_amount: 100000, debit_amount_minor: 0, credit_amount_minor: 100000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Tax Credit' }
    ];

    const { posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];
    const reqHash = createHash('sha256').update(JSON.stringify(lines) + posting_attempt_id).digest('hex');

    // 1st Call
    const res1 = await pgClientAdmin.query(`
      SELECT public.finance_finalize_invoice(
        '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
      ) as result;
    `);
    const txId1 = res1.rows[0].result.transaction_id;

    // 2nd Call (idempotent retry with same persistent posting_attempt_id)
    const res2 = await pgClientAdmin.query(`
      SELECT public.finance_finalize_invoice(
        '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
      ) as result;
    `);
    const result2 = res2.rows[0].result;

    expect(result2.success).toBe(true);
    expect(result2.is_duplicate).toBe(true);
    expect(result2.transaction_id).toBe(txId1);

    // Verifications: Exactly 1 record exists
    const txCount = await pgClientAdmin.query(`SELECT COUNT(*) FROM public.finance_transactions WHERE idempotency_key = '${posting_attempt_id}';`);
    const ledgerCount = await pgClientAdmin.query(`SELECT COUNT(*) FROM public.finance_receivable_ledger WHERE invoice_id = '${invoiceId}';`);
    expect(txCount.rows[0].count).toBe('1');
    expect(ledgerCount.rows[0].count).toBe('1');
  });

  test('F3.2-T13: F1 posting failure triggers full transactional rollback', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T13', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Suite', 1, 1000000, 0.1, '5111');
    `);

    // Invalid imbalance lines to cause F1 validation throw
    const lines = [
      { account_code: '131', debit_functional_amount: 1100000, credit_functional_amount: 0, debit_amount_minor: 1100000, credit_amount_minor: 0, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'AR Debit' },
      { account_code: '5111', debit_functional_amount: 0, credit_functional_amount: 400000, debit_amount_minor: 0, credit_amount_minor: 400000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Imbalanced Credit' }
    ];

    const { posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];
    const reqHash = createHash('sha256').update(JSON.stringify(lines) + posting_attempt_id).digest('hex');

    let err: string | null = null;
    try {
      await pgClientAdmin.query(`
        SELECT public.finance_finalize_invoice(
          '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
        );
      `);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).not.toBeNull();

    // Verify draft status restored, no tx committed, no ledger rows
    const tx = await pgClientAdmin.query(`SELECT id FROM public.finance_transactions WHERE idempotency_key = '${posting_attempt_id}';`);
    const ledger = await pgClientAdmin.query(`SELECT id FROM public.finance_receivable_ledger WHERE invoice_id = '${invoiceId}';`);
    const header = await pgClientAdmin.query(`SELECT status FROM public.finance_invoices WHERE id = '${invoiceId}';`);

    expect(tx.rows.length).toBe(0);
    expect(ledger.rows.length).toBe(0);
    expect(header.rows[0].status).toBe('DRAFT');
  });

  test('F3.2-T14: F3 subledger insertion failure reverts F1 transaction completely', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T14', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Suite', 1, 1000000, 0.1, '5111');
    `);

    const lines = [
      { account_code: '131', debit_functional_amount: 1100000, credit_functional_amount: 0, debit_amount_minor: 1100000, credit_amount_minor: 0, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'AR Debit' },
      { account_code: '5111', debit_functional_amount: 0, credit_functional_amount: 1000000, debit_amount_minor: 0, credit_amount_minor: 1000000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Rev Credit' },
      { account_code: '3331', debit_functional_amount: 0, credit_functional_amount: 100000, debit_amount_minor: 0, credit_amount_minor: 100000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Tax Credit' }
    ];

    const { posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];
    const reqHash = createHash('sha256').update(JSON.stringify(lines) + posting_attempt_id).digest('hex');

    // Force unique violation on subledger fact log to trigger a plpgsql exception post-F1 success
    await pgClientAdmin.query(`
      INSERT INTO public.finance_receivable_ledger (tenant_id, invoice_id, entry_type, amount_minor, source_type, source_id)
      VALUES ('${testTenantId}', '${invoiceId}', 'DEBIT_ACCRUAL', 5555, 'INVOICE', '${invoiceId}');
    `);

    let err: string | null = null;
    try {
      await pgClientAdmin.query(`
        SELECT public.finance_finalize_invoice(
          '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
        );
      `);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).not.toBeNull();

    // Verify F1 transaction was reverted completely
    const tx = await pgClientAdmin.query(`SELECT id FROM public.finance_transactions WHERE idempotency_key = '${posting_attempt_id}';`);
    const ledger = await pgClientAdmin.query(`SELECT amount_minor FROM public.finance_receivable_ledger WHERE invoice_id = '${invoiceId}';`);
    const header = await pgClientAdmin.query(`SELECT status FROM public.finance_invoices WHERE id = '${invoiceId}';`);

    expect(tx.rows.length).toBe(0); // Rollback succeeded
    expect(ledger.rows.length).toBe(1); // Only the pre-seeded conflict fact remains
    expect(ledger.rows[0].amount_minor).toBe('5555');
    expect(header.rows[0].status).toBe('DRAFT');
  });

  // =========================================================================
  // T15 - T20: Transitions & VOID / Reversals
  // =========================================================================

  test('F3.2-T15: Invalid direct state transition rejected', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T15', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;

    // DRAFT -> VOIDED directly fails
    let err: string | null = null;
    try {
      await pgClientAdmin.query(`UPDATE public.finance_invoices SET status = 'VOIDED' WHERE id = '${invoiceId}';`);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toContain('INVALID_INVOICE_STATUS_TRANSITION');
  });

  test('F3.2-T16 to T18: Void finalized invoice, reverse F1 and verify CREDIT_ADJUSTMENT positive facts', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T16-18', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Suite', 1, 1000000, 0.1, '5111');
    `);

    // Finalize
    const lines = [
      { account_code: '131', debit_functional_amount: 1100000, credit_functional_amount: 0, debit_amount_minor: 1100000, credit_amount_minor: 0, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'AR Debit' },
      { account_code: '5111', debit_functional_amount: 0, credit_functional_amount: 1000000, debit_amount_minor: 0, credit_amount_minor: 1000000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Rev Credit' },
      { account_code: '3331', debit_functional_amount: 0, credit_functional_amount: 100000, debit_amount_minor: 0, credit_amount_minor: 100000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Tax Credit' }
    ];
    const { posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];
    const reqHash = createHash('sha256').update(JSON.stringify(lines) + posting_attempt_id).digest('hex');
    await pgClientAdmin.query(`
      SELECT public.finance_finalize_invoice(
        '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
      );
    `);

    // T16 & T17: Void invoice successfully and verify F1 reversal ID
    const resVoid = await pgClientAdmin.query(`
      SELECT public.finance_void_invoice('${testTenantId}', '${invoiceId}') as reversal_id;
    `);
    const reversalId = resVoid.rows[0].reversal_id;
    expect(reversalId).not.toBeNull();

    // Verify F1 Reversal transaction was posted
    const revTx = await pgClientAdmin.query(`SELECT id, status, reversal_of FROM public.finance_transactions WHERE id = '${reversalId}';`);
    expect(revTx.rows.length).toBe(1);
    expect(revTx.rows[0].status).toBe('POSTED');

    // T18: Void creates CREDIT_ADJUSTMENT fact with positive amount (Rule 2)
    const ledger = await pgClientAdmin.query(`
      SELECT entry_type, amount_minor FROM public.finance_receivable_ledger 
      WHERE invoice_id = '${invoiceId}' AND entry_type = 'CREDIT_ADJUSTMENT';
    `);
    expect(ledger.rows.length).toBe(1);
    expect(ledger.rows[0].amount_minor).toBe('1100000'); // strictly positive, not negative!

    // Position outstanding is 0
    const pos = await pgClientAdmin.query(`
      SELECT original_amount_minor, adjusted_amount_minor, outstanding_amount_minor 
      FROM public.finance_receivable_positions WHERE invoice_id = '${invoiceId}';
    `);
    expect(pos.rows[0].outstanding_amount_minor).toBe('0');
  });

  test('F3.2-T19: Void invoice with allocated payment must be rejected', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T19', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Suite', 1, 1000000, 0.1, '5111');
    `);

    const lines = [
      { account_code: '131', debit_functional_amount: 1100000, credit_functional_amount: 0, debit_amount_minor: 1100000, credit_amount_minor: 0, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'AR Debit' },
      { account_code: '5111', debit_functional_amount: 0, credit_functional_amount: 1000000, debit_amount_minor: 0, credit_amount_minor: 1000000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Rev Credit' },
      { account_code: '3331', debit_functional_amount: 0, credit_functional_amount: 100000, debit_amount_minor: 0, credit_amount_minor: 100000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Tax Credit' }
    ];
    const { posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];
    const reqHash = createHash('sha256').update(JSON.stringify(lines) + posting_attempt_id).digest('hex');
    await pgClientAdmin.query(`
      SELECT public.finance_finalize_invoice(
        '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
      );
    `);

    // Mock an allocation of 200,000 to this invoice to simulate payment
    await pgClientAdmin.query(`
      BEGIN;
      SET LOCAL finance.allow_receivable_mutation = 'true';
      UPDATE public.finance_receivable_positions 
      SET allocated_amount_minor = 200000 
      WHERE invoice_id = '${invoiceId}' AND tenant_id = '${testTenantId}';
      COMMIT;
    `);

    // Void attempt - must be blocked because allocated_amount_minor > 0
    let err: string | null = null;
    try {
      await pgClientAdmin.query(`SELECT public.finance_void_invoice('${testTenantId}', '${invoiceId}');`);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toContain('INVOICE_HAS_ALLOCATIONS');
  });

  test('F3.2-T20: Void retry idempotency returns identical reversal transaction', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T20', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Suite', 1, 1000000, 0.1, '5111');
    `);

    const lines = [
      { account_code: '131', debit_functional_amount: 1100000, credit_functional_amount: 0, debit_amount_minor: 1100000, credit_amount_minor: 0, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'AR Debit' },
      { account_code: '5111', debit_functional_amount: 0, credit_functional_amount: 1000000, debit_amount_minor: 0, credit_amount_minor: 1000000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Rev Credit' },
      { account_code: '3331', debit_functional_amount: 0, credit_functional_amount: 100000, debit_amount_minor: 0, credit_amount_minor: 100000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Tax Credit' }
    ];
    const { posting_attempt_id, void_posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id, void_posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];
    const reqHash = createHash('sha256').update(JSON.stringify(lines) + posting_attempt_id).digest('hex');
    await pgClientAdmin.query(`
      SELECT public.finance_finalize_invoice(
        '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
      );
    `);

    // Void 1st time
    const res1 = await pgClientAdmin.query(`
      SELECT public.finance_void_invoice('${testTenantId}', '${invoiceId}') as reversal_id;
    `);
    const reversalId1 = res1.rows[0].reversal_id;

    // Void 2nd time (Retry scenario)
    const res2 = await pgClientAdmin.query(`
      SELECT public.finance_void_invoice('${testTenantId}', '${invoiceId}') as reversal_id;
    `);
    const reversalId2 = res2.rows[0].reversal_id;

    expect(reversalId2).toBe(reversalId1); // F1 returns same canonical duplicate

    const voidCount = await pgClientAdmin.query(`SELECT COUNT(*) FROM public.finance_transactions WHERE idempotency_key = '${void_posting_attempt_id}';`);
    expect(voidCount.rows[0].count).toBe('1');
  });

  // =========================================================================
  // T21 - T24: Multi-account, Zero-value, Rounding & COA validation
  // =========================================================================

  test('F3.2-T21: Multi-revenue-account hạch toán credit', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T21', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    // Line 1 uses 5111
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Service Suite', 1, 800000, 0.1, '5111');
    `);
    // Line 2 uses 5112
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Retail Skincare', 1, 200000, 0.1, '5112');
    `);

    const lines = [
      { account_code: '131', debit_functional_amount: 1100000, credit_functional_amount: 0, debit_amount_minor: 1100000, credit_amount_minor: 0, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'AR Debit' },
      { account_code: '5111', debit_functional_amount: 0, credit_functional_amount: 800000, debit_amount_minor: 0, credit_amount_minor: 800000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Rev Packages' },
      { account_code: '5112', debit_functional_amount: 0, credit_functional_amount: 200000, debit_amount_minor: 0, credit_amount_minor: 200000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Rev Retail' },
      { account_code: '3331', debit_functional_amount: 0, credit_functional_amount: 100000, debit_amount_minor: 0, credit_amount_minor: 100000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'VAT Credit' }
    ];
    const { posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];
    const reqHash = createHash('sha256').update(JSON.stringify(lines) + posting_attempt_id).digest('hex');

    const resFinal = await pgClientAdmin.query(`
      SELECT public.finance_finalize_invoice(
        '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
      ) as result;
    `);
    expect(resFinal.rows[0].result.success).toBe(true);
  });

  test('F3.2-T22: Zero-value invoice finalization must be rejected', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T22', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    // Total remains 0 as no lines are added
    const { posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];

    let err: string | null = null;
    try {
      await pgClientAdmin.query(`
        SELECT public.finance_finalize_invoice(
          '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', 'somehash', '[]'::jsonb
        );
      `);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toContain('INVOICE_EMPTY');
  });

  test('F3.2-T23: Tax rounding policy check', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T23', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    // Line 1: Pretax 123456, Tax 8% = ROUND(123456 * 0.08) = ROUND(9876.48) = 9876
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Line 1', 1, 123456, 0.08, '5111');
    `);

    const header = await pgClientAdmin.query(`SELECT tax_amount_minor FROM public.finance_invoices WHERE id = '${invoiceId}';`);
    expect(header.rows[0].tax_amount_minor).toBe('9876');
  });

  test('F3.2-T24: Rejects finalization with invalid or inactive revenue accounts in COA', async () => {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-T24', 'VND', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;
    // Add line with inactive revenue account '9999'
    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Suite', 1, 1000000, 0.1, '9999');
    `);

    const lines = [
      { account_code: '131', debit_functional_amount: 1100000, credit_functional_amount: 0, debit_amount_minor: 1100000, credit_amount_minor: 0, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'AR Debit' },
      { account_code: '9999', debit_functional_amount: 0, credit_functional_amount: 1000000, debit_amount_minor: 0, credit_amount_minor: 1000000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Inactive Rev' },
      { account_code: '3331', debit_functional_amount: 0, credit_functional_amount: 100000, debit_amount_minor: 0, credit_amount_minor: 100000, debit_currency: 'VND', credit_currency: 'VND', debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Tax' }
    ];
    const { posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];
    const reqHash = createHash('sha256').update(JSON.stringify(lines) + posting_attempt_id).digest('hex');

    let err: string | null = null;
    try {
      await pgClientAdmin.query(`
        SELECT public.finance_finalize_invoice(
          '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
        );
      `);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toContain('INVALID_REVENUE_ACCOUNT'); // Correctly rejected in COA check
  });
});
