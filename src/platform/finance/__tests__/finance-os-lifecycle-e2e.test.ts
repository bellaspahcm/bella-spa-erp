/**
 * Finance OS Lifecycle E2E
 *
 * Proves the current Finance foundation works as one system:
 * business event -> tenant accounting mapping -> GL/F1 -> F2/F4 contracts -> F5.6 reconciliation.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { LedgerEngineService } from '@/platform/finance/engines/ledger-engine/ledger.service';
import { createFinanceEventHandler } from '../finance-event-handler.factory';
import type { FinanceEventEnvelope } from '@/platform/integration-hub/finance-event-contract.types';

jest.setTimeout(90000);

type JournalLineWithAccount = {
  debit_amount: number | string;
  credit_amount: number | string;
  accounting_accounts: {
    account_code: string;
  } | null;
};

type ReconciliationReport = {
  run_id: string;
  is_duplicate: boolean;
  total_checked: number;
  matched: number;
  variances: number;
  quarantined: number;
};

describe('Finance OS Lifecycle E2E', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let ledgerService: LedgerEngineService;
  const runId = Date.now().toString(36).toUpperCase();
  let tenantId: string;
  let bankAccountId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    ledgerService = new LedgerEngineService(supabase);

    tenantId = await createTenant();
    bankAccountId = await seedAccountsAndBank(tenantId);
    await openPeriod(tenantId);
    await createSemanticMapping(tenantId, 'SERVICE_REVENUE', '5113');
    await createSemanticMapping(tenantId, 'PREPAYMENT_CONTROL', '242');
    await createCashOpeningBalance(tenantId, bankAccountId);
  });

  afterAll(async () => {
    await cleanupTenant(tenantId);
  });

  it('traces revenue, cash, and prepayment from configured semantics through F1/F2/F4 to F5.6 reconciliation', async () => {
    const revenueResult = await postRevenueEvent();
    expect(revenueResult.status).toBe('CREATED');
    expect(revenueResult.transaction_id).toBeTruthy();

    const revenueLines = await readJournalLines(revenueResult.transaction_id!);
    expect(Number(revenueLines.find(line => line.accounting_accounts?.account_code === '5113')?.credit_amount)).toBe(125000);
    expect(revenueLines.some(line => line.accounting_accounts?.account_code === '4111')).toBe(false);

    const revenueReplay = await createFinanceEventHandler({ supabase, useInMemoryIdempotency: false }).handle(createRevenueEvent());
    expect(revenueReplay.status).toBe('ALREADY_PROCESSED');
    expect(revenueReplay.transaction_id).toBe(revenueResult.transaction_id);

    const cashTransactionId = await postCashTransaction();
    await recordCashMovement(cashTransactionId);
    const cashReport = await runReconciliation('CASH', 'CASH_GL_BALANCE', 'CASH_GL_BALANCE:v1');
    expect(cashReport).toMatchObject({ total_checked: 1, matched: 1, variances: 0, quarantined: 0 });

    const prepaymentTransactionId = await postPrepaymentTransaction();
    await insertPrepaymentFact(prepaymentTransactionId);
    const prepaymentReport = await runReconciliation('PREPAYMENT', 'PREPAYMENT_GL_BALANCE', 'PREPAYMENT_GL_BALANCE:v1');
    expect(prepaymentReport).toMatchObject({ total_checked: 1, matched: 1, variances: 0, quarantined: 0 });

    const { count: financeTransactionCount } = await supabase
      .from('finance_transactions' as unknown as 'tenants')
      .select('id', { count: 'exact', head: true })
      .eq('tenant_id' as unknown as 'id', tenantId);
    expect(financeTransactionCount).toBe(2);
  });

  async function createTenant(): Promise<string> {
    const { data, error } = await supabase
      .from('tenants')
      .insert({ name: `FIN-OS-E2E-${runId}`, status: 'active' })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Tenant creation failed');
    return data.id;
  }

  async function seedAccountsAndBank(currentTenantId: string): Promise<string> {
    const accountingAccounts = [
      { tenant_id: currentTenantId, account_code: '1311', account_name: 'Accounts Receivable', account_type: 'ASSET', is_active: true },
      { tenant_id: currentTenantId, account_code: '5113', account_name: 'Configured Service Revenue', account_type: 'REVENUE', is_active: true },
    ];
    const cashAccountSeed = { tenant_id: currentTenantId, code: '1111', name: 'Operating Cash', type: 'ASSET', normal_balance: 'DEBIT', currency: 'VND', is_active: true };
    const financeAccounts = [
      { tenant_id: currentTenantId, code: '242', name: 'Configured Prepayment Control', type: 'ASSET', normal_balance: 'DEBIT', currency: 'VND', is_active: true },
      { tenant_id: currentTenantId, code: '5113', name: 'Configured Service Revenue', type: 'REVENUE', normal_balance: 'CREDIT', currency: 'VND', is_active: true },
    ];

    const { error: accountingError } = await supabase.from('accounting_accounts').insert(accountingAccounts as never);
    if (accountingError) throw accountingError;

    const { data: cashAccount, error: financeError } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert(cashAccountSeed as never)
      .select('id')
      .single();
    if (financeError || !cashAccount) throw financeError ?? new Error('Cash finance account creation failed');

    const { error: otherFinanceError } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert(financeAccounts as never);
    if (otherFinanceError) throw otherFinanceError;

    const { data: bankAccount, error: bankError } = await supabase
      .from('finance_bank_accounts')
      .insert({
        tenant_id: currentTenantId,
        bank_name: 'Finance OS E2E Bank',
        account_number: `FIN-OS-E2E-${runId}`,
        account_name: 'Operating Cash',
        currency: 'VND',
        linked_finance_account_id: String(cashAccount.id),
        is_active: true,
      })
      .select('id')
      .single();
    if (bankError || !bankAccount) throw bankError ?? new Error('Bank account creation failed');

    return bankAccount.id;
  }

  async function openPeriod(currentTenantId: string): Promise<void> {
    const period = await ledgerService.openPeriod({
      tenant_id: currentTenantId,
      name: `Finance OS E2E ${runId}`,
      period_start: new Date('2026-08-01T00:00:00Z'),
      period_end: new Date('2026-08-31T23:59:59Z'),
    });
    if (!period.success) throw new Error(period.error?.message ?? 'Period creation failed');
  }

  async function createSemanticMapping(currentTenantId: string, semanticKey: string, accountCode: string): Promise<void> {
    const { error } = await supabase
      .from('finance_control_account_mappings')
      .insert({
        tenant_id: currentTenantId,
        control_type: semanticKey,
        account_code: accountCode,
        effective_from: '2026-01-01',
        effective_to: null,
        authority_version: 'TENANT_CONFIG:v1',
      } as never);
    if (error) throw error;
  }

  async function createCashOpeningBalance(currentTenantId: string, currentBankAccountId: string): Promise<void> {
    const { error } = await supabase
      .from('finance_cash_opening_balances' as unknown as 'tenants')
      .insert({
        tenant_id: currentTenantId,
        bank_account_id: currentBankAccountId,
        balance_minor: 0,
        currency: 'VND',
        effective_date: '2026-08-01T00:00:00Z',
        source_type: 'MANUAL_ADJUSTMENT',
        source_id: `fin-os-e2e-${runId}`,
        notes: 'Finance OS lifecycle E2E baseline',
      } as unknown as Record<string, unknown>);
    if (error) throw error;
  }

  function createRevenueEvent(): FinanceEventEnvelope {
    return {
      event_id: `fin-os-e2e-revenue-${runId}`,
      event_type: 'PATIENT_SERVICE_COMPLETED',
      idempotency_key: `fin-os-e2e-revenue-${runId}`,
      occurred_at: '2026-08-10T10:00:00.000Z',
      created_at: '2026-08-10T10:00:01.000Z',
      tenant_id: tenantId,
      source_system: 'HOSPITAL_OS',
      source_version: '1.0.0',
      correlation_id: `fin-os-e2e-revenue-${runId}`,
      amount: '125000',
      currency: 'VND',
      business_context: {
        patient: { patient_id: `patient-${runId}`, patient_type: 'OUTPATIENT' },
        service: { service_id: `service-${runId}`, service_type: 'CONSULTATION' },
      },
      business_references: [{ entity_type: 'service', entity_id: `service-${runId}` }],
    };
  }

  async function postRevenueEvent() {
    return createFinanceEventHandler({ supabase, useInMemoryIdempotency: false }).handle(createRevenueEvent());
  }

  async function readJournalLines(entryId: string): Promise<JournalLineWithAccount[]> {
    const { data, error } = await supabase
      .from('journal_lines')
      .select('debit_amount, credit_amount, accounting_accounts(account_code)')
      .eq('entry_id', entryId);
    if (error) throw error;
    return data as JournalLineWithAccount[];
  }

  async function postCashTransaction(): Promise<string> {
    const post = await ledgerService.postTransaction({
      tenant_id: tenantId,
      idempotency_key: `fin-os-e2e-cash-${runId}`,
      source_type: 'FINANCE_OS_E2E',
      source_id: crypto.randomUUID(),
      transaction_type: 'CASH',
      posted_at: new Date('2026-08-11T00:00:00Z'),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'Finance OS E2E cash receipt',
      reference_type: 'finance_os_e2e',
      reference_id: crypto.randomUUID(),
      lines: [
        { account_code: '1111', debit_amount_minor: '1000000', credit_amount_minor: '0', memo: 'cash receipt' },
        { account_code: '5113', debit_amount_minor: '0', credit_amount_minor: '1000000', memo: 'configured revenue' },
      ],
    });
    if (!post.success || !post.data) throw new Error(post.error?.message ?? 'Cash transaction posting failed');
    return post.data.id;
  }

  async function recordCashMovement(f1TransactionId: string): Promise<void> {
    const { error } = await supabase.rpc('finance_internal_record_cash_movement', {
      p_tenant_id: tenantId,
      p_bank_account_id: bankAccountId,
      p_idempotency_key: `fin-os-e2e-cash-movement-${runId}`,
      p_direction: 'INFLOW',
      p_amount_minor: 1000000,
      p_currency: 'VND',
      p_functional_amount_minor: 1000000,
      p_functional_currency: 'VND',
      p_valuation_rate: 1,
      p_f1_transaction_id: f1TransactionId,
      p_cash_leg_reference: `FIN-OS-E2E-${runId}`,
      p_source_type: 'F1_POSTING',
      p_source_id: f1TransactionId,
      p_description: 'Finance OS E2E cash movement',
    });
    if (error) throw error;
  }

  async function postPrepaymentTransaction(): Promise<string> {
    const post = await ledgerService.postTransaction({
      tenant_id: tenantId,
      idempotency_key: `fin-os-e2e-prepayment-${runId}`,
      source_type: 'FINANCE_OS_E2E',
      source_id: crypto.randomUUID(),
      transaction_type: 'ACCRUAL',
      posted_at: new Date('2026-08-12T00:00:00Z'),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'Finance OS E2E vendor prepayment',
      reference_type: 'finance_os_e2e',
      reference_id: crypto.randomUUID(),
      lines: [
        { account_code: '242', debit_amount_minor: '300000', credit_amount_minor: '0', memo: 'configured prepayment control' },
        { account_code: '5113', debit_amount_minor: '0', credit_amount_minor: '300000', memo: 'offset' },
      ],
    });
    if (!post.success || !post.data) throw new Error(post.error?.message ?? 'Prepayment transaction posting failed');
    return post.data.id;
  }

  async function insertPrepaymentFact(f1TransactionId: string): Promise<void> {
    const { error } = await supabase
      .from('finance_vendor_prepayments' as unknown as 'tenants')
      .insert({
        tenant_id: tenantId,
        vendor_id: crypto.randomUUID(),
        fact_type: 'PREPAYMENT_RECORDED',
        amount_minor: 300000,
        posting_attempt_id: crypto.randomUUID(),
        f1_transaction_id: f1TransactionId,
        source_type: 'FINANCE_OS_E2E',
        source_id: crypto.randomUUID(),
        created_at: '2026-08-12T00:00:00Z',
      } as never);
    if (error) throw error;
  }

  async function runReconciliation(domain: string, controlType: string, basisVersion: string): Promise<ReconciliationReport> {
    const { data, error } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: tenantId,
      p_domain: domain,
      p_control_type: controlType,
      p_basis_id: crypto.randomUUID(),
      p_basis_version: basisVersion,
      p_reconciliation_as_of: '2026-08-20T00:00:00Z',
    });
    if (error) throw error;
    return data as ReconciliationReport;
  }

  async function cleanupTenant(currentTenantId: string | undefined): Promise<void> {
    if (!currentTenantId) return;
    try { await supabase.from('f5_control_cases').delete().eq('tenant_id', currentTenantId); } catch {}
    try { await supabase.from('f5_control_results').delete().eq('tenant_id', currentTenantId); } catch {}
    try { await supabase.from('finance_vendor_prepayments' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', currentTenantId); } catch {}
    try { await supabase.from('finance_control_account_mappings').delete().eq('tenant_id', currentTenantId); } catch {}
    try { await supabase.from('finance_cash_opening_balances' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', currentTenantId); } catch {}
    try { await supabase.from('finance_cash_movements').delete().eq('tenant_id', currentTenantId); } catch {}
    try { await supabase.from('finance_cash_positions').delete().eq('tenant_id', currentTenantId); } catch {}
    try { await supabase.from('finance_audit_trail' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', currentTenantId); } catch {}
    try { await supabase.from('finance_outbox_events' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', currentTenantId); } catch {}
    try { await supabase.from('finance_transaction_lines' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', currentTenantId); } catch {}
    try { await supabase.from('finance_transactions' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', currentTenantId); } catch {}
    try { await supabase.from('finance_bank_accounts').delete().eq('tenant_id', currentTenantId); } catch {}
    try { await supabase.from('finance_accounting_periods' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', currentTenantId); } catch {}
    try { await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', currentTenantId); } catch {}
    try { await supabase.from('finance_transaction_metadata').delete().eq('tenant_id', currentTenantId); } catch {}
    try { await supabase.from('journal_entries').delete().eq('tenant_id', currentTenantId); } catch {}
    try { await supabase.from('accounting_accounts').delete().eq('tenant_id', currentTenantId); } catch {}
    try { await supabase.from('tenants').delete().eq('id', currentTenantId); } catch {}
  }
});
