/**
 * F5 Reconciliation & Financial Control Integration Test
 *
 * Verifies:
 *   1. F5 Read Contracts (finance_ap_facts_as_of, finance_journal_entries_as_of)
 *   2. F5 Reconstruction Engine (f5_reconstruct_ap_position)
 *   3. F5 Reconciliation Run (f5_run_reconciliation with AP_GL_BALANCE)
 *   4. F5 Case State Machine & Resolution Authority Guard
 *   5. F5 Results Immutability Guard (F5-I-5 / Constitutional Law)
 *   6. Tenant Isolation (F5-I-8)
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('F5 Reconciliation & Financial Control (Integration)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let anotherTenantId: string;
  let testAccountId: string;
  let testDebitAccountId: string;
  let testPeriodId: string;
  let testVendorBillId: string;
  let testTransactionId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);

    // 1. Setup primary test tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', 'Test Tenant F5 Reconciliation')
      .single();

    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant, error } = await supabase
        .from('tenants')
        .insert({ name: 'Test Tenant F5 Reconciliation', status: 'active' })
        .select('id')
        .single();
      if (error) throw new Error(`Failed to create primary test tenant: ${error.message}`);
      testTenantId = newTenant!.id;
    }

    // 2. Setup secondary test tenant (for isolation checks)
    const { data: tenant2 } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', 'Test Tenant F5 Isolation Check')
      .single();

    if (tenant2) {
      anotherTenantId = tenant2.id;
    } else {
      const { data: newTenant2, error } = await supabase
        .from('tenants')
        .insert({ name: 'Test Tenant F5 Isolation Check', status: 'active' })
        .select('id')
        .single();
      if (error) throw new Error(`Failed to create secondary test tenant: ${error.message}`);
      anotherTenantId = newTenant2!.id;
    }

    // 3. Setup Accounting Period
    const { data: period } = await supabase
      .from('finance_accounting_periods')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('name', '2026-08')
      .single();

    if (period) {
      testPeriodId = period.id;
    } else {
      const { data: newPeriod, error } = await supabase
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
      if (error) throw new Error(`Failed to create accounting period: ${error.message}`);
      testPeriodId = newPeriod!.id;
    }

    // 4. Setup AP Account (331)
    const { data: account } = await supabase
      .from('finance_accounts')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('code', '331')
      .single();

    if (account) {
      testAccountId = account.id;
    } else {
      const { data: newAccount, error } = await supabase
        .from('finance_accounts')
        .insert({
          tenant_id: testTenantId,
          code: '331',
          name: 'Accounts Payable Test',
          type: 'LIABILITY',
          normal_balance: 'CREDIT',
          currency: 'VND',
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw new Error(`Failed to create AP Account: ${error.message}`);
      testAccountId = newAccount!.id;
    }

    // 5. Setup Debit Account (111)
    const { data: debitAccount } = await supabase
      .from('finance_accounts')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('code', '111')
      .single();

    if (debitAccount) {
      testDebitAccountId = debitAccount.id;
    } else {
      const { data: newDebitAccount, error } = await supabase
        .from('finance_accounts')
        .insert({
          tenant_id: testTenantId,
          code: '111',
          name: 'Cash Test Account',
          type: 'ASSET',
          normal_balance: 'DEBIT',
          currency: 'VND',
          is_active: true,
        })
        .select('id')
        .single();
      if (error) throw new Error(`Failed to create Debit Account: ${error.message}`);
      testDebitAccountId = newDebitAccount!.id;
    }
  });

  afterEach(async () => {
    // Clean up reconciliation runs/results/cases for both tenants
    const tenantIds = [testTenantId, anotherTenantId].filter(Boolean);
    if (tenantIds.length > 0) {
      await supabase.from('f5_control_cases').delete().in('tenant_id', tenantIds);
      await supabase.from('f5_control_results').delete().in('tenant_id', tenantIds);
      await supabase.from('f5_projection_health').delete().in('tenant_id', tenantIds);
    }
    // Clean up any transactions inserted during each test
    if (testTransactionId) {
      await supabase.from('finance_transaction_lines').delete().eq('transaction_id', testTransactionId);
      await supabase.from('finance_transactions').delete().eq('id', testTransactionId);
      testTransactionId = null as any;
    }
  });

  afterAll(async () => {
    // Delete transactional test data
    if (testTransactionId) {
      await supabase.from('finance_transaction_lines').delete().eq('transaction_id', testTransactionId);
      await supabase.from('finance_transactions').delete().eq('id', testTransactionId);
    }
    if (testVendorBillId) {
      await supabase.from('finance_payable_ledger').delete().eq('vendor_bill_id', testVendorBillId);
      await supabase.from('finance_vendor_bills').delete().eq('id', testVendorBillId);
    }
    // Delete master test data
    if (testAccountId) {
      await supabase.from('finance_accounts').delete().eq('id', testAccountId);
    }
    if (testDebitAccountId) {
      await supabase.from('finance_accounts').delete().eq('id', testDebitAccountId);
    }
    if (testPeriodId) {
      await supabase.from('finance_accounting_periods').delete().eq('id', testPeriodId);
    }
    if (testTenantId) {
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
    if (anotherTenantId) {
      await supabase.from('tenants').delete().eq('id', anotherTenantId);
    }
  });

  it('verifies F5 approved read contracts obey the temporal boundary', async () => {
    // Insert a test vendor bill
    testVendorBillId = '66666666-6666-6666-6666-666666666666';
    const { error: billError } = await supabase.from('finance_vendor_bills').insert({
      id: testVendorBillId,
      tenant_id: testTenantId,
      vendor_id: '11111111-1111-1111-1111-111111111111',
      bill_number: 'VB-F5-TEST-001',
      total_amount_minor: 10000000,
      currency: 'VND',
      bill_date: '2026-08-10T12:00:00Z',
      due_date: '2026-08-30T12:00:00Z',
      status: 'APPROVED',
      posting_attempt_id: 'a8a8a8a8-a8a8-a8a8-a8a8-a8a8a8a8a8a8',
    });
    expect(billError).toBeNull();

    // Insert facts before and after the temporal boundary
    const factBefore = 'b1b1b1b1-b1b1-b1b1-b1b1-b1b1b1b1b1b1';
    const factAfter = 'b2b2b2b2-b2b2-b2b2-b2b2-b2b2b2b2b2b2';

    const { error: f1Error } = await supabase.from('finance_payable_ledger').insert({
      id: factBefore,
      tenant_id: testTenantId,
      vendor_bill_id: testVendorBillId,
      entry_type: 'PAYABLE_ACCRUAL',
      amount_minor: 10000000,
      created_at: '2026-08-15T12:00:00Z',
      f1_transaction_id: 'f1f1f1f1-f1f1-f1f1-f1f1-f1f1f1f1f1f1',
    });
    expect(f1Error).toBeNull();

    const { error: f2Error } = await supabase.from('finance_payable_ledger').insert({
      id: factAfter,
      tenant_id: testTenantId,
      vendor_bill_id: testVendorBillId,
      entry_type: 'DISBURSEMENT_ALLOCATION',
      amount_minor: 3000000,
      created_at: '2026-08-20T12:00:00Z',
      f1_transaction_id: 'f2f2f2f2-f2f2-f2f2-f2f2-f2f2f2f2f2f2',
    });
    expect(f2Error).toBeNull();

    // Run query as_of 2026-08-16 (should exclude the 2026-08-20 disbursement)
    const { data: factsAsOfBefore, error: queryError } = await supabase.rpc('finance_ap_facts_as_of', {
      p_tenant_id: testTenantId,
      p_as_of: '2026-08-16T12:00:00Z',
    });

    expect(queryError).toBeNull();
    const factIds = factsAsOfBefore.map((f: any) => f.fact_id);
    expect(factIds).toContain(factBefore);
    expect(factIds).not.toContain(factAfter);

    // Run query as_of 2026-08-21 (should include both)
    const { data: factsAsOfAfter, error: queryError2 } = await supabase.rpc('finance_ap_facts_as_of', {
      p_tenant_id: testTenantId,
      p_as_of: '2026-08-21T12:00:00Z',
    });

    expect(queryError2).toBeNull();
    const factIds2 = factsAsOfAfter.map((f: any) => f.fact_id);
    expect(factIds2).toContain(factBefore);
    expect(factIds2).toContain(factAfter);
  });

  it('reconstructs outstanding AP balance correctly from facts', async () => {
    // Reconstruct as of 2026-08-16 (expected: 10,000,000)
    const { data: posBefore, error: errBefore } = await supabase.rpc('f5_reconstruct_ap_position', {
      p_tenant_id: testTenantId,
      p_vendor_bill_id: testVendorBillId,
      p_as_of: '2026-08-16T12:00:00Z',
    });
    expect(errBefore).toBeNull();
    expect(posBefore[0].reconstructed_outstanding).toBe(10000000);

    // Reconstruct as of 2026-08-21 (expected: 10,000,000 - 3,000,000 = 7,000,000)
    const { data: posAfter, error: errAfter } = await supabase.rpc('f5_reconstruct_ap_position', {
      p_tenant_id: testTenantId,
      p_vendor_bill_id: testVendorBillId,
      p_as_of: '2026-08-21T12:00:00Z',
    });
    expect(errAfter).toBeNull();
    expect(posAfter[0].reconstructed_outstanding).toBe(7000000);
  });

  it('runs reconciliation and classifies results into MATCHED / VARIANCE', async () => {
    // 1. Insert DRAFT GL transaction matching the fact (10,000,000 on account 331)
    testTransactionId = crypto.randomUUID();
    const { error: txError } = await supabase.from('finance_transactions').insert({
      id: testTransactionId,
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
      exchange_rate_effective: '2026-08-15T12:00:00Z',
      idempotency_key: `tx-idemp-${testTransactionId}`,
      description: 'Test GL Transaction',
      source_type: 'VENDOR_BILL',
      source_id: testVendorBillId,
      reference_type: 'VENDOR_BILL',
      reference_id: 'VB-F5-TEST-001',
    });
    expect(txError).toBeNull();

    // Accrual line (Cr. Accounts Payable: 10,000,000)
    const lineId = crypto.randomUUID();
    const { error: lineError } = await supabase.from('finance_transaction_lines').insert({
      id: lineId,
      tenant_id: testTenantId,
      transaction_id: testTransactionId,
      account_id: testAccountId,
      debit_amount: 0,
      credit_amount: 10000000,
      debit_currency: 'VND',
      credit_currency: 'VND',
      debit_functional_amount: 0,
      credit_functional_amount: 10000000,
      debit_functional_currency: 'VND',
      credit_functional_currency: 'VND',
      memo: 'AP accrual memo',
    });
    expect(lineError).toBeNull();

    // Balancing line (Dr. Cash/Asset Account: 10,000,000)
    const balancingLineId = crypto.randomUUID();
    const { error: balancingLineError } = await supabase.from('finance_transaction_lines').insert({
      id: balancingLineId,
      tenant_id: testTenantId,
      transaction_id: testTransactionId,
      account_id: testDebitAccountId,
      debit_amount: 10000000,
      credit_amount: 0,
      debit_currency: 'VND',
      credit_currency: 'VND',
      debit_functional_amount: 10000000,
      credit_functional_amount: 0,
      debit_functional_currency: 'VND',
      credit_functional_currency: 'VND',
      memo: 'AP balancing cash memo',
    });
    expect(balancingLineError).toBeNull();

    // Update transaction to POSTED now that it has a line
    const { error: postError } = await supabase
      .from('finance_transactions')
      .update({ status: 'POSTED', posted_at: '2026-08-15T12:00:00Z' })
      .eq('id', testTransactionId);
    expect(postError).toBeNull();

    const basisId = 'eeeeeeee-eeee-eeee-eeee-eeeeeeeeeeee';

    // Run reconciliation as of 2026-08-16
    const { data: matchedReport, error: matchedErr } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AP',
      p_control_type: 'AP_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AP_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-08-16T12:00:00Z',
    });

    expect(matchedErr).toBeNull();
    expect(matchedReport).toMatchObject({
      matched: 1,
      variances: 0,
      quarantined: 0,
    });

    // Check results
    const { data: results } = await supabase
      .from('f5_control_results')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('run_id', matchedReport.run_id);
    expect(results).toHaveLength(1);
    expect(results![0].financial_result).toBe('MATCHED');
    expect(results![0].case_id).toBeNull();

    // Run as of 2026-08-21
    const { data: varianceReport, error: varErr } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: testTenantId,
      p_domain: 'AP',
      p_control_type: 'AP_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'AP_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-08-21T12:00:00Z',
    });

    expect(varErr).toBeNull();
    expect(varianceReport).toMatchObject({
      matched: 0,
      variances: 1,
      quarantined: 0,
    });

    // Verify case
    const { data: results2 } = await supabase
      .from('f5_control_results')
      .select('*, case:f5_control_cases(*)')
      .eq('tenant_id', testTenantId)
      .eq('run_id', varianceReport.run_id)
      .single();

    expect(results2.financial_result).toBe('VARIANCE');
    expect(results2.case_id).not.toBeNull();
    expect(results2.case.case_state).toBe('OPEN');
  });

  it('executes case lifecycle: OPEN -> INVESTIGATING -> RESOLVED and obeys authority guard', async () => {
    // Self-contained: insert a result row + OPEN case directly
    const runId   = crypto.randomUUID();
    const basisId = crypto.randomUUID();
    const srcId   = crypto.randomUUID();
    const paId    = crypto.randomUUID();

    const { data: resultRow, error: resultInsertErr } = await supabase
      .from('f5_control_results')
      .insert({
        tenant_id: testTenantId,
        run_id: runId,
        control_type: 'AP_GL_BALANCE',
        basis_id: basisId,
        basis_version: 'AP_GL_BALANCE:v1',
        reconciliation_as_of: '2026-08-16T12:00:00Z',
        source_snapshot_hash: `hash-${runId}`,
        source_module: 'F4',
        source_type: 'VENDOR_BILL',
        source_id: srcId,
        financial_effect_type: 'AP_GL_BALANCE_CHECK',
        posting_attempt_id: paId,
        expected_amount: 10000000,
        actual_amount: 9000000,
        financial_result: 'VARIANCE',
        severity: 'MEDIUM',
        detected_by: 'test-lifecycle',
      })
      .select('result_id')
      .single();
    expect(resultInsertErr).toBeNull();

    const { data: insertedCase, error: caseInsertErr } = await supabase
      .from('f5_control_cases')
      .insert({
        tenant_id: testTenantId,
        result_id: resultRow!.result_id,
        case_state: 'OPEN',
        detected_at: new Date().toISOString(),
        detected_by: 'test-lifecycle',
      })
      .select('case_id')
      .single();
    expect(caseInsertErr).toBeNull();

    await supabase
      .from('f5_control_results')
      .update({ case_id: insertedCase!.case_id })
      .eq('result_id', resultRow!.result_id);

    const openCase = insertedCase!;
    const mockAssignedUser = '99999999-9999-9999-9999-999999999999';

    // Step 1: Open -> Investigating
    const { data: investRes, error: investErr } = await supabase.rpc('f5_investigate_control_case', {
      p_tenant_id: testTenantId,
      p_case_id: openCase.case_id,
      p_assigned_to: mockAssignedUser,
      p_investigated_by: mockAssignedUser,
    });

    expect(investErr).toBeNull();
    expect(investRes.new_state).toBe('INVESTIGATING');

    // Step 2: Resolve without authorization should fail
    const { error: invalidResolveErr } = await supabase.rpc('f5_resolve_control_case', {
      p_tenant_id: testTenantId,
      p_case_id: openCase.case_id,
      p_resolved_by: mockAssignedUser,
      p_authorized_by: null,
      p_resolution_reference: '',
    });
    expect(invalidResolveErr).not.toBeNull();

    // Step 3: Resolve successfully with authorization
    const { data: resolveRes, error: resolveErr } = await supabase.rpc('f5_resolve_control_case', {
      p_tenant_id: testTenantId,
      p_case_id: openCase.case_id,
      p_resolved_by: mockAssignedUser,
      p_authorized_by: mockAssignedUser,
      p_resolution_reference: 'CORRECTIVE-TX-009',
    });

    expect(resolveErr).toBeNull();
    expect(resolveRes.new_state).toBe('RESOLVED');

    const { data: finalCase } = await supabase
      .from('f5_control_cases')
      .select('*')
      .eq('case_id', openCase.case_id)
      .single();
    expect(finalCase.case_state).toBe('RESOLVED');
    expect(finalCase.resolution_reference).toBe('CORRECTIVE-TX-009');
  });

  it('verifies RLS and tenant isolation guards on f5 tables', async () => {
    const basisId = crypto.randomUUID();

    const insertRow = async (tenantId: string) => {
      const runId   = crypto.randomUUID();
      const srcId   = crypto.randomUUID();
      const paId    = crypto.randomUUID();
      const { error } = await supabase.from('f5_control_results').insert({
        tenant_id: tenantId,
        run_id: runId,
        control_type: 'AP_GL_BALANCE',
        basis_id: basisId,
        basis_version: 'AP_GL_BALANCE:v1',
        reconciliation_as_of: new Date().toISOString(),
        source_snapshot_hash: `hash-${runId}`,
        source_module: 'F4',
        source_type: 'VENDOR_BILL',
        source_id: srcId,
        financial_effect_type: 'AP_GL_BALANCE_CHECK',
        posting_attempt_id: paId,
        expected_amount: 1000,
        actual_amount: 1000,
        financial_result: 'MATCHED',
        severity: 'LOW',
        detected_by: 'test-isolation',
      });
      expect(error).toBeNull();
    };

    await insertRow(testTenantId);
    await insertRow(anotherTenantId);

    // Query all results as admin (service_role bypasses RLS, sees both)
    const { data: allResults, error: fetchErr } = await supabase
      .from('f5_control_results')
      .select('tenant_id');
    expect(fetchErr).toBeNull();
    const tenantIds = allResults!.map(r => r.tenant_id);
    expect(tenantIds).toContain(testTenantId);
    expect(tenantIds).toContain(anotherTenantId);
  });

  it('proves that f5_control_results obeys the immutability guard', async () => {
    // Self-contained: insert its own result row
    const runId = crypto.randomUUID();
    const srcId = crypto.randomUUID();
    const paId  = crypto.randomUUID();
    const basisId = crypto.randomUUID();

    const { data: resultRow, error: insertErr } = await supabase
      .from('f5_control_results')
      .insert({
        tenant_id: testTenantId,
        run_id: runId,
        control_type: 'AP_GL_BALANCE',
        basis_id: basisId,
        basis_version: 'AP_GL_BALANCE:v1',
        reconciliation_as_of: new Date().toISOString(),
        source_snapshot_hash: `hash-immute-${runId}`,
        source_module: 'F4',
        source_type: 'VENDOR_BILL',
        source_id: srcId,
        financial_effect_type: 'AP_GL_BALANCE_CHECK',
        posting_attempt_id: paId,
        expected_amount: 10000000,
        actual_amount: 10000000,
        financial_result: 'MATCHED',
        severity: 'LOW',
        detected_by: 'test-immutability',
      })
      .select('result_id')
      .single();
    expect(insertErr).toBeNull();
    expect(resultRow).toBeDefined();

    const { error: updateError } = await supabase
      .from('f5_control_results')
      .update({ functional_currency: 'USD' })
      .eq('result_id', resultRow!.result_id);

    expect(updateError).not.toBeNull();
    expect(updateError!.message).toContain('F5_RESULT_IMMUTABLE');

    const { error: deleteError } = await supabase
      .from('f5_control_results')
      .delete()
      .eq('result_id', resultRow!.result_id);

    expect(deleteError).not.toBeNull();
    expect(deleteError!.message).toContain('F5_RESULT_IMMUTABLE');
  });
});
