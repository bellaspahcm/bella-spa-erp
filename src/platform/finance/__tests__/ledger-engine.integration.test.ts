/**
 * Ledger Engine Integration Tests — Phase F1.3
 *
 * Verifies all Ledger Engine invariants, transaction posting, idempotency,
 * period-closing race conditions, reversal logic, and transactional outbox.
 *
 * Constitution Compliance:
 * - Engineering Quality Rule: TypeSafety-NoAny (Zero any types allowed).
 *
 * @module platform/finance/__tests__/ledger-engine.integration.test
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { LedgerEngineService } from '../engines/ledger-engine/ledger.service';
import { OutboxDispatcher } from '../engines/ledger-engine/outbox-dispatcher';
import { eventBus } from '@/platform/host/event-bus';
import type { DomainEvent } from '@/platform/host/event-bus/types';

jest.setTimeout(45000);

describe('Ledger Engine Service Integration Tests (F1.3)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let ledgerService: LedgerEngineService;
  let outboxDispatcher: OutboxDispatcher;
  let testTenantId: string;
  let cashAccountId: string;
  let revenueAccountId: string;
  let usdCashAccountId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    ledgerService = new LedgerEngineService(supabase);
    outboxDispatcher = new OutboxDispatcher(supabase);

    // 1. Setup/Lookup test tenant
    const { data: tenant, error: tenantErr } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', 'Test Tenant Finance F1.3')
      .maybeSingle();

    if (tenantErr) {
      throw new Error(`Failed to query tenant: ${tenantErr.message}`);
    }

    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant, error: createErr } = await supabase
        .from('tenants')
        .insert({ name: 'Test Tenant Finance F1.3', status: 'active' })
        .select('id')
        .single();

      if (createErr || !newTenant) {
        throw new Error(`Failed to create tenant: ${createErr?.message || 'unknown'}`);
      }
      testTenantId = newTenant.id;
    }

    // Clean up stale finance data for this test tenant
    await supabase.from('finance_audit_trail' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
    await supabase.from('finance_outbox_events' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
    await supabase.from('finance_transaction_lines' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
    await supabase.from('finance_transactions' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
    await supabase.from('finance_accounting_periods' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
    await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);

    // 2. Seed chart of accounts
    const { data: cashAcc, error: cashErr } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: testTenantId,
        code: '1111',
        name: 'Cash VND',
        type: 'ASSET',
        normal_balance: 'DEBIT',
        currency: 'VND',
        is_active: true
      })
      .select('id')
      .single();

    if (cashErr || !cashAcc) {
      throw new Error(`Failed to seed Cash VND account: ${cashErr?.message || 'unknown'}`);
    }
    cashAccountId = String((cashAcc as Record<string, unknown>).id);

    const { data: revAcc, error: revErr } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: testTenantId,
        code: '5111',
        name: 'Revenue VND',
        type: 'REVENUE',
        normal_balance: 'CREDIT',
        currency: 'VND',
        is_active: true
      })
      .select('id')
      .single();

    if (revErr || !revAcc) {
      throw new Error(`Failed to seed Revenue VND account: ${revErr?.message || 'unknown'}`);
    }
    revenueAccountId = String((revAcc as Record<string, unknown>).id);

    const { data: usdAcc, error: usdErr } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: testTenantId,
        code: '1112',
        name: 'Cash USD',
        type: 'ASSET',
        normal_balance: 'DEBIT',
        currency: 'USD',
        is_active: true
      })
      .select('id')
      .single();

    if (usdErr || !usdAcc) {
      throw new Error(`Failed to seed Cash USD account: ${usdErr?.message || 'unknown'}`);
    }
    usdCashAccountId = String((usdAcc as Record<string, unknown>).id);
  });

  afterAll(async () => {
    if (testTenantId) {
      await supabase.from('finance_audit_trail' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
      await supabase.from('finance_outbox_events' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
      await supabase.from('finance_transaction_lines' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
      await supabase.from('finance_transactions' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
      await supabase.from('finance_accounting_periods' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
      await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);
    }
  });

  it('should post a balanced transaction successfully and retrieve details', async () => {
    const postedAt = new Date('2026-08-15T00:00:00Z');
    
    // Open a period
    const openRes = await ledgerService.openPeriod({
      tenant_id: testTenantId,
      name: '2026-08',
      period_start: new Date('2026-08-01T00:00:00Z'),
      period_end: new Date('2026-08-31T23:59:59Z')
    });
    expect(openRes.success).toBe(true);

    const postRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: `key-post-${Date.now()}`,
      source_type: 'SALES_ORDER',
      source_id: 'so-001',
      transaction_type: 'CASH',
      posted_at: postedAt,
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'Test post transaction',
      reference_type: 'sales_orders',
      reference_id: 'so-001',
      lines: [
        {
          account_code: '1111',
          debit_amount_minor: '1500000',
          credit_amount_minor: '0',
          memo: 'Cash debit'
        },
        {
          account_code: '5111',
          debit_amount_minor: '0',
          credit_amount_minor: '1500000',
          memo: 'Revenue credit'
        }
      ]
    });

    expect(postRes.success).toBe(true);
    expect(postRes.data).toBeDefined();
    expect(postRes.data!.lines).toHaveLength(2);
    expect(postRes.data!.lines[0].debit.amount_minor).toBe('1500000');
  });

  it('Gate F-1.3.A: should enforce strict concurrent idempotency', async () => {
    const postedAt = new Date('2026-08-16T00:00:00Z');
    const idempotencyKey = `key-idem-${Date.now()}`;

    const payload = {
      tenant_id: testTenantId,
      idempotency_key: idempotencyKey,
      source_type: 'SALES_ORDER',
      source_id: 'so-idem',
      transaction_type: 'CASH' as const,
      posted_at: postedAt,
      transaction_currency: 'VND' as const,
      functional_currency: 'VND' as const,
      description: 'Idempotency test',
      reference_type: 'sales_orders',
      reference_id: 'so-idem',
      lines: [
        {
          account_code: '1111',
          debit_amount_minor: '500000',
          credit_amount_minor: '0',
          memo: 'Cash debit'
        },
        {
          account_code: '5111',
          debit_amount_minor: '0',
          credit_amount_minor: '500000',
          memo: 'Revenue credit'
        }
      ]
    };

    // Trigger concurrent postTransaction calls
    const [res1, res2] = await Promise.all([
      ledgerService.postTransaction(payload),
      ledgerService.postTransaction(payload)
    ]);

    expect(res1.success).toBe(true);
    expect(res2.success).toBe(true);
    expect(res1.data!.id).toBe(res2.data!.id);

    // Call with different hash using same idempotency key and expect conflict
    const conflictRes = await ledgerService.postTransaction({
      ...payload,
      lines: [
        {
          account_code: '1111',
          debit_amount_minor: '999999',
          credit_amount_minor: '0',
          memo: 'Cash debit'
        },
        {
          account_code: '5111',
          debit_amount_minor: '0',
          credit_amount_minor: '999999',
          memo: 'Revenue credit'
        }
      ]
    });

    expect(conflictRes.success).toBe(false);
    expect(conflictRes.error!.code).toBe('IDEMPOTENCY_KEY_REUSE_CONFLICT');
  });

  it('Gate F-1.3.B: should handle period status check race conditions safely', async () => {
    const postedAt = new Date('2026-08-17T00:00:00Z');
    
    // Find the current period id
    const { data: period } = await supabase
      .from('finance_accounting_periods' as unknown as 'tenants')
      .select('id')
      .eq('tenant_id' as unknown as 'id', testTenantId)
      .eq('name' as unknown as 'id', '2026-08')
      .single();

    const periodId = String((period as Record<string, unknown>).id);

    const postPayload = {
      tenant_id: testTenantId,
      idempotency_key: `key-race-${Date.now()}`,
      source_type: 'SALES_ORDER',
      source_id: 'so-race',
      transaction_type: 'CASH' as const,
      posted_at: postedAt,
      transaction_currency: 'VND' as const,
      functional_currency: 'VND' as const,
      description: 'Race condition test',
      reference_type: 'sales_orders',
      reference_id: 'so-race',
      lines: [
        {
          account_code: '1111',
          debit_amount_minor: '200000',
          credit_amount_minor: '0',
          memo: 'Cash debit'
        },
        {
          account_code: '5111',
          debit_amount_minor: '0',
          credit_amount_minor: '200000',
          memo: 'Revenue credit'
        }
      ]
    };

    // Close the period concurrently with posting a transaction
    const [postRes, closeRes] = await Promise.all([
      ledgerService.postTransaction(postPayload),
      ledgerService.closePeriod(testTenantId, periodId, 'admin-user')
    ]);

    // Either the post succeeded (before close completed) or close succeeded first and post failed with PERIOD_NOT_OPEN
    if (postRes.success) {
      expect(closeRes.success).toBe(true);
    } else {
      expect(postRes.error!.code).toBe('PERIOD_NOT_OPEN');
    }
  });

  it('Gate F-1.3.C: should dispatch outbox events to event bus without duplication', async () => {
    // Reopen period if closed by previous race test
    const { data: period } = await supabase
      .from('finance_accounting_periods' as unknown as 'tenants')
      .select('id')
      .eq('tenant_id' as unknown as 'id', testTenantId)
      .eq('name' as unknown as 'id', '2026-08')
      .single();
    
    const periodId = String((period as Record<string, unknown>).id);
    await supabase
      .from('finance_accounting_periods' as unknown as 'tenants')
      .update({ status: 'OPEN' })
      .eq('id' as unknown as 'id', periodId);

    const postedAt = new Date('2026-08-18T00:00:00Z');
    
    // Clear outbox first
    await supabase.from('finance_outbox_events' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', testTenantId);

    const postRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: `key-outbox-${Date.now()}`,
      source_type: 'SALES_ORDER',
      source_id: 'so-outbox',
      transaction_type: 'CASH',
      posted_at: postedAt,
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'Outbox testing transaction',
      reference_type: 'sales_orders',
      reference_id: 'so-outbox',
      lines: [
        {
          account_code: '1111',
          debit_amount_minor: '100000',
          credit_amount_minor: '0',
          memo: 'Cash debit'
        },
        {
          account_code: '5111',
          debit_amount_minor: '0',
          credit_amount_minor: '100000',
          memo: 'Revenue credit'
        }
      ]
    });
    expect(postRes.success).toBe(true);

    // Verify outbox has PENDING event
    const { data: outboxRows } = await supabase
      .from('finance_outbox_events' as unknown as 'tenants')
      .select('*')
      .eq('tenant_id' as unknown as 'id', testTenantId)
      .eq('status' as unknown as 'id', 'PENDING');
    
    expect(outboxRows).toHaveLength(1);

    // Subscribe to Event Bus to verify reception
    let eventReceived: DomainEvent | null = null;
    const unsubscribe = eventBus.subscribe('finance.transaction.posted.v1', (event) => {
      eventReceived = event;
    });

    // Run Dispatcher
    const dispatchCount = await outboxDispatcher.dispatchPendingEvents(testTenantId);
    expect(dispatchCount).toBe(1);

    // Verify event bus received event
    expect(eventReceived).not.toBeNull();
    expect(eventReceived!.tenantId).toBe(testTenantId);

    // Run dispatcher again and verify zero events are sent
    const secondDispatchCount = await outboxDispatcher.dispatchPendingEvents(testTenantId);
    expect(secondDispatchCount).toBe(0);

    unsubscribe();
  });

  it('should reverse a transaction and assert invariants', async () => {
    const postedAt = new Date('2026-08-19T00:00:00Z');
    const transactionKey = `key-rev-orig-${Date.now()}`;
    const reversalKey = `key-rev-act-${Date.now()}`;

    const postRes = await ledgerService.postTransaction({
      tenant_id: testTenantId,
      idempotency_key: transactionKey,
      source_type: 'SALES_ORDER',
      source_id: 'so-rev',
      transaction_type: 'CASH',
      posted_at: postedAt,
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: 'Original transaction to reverse',
      reference_type: 'sales_orders',
      reference_id: 'so-rev',
      lines: [
        {
          account_code: '1111',
          debit_amount_minor: '750000',
          credit_amount_minor: '0',
          memo: 'Original Debit'
        },
        {
          account_code: '5111',
          debit_amount_minor: '0',
          credit_amount_minor: '750000',
          memo: 'Original Credit'
        }
      ]
    });
    expect(postRes.success).toBe(true);
    const origTxId = postRes.data!.id;

    // Run reversal
    const revRes = await ledgerService.reverseTransaction({
      tenant_id: testTenantId,
      transaction_id: origTxId,
      reason: 'Customer requested refund',
      idempotency_key: reversalKey
    });

    expect(revRes.success).toBe(true);
    expect(revRes.data!.reversal_of).toBe(origTxId);
    expect(revRes.data!.lines).toHaveLength(2);

    // Reversed debit line: original credit of 750k VND on 5111 becomes debit of 750k VND on 5111
    // Reversed credit line: original debit of 750k VND on 1111 becomes credit of 750k VND on 1111
    const cashLine = revRes.data!.lines.find(l => l.account_id === cashAccountId);
    const revLine = revRes.data!.lines.find(l => l.account_id === revenueAccountId);

    expect(cashLine!.credit.amount_minor).toBe('750000');
    expect(revLine!.debit.amount_minor).toBe('750000');

    // Verify original transaction is marked as REVERSED
    const { data: updatedOrig } = await supabase
      .from('finance_transactions')
      .select('status')
      .eq('id', origTxId)
      .single();
    expect(updatedOrig!.status).toBe('REVERSED');

    // Attempt to reverse again and expect failure (Single Reversal Invariant)
    const secondRevRes = await ledgerService.reverseTransaction({
      tenant_id: testTenantId,
      transaction_id: origTxId,
      reason: 'Customer requested refund again',
      idempotency_key: `key-rev-second-${Date.now()}`
    });
    expect(secondRevRes.success).toBe(false);
    expect(secondRevRes.error!.code).toBe('TRANSACTION_IMMUTABLE');
  });

  it('should support DRAFT voiding and block POSTED voiding', async () => {
    const transactionId = '00000000-0000-0000-0000-000000000001';
    
    // 1. Seed a DRAFT transaction
    const { data: period } = await supabase
      .from('finance_accounting_periods' as unknown as 'tenants')
      .select('id')
      .eq('tenant_id' as unknown as 'id', testTenantId)
      .eq('name' as unknown as 'id', '2026-08')
      .single();
    const periodId = String((period as Record<string, unknown>).id);

    await supabase.from('finance_transactions' as unknown as 'tenants').insert({
      id: transactionId,
      tenant_id: testTenantId,
      accounting_period_id: periodId,
      idempotency_key: `key-draft-${Date.now()}`,
      request_hash: 'DRAFT_HASH',
      source_type: 'SALES_ORDER',
      source_id: 'so-draft',
      status: 'DRAFT',
      transaction_type: 'ADJUSTMENT',
      posted_at: new Date().toISOString(),
      transaction_currency: 'VND',
      functional_currency: 'VND',
      exchange_rate_rate: 1.0,
      exchange_rate_source: 'VND',
      exchange_rate_target: 'VND',
      exchange_rate_effective: new Date().toISOString(),
      description: 'Draft transaction'
    });

    // Void the DRAFT transaction
    const voidRes = await ledgerService.voidTransaction(testTenantId, transactionId, 'Order cancelled by customer');
    expect(voidRes.success).toBe(true);

    // Verify it is VOIDED
    const { data: voidedTx } = await supabase
      .from('finance_transactions')
      .select('status')
      .eq('id', transactionId)
      .single();
    expect(voidedTx!.status).toBe('VOIDED');

    // 2. Try to void a POSTED transaction (e.g. from the first test)
    const { data: postedTx } = await supabase
      .from('finance_transactions')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('status', 'POSTED')
      .limit(1)
      .single();

    if (postedTx) {
      const voidPostedRes = await ledgerService.voidTransaction(testTenantId, postedTx.id, 'Void posted tx');
      expect(voidPostedRes.success).toBe(false);
      expect(voidPostedRes.error!.code).toBe('TRANSACTION_IMMUTABLE');
    }
  });
});
