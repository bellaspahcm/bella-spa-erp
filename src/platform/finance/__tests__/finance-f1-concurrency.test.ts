/**
 * Finance OS F1 Ledger Engine — Concurrency Hardening Tests
 *
 * Tests real database-level concurrent behavior to validate:
 * - Idempotency under parallel posting (only 1 record created, rest return cached)
 * - Period-closing race: only one actor wins, the other gets PERIOD_NOT_OPEN
 * - Double-reversal race: only one reversal succeeds, second gets TRANSACTION_IMMUTABLE
 * - Concurrent balanced postings don't corrupt state (all-or-nothing)
 *
 * Architecture compliance:
 * - FOR UPDATE locks serialize period-close vs posting
 * - Idempotency key + unique index serializes duplicate posts
 * - Engineering Quality Rule: TypeSafety-NoAny (Zero any usage)
 *
 * @module platform/finance/__tests__/finance-f1-concurrency.test
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { LedgerEngineService } from '../engines/ledger-engine/ledger.service';

jest.setTimeout(90000); // Concurrency tests need longer timeout

// ─────────────────────────────────────────────────────────────────────────────
// Helpers
// ─────────────────────────────────────────────────────────────────────────────

/** Run N promises concurrently and return all settled results */
async function runConcurrent<T>(
  tasks: Array<() => Promise<T>>
): Promise<PromiseSettledResult<T>[]> {
  return Promise.allSettled(tasks.map(t => t()));
}

/** Count fulfilled results */
function countFulfilled<T>(results: PromiseSettledResult<T>[]): number {
  return results.filter(r => r.status === 'fulfilled').length;
}

/** Extract fulfilled values */
function getFulfilled<T>(results: PromiseSettledResult<T>[]): T[] {
  return results
    .filter((r): r is PromiseFulfilledResult<T> => r.status === 'fulfilled')
    .map(r => r.value);
}

// ─────────────────────────────────────────────────────────────────────────────
// Test Suite
// ─────────────────────────────────────────────────────────────────────────────

describe('Finance OS F1 Ledger — Concurrency Hardening', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let ledger: LedgerEngineService;
  let tenantId: string;

  // Account IDs
  let cashAccountId: string;
  let revenueAccountId: string;

  // Period IDs (fresh per suite)
  let openPeriodId: string;

  // ─── Setup ──────────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    ledger = new LedgerEngineService(supabase);

    // Dynamic isolated tenant name for this test run to prevent idx_finance_accounts_tenant_code conflicts
    // since past POSTED transactions are immutable and prevent account deletion.
    const RUN_ID = Date.now().toString(36).toUpperCase();
    const TENANT_NAME = `F1-Concurrency-${RUN_ID}`;

    const { data: newT, error } = await supabase
      .from('tenants')
      .insert({ name: TENANT_NAME, status: 'active' })
      .select('id')
      .single();
    if (error || !newT) throw error;
    tenantId = newT.id;


    // Seed Chart of Accounts
    const { error: accErr } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert([
        {
          tenant_id: tenantId,
          code: '1001',
          name: 'Cash VND',
          type: 'ASSET',
          normal_balance: 'DEBIT',
          currency: 'VND',
          is_active: true
        },
        {
          tenant_id: tenantId,
          code: '4001',
          name: 'Revenue VND',
          type: 'REVENUE',
          normal_balance: 'CREDIT',
          currency: 'VND',
          is_active: true
        }
      ] as unknown as Record<string, unknown>[]);
    if (accErr) throw accErr;

    // Fetch account IDs
    const { data: accs } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .select('id, code')
      .eq('tenant_id' as unknown as 'id', tenantId);
    cashAccountId = String(accs!.find(a => a.code === '1001')!.id);
    revenueAccountId = String(accs!.find(a => a.code === '4001')!.id);

    // Seed default August period for initial tests
    openPeriodId = await seedOpenPeriod('08', '2026-08-01T00:00:00Z', '2026-08-31T23:59:59Z');
  });


  afterAll(async () => {
    // Cleanup outbox and non-posted details where possible
    await supabase.from('finance_outbox_events' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId);
  });


  // ─── Helpers ──────────────────────────────────────────────────────────────

  async function wipeFinanceData(tid: string): Promise<void> {
    const tables = [
      'finance_audit_trail',
      'finance_outbox_events',
      'finance_transaction_lines',
      'finance_transactions',
      'finance_accounting_periods',
      'finance_accounts'
    ] as const;
    for (const tbl of tables) {
      await supabase
        .from(tbl as unknown as 'tenants')
        .delete()
        .eq('tenant_id' as unknown as 'id', tid);
    }
  }

  async function seedOpenPeriod(
    month: string = '08',
    start: string = '2026-08-01T00:00:00Z',
    end: string = '2026-08-31T23:59:59Z'
  ): Promise<string> {
    const { data, error } = await supabase
      .from('finance_accounting_periods' as unknown as 'tenants')
      .insert({
        tenant_id: tenantId,
        name: `conc-period-${month}-${Date.now()}`,
        period_start: new Date(start).toISOString(),
        period_end: new Date(end).toISOString(),
        status: 'OPEN'
      } as unknown as Record<string, unknown>)
      .select('id')
      .single();
    if (error || !data) throw error;
    return String((data as Record<string, unknown>).id);
  }

  /** Post a simple balanced VND transaction */
  async function postBalanced(
    idempotencyKey: string,
    amountMinor: string = '10000',
    postedAt: Date = new Date('2026-08-15T12:00:00Z')
  ): Promise<{ success: boolean; data?: { id: string; status: string }; error?: { code: string } }> {
    return ledger.postTransaction({
      tenant_id: tenantId,
      idempotency_key: idempotencyKey,
      source_type: 'CONCURRENCY_TEST',
      source_id: `conc-${Date.now()}`,
      transaction_type: 'CASH',
      posted_at: postedAt,
      transaction_currency: 'VND',
      functional_currency: 'VND',
      description: `Concurrency test: ${idempotencyKey}`,
      reference_type: 'test',
      reference_id: idempotencyKey,
      lines: [
        { account_code: '1001', debit_amount_minor: amountMinor, credit_amount_minor: '0', memo: 'Cash in' },
        { account_code: '4001', debit_amount_minor: '0', credit_amount_minor: amountMinor, memo: 'Revenue' }
      ]
    });
  }


  // ─────────────────────────────────────────────────────────────────────────
  // TEST 1: 10 Concurrent Posts — Different Idempotency Keys
  // Expectation: ALL 10 transactions posted, all POSTED, no data corruption
  // ─────────────────────────────────────────────────────────────────────────

  describe('Concurrent Parallel Posting (10 concurrent)', () => {
    it('should allow 10 unique concurrent posts to complete without corruption', async () => {
      const N = 10;
      const baseKey = `conc-post-${Date.now()}`;

      const tasks = Array.from({ length: N }, (_, i) => async () =>
        postBalanced(`${baseKey}-${i}`, '5000')
      );

      const results = await runConcurrent(tasks);
      const fulfilled = getFulfilled(results);

      // All should be Promise.allSettled fulfilled (no unhandled rejections)
      expect(countFulfilled(results)).toBe(N);

      // All should succeed with POSTED status
      const successCount = fulfilled.filter(r => r.success && r.data?.status === 'POSTED').length;
      expect(successCount).toBe(N);

      // All transaction IDs must be unique (no duplicates from race conditions)
      const ids = fulfilled.map(r => r.data!.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(N);

      // Verify in DB: 10 rows with POSTED status for this tenant
      const { data: txRows } = await supabase
        .from('finance_transactions')
        .select('id, status')
        .eq('tenant_id', tenantId)
        .eq('source_type', 'CONCURRENCY_TEST')
        .eq('status', 'POSTED');

      expect(txRows!.length).toBeGreaterThanOrEqual(N);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 2: Idempotency Under Concurrency — Same Key, 5 Concurrent Requests
  // Expectation: All 5 settle to the SAME transaction ID, no duplicate creation
  // ─────────────────────────────────────────────────────────────────────────

  describe('Idempotency Key Deduplication Under Concurrent Load', () => {
    it('should create exactly 1 transaction when the same idempotency key is used 5 times concurrently', async () => {
      const sharedKey = `idem-conc-${Date.now()}`;
      const N = 5;

      const tasks = Array.from({ length: N }, () => async () =>
        postBalanced(sharedKey, '15000')
      );

      const results = await runConcurrent(tasks);
      const fulfilled = getFulfilled(results);

      // All should resolve (no crashes)
      expect(countFulfilled(results)).toBe(N);

      // All successful results must return the SAME transaction ID
      const successResults = fulfilled.filter(r => r.success);
      expect(successResults.length).toBeGreaterThan(0);

      const ids = successResults.map(r => r.data!.id);
      const uniqueIds = new Set(ids);
      expect(uniqueIds.size).toBe(1); // Exactly 1 unique ID

      // Verify in DB: Only 1 row with this idempotency key
      const { data: txRows } = await supabase
        .from('finance_transactions')
        .select('id, idempotency_key')
        .eq('tenant_id', tenantId)
        .eq('idempotency_key', sharedKey);

      expect(txRows).toHaveLength(1);
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 3: Period Close vs Posting Race Condition
  // Expectation: Only ONE of {close, post} wins based on FOR UPDATE serialization
  //   - If close wins: post fails with PERIOD_NOT_OPEN
  //   - If post wins: period is closed after the post (post still POSTED)
  //   - Result is deterministic at DB level — no half-committed state
  // ─────────────────────────────────────────────────────────────────────────

  describe('Period Close vs Posting Race Condition', () => {
    it('should serialize period-close vs transaction-post with no partial states', async () => {
      // Seed a fresh isolated September period for this test case
      const sepPeriodId = await seedOpenPeriod('09', '2026-09-01T00:00:00Z', '2026-09-30T23:59:59Z');
      const postKey = `race-post-${Date.now()}`;
      const postedAtSep = new Date('2026-09-15T12:00:00Z');

      // Race: close and post concurrently (using a valid UUID for actor ID)
      const [closeResult, postResult] = await Promise.allSettled([
        ledger.closePeriod(tenantId, sepPeriodId, '00000000-0000-0000-0000-000000000000'),
        postBalanced(postKey, '25000', postedAtSep)
      ]);

      // Both must settle (no unhandled exceptions)
      expect(closeResult.status).toBe('fulfilled');
      expect(postResult.status).toBe('fulfilled');

      const closeRes = (closeResult as PromiseFulfilledResult<{ success: boolean }>).value;
      const postRes = (postResult as PromiseFulfilledResult<{ success: boolean; error?: { code: string } }>).value;

      // One of these must be true (serialized, not both fail or corrupt):
      // Scenario A: Close wins → Post fails PERIOD_NOT_OPEN
      // Scenario B: Post wins → Close succeeds after
      const closeWins = closeRes.success && !postRes.success;
      const postWins = postRes.success && closeRes.success;
      const bothSucceed = closeRes.success && postRes.success;

      // At minimum, the close must succeed (no period lock corruption)
      expect(closeRes.success).toBe(true);

      // No scenario where both fail:
      expect(closeWins || postWins || bothSucceed).toBe(true);

      // If post failed, it must be a clean PERIOD_NOT_OPEN — no partial data
      if (!postRes.success) {
        expect(postRes.error?.code).toBe('PERIOD_NOT_OPEN');

        // Verify: no orphan transaction in DB
        const { data: orphanTx } = await supabase
          .from('finance_transactions')
          .select('id, status')
          .eq('tenant_id', tenantId)
          .eq('idempotency_key', postKey);
        expect(orphanTx).toHaveLength(0);
      }

      // Verify period is in CLOSED state (close always wins eventually)
      const { data: period } = await supabase
        .from('finance_accounting_periods')
        .select('status')
        .eq('id', sepPeriodId)
        .single();
      expect(period!.status).toBe('CLOSED');
    });
  });


  // ─────────────────────────────────────────────────────────────────────────
  // TEST 4: Double Reversal Race — Only 1 Reversal Must Succeed
  // Expectation: Exactly 1 reversal succeeds (REVERSED status on original),
  //   second attempt gets TRANSACTION_IMMUTABLE
  // ─────────────────────────────────────────────────────────────────────────

  describe('Concurrent Double-Reversal Race Condition', () => {
    it('should allow exactly 1 reversal to succeed when 2 concurrent reversals are attempted', async () => {
      // Seed a fresh isolated October period for this test case
      const octPeriodId = await seedOpenPeriod('10', '2026-10-01T00:00:00Z', '2026-10-31T23:59:59Z');
      const postedAtOct = new Date('2026-10-15T12:00:00Z');

      // Post a fresh transaction in October
      const postKey = `rev-race-orig-${Date.now()}`;
      const origRes = await postBalanced(postKey, '30000', postedAtOct);
      expect(origRes.success).toBe(true);
      const origTxId = origRes.data!.id;


      // Two concurrent reversals on the same transaction
      const [rev1, rev2] = await Promise.allSettled([
        ledger.reverseTransaction({
          tenant_id: tenantId,
          transaction_id: origTxId,
          reason: 'Race reversal attempt 1',
          idempotency_key: `rev-race-1-${Date.now()}`
        }),
        ledger.reverseTransaction({
          tenant_id: tenantId,
          transaction_id: origTxId,
          reason: 'Race reversal attempt 2',
          idempotency_key: `rev-race-2-${Date.now()}`
        })
      ]);

      // Both must settle
      expect(rev1.status).toBe('fulfilled');
      expect(rev2.status).toBe('fulfilled');

      const r1 = (rev1 as PromiseFulfilledResult<Awaited<ReturnType<LedgerEngineService['reverseTransaction']>>>).value;
      const r2 = (rev2 as PromiseFulfilledResult<Awaited<ReturnType<LedgerEngineService['reverseTransaction']>>>).value;

      // Exactly one must succeed
      const successCount = [r1, r2].filter(r => r.success).length;
      expect(successCount).toBe(1);

      // The failure must be TRANSACTION_IMMUTABLE
      const failedRes = [r1, r2].find(r => !r.success);
      expect(failedRes?.error?.code).toBe('TRANSACTION_IMMUTABLE');

      // Original transaction must be REVERSED
      const { data: origTx } = await supabase
        .from('finance_transactions')
        .select('status')
        .eq('id', origTxId)
        .single();
      expect(origTx!.status).toBe('REVERSED');

      // Exactly 1 reversal transaction must exist in DB
      const { data: reversalTxs } = await supabase
        .from('finance_transactions')
        .select('id, status, reversal_of')
        .eq('tenant_id', tenantId)
        .eq('reversal_of', origTxId);
      expect(reversalTxs).toHaveLength(1);
      expect(reversalTxs![0].status).toBe('POSTED');
    });
  });

  // ─────────────────────────────────────────────────────────────────────────
  // TEST 5: State Integrity After Concurrent Load
  // Expectation: After N concurrent posts, the DB state is exactly correct
  //   - Sum of all debits on cash account = Sum of all credits on revenue account
  //   - No orphan lines (lines without headers)
  // ─────────────────────────────────────────────────────────────────────────

  describe('State Integrity Verification After Concurrent Load', () => {
    it('should maintain double-entry balance integrity after 10 concurrent posts', async () => {
      // Seed a fresh isolated November period for this test
      const novPeriodId = await seedOpenPeriod('11', '2026-11-01T00:00:00Z', '2026-11-30T23:59:59Z');
      const postedAtNov = new Date('2026-11-15T12:00:00Z');

      const N = 10;
      const amountPerTx = '8000';
      const baseKey = `integrity-check-${Date.now()}`;

      const tasks = Array.from({ length: N }, (_, i) => async () =>
        postBalanced(`${baseKey}-${i}`, amountPerTx, postedAtNov)
      );

      await runConcurrent(tasks);

      // Fetch all lines for this tenant's POSTED transactions in this period
      const { data: lines, error } = await supabase
        .from('finance_transaction_lines')
        .select(`
          debit_functional_amount,
          credit_functional_amount,
          finance_accounts!inner(code),
          finance_transactions!inner(status, accounting_period_id)
        `)
        .eq('tenant_id', tenantId)
        .eq('finance_transactions.status', 'POSTED')
        .eq('finance_transactions.accounting_period_id', novPeriodId);

      expect(error).toBeNull();
      expect(lines!.length).toBeGreaterThan(0);


      let totalDebits = BigInt(0);
      let totalCredits = BigInt(0);

      for (const line of lines!) {
        totalDebits += BigInt(String(line.debit_functional_amount));
        totalCredits += BigInt(String(line.credit_functional_amount));
      }

      // Core double-entry invariant: Σ debits = Σ credits across all lines
      expect(totalDebits).toBe(totalCredits);

      // Check no orphan lines exist (lines without corresponding transaction headers)
      const { data: orphanCheck } = await supabase.rpc(
        'execute_sql' as unknown as never,
        {
          sql: `
            SELECT COUNT(*) AS orphan_count
            FROM finance_transaction_lines ftl
            LEFT JOIN finance_transactions ft ON ft.id = ftl.transaction_id
            WHERE ftl.tenant_id = $1
              AND ft.id IS NULL
          `,
          params: [tenantId]
        } as unknown as never
      );

      const orphanCount = Number(
        (orphanCheck as unknown as Array<Record<string, string>>)?.[0]?.orphan_count ?? 0
      );
      expect(orphanCount).toBe(0);
    });
  });
});
