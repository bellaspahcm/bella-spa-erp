/**
 * F5.6 Cash + Prepayment Reconciliation Integration Tests
 *
 * Cash is implemented. Prepayment remains gated unless semantic/account mapping
 * authority is separately approved.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { LedgerEngineService } from '@/platform/finance/engines/ledger-engine/ledger.service';

jest.setTimeout(60000);

describe('F5.6 CASH_GL_BALANCE', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let ledgerService: LedgerEngineService;
  const runId = Date.now().toString(36).toUpperCase();

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    ledgerService = new LedgerEngineService(supabase);
  });

  async function createTenantFixture(accountCode: string, openingBalanceMinor: number | null) {
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .insert({ name: `F5-6-CASH-${accountCode}-${runId}-${crypto.randomUUID()}`, status: 'active' })
      .select('id')
      .single();
    if (tenantErr || !tenant) throw tenantErr ?? new Error('Tenant creation failed');

    const tenantId = tenant.id;

    const { data: cashAccount, error: cashErr } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: tenantId,
        code: accountCode,
        name: `Cash ${accountCode}`,
        type: 'ASSET',
        normal_balance: 'DEBIT',
        currency: 'VND',
        is_active: true,
      })
      .select('id')
      .single();
    if (cashErr || !cashAccount) throw cashErr ?? new Error('Cash account creation failed');

    const { error: revenueErr } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: tenantId,
        code: '5111',
        name: 'Revenue',
        type: 'REVENUE',
        normal_balance: 'CREDIT',
        currency: 'VND',
        is_active: true,
      });
    if (revenueErr) throw revenueErr;

    const { data: bankAccount, error: bankErr } = await supabase
      .from('finance_bank_accounts')
      .insert({
        tenant_id: tenantId,
        bank_name: `F5.6 Bank ${accountCode}`,
        account_number: `F56-${accountCode}-${crypto.randomUUID()}`,
        account_name: `Operating ${accountCode}`,
        currency: 'VND',
        linked_finance_account_id: String(cashAccount.id),
        is_active: true,
      })
      .select('id')
      .single();
    if (bankErr || !bankAccount) throw bankErr ?? new Error('Bank account creation failed');

    const period = await ledgerService.openPeriod({
      tenant_id: tenantId,
      name: `2026-08-${accountCode}-${runId}`,
      period_start: new Date('2026-08-01T00:00:00Z'),
      period_end: new Date('2026-08-31T23:59:59Z'),
    });
    if (!period.success) throw new Error(period.error?.message ?? 'Period creation failed');

    if (openingBalanceMinor !== null) {
      const { error: openingErr } = await supabase
        .from('finance_cash_opening_balances' as unknown as 'tenants')
        .insert({
          tenant_id: tenantId,
          bank_account_id: bankAccount.id,
          balance_minor: openingBalanceMinor,
          currency: 'VND',
          effective_date: '2026-08-01T00:00:00Z',
          source_type: 'MANUAL_ADJUSTMENT',
          source_id: `f5-6-${accountCode}`,
          notes: 'F5.6 test verified baseline',
        } as unknown as Record<string, unknown>);
      if (openingErr) throw openingErr;
    }

    return {
      tenantId,
      bankAccountId: bankAccount.id,
      cashAccountId: String(cashAccount.id),
    };
  }

  async function cleanupTenant(tenantId: string): Promise<void> {
    try { await supabase.from('f5_control_cases').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('f5_control_results').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_cash_opening_balances' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_cash_movements').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_cash_positions').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_audit_trail' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_outbox_events' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_transaction_lines' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_transactions' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_bank_accounts').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_accounting_periods' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('tenants').delete().eq('id', tenantId); } catch (e) {}
  }

  async function runCashReconciliation(tenantId: string, basisId = crypto.randomUUID()) {
    const { data, error } = await supabase.rpc('f5_run_reconciliation', {
      p_tenant_id: tenantId,
      p_domain: 'CASH',
      p_control_type: 'CASH_GL_BALANCE',
      p_basis_id: basisId,
      p_basis_version: 'CASH_GL_BALANCE:v1',
      p_reconciliation_as_of: '2026-08-20T00:00:00Z',
    });
    if (error) throw error;
    return data as { run_id: string; is_duplicate: boolean; total_checked: number; matched: number; variances: number; quarantined: number };
  }

  it('matches F2 reconstructed cash position to F1 GL debit-normal balance', async () => {
    const fx = await createTenantFixture('1111', 0);
    try {
      const post = await ledgerService.postTransaction({
        tenant_id: fx.tenantId,
        idempotency_key: `f56-cash-match-${runId}`,
        source_type: 'F5_6_TEST',
        source_id: crypto.randomUUID(),
        transaction_type: 'CASH',
        posted_at: new Date('2026-08-10T00:00:00Z'),
        transaction_currency: 'VND',
        functional_currency: 'VND',
        description: 'F5.6 cash matched',
        reference_type: 'f5_6_test',
        reference_id: crypto.randomUUID(),
        lines: [
          { account_code: '1111', debit_amount_minor: '1000000', credit_amount_minor: '0', memo: 'cash' },
          { account_code: '5111', debit_amount_minor: '0', credit_amount_minor: '1000000', memo: 'revenue' },
        ],
      });
      expect(post.success).toBe(true);

      const { error: movementErr } = await supabase.rpc('finance_internal_record_cash_movement', {
        p_tenant_id: fx.tenantId,
        p_bank_account_id: fx.bankAccountId,
        p_idempotency_key: `f56-cash-movement-${runId}`,
        p_direction: 'INFLOW',
        p_amount_minor: 1000000,
        p_currency: 'VND',
        p_functional_amount_minor: 1000000,
        p_functional_currency: 'VND',
        p_valuation_rate: 1,
        p_f1_transaction_id: post.data!.id,
        p_cash_leg_reference: 'F56-MATCH',
        p_source_type: 'F1_POSTING',
        p_source_id: post.data!.id,
        p_description: 'F5.6 cash movement',
      });
      expect(movementErr).toBeNull();

      const report = await runCashReconciliation(fx.tenantId);
      expect(report.total_checked).toBe(1);
      expect(report.matched).toBe(1);
      expect(report.variances).toBe(0);
      expect(report.quarantined).toBe(0);
    } finally {
      await cleanupTenant(fx.tenantId);
    }
  });

  it('opens a variance case when F2 cash position differs from F1 GL', async () => {
    const fx = await createTenantFixture('1121', 500000);
    try {
      const report = await runCashReconciliation(fx.tenantId);
      expect(report.total_checked).toBe(1);
      expect(report.variances).toBe(1);

      const { data: cases } = await supabase
        .from('f5_control_cases')
        .select('case_id')
        .eq('tenant_id', fx.tenantId);
      expect(cases).toHaveLength(1);
    } finally {
      await cleanupTenant(fx.tenantId);
    }
  });

  it('quarantines cash reconciliation when no verified opening baseline exists', async () => {
    const fx = await createTenantFixture('1131', null);
    try {
      const report = await runCashReconciliation(fx.tenantId);
      expect(report.total_checked).toBe(1);
      expect(report.quarantined).toBe(1);
      expect(report.matched).toBe(0);
    } finally {
      await cleanupTenant(fx.tenantId);
    }
  });

  it('quarantines ambiguous bank-account to GL mappings instead of comparing per-bank to combined GL', async () => {
    const fx = await createTenantFixture('1113', 0);
    try {
      const { error: secondBankErr } = await supabase
        .from('finance_bank_accounts')
        .insert({
          tenant_id: fx.tenantId,
          bank_name: 'F5.6 Duplicate Map Bank',
          account_number: `F56-DUP-${runId}-${crypto.randomUUID()}`,
          account_name: 'Second Operating Account',
          currency: 'VND',
          linked_finance_account_id: fx.cashAccountId,
          is_active: true,
        });
      expect(secondBankErr).toBeNull();

      const report = await runCashReconciliation(fx.tenantId);
      expect(report.total_checked).toBe(2);
      expect(report.matched).toBe(0);
      expect(report.quarantined).toBe(2);
    } finally {
      await cleanupTenant(fx.tenantId);
    }
  });

  it('returns duplicate evidence for repeated CASH_GL_BALANCE runs with the same basis', async () => {
    const fx = await createTenantFixture('1114', 0);
    try {
      const basisId = crypto.randomUUID();
      const first = await runCashReconciliation(fx.tenantId, basisId);
      const second = await runCashReconciliation(fx.tenantId, basisId);

      expect(first.is_duplicate).toBe(false);
      expect(second.is_duplicate).toBe(true);
      expect(second.run_id).toBe(first.run_id);
      expect(second.total_checked).toBe(first.total_checked);
      expect(second.matched).toBe(first.matched);
      expect(second.variances).toBe(first.variances);
      expect(second.quarantined).toBe(first.quarantined);
    } finally {
      await cleanupTenant(fx.tenantId);
    }
  });

  it('rejects mismatched domain and control type pairs', async () => {
    const fx = await createTenantFixture('1115', 0);
    try {
      const { error } = await supabase.rpc('f5_run_reconciliation', {
        p_tenant_id: fx.tenantId,
        p_domain: 'CASH',
        p_control_type: 'AP_GL_BALANCE',
        p_basis_id: crypto.randomUUID(),
        p_basis_version: 'AP_GL_BALANCE:v1',
        p_reconciliation_as_of: '2026-08-20T00:00:00Z',
      });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('F5_DOMAIN_CONTROL_MISMATCH');
    } finally {
      await cleanupTenant(fx.tenantId);
    }
  });

  it('keeps Prepayment gated pending semantic/account mapping authority', async () => {
    const fx = await createTenantFixture('1112', 0);
    try {
      const { error } = await supabase.rpc('f5_run_reconciliation', {
        p_tenant_id: fx.tenantId,
        p_domain: 'PREPAYMENT',
        p_control_type: 'PREPAYMENT_GL_BALANCE',
        p_basis_id: crypto.randomUUID(),
        p_basis_version: 'PREPAYMENT_GL_BALANCE:v1',
        p_reconciliation_as_of: '2026-08-20T00:00:00Z',
      });

      expect(error).not.toBeNull();
      expect(error!.message).toContain('F5_CONTROL_TYPE_NOT_YET_IMPLEMENTED');
    } finally {
      await cleanupTenant(fx.tenantId);
    }
  });
});
