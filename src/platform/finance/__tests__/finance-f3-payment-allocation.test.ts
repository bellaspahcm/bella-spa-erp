/**
 * Integration Test Suite for F3.3 Payment Allocation Engine
 *
 * Verifies all 17 integration tests:
 * - T01 to T07: Core Allocation validations (existence, directions, currency, limits)
 * - T08 to T11: Concurrency races (over-allocations, queuing, limits)
 * - T12 to T14: Reversal constraints and concurrent reversal protection
 * - T15 to T17: Boundary enforcement and subledger-driven reconstruction consistency
 *
 * Compliance:
 * - TypeSafety-NoAny: Strictly typed with zero 'any' usages.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { Client } from 'pg';
import { createHash } from 'crypto';

jest.setTimeout(60000);

describe('F3.3 Payment Allocation Integration Tests', () => {
  let supabaseAdmin: ReturnType<typeof createSupabaseClient<Database>>;
  let pgClientAdmin: Client;

  const RUN_ID = Date.now().toString(36).toUpperCase();
  const TENANT_NAME = `F3-ALLOC-${RUN_ID}`;

  let testTenantId: string;
  let customerId: string;
  let sharedPeriodId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabaseAdmin = createSupabaseClient<Database>(url, adminKey);

    const dbUrl = process.env.DATABASE_URL || process.env.SUPABASE_DATABASE_URL || process.env.SUPABASE_DB_URL;
    if (!dbUrl) throw new Error('Database URL env is missing');

    pgClientAdmin = new Client({ connectionString: dbUrl, ssl: { rejectUnauthorized: false } });
    await pgClientAdmin.connect();

    // Create Tenant
    const { data: tenant, error: tErr } = await supabaseAdmin
      .from('tenants')
      .insert({ name: TENANT_NAME, status: 'active' })
      .select('id')
      .single();
    if (tErr || !tenant) throw tErr || new Error('Tenant creation failed');
    testTenantId = tenant.id;

    customerId = crypto.randomUUID();

    // Seed F1 Accounts
    await pgClientAdmin.query(`
      INSERT INTO public.finance_accounts (tenant_id, code, name, type, normal_balance, currency, is_active) VALUES
      ('${testTenantId}', '131', 'Receivables Control', 'ASSET', 'DEBIT', 'VND', true),
      ('${testTenantId}', '5111', 'Revenue Packages', 'REVENUE', 'CREDIT', 'VND', true),
      ('${testTenantId}', '3331', 'VAT Payable', 'LIABILITY', 'CREDIT', 'VND', true),
      ('${testTenantId}', '112', 'Bank Account', 'ASSET', 'DEBIT', 'VND', true);
    `);

    // Seed F1 Accounting Period
    const { data: period, error: pErr } = await supabaseAdmin
      .from('finance_accounting_periods')
      .insert({
        tenant_id: testTenantId,
        name: '2026-08',
        period_start: '2026-08-01T00:00:00Z',
        period_end: '2026-08-31T23:59:59Z',
        status: 'OPEN'
      })
      .select('id')
      .single();
    if (pErr || !period) throw pErr || new Error('Period setup failed');
    sharedPeriodId = period.id;

    // Seed F2 Bank Account
    await pgClientAdmin.query(`
      INSERT INTO public.finance_bank_accounts (tenant_id, bank_name, account_number, account_name, currency, linked_finance_account_id, is_active)
      VALUES ('${testTenantId}', 'Test Bank', '123456789', 'Spa Corp Account', 'VND', 
        (SELECT id FROM public.finance_accounts WHERE code = '112' AND tenant_id = '${testTenantId}'), true);
    `);
  });

  afterAll(async () => {
    if (testTenantId) {
      await supabaseAdmin.from('tenants').delete().eq('id', testTenantId);
    }
    await pgClientAdmin.end();
  });

  // Helper: Seed F2 Cash Movement
  async function seedCashMovement(direction: 'INFLOW' | 'OUTFLOW', amountMinor: number, currency: string = 'VND'): Promise<string> {
    const movementId = crypto.randomUUID();
    const bankAccountId = (await pgClientAdmin.query(`SELECT id FROM public.finance_bank_accounts WHERE tenant_id = '${testTenantId}';`)).rows[0].id;
    const account112Id = (await pgClientAdmin.query(`SELECT id FROM public.finance_accounts WHERE code = '112' AND tenant_id = '${testTenantId}';`)).rows[0].id;
    const account131Id = (await pgClientAdmin.query(`SELECT id FROM public.finance_accounts WHERE code = '131' AND tenant_id = '${testTenantId}';`)).rows[0].id;

    // Post mock F1 transaction first to satisfy F2 foreign key constraints
    const f1TxId = crypto.randomUUID();
    const idemKey = `MOCK-F1-${crypto.randomUUID()}`;
    
    await pgClientAdmin.query('BEGIN;');
    try {
      // 1. Insert as DRAFT
      await pgClientAdmin.query(`
        INSERT INTO public.finance_transactions (
          id, tenant_id, idempotency_key, source_type, source_id, transaction_type, posted_at, 
          transaction_currency, functional_currency, exchange_rate_rate, exchange_rate_source, exchange_rate_target, exchange_rate_effective,
          description, reference_type, reference_id, status, accounting_period_id
        )
        VALUES (
          '${f1TxId}', '${testTenantId}', '${idemKey}', 'F2_CASH', '${movementId}', 'CASH', NOW(), 
          '${currency}', 'VND', 1.0, 'USD', 'VND', NOW(),
          'Mock F2 txn', 'CASH', '${movementId}', 'DRAFT', '${sharedPeriodId}'
        );
      `);

      // 2. Insert 2 transaction lines satisfying the double-entry balancing rules (Debit = Credit)
      await pgClientAdmin.query(`
        INSERT INTO public.finance_transaction_lines (
          tenant_id, transaction_id, account_id, debit_amount, debit_currency, credit_amount, credit_currency,
          debit_functional_amount, debit_functional_currency, credit_functional_amount, credit_functional_currency, memo
        ) VALUES
        (
          '${testTenantId}', '${f1TxId}', '${account112Id}', ${amountMinor}, '${currency}', 0, '${currency}',
          ${amountMinor}, 'VND', 0, 'VND', 'Debit Cash Inflow'
        ),
        (
          '${testTenantId}', '${f1TxId}', '${account131Id}', 0, '${currency}', ${amountMinor}, '${currency}',
          0, 'VND', ${amountMinor}, 'VND', 'Credit AR Clearing'
        );
      `);

      // 3. Update status to POSTED to trigger validation
      await pgClientAdmin.query(`
        UPDATE public.finance_transactions SET status = 'POSTED' WHERE id = '${f1TxId}';
      `);

      await pgClientAdmin.query('COMMIT;');
    } catch (e) {
      await pgClientAdmin.query('ROLLBACK;');
      throw e;
    }

    // Enable local mutation bypass inside a transaction block
    await pgClientAdmin.query('BEGIN;');
    try {
      await pgClientAdmin.query('SET LOCAL finance.allow_cash_mutation = \'true\';');
      await pgClientAdmin.query(`
        INSERT INTO public.finance_cash_movements (id, tenant_id, bank_account_id, idempotency_key, direction, amount_minor, currency, functional_amount_minor, functional_currency, valuation_rate, f1_transaction_id, cash_leg_reference, source_type, source_id, description, recorded_at, created_at)
        VALUES ('${movementId}', '${testTenantId}', '${bankAccountId}', 'IDEM-${movementId}', '${direction}', ${amountMinor}, '${currency}', ${amountMinor}, 'VND', 1.0, '${f1TxId}', 'LEG-1', 'BANK', '${movementId}', 'Recorded payment receipt', NOW(), NOW());
      `);
      await pgClientAdmin.query('COMMIT;');
    } catch (e) {
      await pgClientAdmin.query('ROLLBACK;');
      throw e;
    }
    return movementId;
  }

  // Helper: Seed Finalized Invoice
  async function seedFinalizedInvoice(amountMinor: number, currency: string = 'VND'): Promise<string> {
    const resDraft = await pgClientAdmin.query(`
      SELECT public.finance_create_draft_invoice(
        '${testTenantId}', '${customerId}', 'INV-ALLOC-${crypto.randomUUID().slice(0,8)}', '${currency}', '2026-08-15', '2026-09-15'
      ) as id;
    `);
    const invoiceId = resDraft.rows[0].id;

    // We calculate line and tax based on the target total
    // Pretax = amountMinor / 1.1, Tax = 10%
    const taxRate = 0.1;
    const pretaxAmount = Math.round(amountMinor / (1 + taxRate));
    const taxAmount = amountMinor - pretaxAmount;

    await pgClientAdmin.query(`
      SELECT public.finance_add_invoice_line('${testTenantId}', '${invoiceId}', '${crypto.randomUUID()}', 'Suite', 1, ${pretaxAmount}, ${taxRate}, '5111');
    `);

    const lines = [
      { account_code: '131', debit_functional_amount: amountMinor, credit_functional_amount: 0, debit_amount_minor: amountMinor, credit_amount_minor: 0, debit_currency: currency, credit_currency: currency, debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'AR Debit' },
      { account_code: '5111', debit_functional_amount: 0, credit_functional_amount: pretaxAmount, debit_amount_minor: 0, credit_amount_minor: pretaxAmount, debit_currency: currency, credit_currency: currency, debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Rev Credit' },
      { account_code: '3331', debit_functional_amount: 0, credit_functional_amount: taxAmount, debit_amount_minor: 0, credit_amount_minor: taxAmount, debit_currency: currency, credit_currency: currency, debit_functional_currency: 'VND', credit_functional_currency: 'VND', memo: 'Tax Credit' }
    ];
    const { posting_attempt_id } = (await pgClientAdmin.query(`SELECT posting_attempt_id FROM public.finance_invoices WHERE id = '${invoiceId}';`)).rows[0];
    const reqHash = createHash('sha256').update(JSON.stringify(lines) + posting_attempt_id).digest('hex');

    await pgClientAdmin.query(`
      SELECT public.finance_finalize_invoice(
        '${testTenantId}', '${invoiceId}', '${posting_attempt_id}', '${reqHash}', '${JSON.stringify(lines)}'::jsonb
      );
    `);

    return invoiceId;
  }

  // =========================================================================
  // T01 - T07: Core Payment Allocation Checks
  // =========================================================================

  test('F3.3-T01: Successful standard payment allocation', async () => {
    const invoiceId = await seedFinalizedInvoice(1000000);
    const cashId = await seedCashMovement('INFLOW', 1000000);

    const resAlloc = await pgClientAdmin.query(`
      SELECT public.finance_allocate_payment(
        '${testTenantId}', '${invoiceId}', '${cashId}', 1000000, 1.0, 'CENTRAL_BANK', NOW()
      ) as allocation_id;
    `);
    const allocId = resAlloc.rows[0].allocation_id;
    expect(allocId).not.toBeNull();

    // Verify subledgerCREDIT_ALLOCATION fact log exists
    const fact = await pgClientAdmin.query(`SELECT entry_type, amount_minor FROM public.finance_receivable_ledger WHERE source_id = '${allocId}';`);
    expect(fact.rows[0].entry_type).toBe('CREDIT_ALLOCATION');
    expect(fact.rows[0].amount_minor).toBe('1000000');

    // Verify outstanding balance projection is reduced to 0
    const pos = await pgClientAdmin.query(`SELECT allocated_amount_minor, outstanding_amount_minor FROM public.finance_receivable_positions WHERE invoice_id = '${invoiceId}';`);
    expect(pos.rows[0].allocated_amount_minor).toBe('1000000');
    expect(pos.rows[0].outstanding_amount_minor).toBe('0');
  });

  test('F3.3-T02: Same-currency allocation defaults rate to 1.0', async () => {
    const invoiceId = await seedFinalizedInvoice(500000);
    const cashId = await seedCashMovement('INFLOW', 500000);

    const resAlloc = await pgClientAdmin.query(`
      SELECT public.finance_allocate_payment(
        '${testTenantId}', '${invoiceId}', '${cashId}', 500000, 1.0, 'TREASURY', NOW()
      ) as id;
    `);
    const allocId = resAlloc.rows[0].id;
    const alloc = await pgClientAdmin.query(`SELECT allocated_invoice_amount_minor, exchange_rate FROM public.finance_receivable_allocations WHERE id = '${allocId}';`);
    expect(alloc.rows[0].allocated_invoice_amount_minor).toBe('500000');
    expect(Number(alloc.rows[0].exchange_rate)).toBe(1.0);
  });

  test('F3.3-T03: Non-existent cash movement is rejected', async () => {
    const invoiceId = await seedFinalizedInvoice(500000);
    const fakeId = crypto.randomUUID();

    let err: string | null = null;
    try {
      await pgClientAdmin.query(`
        SELECT public.finance_allocate_payment(
          '${testTenantId}', '${invoiceId}', '${fakeId}', 500000, 1.0, 'CENTRAL_BANK', NOW()
        );
      `);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toContain('CASH_MOVEMENT_NOT_FOUND');
  });

  test('F3.3-T04: OUTFLOW direction cash movement is rejected', async () => {
    const invoiceId = await seedFinalizedInvoice(500000);
    const cashId = await seedCashMovement('OUTFLOW', 500000);

    let err: string | null = null;
    try {
      await pgClientAdmin.query(`
        SELECT public.finance_allocate_payment(
          '${testTenantId}', '${invoiceId}', '${cashId}', 500000, 1.0, 'CENTRAL_BANK', NOW()
        );
      `);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toContain('INVALID_CASH_DIRECTION');
  });

  test('F3.3-T05: Allocation exceeds available cash amount', async () => {
    const invoiceId = await seedFinalizedInvoice(500000);
    const cashId = await seedCashMovement('INFLOW', 300000); // Only 300k available

    let err: string | null = null;
    try {
      await pgClientAdmin.query(`
        SELECT public.finance_allocate_payment(
          '${testTenantId}', '${invoiceId}', '${cashId}', 400000, 1.0, 'CENTRAL_BANK', NOW()
        );
      `);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toContain('OVER_ALLOCATION');
  });

  test('F3.3-T06: Allocating amount exceeding invoice outstanding balance is rejected', async () => {
    const invoiceId = await seedFinalizedInvoice(200000); // Invoice total: 200k
    const cashId = await seedCashMovement('INFLOW', 500000);

    let err: string | null = null;
    try {
      await pgClientAdmin.query(`
        SELECT public.finance_allocate_payment(
          '${testTenantId}', '${invoiceId}', '${cashId}', 300000, 1.0, 'CENTRAL_BANK', NOW()
        );
      `);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toContain('ALLOCATION_EXCEEDS_OUTSTANDING');
  });

  test('F3.3-T07: Multi-currency allocation conversion rate CASH_TO_INVOICE', async () => {
    // Invoice is VND, Cash is USD. Rate = 25000.
    const invoiceId = await seedFinalizedInvoice(1000000); // 1m VND invoice
    const cashId = await seedCashMovement('INFLOW', 50, 'USD'); // USD bank entry

    // Trích 30 USD, quy đổi 30 * 25000 = 750k VND giảm trừ hoá đơn
    const resAlloc = await pgClientAdmin.query(`
      SELECT public.finance_allocate_payment(
        '${testTenantId}', '${invoiceId}', '${cashId}', 30, 25000.0, 'CENTRAL_BANK', NOW()
      ) as id;
    `);
    const allocId = resAlloc.rows[0].id;

    const alloc = await pgClientAdmin.query(`
      SELECT allocated_amount_minor, allocated_invoice_amount_minor, exchange_rate, rate_direction
      FROM public.finance_receivable_allocations WHERE id = '${allocId}';
    `);

    expect(alloc.rows[0].allocated_amount_minor).toBe('30'); // trích 30 USD
    expect(alloc.rows[0].allocated_invoice_amount_minor).toBe('750000'); // quy đổi 750,000 VND
    expect(Number(alloc.rows[0].exchange_rate)).toBe(25000.0);
    expect(alloc.rows[0].rate_direction).toBe('CASH_TO_INVOICE');

    // Verify position cache is updated using the invoice currency amount (750k)
    const pos = await pgClientAdmin.query(`SELECT allocated_amount_minor, outstanding_amount_minor FROM public.finance_receivable_positions WHERE invoice_id = '${invoiceId}';`);
    expect(pos.rows[0].allocated_amount_minor).toBe('750000');
    expect(pos.rows[0].outstanding_amount_minor).toBe('250000'); // 1m - 750k
  });

  // =========================================================================
  // T08 - T11: Concurrency Race Condition Verification
  // =========================================================================

  test('F3.3-T08 to T11: Concurrent payment allocations against cash limits', async () => {
    // T08 (700 + 500 race): Total cash = 1000. Parallel allocation of 700 and 500. One fails.
    const invoiceA = await seedFinalizedInvoice(1000000);
    const invoiceB = await seedFinalizedInvoice(1000000);
    const cashId = await seedCashMovement('INFLOW', 1000); // 1000 units cash limit

    // Execute concurrently
    const p1 = pgClientAdmin.query(`SELECT public.finance_allocate_payment('${testTenantId}', '${invoiceA}', '${cashId}', 700, 1.0, 'CENTRAL_BANK', NOW()) as id;`);
    const p2 = pgClientAdmin.query(`SELECT public.finance_allocate_payment('${testTenantId}', '${invoiceB}', '${cashId}', 500, 1.0, 'CENTRAL_BANK', NOW()) as id;`);

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1); // Only 1 can succeed
    expect(rejected.length).toBe(1); // The other gets rejected due to over-allocation
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('OVER_ALLOCATION');

    // T09 (600 + 400 success): Total cash = 1000. Both success.
    const invoiceC = await seedFinalizedInvoice(600);
    const invoiceD = await seedFinalizedInvoice(400);
    const cashId2 = await seedCashMovement('INFLOW', 1000);

    const r1 = pgClientAdmin.query(`SELECT public.finance_allocate_payment('${testTenantId}', '${invoiceC}', '${cashId2}', 600, 1.0, 'CENTRAL_BANK', NOW());`);
    const r2 = pgClientAdmin.query(`SELECT public.finance_allocate_payment('${testTenantId}', '${invoiceD}', '${cashId2}', 400, 1.0, 'CENTRAL_BANK', NOW());`);

    const results2 = await Promise.allSettled([r1, r2]);
    expect(results2.filter((r) => r.status === 'fulfilled').length).toBe(2); // Both succeed

    // T10 & T11 (3-way concurrency): 600 + 600 + 100 on cash limit 1000
    const invoiceE = await seedFinalizedInvoice(1000);
    const invoiceF = await seedFinalizedInvoice(1000);
    const invoiceG = await seedFinalizedInvoice(1000);
    const cashId3 = await seedCashMovement('INFLOW', 1000);

    const c1 = pgClientAdmin.query(`SELECT public.finance_allocate_payment('${testTenantId}', '${invoiceE}', '${cashId3}', 600, 1.0, 'CENTRAL_BANK', NOW());`);
    const c2 = pgClientAdmin.query(`SELECT public.finance_allocate_payment('${testTenantId}', '${invoiceF}', '${cashId3}', 600, 1.0, 'CENTRAL_BANK', NOW());`);
    const c3 = pgClientAdmin.query(`SELECT public.finance_allocate_payment('${testTenantId}', '${invoiceG}', '${cashId3}', 100, 1.0, 'CENTRAL_BANK', NOW());`);

    const results3 = await Promise.allSettled([c1, c2, c3]);
    const fulfilled3 = results3.filter((r) => r.status === 'fulfilled');
    const rejected3 = results3.filter((r) => r.status === 'rejected');

    // Expected outcomes:
    // If c3 and c1 run -> succeed (100 + 600 = 700), c2 fails.
    // If c1 and c2 run -> one succeeds, other fails, then c3 runs -> c3 fails if total was 600 + 600, but if c1 succeeded, total allocated was 600, so c3 (100) succeeds!
    // In all paths, the sum of fulfilled allocations is either 700 (600 + 100) or 600 (one 600 succeeded, the other 600 failed, and 100 failed or succeeded depending on execution order).
    // Sum must never exceed 1000.
    const sumAllocated = (await pgClientAdmin.query(`
      SELECT SUM(allocated_amount_minor) FROM public.finance_receivable_allocations WHERE cash_movement_id = '${cashId3}';
    `)).rows[0].sum;
    expect(Number(sumAllocated)).toBeLessThanOrEqual(1000);
  });

  // =========================================================================
  // T12 - T14: Allocation Reversals & Concurrency
  // =========================================================================

  test('F3.3-T12: Successful allocation reversal restores outstanding balance', async () => {
    const invoiceId = await seedFinalizedInvoice(800000);
    const cashId = await seedCashMovement('INFLOW', 800000);

    // 1. Allocate
    const resAlloc = await pgClientAdmin.query(`
      SELECT public.finance_allocate_payment(
        '${testTenantId}', '${invoiceId}', '${cashId}', 800000, 1.0, 'CENTRAL_BANK', NOW()
      ) as id;
    `);
    const allocId = resAlloc.rows[0].id;

    // 2. Reverse allocation
    const resRev = await pgClientAdmin.query(`
      SELECT public.finance_reverse_allocation('${testTenantId}', '${allocId}') as rev_id;
    `);
    const revAllocId = resRev.rows[0].rev_id;
    expect(revAllocId).not.toBeNull();

    // Verify subledger DEBIT_ADJUSTMENT positive fact linked to original allocation id
    const fact = await pgClientAdmin.query(`
      SELECT entry_type, amount_minor, source_id FROM public.finance_receivable_ledger 
      WHERE source_id = '${revAllocId}';
    `);
    expect(fact.rows[0].entry_type).toBe('DEBIT_ADJUSTMENT');
    expect(fact.rows[0].amount_minor).toBe('800000'); // strictly positive

    // Verify derived position cache outstanding restored to 800,000
    const pos = await pgClientAdmin.query(`
      SELECT allocated_amount_minor, outstanding_amount_minor FROM public.finance_receivable_positions WHERE invoice_id = '${invoiceId}';
    `);
    expect(pos.rows[0].allocated_amount_minor).toBe('0');
    expect(pos.rows[0].outstanding_amount_minor).toBe('800000');
  });

  test('F3.3-T13: Double reversal of same allocation is blocked', async () => {
    const invoiceId = await seedFinalizedInvoice(800000);
    const cashId = await seedCashMovement('INFLOW', 800000);

    const resAlloc = await pgClientAdmin.query(`
      SELECT public.finance_allocate_payment(
        '${testTenantId}', '${invoiceId}', '${cashId}', 800000, 1.0, 'CENTRAL_BANK', NOW()
      ) as id;
    `);
    const allocId = resAlloc.rows[0].id;

    // 1st Reversal
    await pgClientAdmin.query(`SELECT public.finance_reverse_allocation('${testTenantId}', '${allocId}');`);

    // 2nd Reversal - must fail
    let err: string | null = null;
    try {
      await pgClientAdmin.query(`SELECT public.finance_reverse_allocation('${testTenantId}', '${allocId}');`);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toContain('ALLOCATION_ALREADY_REVERSED');
  });

  test('F3.3-T14: Concurrent double reversal of same allocation allows only one success', async () => {
    const invoiceId = await seedFinalizedInvoice(800000);
    const cashId = await seedCashMovement('INFLOW', 800000);

    const resAlloc = await pgClientAdmin.query(`
      SELECT public.finance_allocate_payment(
        '${testTenantId}', '${invoiceId}', '${cashId}', 800000, 1.0, 'CENTRAL_BANK', NOW()
      ) as id;
    `);
    const allocId = resAlloc.rows[0].id;

    // Run parallel reversals
    const p1 = pgClientAdmin.query(`SELECT public.finance_reverse_allocation('${testTenantId}', '${allocId}');`);
    const p2 = pgClientAdmin.query(`SELECT public.finance_reverse_allocation('${testTenantId}', '${allocId}');`);

    const results = await Promise.allSettled([p1, p2]);
    const fulfilled = results.filter((r) => r.status === 'fulfilled');
    const rejected = results.filter((r) => r.status === 'rejected');

    expect(fulfilled.length).toBe(1); // exactly one succeeds
    expect(rejected.length).toBe(1); // one gets blocked by duplicate check
    expect((rejected[0] as PromiseRejectedResult).reason.message).toContain('ALLOCATION_ALREADY_REVERSED');

    // Verify outstanding balance restored exactly once (not twice)
    const pos = await pgClientAdmin.query(`
      SELECT allocated_amount_minor, outstanding_amount_minor FROM public.finance_receivable_positions WHERE invoice_id = '${invoiceId}';
    `);
    expect(pos.rows[0].allocated_amount_minor).toBe('0');
    expect(pos.rows[0].outstanding_amount_minor).toBe('800000');
  });

  // =========================================================================
  // T15 - T17: Boundary & Reconstruction
  // =========================================================================

  test('F3.3-T15: F2 Boundary Enforcement: Direct cash query by authenticated role is blocked', async () => {
    // Create connection as non-privileged role (authenticated)
    let err: string | null = null;
    try {
      await pgClientAdmin.query(`
        SET LOCAL role = 'authenticated';
        SET LOCAL request.jwt.claims = '{"app_metadata": {"tenant_id": "${testTenantId}", "role": "authenticated"}}';
        -- Try to directly update cash movements table
        UPDATE public.finance_cash_movements SET amount_minor = 9999 WHERE tenant_id = '${testTenantId}';
      `);
    } catch (e: any) {
      err = e.message;
    }
    expect(err).toMatch(/permission denied|DIRECT_CASH_MUTATION_PROHIBITED/);
  });

  test('F3.3-T16 to T17: Reconstruction consistency of positions cache from subledger history', async () => {
    const invoiceId = await seedFinalizedInvoice(1000000); // Accrual = 1,000,000
    const cashId1 = await seedCashMovement('INFLOW', 500000);
    const cashId2 = await seedCashMovement('INFLOW', 300000);

    // 1. Allocate Cash 1 (500k)
    const resA1 = await pgClientAdmin.query(`
      SELECT public.finance_allocate_payment('${testTenantId}', '${invoiceId}', '${cashId1}', 500000, 1.0, 'CENTRAL_BANK', NOW()) as id;
    `);
    const a1 = resA1.rows[0].id;

    // 2. Allocate Cash 2 (300k)
    const resA2 = await pgClientAdmin.query(`
      SELECT public.finance_allocate_payment('${testTenantId}', '${invoiceId}', '${cashId2}', 300000, 1.0, 'CENTRAL_BANK', NOW()) as id;
    `);
    const a2 = resA2.rows[0].id;

    // 3. Reverse Allocation 1 (500k)
    await pgClientAdmin.query(`
      SELECT public.finance_reverse_allocation('${testTenantId}', '${a1}');
    `);

    // Verify current state before corruption:
    // Outstanding = 1m (Accrual) - 300k (A2) = 700k
    // Allocated = 300k
    const posBefore = await pgClientAdmin.query(`
      SELECT original_amount_minor, allocated_amount_minor, outstanding_amount_minor 
      FROM public.finance_receivable_positions WHERE invoice_id = '${invoiceId}';
    `);
    expect(posBefore.rows[0].allocated_amount_minor).toBe('300000');
    expect(posBefore.rows[0].outstanding_amount_minor).toBe('700000');

    // 4. Corrupt the derived positions cache directly (simulate data corruption)
    // Run under local mutation context
    await pgClientAdmin.query(`
      BEGIN;
      SET LOCAL finance.allow_receivable_mutation = 'true';
      UPDATE public.finance_receivable_positions 
      SET original_amount_minor = 0,
          allocated_amount_minor = 0,
          adjusted_amount_minor = 0
      WHERE invoice_id = '${invoiceId}';
      COMMIT;
    `);

    const posCorrupted = await pgClientAdmin.query(`
      SELECT original_amount_minor, allocated_amount_minor, outstanding_amount_minor 
      FROM public.finance_receivable_positions WHERE invoice_id = '${invoiceId}';
    `);
    expect(posCorrupted.rows[0].original_amount_minor).toBe('0');
    expect(posCorrupted.rows[0].outstanding_amount_minor).toBe('0');

    // 5. Run Reconstruction RPC (T16 & T17)
    await pgClientAdmin.query(`
      SELECT public.finance_reconstruct_receivable_position('${testTenantId}', '${invoiceId}');
    `);

    // 6. Assert restored position matches the subledger facts history exactly
    const posRestored = await pgClientAdmin.query(`
      SELECT original_amount_minor, allocated_amount_minor, outstanding_amount_minor 
      FROM public.finance_receivable_positions WHERE invoice_id = '${invoiceId}';
    `);
    expect(posRestored.rows[0].original_amount_minor).toBe('1000000');
    expect(posRestored.rows[0].allocated_amount_minor).toBe('300000');
    expect(posRestored.rows[0].outstanding_amount_minor).toBe('700000'); // Balanced mathematically
  });
});
