/**
 * F4 Prepayment Position Contract Tests
 *
 * Verifies aggregate tenant/currency prepayment position as-of.
 * Currency is authoritative from F1 functional_currency, not inferred by F5.6.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import { LedgerEngineService } from '@/platform/finance/engines/ledger-engine/ledger.service';
import type { Database } from '@/types/database.types';

jest.setTimeout(60000);

type PrepaymentPositionRow = {
  tenant_id: string;
  currency: string;
  position_amount_minor: string | number;
  as_of: string;
  fact_count: number;
  contract_version: string;
};

describe('F4_PREPAYMENT_POSITION:v1 Contract', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let ledgerService: LedgerEngineService;
  const runId = Date.now().toString(36).toUpperCase();
  let tenantAId: string;
  let tenantBId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    ledgerService = new LedgerEngineService(supabase);

    tenantAId = await createTenant(`F4-PP-POS-A-${runId}`);
    tenantBId = await createTenant(`F4-PP-POS-B-${runId}`);

    await createAccounts(tenantAId);
    await createAccounts(tenantBId);
    await openPeriod(tenantAId);
    await openPeriod(tenantBId);
  });

  beforeEach(async () => {
    await cleanupFinanceData(tenantAId);
    await cleanupFinanceData(tenantBId);
  });

  afterAll(async () => {
    await cleanupTenant(tenantAId);
    await cleanupTenant(tenantBId);
  });

  async function createTenant(name: string): Promise<string> {
    const { data, error } = await supabase
      .from('tenants')
      .insert({ name, status: 'active' })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Tenant creation failed');
    return data.id;
  }

  async function createAccounts(tenantId: string): Promise<void> {
    const accounts = [
      { code: 'PP_VND', name: 'Prepayment VND', currency: 'VND' },
      { code: 'AP_VND', name: 'AP VND', currency: 'VND' },
      { code: 'PP_USD', name: 'Prepayment USD', currency: 'USD' },
      { code: 'AP_USD', name: 'AP USD', currency: 'USD' },
    ];

    const { error } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert(accounts.map(account => ({
        tenant_id: tenantId,
        code: `${account.code}_${runId}`,
        name: account.name,
        type: 'ASSET',
        normal_balance: 'DEBIT',
        currency: account.currency,
        is_active: true,
      })));
    if (error) throw error;
  }

  async function openPeriod(tenantId: string): Promise<void> {
    const period = await ledgerService.openPeriod({
      tenant_id: tenantId,
      name: `F4 PP Position ${runId}`,
      period_start: new Date('2026-08-01T00:00:00Z'),
      period_end: new Date('2026-08-31T23:59:59Z'),
    });
    if (!period.success) throw new Error(period.error?.message ?? 'Period creation failed');
  }

  async function postF1Transaction(
    tenantId: string,
    currency: 'VND' | 'USD',
    amountMinor: string,
    postedAt: string,
  ): Promise<string> {
    const suffix = currency === 'VND' ? 'VND' : 'USD';
    const post = await ledgerService.postTransaction({
      tenant_id: tenantId,
      idempotency_key: `f4-pp-pos-${runId}-${crypto.randomUUID()}`,
      source_type: 'F4_PP_POSITION_TEST',
      source_id: crypto.randomUUID(),
      transaction_type: 'ACCRUAL',
      posted_at: new Date(postedAt),
      transaction_currency: currency,
      functional_currency: currency,
      description: `F4 prepayment position ${currency}`,
      reference_type: 'f4_prepayment_position_test',
      reference_id: crypto.randomUUID(),
      lines: [
        {
          account_code: `PP_${suffix}_${runId}`,
          debit_amount_minor: amountMinor,
          credit_amount_minor: '0',
          memo: 'Prepayment position debit',
        },
        {
          account_code: `AP_${suffix}_${runId}`,
          debit_amount_minor: '0',
          credit_amount_minor: amountMinor,
          memo: 'Prepayment position credit',
        },
      ],
    });

    if (!post.success || !post.data) {
      throw new Error(post.error?.message ?? 'F1 transaction posting failed');
    }

    return post.data.id;
  }

  async function insertPrepaymentFact(
    tenantId: string,
    f1TransactionId: string,
    factType: 'PREPAYMENT_RECORDED' | 'PREPAYMENT_APPLIED' | 'PREPAYMENT_REFUNDED',
    amountMinor: number,
    createdAt: string,
    currency?: string,
  ): Promise<string> {
    const payload: Record<string, unknown> = {
      tenant_id: tenantId,
      vendor_id: crypto.randomUUID(),
      fact_type: factType,
      amount_minor: amountMinor,
      posting_attempt_id: crypto.randomUUID(),
      f1_transaction_id: f1TransactionId,
      source_type: 'F4_PP_POSITION_TEST',
      source_id: crypto.randomUUID(),
      created_at: createdAt,
    };

    if (currency) {
      payload.currency = currency;
    }

    const { data, error } = await supabase
      .from('finance_vendor_prepayments' as unknown as 'tenants')
      .insert(payload as never)
      .select('id')
      .single();

    if (error || !data) throw error ?? new Error('Prepayment fact insert failed');
    return String(data.id);
  }

  async function readPosition(tenantId: string, asOf: string): Promise<PrepaymentPositionRow[]> {
    const { data, error } = await supabase.rpc('finance_prepayment_position_as_of' as never, {
      p_tenant_id: tenantId,
      p_as_of: asOf,
      p_contract_version: 'F4_PREPAYMENT_POSITION:v1',
    } as never);
    if (error) throw error;
    return data as PrepaymentPositionRow[];
  }

  async function cleanupFinanceData(tenantId: string | undefined): Promise<void> {
    if (!tenantId) return;
    try { await supabase.from('finance_vendor_prepayments' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_audit_trail' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_outbox_events' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_transaction_lines' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_transactions' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
  }

  async function cleanupTenant(tenantId: string | undefined): Promise<void> {
    if (!tenantId) return;
    await cleanupFinanceData(tenantId);
    try { await supabase.from('finance_accounting_periods' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('tenants').delete().eq('id', tenantId); } catch (e) {}
  }

  it('derives prepayment fact currency from authoritative F1 functional currency', async () => {
    const f1TransactionId = await postF1Transaction(tenantAId, 'VND', '500000000', '2026-08-01T00:00:00Z');
    const factId = await insertPrepaymentFact(
      tenantAId,
      f1TransactionId,
      'PREPAYMENT_RECORDED',
      500000000,
      '2026-08-01T00:00:00Z',
    );

    const { data, error } = await supabase
      .from('finance_vendor_prepayments' as unknown as 'tenants')
      .select('currency')
      .eq('id' as unknown as 'name', factId)
      .single();

    expect(error).toBeNull();
    expect((data as { currency: string }).currency).toBe('VND');
  });

  it('aggregates position by tenant and currency as of the requested time', async () => {
    const recordedVndTx = await postF1Transaction(tenantAId, 'VND', '500000000', '2026-08-01T00:00:00Z');
    const appliedVndTx = await postF1Transaction(tenantAId, 'VND', '150000000', '2026-08-15T00:00:00Z');
    const refundedVndTx = await postF1Transaction(tenantAId, 'VND', '50000000', '2026-08-20T00:00:00Z');
    const recordedUsdTx = await postF1Transaction(tenantAId, 'USD', '10000', '2026-08-01T00:00:00Z');
    const appliedUsdTx = await postF1Transaction(tenantAId, 'USD', '2000', '2026-08-15T00:00:00Z');

    await insertPrepaymentFact(tenantAId, recordedVndTx, 'PREPAYMENT_RECORDED', 500000000, '2026-08-01T00:00:00Z');
    await insertPrepaymentFact(tenantAId, appliedVndTx, 'PREPAYMENT_APPLIED', 150000000, '2026-08-15T00:00:00Z');
    await insertPrepaymentFact(tenantAId, refundedVndTx, 'PREPAYMENT_REFUNDED', 50000000, '2026-08-20T00:00:00Z');
    await insertPrepaymentFact(tenantAId, recordedUsdTx, 'PREPAYMENT_RECORDED', 10000, '2026-08-01T00:00:00Z');
    await insertPrepaymentFact(tenantAId, appliedUsdTx, 'PREPAYMENT_APPLIED', 2000, '2026-08-15T00:00:00Z');

    const rows = await readPosition(tenantAId, '2026-08-31T00:00:00Z');
    const byCurrency = new Map(rows.map(row => [row.currency, row]));

    expect(rows).toHaveLength(2);
    expect(Number(byCurrency.get('VND')!.position_amount_minor)).toBe(300000000);
    expect(Number(byCurrency.get('USD')!.position_amount_minor)).toBe(8000);
    expect(byCurrency.get('VND')!.fact_count).toBe(3);
    expect(byCurrency.get('USD')!.fact_count).toBe(2);
  });

  it('keeps historical as_of reconstruction deterministic', async () => {
    const recordedTx = await postF1Transaction(tenantAId, 'VND', '1000000', '2026-08-02T00:00:00Z');
    const appliedTx = await postF1Transaction(tenantAId, 'VND', '250000', '2026-08-25T00:00:00Z');

    await insertPrepaymentFact(tenantAId, recordedTx, 'PREPAYMENT_RECORDED', 1000000, '2026-08-02T00:00:00Z');
    await insertPrepaymentFact(tenantAId, appliedTx, 'PREPAYMENT_APPLIED', 250000, '2026-08-25T00:00:00Z');

    const rowsBeforeApply = await readPosition(tenantAId, '2026-08-10T00:00:00Z');
    const rowsAfterApply = await readPosition(tenantAId, '2026-08-31T00:00:00Z');

    const vndBefore = rowsBeforeApply.find(row => row.currency === 'VND');
    const vndAfter = rowsAfterApply.find(row => row.currency === 'VND');

    expect(Number(vndBefore!.position_amount_minor)).toBeGreaterThan(Number(vndAfter!.position_amount_minor));
  });

  it('enforces tenant isolation at the position contract boundary', async () => {
    const tenantBTx = await postF1Transaction(tenantBId, 'VND', '777000', '2026-08-05T00:00:00Z');
    await insertPrepaymentFact(tenantBId, tenantBTx, 'PREPAYMENT_RECORDED', 777000, '2026-08-05T00:00:00Z');

    const tenantARows = await readPosition(tenantAId, '2026-08-31T00:00:00Z');
    const tenantBRows = await readPosition(tenantBId, '2026-08-31T00:00:00Z');

    expect(tenantARows.some(row => Number(row.position_amount_minor) === 777000)).toBe(false);
    expect(tenantBRows.some(row => Number(row.position_amount_minor) === 777000)).toBe(true);
  });

  it('rejects prepayment fact currency that conflicts with F1 functional currency', async () => {
    const f1TransactionId = await postF1Transaction(tenantAId, 'VND', '123000', '2026-08-12T00:00:00Z');

    const { error } = await supabase
      .from('finance_vendor_prepayments' as unknown as 'tenants')
      .insert({
        tenant_id: tenantAId,
        vendor_id: crypto.randomUUID(),
        fact_type: 'PREPAYMENT_RECORDED',
        amount_minor: 123000,
        posting_attempt_id: crypto.randomUUID(),
        f1_transaction_id: f1TransactionId,
        source_type: 'F4_PP_POSITION_TEST',
        source_id: crypto.randomUUID(),
        created_at: '2026-08-12T00:00:00Z',
        currency: 'USD',
      } as never);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('F4_PREPAYMENT_CURRENCY_MISMATCH');
  });

  it('rejects unknown contract versions', async () => {
    const { error } = await supabase.rpc('finance_prepayment_position_as_of' as never, {
      p_tenant_id: tenantAId,
      p_as_of: '2026-08-31T00:00:00Z',
      p_contract_version: 'F4_PREPAYMENT_POSITION:v2',
    } as never);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('UNKNOWN_CONTRACT_VERSION');
  });
});
