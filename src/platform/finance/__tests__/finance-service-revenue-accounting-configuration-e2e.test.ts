/**
 * Accounting Configuration E2E
 *
 * Proves one Finance OS runtime can post the same business semantics to
 * different tenant-selected revenue, revenue-deduction, and goods revenue accounts.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { createFinanceEventHandler } from '../finance-event-handler.factory';
import type { FinanceEventEnvelope } from '@/platform/integration-hub/finance-event-contract.types';

jest.setTimeout(60000);

type JournalLineWithAccount = {
  debit_amount: number | string;
  credit_amount: number | string;
  accounting_accounts: {
    account_code: string;
  } | null;
};

describe('Accounting Configuration E2E', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  const runId = Date.now().toString(36).toUpperCase();
  let tenantAId: string;
  let tenantBId: string;
  let tenantCId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);

    tenantAId = await createTenant(`FIN-REV-E2E-5113-${runId}`);
    tenantBId = await createTenant(`FIN-REV-E2E-5111-${runId}`);
    tenantCId = await createTenant(`FIN-REV-E2E-FALLBACK-${runId}`);

    await seedTenantAccounts(tenantAId, ['5113', '521', '5112']);
    await seedTenantAccounts(tenantBId, ['5111', '5113']);
    await seedTenantAccounts(tenantCId, ['4111']);
    await createSemanticMapping(tenantAId, 'SERVICE_REVENUE', '5113');
    await createSemanticMapping(tenantBId, 'SERVICE_REVENUE', '5111');
    await createSemanticMapping(tenantAId, 'REVENUE_DEDUCTION', '521');
    await createSemanticMapping(tenantBId, 'REVENUE_DEDUCTION', '5113');
    await createSemanticMapping(tenantAId, 'GOODS_REVENUE', '5112');
    await createSemanticMapping(tenantBId, 'GOODS_REVENUE', '5111');
  });

  afterAll(async () => {
    await cleanupTenant(tenantAId);
    await cleanupTenant(tenantBId);
    await cleanupTenant(tenantCId);
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

  async function seedTenantAccounts(tenantId: string, revenueCodes: string[]): Promise<void> {
    const accountingAccounts = [
      {
        tenant_id: tenantId,
        account_code: '1311',
        account_name: 'Accounts Receivable',
        account_type: 'ASSET',
        is_active: true,
      },
      {
        tenant_id: tenantId,
        account_code: '1111',
        account_name: 'Cash',
        account_type: 'ASSET',
        is_active: true,
      },
      ...revenueCodes.map(accountCode => ({
        tenant_id: tenantId,
        account_code: accountCode,
        account_name: `Revenue ${accountCode}`,
        account_type: 'REVENUE',
        is_active: true,
      })),
    ];
    const financeAccounts = revenueCodes.map(accountCode => ({
      tenant_id: tenantId,
      code: accountCode,
      name: `Revenue ${accountCode}`,
      type: 'REVENUE',
      normal_balance: 'CREDIT',
      currency: 'VND',
      is_active: true,
    }));

    const { error: accountingError } = await supabase
      .from('accounting_accounts')
      .insert(accountingAccounts as never);
    if (accountingError) throw accountingError;

    const { error: financeError } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert(financeAccounts as never);
    if (financeError) throw financeError;
  }

  async function createSemanticMapping(tenantId: string, semanticKey: string, accountCode: string): Promise<void> {
    const { error } = await supabase
      .from('finance_control_account_mappings')
      .insert({
        tenant_id: tenantId,
        control_type: semanticKey,
        account_code: accountCode,
        effective_from: '2026-01-01',
        effective_to: null,
        authority_version: 'TENANT_CONFIG:v1',
      } as never);
    if (error) throw error;
  }

  async function cleanupTenant(tenantId: string | undefined): Promise<void> {
    if (!tenantId) return;
    try { await supabase.from('finance_control_account_mappings').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_transaction_metadata').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('journal_entries').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('accounting_accounts').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('tenants').delete().eq('id', tenantId); } catch (e) {}
  }

  function createRevenueEvent(tenantId: string, suffix: string): FinanceEventEnvelope {
    return {
      event_id: `fin-rev-e2e-${runId}-${suffix}`,
      event_type: 'PATIENT_SERVICE_COMPLETED',
      idempotency_key: `fin-rev-e2e-${runId}-${suffix}`,
      occurred_at: '2026-06-30T10:00:00.000Z',
      created_at: '2026-06-30T10:00:01.000Z',
      tenant_id: tenantId,
      source_system: 'HOSPITAL_OS',
      source_version: '1.0.0',
      correlation_id: `fin-rev-e2e-${runId}-${suffix}`,
      amount: '125000',
      currency: 'VND',
      business_context: {
        patient: {
          patient_id: `patient-${suffix}`,
          patient_type: 'OUTPATIENT',
        },
        service: {
          service_id: `service-${suffix}`,
          service_type: 'CONSULTATION',
        },
      },
      business_references: [
        {
          entity_type: 'service',
          entity_id: `service-${suffix}`,
        },
      ],
    };
  }

  function createRefundEvent(tenantId: string, suffix: string): FinanceEventEnvelope {
    return {
      event_id: `fin-refund-e2e-${runId}-${suffix}`,
      event_type: 'PATIENT_REFUND_ISSUED',
      idempotency_key: `fin-refund-e2e-${runId}-${suffix}`,
      occurred_at: '2026-06-30T11:00:00.000Z',
      created_at: '2026-06-30T11:00:01.000Z',
      tenant_id: tenantId,
      source_system: 'HOSPITAL_OS',
      source_version: '1.0.0',
      correlation_id: `fin-refund-e2e-${runId}-${suffix}`,
      amount: '25000',
      currency: 'VND',
      business_context: {
        patient: {
          patient_id: `patient-refund-${suffix}`,
          patient_type: 'OUTPATIENT',
        },
        service: {
          service_id: `service-refund-${suffix}`,
          service_type: 'CONSULTATION',
        },
      },
      business_references: [
        {
          entity_type: 'service',
          entity_id: `service-refund-${suffix}`,
        },
      ],
      metadata: {
        refund_reason: 'E2E refund mapping test',
      },
    };
  }

  function createProductSaleEvent(tenantId: string, suffix: string): FinanceEventEnvelope {
    return {
      event_id: `fin-goods-rev-e2e-${runId}-${suffix}`,
      event_type: 'PRODUCT_SALE_COMPLETED',
      idempotency_key: `fin-goods-rev-e2e-${runId}-${suffix}`,
      occurred_at: '2026-06-30T12:00:00.000Z',
      created_at: '2026-06-30T12:00:01.000Z',
      tenant_id: tenantId,
      source_system: 'RETAIL_OS',
      source_version: '1.0.0',
      correlation_id: `fin-goods-rev-e2e-${runId}-${suffix}`,
      amount: '75000',
      currency: 'VND',
      business_context: {
        billing: {
          bill_id: `goods-bill-${suffix}`,
          bill_date: '2026-06-30',
          payer_type: 'CUSTOMER',
        },
      },
      business_references: [
        {
          entity_type: 'product_sale',
          entity_id: `product-sale-${suffix}`,
        },
      ],
    };
  }

  async function postEventAndReadLines(event: FinanceEventEnvelope): Promise<JournalLineWithAccount[]> {
    const handler = createFinanceEventHandler({
      supabase,
      useInMemoryIdempotency: true,
    });
    const result = await handler.handle(event);

    expect(result.status).toBe('CREATED');
    expect(result.transaction_id).toBeTruthy();

    const { data, error } = await supabase
      .from('journal_lines')
      .select('debit_amount, credit_amount, accounting_accounts(account_code)')
      .eq('entry_id', result.transaction_id!);
    if (error) throw error;

    return data as JournalLineWithAccount[];
  }

  it('posts the same SERVICE_REVENUE semantic to each tenant selected GL account', async () => {
    const tenantALines = await postEventAndReadLines(createRevenueEvent(tenantAId, 'tenant-a'));
    const tenantBLines = await postEventAndReadLines(createRevenueEvent(tenantBId, 'tenant-b'));

    const tenantARevenue = tenantALines.find(
      line => line.accounting_accounts?.account_code === '5113'
    );
    const tenantBRevenue = tenantBLines.find(
      line => line.accounting_accounts?.account_code === '5111'
    );

    expect(Number(tenantARevenue?.credit_amount)).toBe(125000);
    expect(Number(tenantBRevenue?.credit_amount)).toBe(125000);
    expect(tenantALines.some(line => line.accounting_accounts?.account_code === '4111')).toBe(false);
    expect(tenantBLines.some(line => line.accounting_accounts?.account_code === '4111')).toBe(false);
  });

  it('posts the same REVENUE_DEDUCTION refund semantic to each tenant selected GL account', async () => {
    const tenantALines = await postEventAndReadLines(createRefundEvent(tenantAId, 'tenant-a'));
    const tenantBLines = await postEventAndReadLines(createRefundEvent(tenantBId, 'tenant-b'));
    const tenantCLines = await postEventAndReadLines(createRefundEvent(tenantCId, 'tenant-c'));

    const tenantADeduction = tenantALines.find(
      line => line.accounting_accounts?.account_code === '521'
    );
    const tenantBDeduction = tenantBLines.find(
      line => line.accounting_accounts?.account_code === '5113'
    );
    const tenantCFallback = tenantCLines.find(
      line => line.accounting_accounts?.account_code === '4111'
    );

    expect(Number(tenantADeduction?.debit_amount)).toBe(25000);
    expect(Number(tenantBDeduction?.debit_amount)).toBe(25000);
    expect(Number(tenantCFallback?.debit_amount)).toBe(25000);
  });

  it('posts the same GOODS_REVENUE product sale semantic to each tenant selected GL account', async () => {
    const tenantALines = await postEventAndReadLines(createProductSaleEvent(tenantAId, 'tenant-a'));
    const tenantBLines = await postEventAndReadLines(createProductSaleEvent(tenantBId, 'tenant-b'));
    const tenantCLines = await postEventAndReadLines(createProductSaleEvent(tenantCId, 'tenant-c'));

    const tenantAGoodsRevenue = tenantALines.find(
      line => line.accounting_accounts?.account_code === '5112'
    );
    const tenantBGoodsRevenue = tenantBLines.find(
      line => line.accounting_accounts?.account_code === '5111'
    );
    const tenantCFallback = tenantCLines.find(
      line => line.accounting_accounts?.account_code === '4111'
    );

    expect(Number(tenantAGoodsRevenue?.credit_amount)).toBe(75000);
    expect(Number(tenantBGoodsRevenue?.credit_amount)).toBe(75000);
    expect(Number(tenantCFallback?.credit_amount)).toBe(75000);
  });
});
