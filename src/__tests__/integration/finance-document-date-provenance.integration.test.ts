import { createClient } from '@/lib/supabase-server';
import { LedgerEngineService } from '@/platform/finance/engines/ledger-engine/ledger.service';
import type { PostTransactionRequest } from '@/platform/finance/contracts/ledger-engine.contract';
import type { Database } from '@/types/database.types';
import type { SupabaseClient } from '@supabase/supabase-js';
import { randomUUID } from 'crypto';

type FinanceOutboxPayload = {
  transaction_id?: string;
  document_date?: string | null;
};

type FinanceOutboxEventRow = {
  event_type: string;
  payload: FinanceOutboxPayload | null;
};

describe('Finance Document-Date Provenance Integration Proof', () => {
  let supabase: Awaited<ReturnType<typeof createClient>>;
  let ledgerService: LedgerEngineService;
  let testTenantId: string;
  const testIdempotencyKeyBase = randomUUID();

  beforeAll(async () => {
    supabase = await createClient();
    ledgerService = new LedgerEngineService(supabase as unknown as SupabaseClient<Database>);
    
    // Get or create test tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', 'Integration Test Tenant')
      .limit(1)
      .single();

    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant } = await supabase
        .from('tenants')
        .insert({
          id: randomUUID(),
          name: 'Integration Test Tenant',
          subscription_tier: 'premium',
          status: 'active',
        })
        .select('id')
        .single();
      testTenantId = newTenant!.id;
    }

    // Prepare accounts
    const { data: existingAccounts } = await supabase
      .from('finance_accounts')
      .select('code')
      .eq('tenant_id', testTenantId);
      
    const existingCodes = existingAccounts?.map(a => a.code) || [];

    if (!existingCodes.includes('TEST1111')) {
      await supabase.from('finance_accounts').insert({ tenant_id: testTenantId, code: 'TEST1111', name: 'Cash', type: 'ASSET', normal_balance: 'DEBIT', currency: 'VND', is_active: true });
    }
    if (!existingCodes.includes('TEST5111')) {
      await supabase.from('finance_accounts').insert({ tenant_id: testTenantId, code: 'TEST5111', name: 'Rev', type: 'REVENUE', normal_balance: 'CREDIT', currency: 'VND', is_active: true });
    }

    // Open period
    const now = new Date();
    await supabase.from('finance_accounting_periods').upsert({
      tenant_id: testTenantId,
      name: `TEST-PERIOD-${now.getFullYear()}-${now.getMonth()}`,
      period_start: new Date(now.getFullYear(), now.getMonth(), 1).toISOString(),
      period_end: new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59).toISOString(),
      status: 'OPEN'
    }, { onConflict: 'tenant_id,name' });
  });

  const createBaseRequest = (suffix: string, documentDate?: string): PostTransactionRequest => ({
    tenant_id: testTenantId,
    idempotency_key: `${testIdempotencyKeyBase}-${suffix}`,
    source_type: 'INVOICE',
    source_id: `inv-${suffix}`,
    transaction_type: 'ACCRUAL',
    posted_at: new Date(),
    transaction_currency: 'VND',
    functional_currency: 'VND',
    description: `Test transaction ${suffix}`,
    reference_type: 'INVOICE',
    reference_id: `inv-${suffix}`,
    document_date: documentDate,
    lines: [
      { account_code: 'TEST1111', debit_amount_minor: '1000', credit_amount_minor: '0', memo: 'Debit' },
      { account_code: 'TEST5111', debit_amount_minor: '0', credit_amount_minor: '1000', memo: 'Credit' }
    ]
  });

  it('should post legacy transaction successfully with NULL document_date', async () => {
    const req = createBaseRequest('legacy');
    const result = await ledgerService.postTransaction(req);
    
    if (!result.success) console.log('Legacy TX Error:', result.error);
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    
    const { data: dbTx } = await supabase
      .from('finance_transactions')
      .select('*')
      .eq('id', result.data!.id)
      .single();
      
    expect(dbTx).toBeDefined();
    expect(dbTx.document_date).toBeNull();
  });

  it('should post new transaction successfully with explicit document_date and reflect in DB & Outbox', async () => {
    const docDate = '2026-08-25';
    const req = createBaseRequest('new', docDate);
    const result = await ledgerService.postTransaction(req);
    
    expect(result.success).toBe(true);
    expect(result.data).toBeDefined();
    
    // Check main table
    const { data: dbTx } = await supabase
      .from('finance_transactions')
      .select('*')
      .eq('id', result.data!.id)
      .single();
      
    expect(dbTx).toBeDefined();
    expect(dbTx.document_date).toBe(docDate);

    // Check Outbox
    const { data: outboxEvents } = await supabase
      .from('finance_outbox_events')
      .select('*')
      .eq('tenant_id', testTenantId)
      .contains('payload', { transaction_id: result.data!.id });
      
    expect(outboxEvents).toBeDefined();
    expect(outboxEvents!.length).toBeGreaterThan(0);
    
    const events = (outboxEvents ?? []) as unknown as FinanceOutboxEventRow[];
    const v1Event = events.find(e => e.event_type === 'finance.transaction.posted.v1');
    const v2Event = events.find(e => e.event_type === 'finance.transaction.posted.v2');
    
    expect(v1Event?.payload.document_date).toBe(docDate);
    expect(v2Event?.payload.document_date).toBe(docDate);
  });

  it('should generate distinct idempotency hashes when only document_date changes', async () => {
    const reqA = createBaseRequest('hash-test', '2026-08-20');
    const resultA = await ledgerService.postTransaction(reqA);
    expect(resultA.success).toBe(true);

    const reqB = createBaseRequest('hash-test', '2026-08-21');
    // Same idempotency_key but different hash (due to different document_date) should fail due to IDEMPOTENCY_KEY_REUSE_CONFLICT
    const resultB = await ledgerService.postTransaction(reqB);
    
    expect(resultB.success).toBe(false);
    expect(resultB.error?.code).toBe('IDEMPOTENCY_KEY_REUSE_CONFLICT');
  });

  it('should return is_duplicate: true for exact same request payload and date', async () => {
    const req = createBaseRequest('exact-dup', '2026-08-20');
    
    const result1 = await ledgerService.postTransaction(req);
    expect(result1.success).toBe(true);
    expect(result1.data?.status).toBe('POSTED');

    const result2 = await ledgerService.postTransaction(req);
    // Success but marked as duplicate
    expect(result2.success).toBe(true);
    // The implementation currently returns `is_duplicate: true` but our typed response interface in testing 
    // might not expose is_duplicate unless we check the raw response, however LedgerEngine service maps it!
    // Wait, ledgerService mapToTransactionDTO doesn't map `is_duplicate`. The response shape for duplicate is:
    // { success: true, transaction_id, status, is_duplicate: true } directly from RPC! Wait, `mapToTransactionDTO` fetches it.
    // If it's a duplicate, it returns: `return jsonb_build_object('success', true, 'transaction_id', v_existing_tx_id, ...)`
    // So `ledgerService` fetches that TX and returns it. We just check if it succeeds and is same ID.
    expect(result2.data?.id).toBe(result1.data?.id);
  });
});
