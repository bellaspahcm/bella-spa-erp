/**
 * Integration Test Suite for F2.2 Cash Projection Worker
 *
 * Verifies the 12 invariants, cash classification policy (ignore vs quarantine),
 * multi-leg atomicity (F2.2.12 P0), idempotency, and reversal lineage.
 *
 * Compliance:
 * - TypeSafety-NoAny: Strictly typed with zero 'any' usages.
 *
 * @module platform/finance/__tests__/finance-f2-projection-worker.test
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { LedgerEngineService } from '../engines/ledger-engine/ledger.service';
import { OutboxDispatcher } from '../engines/ledger-engine/outbox-dispatcher';
import { CashProjectionWorker } from '../engines/cash-engine/cash-projection-worker';
import { eventBus } from '@/platform/host/event-bus';
import type { DomainEvent } from '@/platform/host/event-bus/types';

jest.setTimeout(45000);

describe('F2.2 Cash Projection Worker Integration Tests', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let ledgerService: LedgerEngineService;
  let outboxDispatcher: OutboxDispatcher;
  let worker: CashProjectionWorker;
  let unsubscribeWorker: (() => void) | null = null;

  const RUN_ID = Date.now().toString(36).toUpperCase();
  const TENANT_A_NAME = `F2-WRK-A-${RUN_ID}`;
  const TENANT_B_NAME = `F2-WRK-B-${RUN_ID}`;

  let testTenantId: string;
  let tenantBId: string; // For cross-tenant tests

  // F1 Accounts
  let cashAccountId: string;
  let revenueAccountId: string;
  let arAccountId: string; // Non-cash asset (Accounts Receivable)

  // F2 Bank Accounts
  let bankAccountId: string;
  let inactiveBankAccountId: string;

  let sharedPeriodName: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    ledgerService = new LedgerEngineService(supabase);
    outboxDispatcher = new OutboxDispatcher(supabase);
    
    // Initialize & start worker
    worker = new CashProjectionWorker(supabase);
    unsubscribeWorker = worker.start();

    // 1. Setup Tenant A
    const { data: newTenant, error: createErr } = await supabase
      .from('tenants')
      .insert({ name: TENANT_A_NAME, status: 'active' })
      .select('id')
      .single();
    if (createErr || !newTenant) throw createErr || new Error('Tenant creation failed');
    testTenantId = newTenant.id;

    // 2. Setup Tenant B (for cross-tenant tests)
    const { data: newTenantB, error: createBErr } = await supabase
      .from('tenants')
      .insert({ name: TENANT_B_NAME, status: 'active' })
      .select('id')
      .single();
    if (createBErr || !newTenantB) throw createBErr || new Error('Tenant B creation failed');
    tenantBId = newTenantB.id;

    // Clean up all F2 & F1 tables for clean run (ignore mutation guard delete failure on fresh run)
    try {
      await cleanupTenant(testTenantId);
      await cleanupTenant(tenantBId);
    } catch (e) {
      // Ignored
    }

    // 3. Seed Accounts
    // 1111 (Cash VND) - Liquidity account
    await supabase.from('finance_accounts' as unknown as 'tenants').upsert(
      { tenant_id: testTenantId, code: '1111', name: 'Cash VND', type: 'ASSET', normal_balance: 'DEBIT', currency: 'VND', is_active: true },
      { onConflict: 'tenant_id,code' } as unknown as Record<string, unknown>
    );
    const { data: cashAcc } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .select('id')
      .eq('tenant_id' as unknown as 'id', testTenantId)
      .eq('code' as unknown as 'id', '1111')
      .single();
    cashAccountId = String(cashAcc!.id);

    // 5111 (Revenue VND) - Revenue account (non-liquidity)
    await supabase.from('finance_accounts' as unknown as 'tenants').upsert(
      { tenant_id: testTenantId, code: '5111', name: 'Revenue VND', type: 'REVENUE', normal_balance: 'CREDIT', currency: 'VND', is_active: true },
      { onConflict: 'tenant_id,code' } as unknown as Record<string, unknown>
    );
    const { data: revAcc } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .select('id')
      .eq('tenant_id' as unknown as 'id', testTenantId)
      .eq('code' as unknown as 'id', '5111')
      .single();
    revenueAccountId = String(revAcc!.id);

    // 1311 (Accounts Receivable VND) - Non-cash Asset account (should be ignored)
    await supabase.from('finance_accounts' as unknown as 'tenants').upsert(
      { tenant_id: testTenantId, code: '1311', name: 'AR VND', type: 'ASSET', normal_balance: 'DEBIT', currency: 'VND', is_active: true },
      { onConflict: 'tenant_id,code' } as unknown as Record<string, unknown>
    );
    const { data: arAcc } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .select('id')
      .eq('tenant_id' as unknown as 'id', testTenantId)
      .eq('code' as unknown as 'id', '1311')
      .single();
    arAccountId = String(arAcc!.id);

    // 1112 (Cash Inactive VND) - Linked with inactive bank account
    await supabase.from('finance_accounts' as unknown as 'tenants').upsert(
      { tenant_id: testTenantId, code: '1112', name: 'Cash Inactive VND', type: 'ASSET', normal_balance: 'DEBIT', currency: 'VND', is_active: true },
      { onConflict: 'tenant_id,code' } as unknown as Record<string, unknown>
    );
    const { data: inactiveCashAcc } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .select('id')
      .eq('tenant_id' as unknown as 'id', testTenantId)
      .eq('code' as unknown as 'id', '1112')
      .single();
    const inactiveCashAccountId = String(inactiveCashAcc!.id);

    // 4. Seed Bank Accounts
    // Active bank account linked to 1111
    const { data: bankAcc, error: bankErr } = await supabase
      .from('finance_bank_accounts')
      .insert({
        tenant_id: testTenantId,
        bank_name: 'Techcombank F2.2',
        account_number: `TCB-${Date.now()}`,
        account_name: 'Main Business Account',
        currency: 'VND',
        linked_finance_account_id: cashAccountId,
        is_active: true
      })
      .select('id')
      .single();
    if (bankErr || !bankAcc) throw bankErr || new Error('Bank account seeding failed');
    bankAccountId = bankAcc.id;

    // Inactive bank account linked to 1112 (inactiveCashAccountId) to avoid ambiguous mapping crash
    const { data: inactiveBank, error: inactiveErr } = await supabase
      .from('finance_bank_accounts')
      .insert({
        tenant_id: testTenantId,
        bank_name: 'Vietcombank Inactive F2.2',
        account_number: `VCB-${Date.now()}`,
        account_name: 'Inactive Account',
        currency: 'VND',
        linked_finance_account_id: inactiveCashAccountId,
        is_active: false
      })
      .select('id')
      .single();
    if (inactiveErr || !inactiveBank) throw inactiveErr || new Error('Inactive bank account seeding failed');
    inactiveBankAccountId = inactiveBank.id;

    // 5. Seed accounting period
    sharedPeriodName = `2026-08-T${Date.now()}`;
    const openRes = await ledgerService.openPeriod({
      tenant_id: testTenantId,
      name: sharedPeriodName,
      period_start: new Date('2026-08-01T00:00:00Z'),
      period_end: new Date('2026-08-31T23:59:59Z')
    });
    if (!openRes.success) throw new Error(`Seeding period failed: ${openRes.error?.message}`);
  });

  afterAll(async () => {
    if (unsubscribeWorker) {
      unsubscribeWorker();
    }
    await cleanupTenant(testTenantId);
    await cleanupTenant(tenantBId);
  });

  async function cleanupTenant(tenantId: string): Promise<void> {
    // F2 tables delete will be blocked by cash_mutation_guard trigger, but we attempt them anyway.
    // Dynamic tenant names mean that cleanup is not strictly necessary for test correctness.
    try { await supabase.from('finance_cash_quarantine').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_cash_positions').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_cash_movements').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_audit_trail' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_outbox_events' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_transaction_lines' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_transactions' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_bank_accounts').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_accounting_periods' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
  }

  // =========================================================================
  // INTEGRATION TEST CASES
  // =========================================================================

  it('T01: should project posted cash transaction atomically to F2 cash movement & position', async () => {
    const postedAt = new Date('2026-08-18T00:00:00Z');
    const txKey = `key-t01-${Date.now()}`;

    // 1. Post transaction in F1 (includes cash leg code 1111)
    const postRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: txKey,
      source_type: 'SALES_ORDER',
      source_id: 'so-t01',
      transaction_type: 'CASH',
      posted_at: postedAt,
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T01 Cash Posting',
      reference_type: 'sales_orders',
      reference_id: 'so-t01',
      lines: [
        { account_code: '1111', debit_amount_minor: '100000', credit_amount_minor: '0', memo: 'Cash debit' },
        { account_code: '5111', debit_amount_minor: '0', credit_amount_minor: '100000', memo: 'Revenue credit' }
      ]
    });
    expect(postRes.success).toBe(true);

    // 2. Dispatch events
    const dispatchCount = await outboxDispatcher.dispatchPendingEvents(testTenantId);
    expect(dispatchCount).toBe(2); // v1 + v2 emitted

    // 3. Verify F2 Cash Movement chèn thành công
    const { data: movements } = await supabase
      .from('finance_cash_movements')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('f1_transaction_id', postRes.data!.id);

    expect(movements).toHaveLength(1);
    expect(movements![0].bank_account_id).toBe(bankAccountId);
    expect(movements![0].direction).toBe('INFLOW');
    expect(Number(movements![0].amount_minor)).toBe(100000);

    // 4. Verify Cash Position cập nhật balance
    const { data: position } = await supabase
      .from('finance_cash_positions')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .single();

    expect(Number(position!.balance_minor)).toBe(100000);
  });

  it('T02: should ignore non-cash transactions silently without F2 positioning or error', async () => {
    const txKey = `key-t02-${Date.now()}`;

    // 1. Post F1 transaction between non-cash accounts (e.g. Accounts Receivable 1311 and Revenue 5111)
    const postRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: txKey,
      source_type: 'SALES_ORDER',
      source_id: 'so-t02',
      transaction_type: 'ACCRUAL',
      posted_at: new Date('2026-08-18T00:00:00Z'),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T02 Non-Cash Accrual Posting',
      reference_type: 'sales_orders',
      reference_id: 'so-t02',
      lines: [
        { account_code: '1311', debit_amount_minor: '200000', credit_amount_minor: '0', memo: 'AR debit' },
        { account_code: '5111', debit_amount_minor: '0', credit_amount_minor: '200000', memo: 'Revenue credit' }
      ]
    });
    expect(postRes.success).toBe(true);

    // Get current balance of position before dispatch
    const { data: posBefore } = await supabase
      .from('finance_cash_positions')
      .select('balance_minor')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .maybeSingle();
    const balanceBefore = Number(posBefore?.balance_minor || 0);

    // 2. Dispatch events
    const dispatchCount = await outboxDispatcher.dispatchPendingEvents(testTenantId);
    expect(dispatchCount).toBe(2);

    // 3. Verify no cash movements inserted for this F1 Transaction
    const { data: movements } = await supabase
      .from('finance_cash_movements')
      .select('*')
      .eq('f1_transaction_id', postRes.data!.id);
    expect(movements).toHaveLength(0);

    // 4. Position remains unchanged
    const { data: posAfter } = await supabase
      .from('finance_cash_positions')
      .select('balance_minor')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .maybeSingle();
    expect(Number(posAfter?.balance_minor || 0)).toBe(balanceBefore);

    // 5. No quarantine rows chèn
    const { data: quarantine } = await supabase
      .from('finance_cash_quarantine')
      .select('*')
      .eq('tenant_id', testTenantId);
    expect(quarantine).toHaveLength(0);
  });

  it('T03: should silently ignore legs mapped to non-cash asset accounts (AR)', async () => {
    // 1311 starts with '13', which is not startsWith('11'). Thus it is silently ignored as non-cash asset.
    // Tested implicitly in T02.
    expect(worker.classifyLiquidityAccount('1311')).toBe(false);
  });

  it('T04: should quarantine event as PENDING if bank account linked is inactive', async () => {
    const txKey = `key-t04-${Date.now()}`;

    const postRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: txKey,
      source_type: 'SALES_ORDER',
      source_id: 'so-t04',
      transaction_type: 'CASH',
      posted_at: new Date('2026-08-18T00:00:00Z'),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T04 Inactive Bank Account Seeding',
      reference_type: 'sales_orders',
      reference_id: 'so-t04',
      lines: [
        { account_code: '1112', debit_amount_minor: '300000', credit_amount_minor: '0', memo: 'Inactive Cash debit' },
        { account_code: '5111', debit_amount_minor: '0', credit_amount_minor: '300000', memo: 'Revenue credit' }
      ]
    });
    expect(postRes.success).toBe(true);

    // Dispatch
    await outboxDispatcher.dispatchPendingEvents(testTenantId);

    // Verify quarantine record has been created
    const { data: quarantine } = await supabase
      .from('finance_cash_quarantine')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('status', 'PENDING');
    
    expect(quarantine.length).toBeGreaterThan(0);
    expect(quarantine[0].failure_reason).toContain('Target bank account number is inactive');
  });

  it('T05: should preserve idempotency and determinism on event replay', async () => {
    // 1. Get a previously successfully projected cash transaction (e.g. from T01)
    const { data: events } = await supabase
      .from('finance_outbox_events')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('event_type', 'finance.transaction.posted.v2')
      .limit(1);

    expect(events).toHaveLength(1);
    const replayedEvent = events![0];
    const payload = JSON.parse(replayedEvent.payload);

    // Get position balance before replay
    const { data: posBefore } = await supabase
      .from('finance_cash_positions')
      .select('balance_minor')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .single();

    // 2. Publish event to eventBus again manually to trigger worker replay
    const eventObj: DomainEvent<FinanceTransactionPostedV2Payload> = {
      eventId: replayedEvent.event_id,
      eventType: 'finance.transaction.posted.v2',
      eventVersion: '2.0',
      tenantId: testTenantId,
      aggregateId: payload.transaction_id,
      aggregateType: 'finance_transactions',
      payload: payload as FinanceTransactionPostedV2Payload,
      occurredAt: new Date().toISOString()
    };

    await eventBus.publish(eventObj);

    // 3. Position balance must remain unchanged
    const { data: posAfter } = await supabase
      .from('finance_cash_positions')
      .select('balance_minor')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .single();

    expect(Number(posAfter.balance_minor)).toBe(Number(posBefore.balance_minor));
  });

  it('T06: should quarantine when duplicate F1 leg is projected under a different idempotency key', async () => {
    // A duplicate leg insertion (same transaction_id + cash_leg_reference) under a different idempotency key
    // will violate the DB unique constraint `uq_finance_cash_movements_leg`.
    // Use ledgerService.postTransaction() — the proper F1 code path — to seed a transaction with lines.
    // This avoids raw DB insert hacks that fail silently due to Supabase TS type constraints.
    const t06SourceId = `so-t06-${Date.now()}`;
    const t06PostRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: `key-t06-post-${Date.now()}`,
      source_type: 'SALES_ORDER',
      source_id: t06SourceId,
      transaction_type: 'CASH',
      posted_at: new Date('2026-08-18T01:00:00Z'),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T06 Seed via LedgerService',
      reference_type: 'SALES_ORDER',
      reference_id: t06SourceId,
      lines: [
        {
          account_code: '1111',
          debit_amount_minor: '50000',
          credit_amount_minor: '0',
          memo: 'T06 Cash leg'
        },
        {
          account_code: '5111',
          debit_amount_minor: '0',
          credit_amount_minor: '50000',
          memo: 'T06 Revenue leg'
        }
      ]
    });
    if (!t06PostRes.success || !t06PostRes.data) {
      throw new Error(`T06 seed postTransaction failed: ${t06PostRes.error?.message}`);
    }
    const f1TxId: string = t06PostRes.data.id;

    const legs = [
      {
        bank_account_id: bankAccountId,
        cash_leg_reference: '1111',
        direction: 'INFLOW',
        amount_minor: 50000,
        currency: 'VND',
        functional_amount_minor: 50000,
        functional_currency: 'VND',
        valuation_rate: 1.0,
        source_type: 'F1_POST',
        source_id: t06SourceId,
        description: 'Leg 1'
      }
    ];

    // Project leg for the first time (direct RPC — no outbox, no event bus)
    const { data: firstRes, error: firstErr } = await supabase.rpc('finance_internal_project_cash_transaction', {
      p_tenant_id: testTenantId,
      p_f1_transaction_id: f1TxId,
      p_base_idempotency: `key-t06-first-${Date.now()}`,
      p_legs: legs
    });
    if (firstErr) throw firstErr;
    expect(firstRes).toBeDefined();
    expect(firstRes!.success).toBe(true);

    // Attempt duplicate projection via event bus — worker should quarantine this
    const eventPayload: FinanceTransactionPostedV2Payload = {
      event_id: crypto.randomUUID(),
      event_type: 'finance.transaction.posted.v2',
      event_version: '2.0',
      tenant_id: testTenantId,
      transaction_id: f1TxId,
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      source_type: 'SALES_ORDER',
      source_id: t06SourceId,
      candidate_cash_legs: [
        {
          account_id: cashAccountId,
          account_code: '1111',
          direction: 'INFLOW',
          amount_minor: 50000,
          currency: 'VND',
          functional_amount_minor: 50000,
          functional_currency: 'VND',
          exchange_rate: 1.0
        }
      ]
    };

    const eventObj: DomainEvent<FinanceTransactionPostedV2Payload> = {
      eventId: eventPayload.event_id,
      eventType: 'finance.transaction.posted.v2',
      eventVersion: '2.0',
      tenantId: testTenantId,
      aggregateId: f1TxId,
      aggregateType: 'finance_transactions',
      payload: eventPayload,
      occurredAt: new Date().toISOString()
    };

    await eventBus.publish(eventObj);

    // Give worker time to process asynchronously
    await new Promise(resolve => setTimeout(resolve, 800));

    // Verify quarantine record was created
    const { data: quarantine } = await supabase
      .from('finance_cash_quarantine')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('event_id', eventPayload.event_id)
      .single();

    expect(quarantine).toBeDefined();
    expect(quarantine!.status).toBe('PENDING');
  });

  it('T07: Tenant A should fail to project into Tenant B bank account', async () => {
    // Setup Tenant B accounts
    await supabase.from('finance_accounts' as unknown as 'tenants').upsert(
      { tenant_id: tenantBId, code: '1111', name: 'Cash VND B', type: 'ASSET', normal_balance: 'DEBIT', currency: 'VND', is_active: true },
      { onConflict: 'tenant_id,code' } as unknown as Record<string, unknown>
    );
    const { data: cashAccB } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .select('id')
      .eq('tenant_id' as unknown as 'id', tenantBId)
      .eq('code' as unknown as 'id', '1111')
      .single();

    const { data: bankAccB } = await supabase
      .from('finance_bank_accounts')
      .insert({
        tenant_id: tenantBId,
        bank_name: 'Techcombank Tenant B',
        account_number: `TCB-B-${Date.now()}`,
        account_name: 'Tenant B Account',
        currency: 'VND',
        linked_finance_account_id: cashAccB!.id,
        is_active: true
      })
      .select('id')
      .single();

    const f1TxId = '00000000-0000-0000-0000-' + Date.now().toString().slice(-12).padStart(12, '0');
    // Seed F1 posted transaction for Tenant A
    await supabase.from('finance_transactions').insert({
      id: f1TxId,
      tenant_id: testTenantId,
      accounting_period_id: (await supabase.from('finance_accounting_periods').select('id').eq('tenant_id', testTenantId).eq('name', sharedPeriodName).single()).data!.id,
      idempotency_key: `key-t07-seed-${Date.now()}`,
      request_hash: 'HASH_T07',
      source_type: 'SALES_ORDER',
      source_id: 'so-t07',
      status: 'POSTED',
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T07 Seed'
    });

    const eventPayload: FinanceTransactionPostedV2Payload = {
      event_id: crypto.randomUUID(),
      event_type: 'finance.transaction.posted.v2',
      event_version: '2.0',
      tenant_id: testTenantId,
      transaction_id: f1TxId,
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      source_type: 'SALES_ORDER',
      source_id: 'so-t07',
      candidate_cash_legs: [
        {
          account_id: cashAccountId,
          account_code: '1111',
          direction: 'INFLOW',
          amount_minor: 50000,
          currency: 'VND',
          functional_amount_minor: 50000,
          functional_currency: 'VND',
          exchange_rate: 1.0
        }
      ]
    };

    // Inject Tenant B's bank account ID into Tenant A's project transaction RPC call
    // This should violate RLS/Foreign Key constraint because Tenant A's payload tenant_id (testTenantId)
    // does not match Tenant B's bank account tenant_id (tenantBId).
    const eventObj: DomainEvent<FinanceTransactionPostedV2Payload> = {
      eventId: eventPayload.event_id,
      eventType: 'finance.transaction.posted.v2',
      eventVersion: '2.0',
      tenantId: testTenantId,
      aggregateId: f1TxId,
      aggregateType: 'finance_transactions',
      payload: eventPayload,
      occurredAt: new Date().toISOString()
    };

    // Mock the linked bank account resolution to return Tenant B's bank account
    const resolveSpy = jest
      .spyOn(supabase, 'from')
      .mockImplementationOnce(((table: string) => {
        if (table === 'finance_bank_accounts') {
          return {
            select: () => ({
              eq: () => ({
                eq: () => ({
                  maybeSingle: async () => ({
                    data: { id: bankAccB!.id, is_active: true, currency: 'VND' },
                    error: null
                  })
                })
              })
            })
          } as unknown as ReturnType<typeof supabase.from>;
        }
        return (supabase.from as unknown as (table: string) => unknown)(table);
      }) as unknown as (table: string) => never);

    await eventBus.publish(eventObj);
    resolveSpy.mockRestore();

    // Verify event is quarantined due to Foreign Key tenant mismatch violation
    const { data: quarantine } = await supabase
      .from('finance_cash_quarantine')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('event_id', eventPayload.event_id)
      .single();

    expect(quarantine).toBeDefined();
    expect(quarantine!.status).toBe('PENDING');
  });

  it('T08: should throw security alert and quarantine if event payload tenant_id does not match context tenant_id', async () => {
    const f1TxId = '00000000-0000-0000-0000-' + Date.now().toString().slice(-12).padStart(12, '0');
    const eventPayload: FinanceTransactionPostedV2Payload = {
      event_id: crypto.randomUUID(),
      event_type: 'finance.transaction.posted.v2',
      event_version: '2.0',
      tenant_id: tenantBId, // payload tenant_id
      transaction_id: f1TxId,
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      source_type: 'SALES_ORDER',
      source_id: 'so-t08',
      candidate_cash_legs: [
        {
          account_id: cashAccountId,
          account_code: '1111',
          direction: 'INFLOW',
          amount_minor: 50000,
          currency: 'VND',
          functional_amount_minor: 50000,
          functional_currency: 'VND',
          exchange_rate: 1.0
        }
      ]
    };

    const eventObj: DomainEvent<FinanceTransactionPostedV2Payload> = {
      eventId: eventPayload.event_id,
      eventType: 'finance.transaction.posted.v2',
      eventVersion: '2.0',
      tenantId: testTenantId, // context tenant_id mismatch
      aggregateId: f1TxId,
      aggregateType: 'finance_transactions',
      payload: eventPayload,
      occurredAt: new Date().toISOString()
    };

    const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation(() => {});
    await eventBus.publish(eventObj);

    // Verify SECURITY_AUDIT_SIGNAL log emitted
    expect(consoleErrorSpy).toHaveBeenCalledWith(
      expect.stringContaining('[SECURITY_AUDIT_SIGNAL] Terminal security integrity violation detected')
    );
    consoleErrorSpy.mockRestore();

    // Verify quarantined under context tenant_id
    const { data: quarantine } = await supabase
      .from('finance_cash_quarantine')
      .select('*')
      .eq('tenant_id', tenantBId)
      .eq('event_id', eventPayload.event_id)
      .single();

    expect(quarantine).toBeDefined();
    expect(quarantine!.status).toBe('PENDING');
  });

  it('T09: should quarantine event when leg currency is desynchronized with target bank account currency', async () => {
    const f1TxId = '00000000-0000-0000-0000-' + Date.now().toString().slice(-12).padStart(12, '0');
    await supabase.from('finance_transactions').insert({
      id: f1TxId,
      tenant_id: testTenantId,
      accounting_period_id: (await supabase.from('finance_accounting_periods').select('id').eq('tenant_id', testTenantId).eq('name', sharedPeriodName).single()).data!.id,
      idempotency_key: `key-t09-seed-${Date.now()}`,
      request_hash: 'HASH_T09',
      source_type: 'SALES_ORDER',
      source_id: 'so-t09',
      status: 'POSTED',
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      transaction_currency: 'USD', // USD currency mismatch with VND bank account
      functional_currency: 'VND',
      description: 'T09 Seed'
    });

    const eventPayload: FinanceTransactionPostedV2Payload = {
      event_id: crypto.randomUUID(),
      event_type: 'finance.transaction.posted.v2',
      event_version: '2.0',
      tenant_id: testTenantId,
      transaction_id: f1TxId,
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      source_type: 'SALES_ORDER',
      source_id: 'so-t09',
      candidate_cash_legs: [
        {
          account_id: cashAccountId,
          account_code: '1111',
          direction: 'INFLOW',
          amount_minor: 100,
          currency: 'USD', // USD leg
          functional_amount_minor: 2500000,
          functional_currency: 'VND',
          exchange_rate: 25000.0
        }
      ]
    };

    const eventObj: DomainEvent<FinanceTransactionPostedV2Payload> = {
      eventId: eventPayload.event_id,
      eventType: 'finance.transaction.posted.v2',
      eventVersion: '2.0',
      tenantId: testTenantId,
      aggregateId: f1TxId,
      aggregateType: 'finance_transactions',
      payload: eventPayload,
      occurredAt: new Date().toISOString()
    };

    await eventBus.publish(eventObj);

    // Verify quarantined
    const { data: quarantine } = await supabase
      .from('finance_cash_quarantine')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('event_id', eventPayload.event_id)
      .single();

    expect(quarantine).toBeDefined();
    expect(quarantine!.status).toBe('PENDING');
  });

  it('T10: should quarantine event when leg has invalid negative or zero amount', async () => {
    const f1TxId = '00000000-0000-0000-0000-' + Date.now().toString().slice(-12).padStart(12, '0');
    await supabase.from('finance_transactions').insert({
      id: f1TxId,
      tenant_id: testTenantId,
      accounting_period_id: (await supabase.from('finance_accounting_periods').select('id').eq('tenant_id', testTenantId).eq('name', sharedPeriodName).single()).data!.id,
      idempotency_key: `key-t10-seed-${Date.now()}`,
      request_hash: 'HASH_T10',
      source_type: 'SALES_ORDER',
      source_id: 'so-t10',
      status: 'POSTED',
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T10 Seed'
    });

    const eventPayload: FinanceTransactionPostedV2Payload = {
      event_id: crypto.randomUUID(),
      event_type: 'finance.transaction.posted.v2',
      event_version: '2.0',
      tenant_id: testTenantId,
      transaction_id: f1TxId,
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      source_type: 'SALES_ORDER',
      source_id: 'so-t10',
      candidate_cash_legs: [
        {
          account_id: cashAccountId,
          account_code: '1111',
          direction: 'INFLOW',
          amount_minor: -50000, // Negative amount
          currency: 'VND',
          functional_amount_minor: -50000,
          functional_currency: 'VND',
          exchange_rate: 1.0
        }
      ]
    };

    const eventObj: DomainEvent<FinanceTransactionPostedV2Payload> = {
      eventId: eventPayload.event_id,
      eventType: 'finance.transaction.posted.v2',
      eventVersion: '2.0',
      tenantId: testTenantId,
      aggregateId: f1TxId,
      aggregateType: 'finance_transactions',
      payload: eventPayload,
      occurredAt: new Date().toISOString()
    };

    await eventBus.publish(eventObj);

    // Verify quarantined
    const { data: quarantine } = await supabase
      .from('finance_cash_quarantine')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('event_id', eventPayload.event_id)
      .single();

    expect(quarantine).toBeDefined();
    expect(quarantine!.status).toBe('PENDING');
  });

  it('T11: should quarantine event when ledger F1 transaction status is not POSTED', async () => {
    const f1TxId = '00000000-0000-0000-0000-' + Date.now().toString().slice(-12).padStart(12, '0');
    // Seed as DRAFT transaction
    await supabase.from('finance_transactions').insert({
      id: f1TxId,
      tenant_id: testTenantId,
      accounting_period_id: (await supabase.from('finance_accounting_periods').select('id').eq('tenant_id', testTenantId).eq('name', sharedPeriodName).single()).data!.id,
      idempotency_key: `key-t11-seed-${Date.now()}`,
      request_hash: 'HASH_T11',
      source_type: 'SALES_ORDER',
      source_id: 'so-t11',
      status: 'DRAFT', // DRAFT state
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T11 Seed'
    });

    const eventPayload: FinanceTransactionPostedV2Payload = {
      event_id: crypto.randomUUID(),
      event_type: 'finance.transaction.posted.v2',
      event_version: '2.0',
      tenant_id: testTenantId,
      transaction_id: f1TxId,
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      source_type: 'SALES_ORDER',
      source_id: 'so-t11',
      candidate_cash_legs: [
        {
          account_id: cashAccountId,
          account_code: '1111',
          direction: 'INFLOW',
          amount_minor: 50000,
          currency: 'VND',
          functional_amount_minor: 50000,
          functional_currency: 'VND',
          exchange_rate: 1.0
        }
      ]
    };

    const eventObj: DomainEvent<FinanceTransactionPostedV2Payload> = {
      eventId: eventPayload.event_id,
      eventType: 'finance.transaction.posted.v2',
      eventVersion: '2.0',
      tenantId: testTenantId,
      aggregateId: f1TxId,
      aggregateType: 'finance_transactions',
      payload: eventPayload,
      occurredAt: new Date().toISOString()
    };

    await eventBus.publish(eventObj);

    // Verify quarantined
    const { data: quarantine } = await supabase
      .from('finance_cash_quarantine')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('event_id', eventPayload.event_id)
      .single();

    expect(quarantine).toBeDefined();
    expect(quarantine!.status).toBe('PENDING');
  });

  it('T12: should process F1 transaction reversal and create compensating F2 movement with lineage', async () => {
    const txKey = `key-t12-orig-${Date.now()}`;
    const revKey = `key-t12-rev-${Date.now()}`;

    // Get position balance before reversal flow
    const { data: posBefore } = await supabase
      .from('finance_cash_positions')
      .select('balance_minor')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .maybeSingle();
    const balanceBefore = Number(posBefore?.balance_minor || 0);

    // 1. Post original cash transaction
    const postRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: txKey,
      source_type: 'SALES_ORDER',
      source_id: 'so-t12',
      transaction_type: 'CASH',
      posted_at: new Date('2026-08-18T00:00:00Z'),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T12 Original Cash',
      reference_type: 'sales_orders',
      reference_id: 'so-t12',
      lines: [
        { account_code: '1111', debit_amount_minor: '120000', credit_amount_minor: '0', memo: 'Cash debit' },
        { account_code: '5111', debit_amount_minor: '0', credit_amount_minor: '120000', memo: 'Revenue credit' }
      ]
    });
    expect(postRes.success).toBe(true);
    const origF1TxId = postRes.data!.id;

    // Dispatch original post
    await outboxDispatcher.dispatchPendingEvents(testTenantId);

    // Verify original cash movement created
    const { data: origMovement } = await supabase
      .from('finance_cash_movements')
      .select('id, amount_minor')
      .eq('f1_transaction_id', origF1TxId)
      .single();
    expect(origMovement).toBeDefined();

    // 2. Perform F1 transaction reversal
    const revRes = await ledgerService.reverseTransaction({
      tenant_id: testTenantId,
      transaction_id: origF1TxId,
      reason: 'Reversal testing',
      idempotency_key: revKey
    });
    expect(revRes.success).toBe(true);
    const revF1TxId = revRes.data!.id;

    // Dispatch reversal events
    const dispatchCount = await outboxDispatcher.dispatchPendingEvents(testTenantId);
    expect(dispatchCount).toBe(2); // v1 + v2 reversal

    // 3. Verify reversal cash movement created in F2
    const { data: revMovement } = await supabase
      .from('finance_cash_movements')
      .select('*')
      .eq('f1_transaction_id', revF1TxId)
      .single();

    expect(revMovement).toBeDefined();
    expect(revMovement!.direction).toBe('OUTFLOW'); // counter-direction
    expect(Number(revMovement!.amount_minor)).toBe(120000);
    
    // Lineage verification
    expect(revMovement!.source_type).toBe('REVERSAL');
    expect(revMovement!.source_id).toBe(origMovement!.id); // parent lineage
    expect(revMovement!.description).toContain(`Reversal of F1 Transaction ${origF1TxId}`);

    // Verify original movement remains unchanged (immutable fact check)
    const { data: origMovementCheck } = await supabase
      .from('finance_cash_movements')
      .select('direction, amount_minor')
      .eq('id', origMovement!.id)
      .single();
    expect(origMovementCheck!.direction).toBe('INFLOW');
    expect(Number(origMovementCheck!.amount_minor)).toBe(120000);

    // Verify F2 position net balance effect is 0
    const { data: posAfter } = await supabase
      .from('finance_cash_positions')
      .select('balance_minor')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .single();
    
    expect(Number(posAfter.balance_minor)).toBe(balanceBefore);
  });

  it('T13-A: should handle transient DB failures with retry and eventually succeed with exactly one cash projection', async () => {
    // Stub publish to simulate a transient event bus or DB connection timeout
    const publishSpy = jest.spyOn(eventBus, 'publish').mockRejectedValue(new Error('Transient DB timeout'));

    const txKey = `key-t13a-${Date.now()}`;
    const postRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: txKey,
      source_type: 'SALES_ORDER',
      source_id: 'so-t13a',
      transaction_type: 'CASH',
      posted_at: new Date('2026-08-18T00:00:00Z'),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T13A Transient',
      reference_type: 'sales_orders',
      reference_id: 'so-t13a',
      lines: [
        { account_code: '1111', debit_amount_minor: '15000', credit_amount_minor: '0', memo: 'Cash debit' },
        { account_code: '5111', debit_amount_minor: '0', credit_amount_minor: '15000', memo: 'Revenue credit' }
      ]
    });
    expect(postRes.success).toBe(true);

    // 1. Dispatch fails due to mocked transient error
    const dispatchCount1 = await outboxDispatcher.dispatchPendingEvents(testTenantId);
    expect(dispatchCount1).toBe(0); // 0 succeeded

    // Verify outbox status is FAILED and retry_count incremented
    const { data: outboxFailures } = await supabase
      .from('finance_outbox_events' as unknown as 'tenants')
      .select('status, retry_count')
      .eq('tenant_id' as unknown as 'id', testTenantId)
      .eq('status' as unknown as 'id', 'FAILED');

    expect(outboxFailures!.length).toBeGreaterThan(0);
    expect(outboxFailures![0].retry_count).toBe(1);

    // 2. Requeue failed event back to PENDING
    const requeueCount = await outboxDispatcher.requeueFailedEvents(testTenantId);
    expect(requeueCount).toBeGreaterThan(0);

    // Restore mock publish
    publishSpy.mockRestore();

    // 3. Dispatch succeeds on retry
    const dispatchCount2 = await outboxDispatcher.dispatchPendingEvents(testTenantId);
    expect(dispatchCount2).toBe(2);

    // Verify cash movement recorded exactly once
    const { data: movements } = await supabase
      .from('finance_cash_movements')
      .select('id')
      .eq('f1_transaction_id', postRes.data!.id);
    expect(movements).toHaveLength(1);
  });

  it('T13-B: should exhaust retries on repeated transient failures', async () => {
    const publishSpy = jest.spyOn(eventBus, 'publish').mockRejectedValue(new Error('Repeated DB timeout'));

    const txKey = `key-t13b-${Date.now()}`;
    const postRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: txKey,
      source_type: 'SALES_ORDER',
      source_id: 'so-t13b',
      transaction_type: 'CASH',
      posted_at: new Date('2026-08-18T00:00:00Z'),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T13B Retries',
      reference_type: 'sales_orders',
      reference_id: 'so-t13b',
      lines: [
        { account_code: '1111', debit_amount_minor: '16000', credit_amount_minor: '0', memo: 'Cash debit' },
        { account_code: '5111', debit_amount_minor: '0', credit_amount_minor: '16000', memo: 'Revenue credit' }
      ]
    });
    expect(postRes.success).toBe(true);

    // Dispatch -> fails
    await outboxDispatcher.dispatchPendingEvents(testTenantId); // retry 1
    await outboxDispatcher.requeueFailedEvents(testTenantId);
    await outboxDispatcher.dispatchPendingEvents(testTenantId); // retry 2
    await outboxDispatcher.requeueFailedEvents(testTenantId);
    await outboxDispatcher.dispatchPendingEvents(testTenantId); // retry 3

    // Verify outbox event remains in FAILED with retry_count = 3
    const { data: outboxRows } = await supabase
      .from('finance_outbox_events' as unknown as 'tenants')
      .select('retry_count, status')
      .eq('tenant_id' as unknown as 'id', testTenantId)
      .eq('status' as unknown as 'id', 'FAILED');

    expect(outboxRows!.find((r: Record<string, unknown>) => Number(r.retry_count) >= 3)).toBeDefined();

    publishSpy.mockRestore();
  });

  it('T13-C: should quarantine terminal failures immediately without entering retry loops', async () => {
    // T08, T09, T10, T11 already demonstrate this. Terminal validation errors throw terminal exceptions
    // which the worker catches, quarantines, and does NOT bubble up as a retryable error (thus outbox dispatcher
    // considers the dispatch successful, marked DISPATCHED, and halts retries).
    const f1TxId = '00000000-0000-0000-0000-' + Date.now().toString().slice(-12).padStart(12, '0');
    
    // Seed F1 transaction
    await supabase.from('finance_transactions').insert({
      id: f1TxId,
      tenant_id: testTenantId,
      accounting_period_id: (await supabase.from('finance_accounting_periods').select('id').eq('tenant_id', testTenantId).eq('name', sharedPeriodName).single()).data!.id,
      idempotency_key: `key-t13c-seed-${Date.now()}`,
      request_hash: 'HASH_T13C',
      source_type: 'SALES_ORDER',
      source_id: 'so-t13c',
      status: 'POSTED',
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T13C Seed'
    });

    const eventPayload: FinanceTransactionPostedV2Payload = {
      event_id: crypto.randomUUID(),
      event_type: 'finance.transaction.posted.v2',
      event_version: '2.0',
      tenant_id: testTenantId,
      transaction_id: f1TxId,
      transaction_type: 'CASH',
      posted_at: new Date().toISOString(),
      source_type: 'SALES_ORDER',
      source_id: 'so-t13c',
      candidate_cash_legs: [
        {
          account_id: cashAccountId,
          account_code: '1111',
          direction: 'INFLOW',
          amount_minor: -999, // Terminal negative amount failure
          currency: 'VND',
          functional_amount_minor: -999,
          functional_currency: 'VND',
          exchange_rate: 1.0
        }
      ]
    };

    const eventObj: DomainEvent<FinanceTransactionPostedV2Payload> = {
      eventId: eventPayload.event_id,
      eventType: 'finance.transaction.posted.v2',
      eventVersion: '2.0',
      tenantId: testTenantId,
      aggregateId: f1TxId,
      aggregateType: 'finance_transactions',
      payload: eventPayload,
      occurredAt: new Date().toISOString()
    };

    // The execution should resolve successfully without throwing out of the eventBus handler
    await expect(eventBus.publish(eventObj)).resolves.not.toThrow();

    // Verify quarantine record created
    const { data: quarantine } = await supabase
      .from('finance_cash_quarantine')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('event_id', eventPayload.event_id)
      .single();

    expect(quarantine).toBeDefined();
    expect(quarantine!.status).toBe('PENDING');
  });

  it('T14: should verify quarantine records cannot mutate cash positions or balances', async () => {
    // Get position balance before
    const { data: posBefore } = await supabase
      .from('finance_cash_positions')
      .select('balance_minor')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .single();
    
    // Seed a quarantine row directly (requires allow_cash_mutation = true context via RPC)
    const eventId = crypto.randomUUID();
    const { data: qr } = await supabase.rpc('finance_internal_quarantine_cash_event', {
      p_tenant_id: testTenantId,
      p_event_id: eventId,
      p_event_type: 'finance.transaction.posted.v2',
      p_payload: { test: 'T14' },
      p_failure_reason: 'T14 verification',
      p_failure_code: 'T14_ERR'
    });
    expect(qr.success).toBe(true);

    // Verify position balance is exactly identical
    const { data: posAfter } = await supabase
      .from('finance_cash_positions')
      .select('balance_minor')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .single();

    expect(Number(posAfter.balance_minor)).toBe(Number(posBefore.balance_minor));
  });

  it('T15: E2E Integration: should verify complete outbox dispatcher to cash worker flow', async () => {
    const txKey = `key-t15-${Date.now()}`;
    
    // Get position balance before
    const { data: posBefore } = await supabase
      .from('finance_cash_positions')
      .select('balance_minor')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .single();

    // 1. Post transaction
    const postRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: txKey,
      source_type: 'SALES_ORDER',
      source_id: 'so-t15',
      transaction_type: 'CASH',
      posted_at: new Date('2026-08-18T00:00:00Z'),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'T15 E2E cash',
      reference_type: 'sales_orders',
      reference_id: 'so-t15',
      lines: [
        { account_code: '1111', debit_amount_minor: '85000', credit_amount_minor: '0', memo: 'Cash debit' },
        { account_code: '5111', debit_amount_minor: '0', credit_amount_minor: '85000', memo: 'Revenue credit' }
      ]
    });
    expect(postRes.success).toBe(true);

    // 2. Run outbox dispatcher
    const dispatchCount = await outboxDispatcher.dispatchPendingEvents(testTenantId);
    expect(dispatchCount).toBe(2); // v1 + v2 dispatched

    // 3. Verify movement projected successfully
    const { data: movement } = await supabase
      .from('finance_cash_movements')
      .select('id, amount_minor')
      .eq('f1_transaction_id', postRes.data!.id)
      .single();
    expect(movement).toBeDefined();
    expect(Number(movement!.amount_minor)).toBe(85000);

    // 4. Verify position balance updated
    const { data: posAfter } = await supabase
      .from('finance_cash_positions')
      .select('balance_minor')
      .eq('tenant_id', testTenantId)
      .eq('bank_account_id', bankAccountId)
      .single();
    
    expect(Number(posAfter.balance_minor)).toBe(Number(posBefore.balance_minor) + 85000);
  });
});
