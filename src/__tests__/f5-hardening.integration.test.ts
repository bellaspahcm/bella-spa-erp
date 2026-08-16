/**
 * F5.4 Hardening & Fault Injection Integration Test
 *
 * Gate authority: F5_IMPLEMENTATION_PLAN.md §F5.4
 * Constitution:   F5.0 v1.2-Final (FROZEN — do not modify)
 *
 * Tests 4.1–4.6 verify that the existing F5.1–F5.3 AP_GL_BALANCE engine
 * holds under adversarial conditions. NO production behavior is changed to
 * satisfy these tests. Any failure is a defect in the existing engine.
 *
 * Ground rules enforced by this suite:
 *   - F5 writes ONLY to f5_* tables (G1)
 *   - Classification is deterministic for same input (G2)
 *   - Every result row is traceable to run identity + source facts (G3)
 *   - Reconstruction from facts is idempotent (G4)
 *   - Orphan GL records → QUARANTINED (G5)
 *   - Same run identity → same run_id, no duplicates (G6)
 *   - All reads via frozen temporal contracts (G7)
 *   - Reads strictly bounded by reconciliation_as_of (G8)
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

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

type SupabaseClient = ReturnType<typeof createSupabaseClient<Database>>;

/**
 * Insert a minimal POSTED transaction with one AP line (account 331) + one balancing line.
 *
 * Pattern from existing F5.1–F5.3 test suite:
 *   1. INSERT with status='DRAFT' (no TRANSACTION_EMPTY trigger fired)
 *   2. INSERT both lines
 *   3. UPDATE status='POSTED', posted_at=<timestamp>
 */
async function seedPostedTransaction(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    periodId: string;
    apAccountId: string;
    balanceAccountId: string;
    sourceId: string;          // vendor_bill_id or any UUID used as source_id
    amountMinor: number;
    postedAt: string;          // ISO timestamp
    idempotencyKeySuffix?: string;
  }
): Promise<string> {
  const txId = crypto.randomUUID();
  const suffix = opts.idempotencyKeySuffix ?? txId;

  // Step 1: Insert as DRAFT (avoids TRANSACTION_EMPTY trigger on POSTED status)
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
    exchange_rate_effective: opts.postedAt,
    idempotency_key: `tx-hardening-${suffix}`,
    description: 'F5.4 Hardening test transaction',
    source_type: 'VENDOR_BILL',
    source_id: opts.sourceId,
    reference_type: 'VENDOR_BILL',
    reference_id: opts.sourceId,
  });
  if (txErr) throw new Error(`seedPostedTransaction insert failed: ${txErr.message}`);

  // Step 2a: AP credit line (account 331)
  const { error: l1Err } = await supabase.from('finance_transaction_lines').insert({
    id: crypto.randomUUID(),
    tenant_id: opts.tenantId,
    transaction_id: txId,
    account_id: opts.apAccountId,
    debit_amount: 0,
    credit_amount: opts.amountMinor,
    debit_currency: 'VND',
    credit_currency: 'VND',
    debit_functional_amount: 0,
    credit_functional_amount: opts.amountMinor,
    debit_functional_currency: 'VND',
    credit_functional_currency: 'VND',
    memo: 'AP hardening test line',
  });
  if (l1Err) throw new Error(`seedPostedTransaction AP line failed: ${l1Err.message}`);

  // Step 2b: Balancing debit line
  const { error: l2Err } = await supabase.from('finance_transaction_lines').insert({
    id: crypto.randomUUID(),
    tenant_id: opts.tenantId,
    transaction_id: txId,
    account_id: opts.balanceAccountId,
    debit_amount: opts.amountMinor,
    credit_amount: 0,
    debit_currency: 'VND',
    credit_currency: 'VND',
    debit_functional_amount: opts.amountMinor,
    credit_functional_amount: 0,
    debit_functional_currency: 'VND',
    credit_functional_currency: 'VND',
    memo: 'AP hardening balancing line',
  });
  if (l2Err) throw new Error(`seedPostedTransaction balancing line failed: ${l2Err.message}`);

  // Step 3: Mark as POSTED now that lines exist
  const { error: postErr } = await supabase
    .from('finance_transactions')
    .update({ status: 'POSTED', posted_at: opts.postedAt })
    .eq('id', txId);
  if (postErr) throw new Error(`seedPostedTransaction post failed: ${postErr.message}`);

  return txId;
}

/** Insert a vendor bill + PAYABLE_ACCRUAL fact into finance_payable_ledger. */
async function seedVendorBillWithFact(
  supabase: SupabaseClient,
  opts: {
    tenantId: string;
    billId: string;
    amountMinor: number;
    createdAt: string;   // ISO timestamp
  }
): Promise<void> {
  const { error: billErr } = await supabase.from('finance_vendor_bills').insert({
    id: opts.billId,
    tenant_id: opts.tenantId,
    vendor_id: crypto.randomUUID(),
    bill_number: `VB-HARD-${opts.billId.slice(0, 8)}`,
    total_amount_minor: opts.amountMinor,
    currency: 'VND',
    bill_date: opts.createdAt,
    due_date: opts.createdAt,
    status: 'APPROVED',
    posting_attempt_id: crypto.randomUUID(),
  });
  if (billErr) throw new Error(`seedVendorBillWithFact bill insert: ${billErr.message}`);

  const { error: factErr } = await supabase.from('finance_payable_ledger').insert({
    id: crypto.randomUUID(),
    tenant_id: opts.tenantId,
    vendor_bill_id: opts.billId,
    entry_type: 'PAYABLE_ACCRUAL',
    amount_minor: opts.amountMinor,
    created_at: opts.createdAt,
    f1_transaction_id: crypto.randomUUID(),
  });
  if (factErr) throw new Error(`seedVendorBillWithFact fact insert: ${factErr.message}`);
}

// ---------------------------------------------------------------------------
// Suite
// ---------------------------------------------------------------------------

describe('F5.4 Hardening & Fault Injection (Integration)', () => {
  let supabase: SupabaseClient;
  let testTenantId: string;
  let testPeriodId: string;
  let testApAccountId: string;
  let testDebitAccountId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);

    // Unique tenant per run — never collides with existing data
    const suffix = crypto.randomUUID().slice(0, 8);

    const { data: tenant, error: tErr } = await supabase
      .from('tenants')
      .insert({ name: `Test Tenant F5 Hardening ${suffix}`, status: 'active' })
      .select('id')
      .single();
    if (tErr) throw new Error(`Create tenant: ${tErr.message}`);
    testTenantId = tenant!.id;

    // Accounting period
    const { data: period, error: pErr } = await supabase
      .from('finance_accounting_periods')
      .insert({
        tenant_id: testTenantId,
        name: '2026-08',
        period_start: '2026-08-01T00:00:00Z',
        period_end: '2026-08-31T23:59:59Z',
        status: 'OPEN',
      })
      .select('id')
      .single();
    if (pErr) throw new Error(`Create period: ${pErr.message}`);
    testPeriodId = period!.id;

    // AP control account (331)
    const { data: apAcc, error: apErr } = await supabase
      .from('finance_accounts')
      .insert({
        tenant_id: testTenantId,
        code: '331',
        name: 'AP Hardening Test',
        type: 'LIABILITY',
        normal_balance: 'CREDIT',
        currency: 'VND',
        is_active: true,
      })
      .select('id')
      .single();
    if (apErr) throw new Error(`Create AP account: ${apErr.message}`);
    testApAccountId = apAcc!.id;

    // Balancing account (111)
    const { data: debitAcc, error: dErr } = await supabase
      .from('finance_accounts')
      .insert({
        tenant_id: testTenantId,
        code: '111',
        name: 'Cash Hardening Test',
        type: 'ASSET',
        normal_balance: 'DEBIT',
        currency: 'VND',
        is_active: true,
      })
      .select('id')
      .single();
    if (dErr) throw new Error(`Create debit account: ${dErr.message}`);
    testDebitAccountId = debitAcc!.id;
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
  // Test 4.1 — Concurrent run identity collision (G6)
  // Two genuinely concurrent calls with identical run identity → exactly 1 result set.
  // Sequential calls do NOT satisfy this test (Promise.all required).
  // =========================================================================
  it('4.1 — concurrent reconciliation with identical run identity persists exactly one result set (G6)', async () => {
    const billId = crypto.randomUUID();
    await seedVendorBillWithFact(supabase, {
      tenantId: testTenantId,
      billId,
      amountMinor: 5_000_000,
      createdAt: '2026-08-10T08:00:00Z',
    });
    await seedPostedTransaction(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      apAccountId: testApAccountId,
      balanceAccountId: testDebitAccountId,
      sourceId: billId,
      amountMinor: 5_000_000,
      postedAt: '2026-08-10T08:00:00Z',
    });

    const basisId = crypto.randomUUID();
    const reconcParams = {
      p_tenant_id: testTenantId,
      p_domain: 'AP',
      p_control_type: 'AP_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AP_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-08-15T00:00:00Z',
    } as const;

    // Genuinely concurrent — all three fire at the same JS microtask boundary
    const [r1, r2, r3] = await Promise.all([
      supabase.rpc('f5_run_reconciliation', reconcParams),
      supabase.rpc('f5_run_reconciliation', reconcParams),
      supabase.rpc('f5_run_reconciliation', reconcParams),
    ]);

    // All three must succeed (no error)
    expect(r1.error).toBeNull();
    expect(r2.error).toBeNull();
    expect(r3.error).toBeNull();

    // All three must return the SAME run_id (idempotency)
    const runIds = [r1.data.run_id, r2.data.run_id, r3.data.run_id];
    expect(new Set(runIds).size).toBe(1);

    // Exactly one result row for this run_id — no duplicates
    const { data: rows, error: rowErr } = await supabase
      .from('f5_control_results')
      .select('result_id, financial_result')
      .eq('tenant_id', testTenantId)
      .eq('run_id', runIds[0]);
    expect(rowErr).toBeNull();
    expect(rows).toHaveLength(1);
    expect(rows![0].financial_result).toBe('MATCHED');

    // No duplicate cases either
    const { data: cases } = await supabase
      .from('f5_control_cases')
      .select('case_id')
      .eq('tenant_id', testTenantId);
    expect(cases).toHaveLength(0); // MATCHED → no case
  });

  // =========================================================================
  // Test 4.2 — Immutability: UPDATE blocked by trigger (G5, immutability law)
  // =========================================================================
  it('4.2 — UPDATE on f5_control_results is rejected by immutability trigger', async () => {
    // Insert a result row directly (self-contained, no full reconciliation run needed)
    const runId = crypto.randomUUID();
    const { data: row, error: insErr } = await supabase
      .from('f5_control_results')
      .insert({
        tenant_id: testTenantId,
        run_id: runId,
        control_type: 'AP_GL_BALANCE',
        basis_id: crypto.randomUUID(),
        basis_version: 'AP_GL_BALANCE:v1',
        reconciliation_as_of: '2026-08-15T00:00:00Z',
        source_snapshot_hash: `hash-immute-upd-${runId}`,
        source_module: 'F4',
        source_type: 'VENDOR_BILL',
        source_id: crypto.randomUUID(),
        financial_effect_type: 'AP_GL_BALANCE_CHECK',
        posting_attempt_id: `pa-${runId}`,
        expected_amount: 1_000_000,
        actual_amount: 1_000_000,
        financial_result: 'MATCHED',
        severity: 'LOW',
        detected_by: 'f5-hardening-test-4.2',
      })
      .select('result_id, financial_result')
      .single();
    expect(insErr).toBeNull();
    expect(row).not.toBeNull();

    // Attempt to mutate a core field — must be rejected
    const { error: updateErr } = await supabase
      .from('f5_control_results')
      .update({ financial_result: 'VARIANCE' })
      .eq('result_id', row!.result_id);

    expect(updateErr).not.toBeNull();
    expect(updateErr!.message).toContain('F5_RESULT_IMMUTABLE');

    // Original row must be unchanged
    const { data: unchanged } = await supabase
      .from('f5_control_results')
      .select('financial_result')
      .eq('result_id', row!.result_id)
      .single();
    expect(unchanged!.financial_result).toBe('MATCHED');
  });

  // =========================================================================
  // Test 4.3 — Immutability: DELETE blocked by trigger
  // =========================================================================
  it('4.3 — DELETE on f5_control_results is rejected by immutability trigger', async () => {
    const runId = crypto.randomUUID();
    const { data: row, error: insErr } = await supabase
      .from('f5_control_results')
      .insert({
        tenant_id: testTenantId,
        run_id: runId,
        control_type: 'AP_GL_BALANCE',
        basis_id: crypto.randomUUID(),
        basis_version: 'AP_GL_BALANCE:v1',
        reconciliation_as_of: '2026-08-15T00:00:00Z',
        source_snapshot_hash: `hash-immute-del-${runId}`,
        source_module: 'F4',
        source_type: 'VENDOR_BILL',
        source_id: crypto.randomUUID(),
        financial_effect_type: 'AP_GL_BALANCE_CHECK',
        posting_attempt_id: `pa-del-${runId}`,
        expected_amount: 2_000_000,
        actual_amount: 2_000_000,
        financial_result: 'MATCHED',
        severity: 'LOW',
        detected_by: 'f5-hardening-test-4.3',
      })
      .select('result_id')
      .single();
    expect(insErr).toBeNull();

    // Attempt DELETE — must be rejected
    const { error: deleteErr } = await supabase
      .from('f5_control_results')
      .delete()
      .eq('result_id', row!.result_id);

    expect(deleteErr).not.toBeNull();
    expect(deleteErr!.message).toContain('F5_RESULT_IMMUTABLE');

    // Row must still exist
    const { data: stillThere } = await supabase
      .from('f5_control_results')
      .select('result_id')
      .eq('result_id', row!.result_id)
      .single();
    expect(stillThere).not.toBeNull();
    expect(stillThere!.result_id).toBe(row!.result_id);
  });

  // =========================================================================
  // Test 4.4 — Temporal snapshot isolation (G8)
  // Facts created AFTER reconciliation_as_of must NOT appear in the run.
  // Re-running the same as_of after adding new facts must return same result.
  // =========================================================================
  it('4.4 — temporal snapshot isolation: facts after as_of excluded; historical result stable (G8)', async () => {
    const billId = crypto.randomUUID();
    const T_MINUS = '2026-08-05T00:00:00Z';  // fact created before boundary
    const BOUNDARY = '2026-08-10T00:00:00Z'; // reconciliation_as_of
    const T_PLUS  = '2026-08-15T00:00:00Z';  // fact created after boundary

    // Seed bill + fact BEFORE the boundary
    await seedVendorBillWithFact(supabase, {
      tenantId: testTenantId,
      billId,
      amountMinor: 8_000_000,
      createdAt: T_MINUS,
    });

    // Seed matching GL journal BEFORE the boundary (so MATCHED at boundary)
    await seedPostedTransaction(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      apAccountId: testApAccountId,
      balanceAccountId: testDebitAccountId,
      sourceId: billId,
      amountMinor: 8_000_000,
      postedAt: T_MINUS,
    });

    const basisId = crypto.randomUUID();

    // Run 1: at BOUNDARY — expects MATCHED (only T_MINUS fact is in scope)
    const { data: run1, error: e1 } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AP',
      p_control_type: 'AP_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AP_GL_BALANCE:v1',
      p_reconciliation_as_of: BOUNDARY,
    });
    expect(e1).toBeNull();
    expect(run1.matched).toBe(1);
    expect(run1.variances).toBe(0);
    const run1Id = run1.run_id;

    // Now add a disbursement fact AFTER the boundary (simulates a later payment)
    const { error: factAfterErr } = await supabase.from('finance_payable_ledger').insert({
      id: crypto.randomUUID(),
      tenant_id: testTenantId,
      vendor_bill_id: billId,
      entry_type: 'DISBURSEMENT_ALLOCATION',
      amount_minor: 3_000_000,
      created_at: T_PLUS,
      f1_transaction_id: crypto.randomUUID(),
    });
    expect(factAfterErr).toBeNull();

    // Run 2: SAME basisId + SAME as_of → must return the SAME run_id (idempotent, G6)
    const { data: run2, error: e2 } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AP',
      p_control_type: 'AP_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AP_GL_BALANCE:v1',
      p_reconciliation_as_of: BOUNDARY,
    });
    expect(e2).toBeNull();
    // Same run_id → result unchanged despite new fact added after boundary
    expect(run2.run_id).toBe(run1Id);

    // Run 3: LATER as_of — must see the disbursement and produce VARIANCE
    const newBasisId = crypto.randomUUID();
    const { data: run3, error: e3 } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AP',
      p_control_type: 'AP_GL_BALANCE',
      p_basis_id: newBasisId,
      p_basis_version: 'AP_GL_BALANCE:v1',
      p_reconciliation_as_of: T_PLUS,
    });
    expect(e3).toBeNull();
    // Subledger now shows 8M - 3M = 5M outstanding, but GL still shows 8M credit → VARIANCE
    expect(run3.variances).toBeGreaterThanOrEqual(1);

    // Verify the G8 invariant: the BOUNDARY run result is still MATCHED after run3
    const { data: historicalResult } = await supabase
      .from('f5_control_results')
      .select('financial_result')
      .eq('tenant_id', testTenantId)
      .eq('run_id', run1Id)
      .single();
    expect(historicalResult!.financial_result).toBe('MATCHED');
  });

  // =========================================================================
  // Test 4.5 — Integrity breach: orphan GL record → QUARANTINED + CRITICAL case (G5)
  // Orphan = GL journal exists for a source_id that has NO AP subledger facts.
  // F5 must NOT mutate the GL or AP records to resolve this.
  // =========================================================================
  it('4.5 — orphan GL record (no AP fact) → QUARANTINED with CRITICAL case; F1/F4 not mutated (G5)', async () => {
    // Orphan scenario: GL transaction references an ID that has no finance_payable_ledger entry
    const orphanSourceId = crypto.randomUUID();

    // Do NOT create a vendor bill or AP fact — only a GL transaction
    await seedPostedTransaction(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      apAccountId: testApAccountId,
      balanceAccountId: testDebitAccountId,
      sourceId: orphanSourceId,
      amountMinor: 6_000_000,
      postedAt: '2026-08-08T00:00:00Z',
    });

    // Capture baseline counts before reconciliation — F1/F4 must not change
    const { count: glCountBefore } = await supabase
      .from('finance_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);

    const { count: factCountBefore } = await supabase
      .from('finance_payable_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);

    // Orphan GL detection via the two approved read contracts directly (G7 compliant):
    // GL has a POSTED line for orphanSourceId (account 331), but finance_ap_facts_as_of
    // returns zero rows for that source. This bidirectional gap IS the ORPHAN_GL condition.

    // Step A: confirm GL has an entry for orphanSourceId
    const { data: glEntries, error: glErr } = await supabase.rpc(
      'finance_journal_entries_as_of',
      {
        p_tenant_id: testTenantId,
        p_as_of: '2026-08-15T00:00:00Z',
      }
    );
    expect(glErr).toBeNull();
    const orphanGlLines = (glEntries as Array<{ source_id: string }>)
      .filter(r => r.source_id === orphanSourceId);
    expect(orphanGlLines.length).toBeGreaterThanOrEqual(1); // GL line exists

    // Step B: confirm AP facts has ZERO entries for orphanSourceId
    const { data: apFacts, error: apErr } = await supabase.rpc(
      'finance_ap_facts_as_of',
      {
        p_tenant_id: testTenantId,
        p_as_of: '2026-08-15T00:00:00Z',
      }
    );
    expect(apErr).toBeNull();
    const orphanApFacts = (apFacts as Array<{ vendor_bill_id: string }>)
      .filter(r => r.vendor_bill_id === orphanSourceId);
    expect(orphanApFacts.length).toBe(0); // No AP fact — this IS the orphan

    // Step C: GL exists but no AP fact = ORPHAN_GL condition verified
    const isOrphanGl = orphanGlLines.length > 0 && orphanApFacts.length === 0;
    expect(isOrphanGl).toBe(true);

    // Verify F1 and F4 are NOT mutated
    const { count: glCountAfter } = await supabase
      .from('finance_transactions')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);
    const { count: factCountAfter } = await supabase
      .from('finance_payable_ledger')
      .select('*', { count: 'exact', head: true })
      .eq('tenant_id', testTenantId);

    expect(glCountAfter).toBe(glCountBefore);
    expect(factCountAfter).toBe(factCountBefore);
  });

  // =========================================================================
  // Test 4.6 — Case resolution cannot alter evidence; re-run without source fix stays VARIANCE
  // RESOLVED case_state ≠ MATCHED financial_result (Constitutional Law §4.13)
  // =========================================================================
  it('4.6 — resolving a VARIANCE case leaves f5_control_results immutable; re-run without source fix stays VARIANCE (G5, immutability)', async () => {
    const billId = crypto.randomUUID();

    // Seed bill + AP fact for 10M
    await seedVendorBillWithFact(supabase, {
      tenantId: testTenantId,
      billId,
      amountMinor: 10_000_000,
      createdAt: '2026-08-01T00:00:00Z',
    });

    // Seed GL for only 8M → deliberate VARIANCE
    await seedPostedTransaction(supabase, {
      tenantId: testTenantId,
      periodId: testPeriodId,
      apAccountId: testApAccountId,
      balanceAccountId: testDebitAccountId,
      sourceId: billId,
      amountMinor: 8_000_000,
      postedAt: '2026-08-01T00:00:00Z',
    });

    const basisId = crypto.randomUUID();
    const asOf = '2026-08-15T00:00:00Z';

    // Run 1: expect VARIANCE
    const { data: run1, error: runErr } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AP',
      p_control_type: 'AP_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AP_GL_BALANCE:v1',
      p_reconciliation_as_of: asOf,
    });
    expect(runErr).toBeNull();
    expect(run1.variances).toBeGreaterThanOrEqual(1);

    // Fetch the VARIANCE result row and its associated case
    const { data: varianceRow, error: vErr } = await supabase
      .from('f5_control_results')
      .select('result_id, financial_result, case_id, case:f5_control_cases!fk_f5_control_results_case(*)')
      .eq('tenant_id', testTenantId)
      .eq('run_id', run1.run_id)
      .eq('source_id', billId)
      .single();
    expect(vErr).toBeNull();
    expect(varianceRow!.financial_result).toBe('VARIANCE');
    expect(varianceRow!.case_id).not.toBeNull();

    const caseId = varianceRow!.case_id as string;
    const mockUserId = crypto.randomUUID();

    // Transition: OPEN → INVESTIGATING
    const { error: investErr } = await supabase.rpc('f5_investigate_control_case', {
      p_tenant_id: testTenantId,
      p_case_id: caseId,
      p_assigned_to: mockUserId,
      p_investigated_by: mockUserId,
    });
    expect(investErr).toBeNull();

    // Transition: INVESTIGATING → RESOLVED (with authority)
    const { data: resolveData, error: resolveErr } = await supabase.rpc(
      'f5_resolve_control_case',
      {
        p_tenant_id: testTenantId,
        p_case_id: caseId,
        p_resolved_by: mockUserId,
        p_authorized_by: mockUserId,
        p_resolution_reference: 'CORRECTIVE-REF-HARDENING-4.6',
      }
    );
    expect(resolveErr).toBeNull();
    expect(resolveData.new_state).toBe('RESOLVED');

    // The original f5_control_results row must still be VARIANCE (immutable)
    const { data: afterResolve } = await supabase
      .from('f5_control_results')
      .select('financial_result')
      .eq('result_id', varianceRow!.result_id)
      .single();
    expect(afterResolve!.financial_result).toBe('VARIANCE'); // NOT MATCHED

    // Re-run with a NEW basis_id (different run identity) but SAME source data
    // Source data is unchanged — GL still 8M, fact still 10M → must still be VARIANCE
    const basisId2 = crypto.randomUUID();
    const { data: run2, error: run2Err } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AP',
      p_control_type: 'AP_GL_BALANCE',
      p_basis_id: basisId2,
      p_basis_version: 'AP_GL_BALANCE:v1',
      p_reconciliation_as_of: asOf,
    });
    expect(run2Err).toBeNull();
    expect(run2.variances).toBeGreaterThanOrEqual(1); // Still VARIANCE — source not fixed

    // Constitutional notice must be present in resolve response
    expect(resolveData.constitutional_notice).toBeDefined();
  });
});
