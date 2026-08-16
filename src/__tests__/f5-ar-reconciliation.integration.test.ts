/**
 * F5.5 AR_GL_BALANCE Integration Test Suite
 *
 * Gate authority: F5_IMPLEMENTATION_PLAN.md §F5.5
 * Constitution:   F5.0 v1.2-Final (FROZEN)
 * Migration:      20260823000000_f5_ar_reconciliation.sql
 *
 * CRITICAL: AR sign convention is the OPPOSITE of AP.
 *   AP 331 (CREDIT normal): GL Outstanding = SUM(credit) - SUM(debit)
 *   AR 131 (DEBIT  normal): GL Outstanding = SUM(debit)  - SUM(credit)
 *
 * Every test that classifies MATCHED must use the DEBIT-normal formula.
 * Test 5.2 is the explicit sign-convention proof — it MUST demonstrate
 * that the AP formula would produce a WRONG result on AR data.
 *
 * Gates verified: G1–G8 (same constitutional gates as AP domain)
 * Additional: AR sign convention proof (unique to F5.5)
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(90_000);

type SupabaseClient = ReturnType<typeof createSupabaseClient<Database>>;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Create a minimal finalized invoice with a DEBIT_ACCRUAL fact in
 * finance_receivable_ledger and a matching POSTED GL transaction on account 131.
 *
 * This is the "happy path" AR record — fact and GL are in sync.
 *
 * Pattern:
 *   1. INSERT finance_invoices (FINALIZED)
 *   2. INSERT finance_receivable_ledger (DEBIT_ACCRUAL)
 *   3. INSERT finance_transactions (DRAFT → lines → POSTED)
 *      - DR 131 (AR control)  amount
 *      - CR revenue account   amount
 */
async function seedFinalizedInvoiceWithGl(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    periodId: string;
    arAccountId: string;      // account 131
    revenueAccountId: string; // account 511x
    invoiceId: string;
    amountMinor: number;
    issuedAt: string;         // ISO date string, used as posting_date
    customerId?: string;
  }
): Promise<{ invoiceId: string; postingAttemptId: string }> {
  const postingAttemptId = crypto.randomUUID();
  const customerId = opts.customerId ?? crypto.randomUUID();

  // 1. Insert FINALIZED invoice
  const { error: invErr } = await supabase.from('finance_invoices').insert({
    id: opts.invoiceId,
    tenant_id: opts.tenantId,
    customer_id: customerId,
    invoice_number: `INV-F55-${opts.invoiceId.slice(0, 8)}`,
    status: 'FINALIZED',
    issue_date: opts.issuedAt.slice(0, 10),
    due_date: opts.issuedAt.slice(0, 10),
    currency: 'VND',
    total_pretax_amount_minor: opts.amountMinor,
    tax_amount_minor: 0,
    total_invoice_amount_minor: opts.amountMinor,
    posting_status: 'SUCCESS',
    posting_attempt_id: postingAttemptId,
  });
  if (invErr) throw new Error(`seedFinalizedInvoice invoice: ${invErr.message}`);

  // 2. Insert DEBIT_ACCRUAL fact into AR subledger
  const { error: factErr } = await supabase.from('finance_receivable_ledger').insert({
    id: crypto.randomUUID(),
    tenant_id: opts.tenantId,
    invoice_id: opts.invoiceId,
    entry_type: 'DEBIT_ACCRUAL',
    amount_minor: opts.amountMinor,
    source_type: 'INVOICE',
    source_id: opts.invoiceId,
    created_at: opts.issuedAt,
  });
  if (factErr) throw new Error(`seedFinalizedInvoice AR fact: ${factErr.message}`);

  // 3. GL transaction: DRAFT → lines → POSTED
  const txId = crypto.randomUUID();
  const { error: txErr } = await supabase.from('finance_transactions').insert({
    id: txId,
    tenant_id: opts.tenantId,
    accounting_period_id: opts.periodId,
    transaction_type: 'ACCRUAL',
    status: 'DRAFT',
    posted_at: null,
    transaction_currency: 'VND',
    functional_currency: 'VND',
    exchange_rate_source: 'SYSTEM',
    exchange_rate_target: 'VND',
    exchange_rate_rate: 1.0,
    exchange_rate_effective: opts.issuedAt,
    idempotency_key: `ar-gl-${opts.invoiceId}`,
    description: 'F5.5 AR accrual test',
    source_type: 'INVOICE',
    source_id: opts.invoiceId,
    reference_type: 'INVOICE',
    reference_id: opts.invoiceId,
  });
  if (txErr) throw new Error(`seedFinalizedInvoice tx: ${txErr.message}`);

  // DR 131 (AR control account — DEBIT normal)
  const { error: l1Err } = await supabase.from('finance_transaction_lines').insert({
    id: crypto.randomUUID(),
    tenant_id: opts.tenantId,
    transaction_id: txId,
    account_id: opts.arAccountId,
    debit_amount: opts.amountMinor,
    credit_amount: 0,
    debit_currency: 'VND',
    credit_currency: 'VND',
    debit_functional_amount: opts.amountMinor,
    credit_functional_amount: 0,
    debit_functional_currency: 'VND',
    credit_functional_currency: 'VND',
    memo: 'AR debit accrual line',
  });
  if (l1Err) throw new Error(`seedFinalizedInvoice AR line: ${l1Err.message}`);

  // CR revenue account (balancing)
  const { error: l2Err } = await supabase.from('finance_transaction_lines').insert({
    id: crypto.randomUUID(),
    tenant_id: opts.tenantId,
    transaction_id: txId,
    account_id: opts.revenueAccountId,
    debit_amount: 0,
    credit_amount: opts.amountMinor,
    debit_currency: 'VND',
    credit_currency: 'VND',
    debit_functional_amount: 0,
    credit_functional_amount: opts.amountMinor,
    debit_functional_currency: 'VND',
    credit_functional_currency: 'VND',
    memo: 'Revenue credit balancing line',
  });
  if (l2Err) throw new Error(`seedFinalizedInvoice revenue line: ${l2Err.message}`);

  // Mark POSTED
  const { error: postErr } = await supabase
    .from('finance_transactions')
    .update({ status: 'POSTED', posted_at: opts.issuedAt })
    .eq('id', txId);
  if (postErr) throw new Error(`seedFinalizedInvoice post: ${postErr.message}`);

  return { invoiceId: opts.invoiceId, postingAttemptId };
}

/** Add a CREDIT_ALLOCATION fact (partial payment received) to an existing invoice. */
async function seedCreditAllocationFact(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    invoiceId: string;
    amountMinor: number;
    createdAt: string;
  }
): Promise<void> {
  const { error } = await supabase.from('finance_receivable_ledger').insert({
    id: crypto.randomUUID(),
    tenant_id: opts.tenantId,
    invoice_id: opts.invoiceId,
    entry_type: 'CREDIT_ALLOCATION',
    amount_minor: opts.amountMinor,
    source_type: 'ALLOCATION',
    source_id: crypto.randomUUID(),
    created_at: opts.createdAt,
  });
  if (error) throw new Error(`seedCreditAllocationFact: ${error.message}`);
}

// ---------------------------------------------------------------------------
// Suite setup
// ---------------------------------------------------------------------------

describe('F5.5 AR_GL_BALANCE Reconciliation (Integration)', () => {
  let supabase: SupabaseClient;
  let testTenantId: string;
  let testPeriodId: string;
  let testArAccountId: string;    // account 131 — DEBIT normal
  let testRevenueAccountId: string; // account 5111 — CREDIT normal

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);

    const suffix = crypto.randomUUID().slice(0, 8);

    // Tenant
    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .insert({ name: `Test Tenant F5 AR ${suffix}`, status: 'active' })
      .select('id')
      .single();
    if (tErr) throw new Error(`Create tenant: ${tErr.message}`);
    testTenantId = tenant!.id;

    // Accounting period
    const { data: period, error: pErr } = await supabase
      .from('finance_accounting_periods')
      .insert({
        tenant_id: testTenantId,
        name: '2026-09',
        period_start: '2026-09-01T00:00:00Z',
        period_end: '2026-09-30T23:59:59Z',
        status: 'OPEN',
      })
      .select('id')
      .single();
    if (pErr) throw new Error(`Create period: ${pErr.message}`);
    testPeriodId = period!.id;

    // AR control account 131 — DEBIT normal
    const { data: arAcc, error: arErr } = await supabase
      .from('finance_accounts')
      .insert({
        tenant_id: testTenantId,
        code: '131',
        name: 'Accounts Receivable F5.5 Test',
        type: 'ASSET',
        normal_balance: 'DEBIT',
        currency: 'VND',
        is_active: true,
      })
      .select('id')
      .single();
    if (arErr) throw new Error(`Create AR account: ${arErr.message}`);
    testArAccountId = arAcc!.id;

    // Revenue account 5111 — CREDIT normal
    const { data: revAcc, error: revErr } = await supabase
      .from('finance_accounts')
      .insert({
        tenant_id: testTenantId,
        code: '5111',
        name: 'Revenue F5.5 Test',
        type: 'REVENUE',
        normal_balance: 'CREDIT',
        currency: 'VND',
        is_active: true,
      })
      .select('id')
      .single();
    if (revErr) throw new Error(`Create revenue account: ${revErr.message}`);
    testRevenueAccountId = revAcc!.id;
  });

  afterEach(async () => {
    if (testTenantId) {
      await supabase.rpc('f5_admin_cleanup_test_data' as any, {
        p_tenant_ids: [testTenantId],
        p_delete_master: false,
      });
    }
  });

  afterAll(async () => {
    if (testTenantId) {
      await supabase.rpc('f5_admin_cleanup_test_data' as any, {
        p_tenant_ids: [testTenantId],
        p_delete_master: true,
      });
    }
  });

  // =========================================================================
  // Test 5.1 — MATCHED: AR fact = GL debit outstanding (G1, G2, G4, G7, G8)
  // Full invoice: DEBIT_ACCRUAL 10M, GL DR 131 = 10M → MATCHED
  // =========================================================================
  it('5.1 — MATCHED: AR subledger position equals GL 131 debit outstanding', async () => {
    const invoiceId = crypto.randomUUID();
    await seedFinalizedInvoiceWithGl(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      arAccountId: testArAccountId,
      revenueAccountId: testRevenueAccountId,
      invoiceId,
      amountMinor: 10_000_000,
      issuedAt: '2026-09-05T08:00:00Z',
    });

    const basisId = crypto.randomUUID();
    const { data: report, error } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AR',
      p_control_type: 'AR_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AR_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-09-10T00:00:00Z',
    });
    expect(error).toBeNull();
    expect(report.matched).toBe(1);
    expect(report.variances).toBe(0);
    expect(report.quarantined).toBe(0);

    // G3: result row has full trace fields
    const { data: resultRow } = await supabase
      .from('f5_control_results')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('run_id', report.run_id)
      .single();
    expect(resultRow).not.toBeNull();
    expect(resultRow!.financial_result).toBe('MATCHED');
    expect(resultRow!.source_module).toBe('F3');
    expect(resultRow!.source_type).toBe('INVOICE');
    expect(resultRow!.source_id).toBe(invoiceId);
    expect(resultRow!.expected_amount).toBe(10_000_000);
    expect(resultRow!.actual_amount).toBe(10_000_000);
    expect(resultRow!.case_id).toBeNull(); // MATCHED → no case
    // G1: only f5_* written — no direct check needed (static, but verify no case created)
    const { data: cases } = await supabase
      .from('f5_control_cases')
      .select('case_id')
      .eq('tenant_id', testTenantId);
    expect(cases).toHaveLength(0);
  });

  // =========================================================================
  // Test 5.2 — AR SIGN CONVENTION PROOF (critical gate)
  // Invoice: DEBIT_ACCRUAL 10M; partial payment CREDIT_ALLOCATION 3M
  // AR outstanding = 10M - 3M = 7M
  // GL 131: DR 10M only (payment not yet posted to GL) → VARIANCE 3M
  //
  // Sign proof: if AP formula (credit - debit) were used on account 131,
  // it would yield: 0 - 10M = -10M, a massive negative → wrong direction.
  // Only DEBIT-normal formula (debit - credit = 10M - 0 = 10M) is correct for GL.
  // =========================================================================
  it('5.2 — sign convention proof: AR DEBIT-normal GL formula differs from AP CREDIT-normal', async () => {
    const invoiceId = crypto.randomUUID();
    await seedFinalizedInvoiceWithGl(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      arAccountId: testArAccountId,
      revenueAccountId: testRevenueAccountId,
      invoiceId,
      amountMinor: 10_000_000,
      issuedAt: '2026-09-05T08:00:00Z',
    });

    // Add partial payment fact (CREDIT_ALLOCATION) — subledger now = 7M outstanding
    await seedCreditAllocationFact(supabase, {
      tenantId: testTenantId,
      invoiceId,
      amountMinor: 3_000_000,
      createdAt: '2026-09-07T10:00:00Z',
    });
    // GL is NOT updated — no corresponding credit entry on 131 yet → deliberate VARIANCE

    const basisId = crypto.randomUUID();
    const { data: report, error } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AR',
      p_control_type: 'AR_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AR_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-09-10T00:00:00Z',
    });
    expect(error).toBeNull();
    // Don't assert aggregate counts — other tests' invoices accumulate in the tenant.
    // Assert the specific invoice result by source_id instead.

    const { data: resultRow } = await supabase
      .from('f5_control_results')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('run_id', report.run_id)
      .eq('source_id', invoiceId)
      .single();
    expect(resultRow!.financial_result).toBe('VARIANCE');

    // expected_amount = reconstructed_outstanding = 7M (DEBIT_ACCRUAL - CREDIT_ALLOCATION)
    expect(resultRow!.expected_amount).toBe(7_000_000);

    // actual_amount = GL 131 debit - credit = 10M - 0 = 10M (DEBIT-normal formula)
    expect(resultRow!.actual_amount).toBe(10_000_000);

    // variance_amount = GL - reconstructed = 10M - 7M = 3M
    // (if AP formula credit - debit were used: 0 - 10M = -10M → wrong sign, wrong magnitude)
    expect(Number(resultRow!.variance_amount)).toBe(3_000_000);

    // VARIANCE → case must be OPEN
    expect(resultRow!.case_id).not.toBeNull();
    const { data: caseRow } = await supabase
      .from('f5_control_cases')
      .select('case_state')
      .eq('case_id', resultRow!.case_id)
      .single();
    expect(caseRow!.case_state).toBe('OPEN');
  });

  // =========================================================================
  // Test 5.3 — MATCHED after full payment: allocation reduces outstanding to 0
  // Invoice 10M; GL DR 10M; CREDIT_ALLOCATION 10M; GL CR 10M → both = 0 → MATCHED
  // =========================================================================
  it('5.3 — MATCHED after full payment: allocation + GL payment entry both 0', async () => {
    const invoiceId = crypto.randomUUID();
    await seedFinalizedInvoiceWithGl(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      arAccountId: testArAccountId,
      revenueAccountId: testRevenueAccountId,
      invoiceId,
      amountMinor: 8_000_000,
      issuedAt: '2026-09-05T08:00:00Z',
    });

    // Full payment fact
    await seedCreditAllocationFact(supabase, {
      tenantId: testTenantId,
      invoiceId,
      amountMinor: 8_000_000,
      createdAt: '2026-09-08T10:00:00Z',
    });

    // GL: add matching CR 131 for payment (DR 111 cash, CR 131 AR)
    const payTxId = crypto.randomUUID();
    const { error: ptxErr } = await supabase.from('finance_transactions').insert({
      id: payTxId,
      tenant_id: testTenantId,
      accounting_period_id: testPeriodId,
      transaction_type: 'ACCRUAL',
      status: 'DRAFT',
      posted_at: null,
      transaction_currency: 'VND',
      functional_currency: 'VND',
      exchange_rate_source: 'SYSTEM',
      exchange_rate_target: 'VND',
      exchange_rate_rate: 1.0,
      exchange_rate_effective: '2026-09-08T10:00:00Z',
      idempotency_key: `pay-gl-${invoiceId}`,
      description: 'Payment allocation GL entry',
      source_type: 'INVOICE',
      source_id: invoiceId,
      reference_type: 'INVOICE',
      reference_id: invoiceId,
    });
    expect(ptxErr).toBeNull();

    // CR 131 (AR cleared — DEBIT normal, so CR reduces it)
    const { error: pl1Err } = await supabase.from('finance_transaction_lines').insert({
      id: crypto.randomUUID(),
      tenant_id: testTenantId,
      transaction_id: payTxId,
      account_id: testArAccountId,
      debit_amount: 0,
      credit_amount: 8_000_000,
      debit_currency: 'VND',
      credit_currency: 'VND',
      debit_functional_amount: 0,
      credit_functional_amount: 8_000_000,
      debit_functional_currency: 'VND',
      credit_functional_currency: 'VND',
      memo: 'AR credit on payment',
    });
    expect(pl1Err).toBeNull();

    // DR cash (balancing)
    const { error: pl2Err } = await supabase.from('finance_transaction_lines').insert({
      id: crypto.randomUUID(),
      tenant_id: testTenantId,
      transaction_id: payTxId,
      account_id: testRevenueAccountId, // reuse as balancing account
      debit_amount: 8_000_000,
      credit_amount: 0,
      debit_currency: 'VND',
      credit_currency: 'VND',
      debit_functional_amount: 8_000_000,
      credit_functional_amount: 0,
      debit_functional_currency: 'VND',
      credit_functional_currency: 'VND',
      memo: 'Cash debit on payment',
    });
    expect(pl2Err).toBeNull();

    const { error: postPayErr } = await supabase
      .from('finance_transactions')
      .update({ status: 'POSTED', posted_at: '2026-09-08T10:00:00Z' })
      .eq('id', payTxId);
    expect(postPayErr).toBeNull();

    // Reconcile: expected = 8M - 8M = 0; GL = DR 8M - CR 8M = 0 → MATCHED
    const basisId = crypto.randomUUID();
    const { data: report, error } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AR',
      p_control_type: 'AR_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AR_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-09-10T00:00:00Z',
    });
    expect(error).toBeNull();
    // Scope assertion to this invoice only
    const { data: resultRow } = await supabase
      .from('f5_control_results')
      .select('*')
      .eq('run_id', report.run_id)
      .eq('source_id', invoiceId)
      .single();
    expect(resultRow!.financial_result).toBe('MATCHED');
    expect(resultRow!.expected_amount).toBe(0);
    expect(resultRow!.actual_amount).toBe(0);
  });

  // =========================================================================
  // Test 5.4 — Temporal boundary: fact after as_of excluded (G8)
  // =========================================================================
  it('5.4 — temporal boundary: CREDIT_ALLOCATION after as_of is excluded (G8)', async () => {
    const invoiceId = crypto.randomUUID();
    const T = '2026-09-05T08:00:00Z';
    const BOUNDARY = '2026-09-08T00:00:00Z';
    const T_AFTER = '2026-09-12T10:00:00Z';

    await seedFinalizedInvoiceWithGl(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      arAccountId: testArAccountId,
      revenueAccountId: testRevenueAccountId,
      invoiceId,
      amountMinor: 6_000_000,
      issuedAt: T,
    });

    // Payment fact AFTER boundary — must NOT be included at BOUNDARY
    await seedCreditAllocationFact(supabase, {
      tenantId: testTenantId,
      invoiceId,
      amountMinor: 6_000_000,
      createdAt: T_AFTER,
    });

    const basisId = crypto.randomUUID();
    const { data: report, error } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AR',
      p_control_type: 'AR_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AR_GL_BALANCE:v1',
      p_reconciliation_as_of: BOUNDARY,
    });
    expect(error).toBeNull();
    // At BOUNDARY: this invoice's fact = DEBIT_ACCRUAL 6M only → outstanding = 6M
    // GL = DR 6M - CR 0 = 6M → MATCHED — assert by source_id
    const { data: resultRow } = await supabase
      .from('f5_control_results')
      .select('expected_amount, actual_amount, financial_result')
      .eq('run_id', report.run_id)
      .eq('source_id', invoiceId)
      .single();
    expect(resultRow!.financial_result).toBe('MATCHED');
    expect(resultRow!.expected_amount).toBe(6_000_000);
    expect(resultRow!.actual_amount).toBe(6_000_000);
  });

  // =========================================================================
  // Test 5.5 — Idempotency: concurrent runs return same run_id (G6)
  // =========================================================================
  it('5.5 — concurrent AR runs with identical identity return exactly one result set (G6)', async () => {
    const invoiceId = crypto.randomUUID();
    await seedFinalizedInvoiceWithGl(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      arAccountId: testArAccountId,
      revenueAccountId: testRevenueAccountId,
      invoiceId,
      amountMinor: 4_000_000,
      issuedAt: '2026-09-05T08:00:00Z',
    });

    const basisId = crypto.randomUUID();
    const params = {
      p_tenant_id: testTenantId,
      p_domain: 'AR',
      p_control_type: 'AR_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AR_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-09-10T00:00:00Z',
    } as const;

    // Genuinely concurrent
    const [r1, r2, r3] = await Promise.all([
      supabase.rpc('f5_run_reconciliation', params),
      supabase.rpc('f5_run_reconciliation', params),
      supabase.rpc('f5_run_reconciliation', params),
    ]);

    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    expect(r3.error).toBeNull();

    const runIds = [r1.data.run_id, r2.data.run_id, r3.data.run_id];
    expect(new Set(runIds).size).toBe(1); // Same run_id

    // For this specific invoice, exactly one result row — no duplicates regardless
    // of how many other invoices exist in the tenant from prior tests in this run.
    const { data: rows } = await supabase
      .from('f5_control_results')
      .select('result_id')
      .eq('run_id', runIds[0])
      .eq('tenant_id', testTenantId)
      .eq('source_id', invoiceId); // scoped to THIS invoice
    expect(rows!.length).toBe(1); // Exactly one result for this invoice — no duplicates
  });

  // =========================================================================
  // Test 5.6 — Namespace boundary: no writes to finance_* tables (G1)
  // Count rows in key F3 tables before and after AR reconciliation run.
  // =========================================================================
  it('5.6 — namespace boundary: AR reconciliation writes only to f5_* tables (G1)', async () => {
    const invoiceId = crypto.randomUUID();
    await seedFinalizedInvoiceWithGl(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      arAccountId: testArAccountId,
      revenueAccountId: testRevenueAccountId,
      invoiceId,
      amountMinor: 5_000_000,
      issuedAt: '2026-09-05T08:00:00Z',
    });

    // Capture F3 table row counts before run
    const { count: invCountBefore } = await supabase
      .from('finance_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);
    const { count: ledgerCountBefore } = await supabase
      .from('finance_receivable_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);
    const { count: txCountBefore } = await supabase
      .from('finance_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);

    const { data: report, error } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AR',
      p_control_type: 'AR_GL_BALANCE',
      p_basis_id: crypto.randomUUID(),
      p_basis_version: 'AR_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-09-10T00:00:00Z',
    });
    expect(error).toBeNull();

    // F3/F1 tables must be unchanged
    const { count: invCountAfter } = await supabase
      .from('finance_invoices')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);
    const { count: ledgerCountAfter } = await supabase
      .from('finance_receivable_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);
    const { count: txCountAfter } = await supabase
      .from('finance_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);

    expect(invCountAfter).toBe(invCountBefore);
    expect(ledgerCountAfter).toBe(ledgerCountBefore);
    expect(txCountAfter).toBe(txCountBefore);

    // f5_control_results MUST have grown (one result written)
    const { count: resultCount } = await supabase
      .from('f5_control_results')
      .select('*', { count: 'exact', head: true })
      .eq('run_id', report.run_id);
    expect(resultCount).toBeGreaterThanOrEqual(1);
  });

  // =========================================================================
  // Test 5.7 — Reconstruction: finance_ar_facts_as_of temporal boundary (G7, G8)
  // Direct contract verification: facts_as_of includes only entries ≤ as_of.
  // =========================================================================
  it('5.7 — finance_ar_facts_as_of respects temporal boundary (G7 read contract, G8 temporal)', async () => {
    const invoiceId = crypto.randomUUID();
    const { error: invErr } = await supabase.from('finance_invoices').insert({
      id: invoiceId,
      tenant_id: testTenantId,
      customer_id: crypto.randomUUID(),
      invoice_number: `INV-TEMPORAL-${invoiceId.slice(0, 8)}`,
      status: 'FINALIZED',
      issue_date: '2026-09-01',
      due_date: '2026-09-30',
      currency: 'VND',
      total_pretax_amount_minor: 9_000_000,
      tax_amount_minor: 0,
      total_invoice_amount_minor: 9_000_000,
      posting_status: 'SUCCESS',
      posting_attempt_id: crypto.randomUUID(),
    });
    expect(invErr).toBeNull();

    const factBefore = crypto.randomUUID();
    const factAfter  = crypto.randomUUID();

    // Fact BEFORE boundary
    await supabase.from('finance_receivable_ledger').insert({
      id: factBefore,
      tenant_id: testTenantId,
      invoice_id: invoiceId,
      entry_type: 'DEBIT_ACCRUAL',
      amount_minor: 9_000_000,
      source_type: 'INVOICE',
      source_id: invoiceId,
      created_at: '2026-09-01T08:00:00Z',
    });

    // Fact AFTER boundary
    await supabase.from('finance_receivable_ledger').insert({
      id: factAfter,
      tenant_id: testTenantId,
      invoice_id: invoiceId,
      entry_type: 'CREDIT_ALLOCATION',
      amount_minor: 4_000_000,
      source_type: 'ALLOCATION',
      source_id: crypto.randomUUID(),
      created_at: '2026-09-20T10:00:00Z',
    });

    const BOUNDARY = '2026-09-10T00:00:00Z';

    // Query via approved read contract (G7)
    const { data: factsAtBoundary, error: qErr } = await supabase.rpc(
      'finance_ar_facts_as_of',
      { p_tenant_id: testTenantId, p_as_of: BOUNDARY }
    );
    expect(qErr).toBeNull();

    const ids = (factsAtBoundary as Array<{ fact_id: string }>).map(f => f.fact_id);
    expect(ids).toContain(factBefore);   // included
    expect(ids).not.toContain(factAfter); // excluded — after boundary (G8)
  });

  // =========================================================================
  // Test 5.8 — Immutability: AR result row is write-once (G5)
  // =========================================================================
  it('5.8 — f5_control_results rows from AR run are immutable (G5)', async () => {
    const invoiceId = crypto.randomUUID();
    await seedFinalizedInvoiceWithGl(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      arAccountId: testArAccountId,
      revenueAccountId: testRevenueAccountId,
      invoiceId,
      amountMinor: 3_000_000,
      issuedAt: '2026-09-05T08:00:00Z',
    });

    const { data: report, error } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AR',
      p_control_type: 'AR_GL_BALANCE',
      p_basis_id: crypto.randomUUID(),
      p_basis_version: 'AR_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-09-10T00:00:00Z',
    });
    expect(error).toBeNull();

    const { data: row } = await supabase
      .from('f5_control_results')
      .select('result_id')
      .eq('run_id', report.run_id)
      .eq('source_id', invoiceId)
      .single();

    // Attempt UPDATE on immutable field
    const { error: updateErr } = await supabase
      .from('f5_control_results')
      .update({ financial_result: 'VARIANCE' })
      .eq('result_id', row!.result_id);
    expect(updateErr).not.toBeNull();
    expect(updateErr!.message).toContain('F5_RESULT_IMMUTABLE');

    // Attempt DELETE
    const { error: deleteErr } = await supabase
      .from('f5_control_results')
      .delete()
      .eq('result_id', row!.result_id);
    expect(deleteErr).not.toBeNull();
    expect(deleteErr!.message).toContain('F5_RESULT_IMMUTABLE');

    // Row still MATCHED
    const { data: unchanged } = await supabase
      .from('f5_control_results')
      .select('financial_result')
      .eq('result_id', row!.result_id)
      .single();
    expect(unchanged!.financial_result).toBe('MATCHED');
  });
});
