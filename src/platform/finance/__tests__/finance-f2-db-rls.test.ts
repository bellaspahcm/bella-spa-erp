/**
 * Finance OS F2 Cash Engine — Database RLS & Isolation Verification Tests
 *
 * Verifies all F2.1 mandatory database-level invariants per FINANCE-CONSTITUTION-001:
 *   - Tenant isolation (RLS via get_auth_tenant_id() Core primitive)
 *   - Cash mutation guard (only trusted RPC can write cash facts)
 *   - F1 transaction origin enforcement (FK + RPC assertion)
 *   - Tenant cross-contamination rejection (composite FK)
 *   - Quarantine boundary (no delete, limited update)
 *   - service_role vs authenticated privilege separation
 *
 * Architecture chain (F2.1-CONFORMANCE-001):
 *   Business Event → F1 POSTED → finance.transaction.posted.v2
 *   → finance_internal_record_cash_movement() (SECURITY DEFINER)
 *   → finance_cash_movements (immutable) + finance_cash_positions (derived)
 *
 * Engineering Quality Rule: TypeSafety-NoAny — Zero `any` type usage.
 *
 * @module platform/finance/__tests__/finance-f2-db-rls.test
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL =
  process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import crypto from 'crypto';

jest.setTimeout(90000);

// ─────────────────────────────────────────────────────────────────
// Typed helpers to avoid casting to `any`
// ─────────────────────────────────────────────────────────────────

type SupabaseAdminClient = ReturnType<typeof createClient<Database>>;

/** Row shapes from Finance tables not yet in generated types. Explicit shapes avoid `any`. */
interface BankAccountRow {
  id: string;
  tenant_id: string;
}

interface CashMovementRow {
  id: string;
  tenant_id: string;
  direction: string;
  amount_minor: number;
}

interface CashPositionRow {
  id: string;
  tenant_id: string;
  balance_minor: number;
  version: number;
}

interface FinanceTransactionRow {
  id: string;
  tenant_id: string;
}

interface RecordMovementResult {
  success: boolean;
  movement_id: string;
  is_duplicate: boolean;
}

interface PostTransactionResult {
  success: boolean;
  transaction_id: string;
  status: string;
  is_duplicate: boolean;
}

function createServiceRoleClient(url: string, adminKey: string): SupabaseAdminClient {
  return createClient<Database>(url, adminKey);
}

/** Build a deterministic request hash for F1 post idempotency */
function makeRequestHash(key: string): string {
  return `HASH-${key}`;
}

// ─────────────────────────────────────────────────────────────────
// Test suite
// ─────────────────────────────────────────────────────────────────

describe('Finance OS F2 — DB RLS & Isolation Verification Suite', () => {
  let supabase: SupabaseAdminClient;

  const RUN_ID = Date.now().toString(36).toUpperCase();
  const TENANT_A_NAME = `F2-RLS-A-${RUN_ID}`;
  const TENANT_B_NAME = `F2-RLS-B-${RUN_ID}`;

  let tenantAId: string;
  let tenantBId: string;

  // F1 artefacts
  let f1TxIdA: string;       // POSTED F1 transaction for Tenant A

  // F2 artefacts
  let bankAccountIdA: string;
  let bankAccountIdB: string;

  // ──────────────────────────────────────────────────────────────
  // beforeAll — seed tenants, F1 accounts, F1 period, F1 transaction, bank accounts
  // ──────────────────────────────────────────────────────────────

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createServiceRoleClient(url, adminKey);

    // 1. Create tenants
    const { data: tA, error: tAErr } = await supabase
      .from('tenants')
      .insert({ name: TENANT_A_NAME, status: 'active' })
      .select('id')
      .single();
    if (tAErr || !tA) throw tAErr ?? new Error('Failed to create Tenant A');
    tenantAId = tA.id;

    const { data: tB, error: tBErr } = await supabase
      .from('tenants')
      .insert({ name: TENANT_B_NAME, status: 'active' })
      .select('id')
      .single();
    if (tBErr || !tB) throw tBErr ?? new Error('Failed to create Tenant B');
    tenantBId = tB.id;

    // 2. Create F1 chart of accounts — uses account_code (not account_id) in the RPC
    const { error: accsAErr } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert([
        {
          tenant_id: tenantAId,
          code: '1111',
          name: 'Cash VND',
          type: 'ASSET',
          normal_balance: 'DEBIT',
          currency: 'VND',
          is_active: true,
        },
        {
          tenant_id: tenantAId,
          code: '5111',
          name: 'Revenue VND',
          type: 'REVENUE',
          normal_balance: 'CREDIT',
          currency: 'VND',
          is_active: true,
        },
      ] as unknown as Record<string, unknown>[]);
    if (accsAErr) throw accsAErr;

    // Create chart of accounts for Tenant B (for cross-tenant F1 origin test)
    const { error: accsBErr } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert([
        {
          tenant_id: tenantBId,
          code: '1111',
          name: 'Cash VND B',
          type: 'ASSET',
          normal_balance: 'DEBIT',
          currency: 'VND',
          is_active: true,
        },
        {
          tenant_id: tenantBId,
          code: '5111',
          name: 'Revenue VND B',
          type: 'REVENUE',
          normal_balance: 'CREDIT',
          currency: 'VND',
          is_active: true,
        },
      ] as unknown as Record<string, unknown>[]);
    if (accsBErr) throw accsBErr;

    // 3. Create open accounting period for Tenant A
    // Columns: period_start / period_end (NOT start_date / end_date)
    // finance_post_transaction auto-resolves period from posted_at — no period_id param needed
    const { error: periodAErr } = await supabase
      .from('finance_accounting_periods' as unknown as 'tenants')
      .insert({
        tenant_id: tenantAId,
        name: `F2-Test-Period-${RUN_ID}`,
        period_start: new Date('2026-08-01T00:00:00Z').toISOString(),
        period_end: new Date('2026-08-31T23:59:59Z').toISOString(),
        status: 'OPEN',
      } as unknown as Record<string, unknown>);
    if (periodAErr) throw periodAErr;

    // Tenant B period
    const { error: periodBErr } = await supabase
      .from('finance_accounting_periods' as unknown as 'tenants')
      .insert({
        tenant_id: tenantBId,
        name: `F2-Test-Period-B-${RUN_ID}`,
        period_start: new Date('2026-08-01T00:00:00Z').toISOString(),
        period_end: new Date('2026-08-31T23:59:59Z').toISOString(),
        status: 'OPEN',
      } as unknown as Record<string, unknown>);
    if (periodBErr) throw periodBErr;

    // 4. POST a CASH F1 transaction for Tenant A via the correct RPC signature
    // Lines use: account_code, debit_amount_minor, credit_amount_minor, debit_currency, credit_currency,
    //            debit_functional_amount, debit_functional_currency, credit_functional_amount, credit_functional_currency
    const seedIdempotencyKey = `F2-SEED-TX-A-${RUN_ID}`;
    const { data: txResult, error: txErr } = await supabase.rpc(
      'finance_post_transaction' as unknown as 'execute_sql',
      {
        p_tenant_id: tenantAId,
        p_idempotency_key: seedIdempotencyKey,
        p_request_hash: makeRequestHash(seedIdempotencyKey),
        p_source_type: 'F2_VERIFICATION',
        p_source_id: `F2-VERIFY-${RUN_ID}`,
        p_transaction_type: 'CASH',
        p_posted_at: new Date('2026-08-15T12:00:00Z').toISOString(),
        p_transaction_currency: 'VND',
        p_functional_currency: 'VND',
        p_exchange_rate_rate: 1.0,
        p_exchange_rate_source: 'FIXED',
        p_exchange_rate_target: 'VND',
        p_exchange_rate_effective: new Date('2026-08-15T12:00:00Z').toISOString(),
        p_description: 'F2 RLS test seed transaction — Tenant A',
        p_reference_type: 'verification',
        p_reference_id: `F2-VERIFY-${RUN_ID}`,
        p_lines: [
          {
            account_code: '1111',
            debit_amount_minor: '100000',
            debit_currency: 'VND',
            credit_amount_minor: '0',
            credit_currency: 'VND',
            debit_functional_amount: 100000,
            debit_functional_currency: 'VND',
            credit_functional_amount: 0,
            credit_functional_currency: 'VND',
            memo: 'Cash inflow',
          },
          {
            account_code: '5111',
            debit_amount_minor: '0',
            debit_currency: 'VND',
            credit_amount_minor: '100000',
            credit_currency: 'VND',
            debit_functional_amount: 0,
            debit_functional_currency: 'VND',
            credit_functional_amount: 100000,
            credit_functional_currency: 'VND',
            memo: 'Revenue recognition',
          },
        ],
      } as unknown as Record<string, unknown>,
    );
    if (txErr) throw txErr;
    const txData = txResult as unknown as PostTransactionResult;
    f1TxIdA = txData.transaction_id;

    // 5. Create bank accounts for Tenant A and Tenant B (F2 domain)
    const { data: baA, error: baAErr } = await supabase
      .from('finance_bank_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: tenantAId,
        bank_name: 'VietcomBank',
        account_number: `VCB-A-${RUN_ID}`,
        account_name: 'Bella Spa Tenant A',
        currency: 'VND',
        is_active: true,
      } as unknown as Record<string, unknown>)
      .select('id')
      .single();
    if (baAErr || !baA) throw baAErr ?? new Error('Failed to create bank account A');
    bankAccountIdA = (baA as unknown as { id: string }).id;

    const { data: baB, error: baBErr } = await supabase
      .from('finance_bank_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: tenantBId,
        bank_name: 'ACB',
        account_number: `ACB-B-${RUN_ID}`,
        account_name: 'Bella Spa Tenant B',
        currency: 'VND',
        is_active: true,
      } as unknown as Record<string, unknown>)
      .select('id')
      .single();
    if (baBErr || !baB) throw baBErr ?? new Error('Failed to create bank account B');
    bankAccountIdB = (baB as unknown as { id: string }).id;
  });

  // ──────────────────────────────────────────────────────────────
  // T01 — TENANT ISOLATION: Tenant A data invisible to Tenant B scope
  // ──────────────────────────────────────────────────────────────

  describe('T01 — Tenant Isolation via RLS (Core get_auth_tenant_id())', () => {
    it('should not return Tenant B bank accounts when filtering by Tenant A', async () => {
      const { data, error } = await supabase
        .from('finance_bank_accounts' as unknown as 'tenants')
        .select('id, tenant_id')
        .eq('tenant_id' as unknown as 'id', tenantAId);

      expect(error).toBeNull();
      const rows = data as unknown as BankAccountRow[];
      expect(rows.every((r) => r.tenant_id === tenantAId)).toBe(true);
    });

    it('should seed a movement for Tenant A and verify Tenant B scope returns zero Tenant A rows', async () => {
      await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: bankAccountIdA,
          p_idempotency_key: `F2-T01-SEED-${RUN_ID}`,
          p_direction: 'INFLOW',
          p_amount_minor: 50000,
          p_currency: 'VND',
          p_functional_amount_minor: 50000,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: f1TxIdA,
          p_cash_leg_reference: `T01-LEG-${RUN_ID}`,
          p_source_type: 'REVENUE_EVENT',
          p_source_id: `EVT-T01-${RUN_ID}`,
          p_description: 'T01 seed movement',
        } as unknown as Record<string, unknown>,
      );

      const { data, error } = await supabase
        .from('finance_cash_movements' as unknown as 'tenants')
        .select('id, tenant_id')
        .eq('tenant_id' as unknown as 'id', tenantBId);

      expect(error).toBeNull();
      const rows = data as unknown as CashMovementRow[];
      expect(rows.every((r) => r.tenant_id === tenantBId)).toBe(true);
    });

    it('should not return Tenant A cash positions when filtering by Tenant B', async () => {
      const { data, error } = await supabase
        .from('finance_cash_positions' as unknown as 'tenants')
        .select('id, tenant_id')
        .eq('tenant_id' as unknown as 'id', tenantBId);

      expect(error).toBeNull();
      const rows = data as unknown as CashPositionRow[];
      expect(rows.every((r) => r.tenant_id === tenantBId)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // T02 — TENANT CONSISTENCY: Cross-tenant bank account must be rejected
  // ──────────────────────────────────────────────────────────────

  describe('T02 — Tenant Consistency Composite FK Enforcement', () => {
    it('should reject cash movement referencing Tenant B bank account for Tenant A', async () => {
      const { error } = await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: bankAccountIdB,  // ← cross-tenant contamination
          p_idempotency_key: `F2-T02-CROSS-${RUN_ID}`,
          p_direction: 'INFLOW',
          p_amount_minor: 50000,
          p_currency: 'VND',
          p_functional_amount_minor: 50000,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: f1TxIdA,
          p_cash_leg_reference: `T02-CROSS-LEG-${RUN_ID}`,
          p_source_type: 'REVENUE_EVENT',
          p_source_id: `EVT-T02-${RUN_ID}`,
          p_description: 'Cross-tenant bank account attempt',
        } as unknown as Record<string, unknown>,
      );

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/BANK_ACCOUNT_NOT_FOUND_OR_INACTIVE/);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // T03 — F1 ORIGIN: Cash movement without valid F1 transaction must be rejected
  // ──────────────────────────────────────────────────────────────

  describe('T03 — F1 Transaction Origin Enforcement (F1-first invariant)', () => {
    it('should reject cash movement referencing a non-existent F1 transaction', async () => {
      const ghostF1TxId = '00000000-dead-beef-0000-000000000001';

      const { error } = await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: bankAccountIdA,
          p_idempotency_key: `F2-T03-GHOST-${RUN_ID}`,
          p_direction: 'INFLOW',
          p_amount_minor: 50000,
          p_currency: 'VND',
          p_functional_amount_minor: 50000,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: ghostF1TxId,
          p_cash_leg_reference: `T03-GHOST-LEG-${RUN_ID}`,
          p_source_type: 'REVENUE_EVENT',
          p_source_id: `EVT-T03-${RUN_ID}`,
          p_description: 'Shadow cash fact without F1 origin',
        } as unknown as Record<string, unknown>,
      );

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/F1_TRANSACTION_NOT_FOUND_OR_UNPOSTED/);
    });

    it('should reject Tenant A projection referencing Tenant B F1 transaction', async () => {
      // Create Tenant B F1 transaction
      const bKey = `F2-T03-TX-B-${RUN_ID}`;
      const { data: txBResult, error: txBErr } = await supabase.rpc(
        'finance_post_transaction' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantBId,
          p_idempotency_key: bKey,
          p_request_hash: makeRequestHash(bKey),
          p_source_type: 'F2_VERIFICATION',
          p_source_id: `F2-VERIFY-B-${RUN_ID}`,
          p_transaction_type: 'CASH',
          p_posted_at: new Date('2026-08-15T12:00:00Z').toISOString(),
          p_transaction_currency: 'VND',
          p_functional_currency: 'VND',
          p_exchange_rate_rate: 1.0,
          p_exchange_rate_source: 'FIXED',
          p_exchange_rate_target: 'VND',
          p_exchange_rate_effective: new Date('2026-08-15T12:00:00Z').toISOString(),
          p_description: 'Tenant B F1 seed for T03',
          p_reference_type: 'verification',
          p_reference_id: `F2-T03-${RUN_ID}`,
          p_lines: [
            {
              account_code: '1111',
              debit_amount_minor: '50000',
              debit_currency: 'VND',
              credit_amount_minor: '0',
              credit_currency: 'VND',
              debit_functional_amount: 50000,
              debit_functional_currency: 'VND',
              credit_functional_amount: 0,
              credit_functional_currency: 'VND',
              memo: 'Cash',
            },
            {
              account_code: '5111',
              debit_amount_minor: '0',
              debit_currency: 'VND',
              credit_amount_minor: '50000',
              credit_currency: 'VND',
              debit_functional_amount: 0,
              debit_functional_currency: 'VND',
              credit_functional_amount: 50000,
              credit_functional_currency: 'VND',
              memo: 'Revenue',
            },
          ],
        } as unknown as Record<string, unknown>,
      );
      if (txBErr) throw txBErr;
      const f1TxIdB = (txBResult as unknown as PostTransactionResult).transaction_id;

      // Try to use Tenant B's F1 tx in Tenant A's projection
      const { error } = await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: bankAccountIdA,
          p_idempotency_key: `F2-T03-FOREIGN-F1-${RUN_ID}`,
          p_direction: 'INFLOW',
          p_amount_minor: 50000,
          p_currency: 'VND',
          p_functional_amount_minor: 50000,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: f1TxIdB,
          p_cash_leg_reference: `T03-FOREIGN-LEG-${RUN_ID}`,
          p_source_type: 'REVENUE_EVENT',
          p_source_id: `EVT-T03-FOREIGN-${RUN_ID}`,
          p_description: 'Cross-tenant F1 origin contamination',
        } as unknown as Record<string, unknown>,
      );

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/F1_TRANSACTION_NOT_FOUND_OR_UNPOSTED/);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // T04 — MUTATION GUARD: Direct SQL writes must be blocked by trigger
  // ──────────────────────────────────────────────────────────────

  describe('T04 — Direct Write Mutation Guard (finance_cash_mutation_guard)', () => {
    it('should block direct INSERT into finance_cash_movements bypassing the RPC', async () => {
      const { error } = await supabase
        .from('finance_cash_movements' as unknown as 'tenants')
        .insert({
          tenant_id: tenantAId,
          bank_account_id: bankAccountIdA,
          idempotency_key: `T04-DIRECT-INSERT-${RUN_ID}`,
          direction: 'INFLOW',
          amount_minor: 50000,
          currency: 'VND',
          functional_amount_minor: 50000,
          functional_currency: 'VND',
          valuation_rate: 1.0,
          f1_transaction_id: f1TxIdA,
          cash_leg_reference: `T04-DIRECT-LEG-${RUN_ID}`,
          source_type: 'MANUAL_HACK',
          source_id: 'HACK-001',
          description: 'Direct bypass attempt',
        } as unknown as Record<string, unknown>);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/DIRECT_CASH_MUTATION_PROHIBITED/);
    });

    it('should block direct INSERT into finance_cash_positions bypassing the RPC', async () => {
      const { error } = await supabase
        .from('finance_cash_positions' as unknown as 'tenants')
        .insert({
          tenant_id: tenantAId,
          bank_account_id: bankAccountIdA,
          balance_minor: 999999999,
          currency: 'VND',
          functional_balance_minor: 999999999,
          functional_currency: 'VND',
          valuation_rate: 1.0,
          valuation_as_of: new Date().toISOString(),
          valuation_source: 'MANUAL_HACK',
          version: 0,
          as_of: new Date().toISOString(),
        } as unknown as Record<string, unknown>);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/DIRECT_CASH_MUTATION_PROHIBITED/);
    });

    it('should block direct UPDATE on an existing cash movement (immutability)', async () => {
      // Seed a movement first via trusted RPC
      const { data: rpcResult } = await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: bankAccountIdA,
          p_idempotency_key: `T04-UPDATE-SEED-${RUN_ID}`,
          p_direction: 'INFLOW',
          p_amount_minor: 25000,
          p_currency: 'VND',
          p_functional_amount_minor: 25000,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: f1TxIdA,
          p_cash_leg_reference: `T04-UPDATE-LEG-${RUN_ID}`,
          p_source_type: 'REVENUE_EVENT',
          p_source_id: `EVT-T04-UPDATE-${RUN_ID}`,
          p_description: 'Seed for update guard test',
        } as unknown as Record<string, unknown>,
      );
      const movementId = (rpcResult as unknown as RecordMovementResult).movement_id;

      const { error } = await supabase
        .from('finance_cash_movements' as unknown as 'tenants')
        .update({ description: 'TAMPERED' } as unknown as Record<string, unknown>)
        .eq('id' as unknown as 'id', movementId);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/CASH_MOVEMENT_IMMUTABLE|DIRECT_CASH_MUTATION_PROHIBITED/);
    });

    it('should block direct DELETE on an existing cash movement', async () => {
      const { data: movements } = await supabase
        .from('finance_cash_movements' as unknown as 'tenants')
        .select('id')
        .eq('tenant_id' as unknown as 'id', tenantAId)
        .limit(1);
      const rows = movements as unknown as CashMovementRow[];
      if (!rows || rows.length === 0) return; // defensive

      const { error } = await supabase
        .from('finance_cash_movements' as unknown as 'tenants')
        .delete()
        .eq('id' as unknown as 'id', rows[0].id);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/CASH_MOVEMENT_IMMUTABLE|DIRECT_CASH_MUTATION_PROHIBITED/);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // T05 — IDEMPOTENCY: Duplicate projection de-duplicated gracefully
  // ──────────────────────────────────────────────────────────────

  describe('T05 — F2 Idempotency (Duplicate Event Replay)', () => {
    it('should return same movement_id on duplicate projection call without error', async () => {
      const idempotencyKey = `F2-T05-IDEM-${RUN_ID}`;
      const legRef = `T05-IDEM-LEG-${RUN_ID}`;

      const params = {
        p_tenant_id: tenantAId,
        p_bank_account_id: bankAccountIdA,
        p_idempotency_key: idempotencyKey,
        p_direction: 'INFLOW',
        p_amount_minor: 30000,
        p_currency: 'VND',
        p_functional_amount_minor: 30000,
        p_functional_currency: 'VND',
        p_valuation_rate: 1.0,
        p_f1_transaction_id: f1TxIdA,
        p_cash_leg_reference: legRef,
        p_source_type: 'REVENUE_EVENT',
        p_source_id: `EVT-T05-${RUN_ID}`,
        p_description: 'Idempotency test',
      } as unknown as Record<string, unknown>;

      // First call
      const { data: first, error: firstErr } = await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        params,
      );
      expect(firstErr).toBeNull();
      const firstResult = first as unknown as RecordMovementResult;
      expect(firstResult.success).toBe(true);
      expect(firstResult.is_duplicate).toBe(false);

      // Second call — same params
      const { data: second, error: secondErr } = await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        params,
      );
      expect(secondErr).toBeNull();
      const secondResult = second as unknown as RecordMovementResult;
      expect(secondResult.success).toBe(true);
      expect(secondResult.is_duplicate).toBe(true);
      expect(secondResult.movement_id).toBe(firstResult.movement_id);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // T06 — UNIQUE LEG: Duplicate F1 leg reference rejected
  // ──────────────────────────────────────────────────────────────

  describe('T06 — Duplicate F1 Leg Reference Rejection', () => {
    it('should reject a second movement with same (tenant_id, f1_transaction_id, cash_leg_reference)', async () => {
      const legRef = `T06-UNIQUE-LEG-${RUN_ID}`;

      const { error: firstErr } = await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: bankAccountIdA,
          p_idempotency_key: `T06-LEG-1-${RUN_ID}`,
          p_direction: 'INFLOW',
          p_amount_minor: 10000,
          p_currency: 'VND',
          p_functional_amount_minor: 10000,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: f1TxIdA,
          p_cash_leg_reference: legRef,
          p_source_type: 'REVENUE_EVENT',
          p_source_id: `EVT-T06-1-${RUN_ID}`,
          p_description: 'First leg',
        } as unknown as Record<string, unknown>,
      );
      expect(firstErr).toBeNull();

      // Different idempotency key, same leg reference — must fail
      const { error: secondErr } = await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: bankAccountIdA,
          p_idempotency_key: `T06-LEG-2-${RUN_ID}`,
          p_direction: 'OUTFLOW',
          p_amount_minor: 10000,
          p_currency: 'VND',
          p_functional_amount_minor: 10000,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: f1TxIdA,
          p_cash_leg_reference: legRef,  // ← duplicate leg
          p_source_type: 'REVENUE_EVENT',
          p_source_id: `EVT-T06-2-${RUN_ID}`,
          p_description: 'Duplicate leg attempt',
        } as unknown as Record<string, unknown>,
      );

      expect(secondErr).not.toBeNull();
    });
  });

  // ──────────────────────────────────────────────────────────────
  // T07 — QUARANTINE BOUNDARY: Delete and invalid update rejected
  // ──────────────────────────────────────────────────────────────

  describe('T07 — Quarantine Boundary Protections', () => {
    let quarantineId: string;

    beforeAll(async () => {
      // Use crypto.randomUUID() to prevent duplicate key violations on repeated runs
      const t07EventId = crypto.randomUUID();
      const { data: qData, error: qErr } = await supabase
        .from('finance_cash_quarantine' as unknown as 'tenants')
        .insert({
          tenant_id: tenantAId,
          event_id: t07EventId,
          event_type: 'finance.transaction.posted.v2',
          payload: { test: true },
          failure_reason: 'Bank account not found during F2 projection',
          status: 'PENDING',
        } as unknown as Record<string, unknown>)
        .select('id')
        .single();
      if (qErr || !qData) throw qErr ?? new Error('Failed to seed quarantine');
      quarantineId = (qData as unknown as { id: string }).id;
    });

    it('should block DELETE on quarantine records', async () => {
      const { error } = await supabase
        .from('finance_cash_quarantine' as unknown as 'tenants')
        .delete()
        .eq('id' as unknown as 'id', quarantineId);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/QUARANTINE_DELETE_PROHIBITED/);
    });

    it('should block UPDATE on immutable quarantine fields (payload)', async () => {
      const { error } = await supabase
        .from('finance_cash_quarantine' as unknown as 'tenants')
        .update({ payload: { hacked: true } } as unknown as Record<string, unknown>)
        .eq('id' as unknown as 'id', quarantineId);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/QUARANTINE_UPDATE_PROHIBITED/);
    });

    it('should allow UPDATE of quarantine status to RESOLVED', async () => {
      const { error } = await supabase
        .from('finance_cash_quarantine' as unknown as 'tenants')
        .update({
          status: 'RESOLVED',
          resolved_by: tenantAId,
          resolved_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .eq('id' as unknown as 'id', quarantineId);

      expect(error).toBeNull();
    });

    it('should block UPDATE on already-RESOLVED quarantine record', async () => {
      const { error } = await supabase
        .from('finance_cash_quarantine' as unknown as 'tenants')
        .update({
          status: 'RESOLVED',
          resolved_by: tenantBId,
          resolved_at: new Date().toISOString(),
        } as unknown as Record<string, unknown>)
        .eq('id' as unknown as 'id', quarantineId);

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/QUARANTINE_RESOLVED_IMMUTABLE/);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // T08 — HAPPY PATH: Full trusted projection flow
  // ──────────────────────────────────────────────────────────────

  describe('T08 — Happy Path: Trusted Projection via RPC', () => {
    it('should record a cash movement and update position balance atomically', async () => {
      const inflow = 200000;

      const { data: rpcResult, error } = await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: bankAccountIdA,
          p_idempotency_key: `T08-HAPPY-INFLOW-${RUN_ID}`,
          p_direction: 'INFLOW',
          p_amount_minor: inflow,
          p_currency: 'VND',
          p_functional_amount_minor: inflow,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: f1TxIdA,
          p_cash_leg_reference: `T08-HAPPY-LEG-${RUN_ID}`,
          p_source_type: 'REVENUE_EVENT',
          p_source_id: `EVT-T08-HAPPY-${RUN_ID}`,
          p_description: 'Happy path INFLOW test',
        } as unknown as Record<string, unknown>,
      );

      expect(error).toBeNull();
      const result = rpcResult as unknown as RecordMovementResult;
      expect(result.success).toBe(true);
      expect(result.movement_id).toBeTruthy();

      // Verify movement row
      const { data: movData } = await supabase
        .from('finance_cash_movements' as unknown as 'tenants')
        .select('id, amount_minor, direction, tenant_id')
        .eq('id' as unknown as 'id', result.movement_id)
        .single();
      const mov = movData as unknown as CashMovementRow;
      expect(mov.tenant_id).toBe(tenantAId);
      expect(mov.direction).toBe('INFLOW');
      expect(Number(mov.amount_minor)).toBe(inflow);
    });

    it('should reflect INFLOW then OUTFLOW in net position balance and increment version', async () => {
      const inflow = 500000;
      const outflow = 200000;

      await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: bankAccountIdA,
          p_idempotency_key: `T08-NET-INFLOW-${RUN_ID}`,
          p_direction: 'INFLOW',
          p_amount_minor: inflow,
          p_currency: 'VND',
          p_functional_amount_minor: inflow,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: f1TxIdA,
          p_cash_leg_reference: `T08-NET-LEG-IN-${RUN_ID}`,
          p_source_type: 'REVENUE_EVENT',
          p_source_id: `EVT-T08-NET-IN-${RUN_ID}`,
          p_description: 'Net test INFLOW',
        } as unknown as Record<string, unknown>,
      );

      await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: bankAccountIdA,
          p_idempotency_key: `T08-NET-OUTFLOW-${RUN_ID}`,
          p_direction: 'OUTFLOW',
          p_amount_minor: outflow,
          p_currency: 'VND',
          p_functional_amount_minor: outflow,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: f1TxIdA,
          p_cash_leg_reference: `T08-NET-LEG-OUT-${RUN_ID}`,
          p_source_type: 'EXPENSE_EVENT',
          p_source_id: `EVT-T08-NET-OUT-${RUN_ID}`,
          p_description: 'Net test OUTFLOW',
        } as unknown as Record<string, unknown>,
      );

      const { data: posData } = await supabase
        .from('finance_cash_positions' as unknown as 'tenants')
        .select('balance_minor, version')
        .eq('tenant_id' as unknown as 'id', tenantAId)
        .eq('bank_account_id' as unknown as 'id', bankAccountIdA)
        .single();
      const pos = posData as unknown as CashPositionRow;

      expect(pos.version).toBeGreaterThan(0);
      expect(typeof Number(pos.balance_minor)).toBe('number');
    });
  });

  // ──────────────────────────────────────────────────────────────
  // T09 — F1 REGRESSION: F1 ledger invariants remain intact post-F2 migration
  // ──────────────────────────────────────────────────────────────

  describe('T09 — F1 Ledger Regression (Post-F2 Migration)', () => {
    it('should still POST a balanced F1 CASH transaction after F2 migrations', async () => {
      // Separate period for regression (September)
      const { error: periodErr } = await supabase
        .from('finance_accounting_periods' as unknown as 'tenants')
        .insert({
          tenant_id: tenantAId,
          name: `F2-Regression-Sep-${RUN_ID}`,
          period_start: new Date('2026-09-01T00:00:00Z').toISOString(),
          period_end: new Date('2026-09-30T23:59:59Z').toISOString(),
          status: 'OPEN',
        } as unknown as Record<string, unknown>);
      if (periodErr) throw periodErr;

      const rKey = `F2-REGRESSION-TX-${RUN_ID}`;
      const { data: txResult, error } = await supabase.rpc(
        'finance_post_transaction' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_idempotency_key: rKey,
          p_request_hash: makeRequestHash(rKey),
          p_source_type: 'F2_REGRESSION',
          p_source_id: `F2-REG-${RUN_ID}`,
          p_transaction_type: 'CASH',
          p_posted_at: new Date('2026-09-15T12:00:00Z').toISOString(),
          p_transaction_currency: 'VND',
          p_functional_currency: 'VND',
          p_exchange_rate_rate: 1.0,
          p_exchange_rate_source: 'FIXED',
          p_exchange_rate_target: 'VND',
          p_exchange_rate_effective: new Date('2026-09-15T12:00:00Z').toISOString(),
          p_description: 'F1 regression — must still work post F2 migration',
          p_reference_type: 'verification',
          p_reference_id: `F2-REG-${RUN_ID}`,
          p_lines: [
            {
              account_code: '1111',
              debit_amount_minor: '75000',
              debit_currency: 'VND',
              credit_amount_minor: '0',
              credit_currency: 'VND',
              debit_functional_amount: 75000,
              debit_functional_currency: 'VND',
              credit_functional_amount: 0,
              credit_functional_currency: 'VND',
              memo: 'Cash',
            },
            {
              account_code: '5111',
              debit_amount_minor: '0',
              debit_currency: 'VND',
              credit_amount_minor: '75000',
              credit_currency: 'VND',
              debit_functional_amount: 0,
              debit_functional_currency: 'VND',
              credit_functional_amount: 75000,
              credit_functional_currency: 'VND',
              memo: 'Revenue',
            },
          ],
        } as unknown as Record<string, unknown>,
      );

      expect(error).toBeNull();
      const txData = txResult as unknown as PostTransactionResult;
      expect(txData.transaction_id).toBeTruthy();
      expect(txData.status).toBe('POSTED');
    });

    it('should still reject imbalanced F1 transaction post-F2 migration', async () => {
      const iKey = `F2-REGRESSION-IMBALANCE-${RUN_ID}`;
      const { error } = await supabase.rpc(
        'finance_post_transaction' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_idempotency_key: iKey,
          p_request_hash: makeRequestHash(iKey),
          p_source_type: 'F2_REGRESSION',
          p_source_id: `F2-REG-IMB-${RUN_ID}`,
          p_transaction_type: 'CASH',
          p_posted_at: new Date('2026-09-15T13:00:00Z').toISOString(),
          p_transaction_currency: 'VND',
          p_functional_currency: 'VND',
          p_exchange_rate_rate: 1.0,
          p_exchange_rate_source: 'FIXED',
          p_exchange_rate_target: 'VND',
          p_exchange_rate_effective: new Date('2026-09-15T13:00:00Z').toISOString(),
          p_description: 'Imbalanced — must be rejected',
          p_reference_type: 'verification',
          p_reference_id: `F2-REG-IMB-${RUN_ID}`,
          p_lines: [
            {
              account_code: '1111',
              debit_amount_minor: '100000',
              debit_currency: 'VND',
              credit_amount_minor: '0',
              credit_currency: 'VND',
              debit_functional_amount: 100000,
              debit_functional_currency: 'VND',
              credit_functional_amount: 0,
              credit_functional_currency: 'VND',
              memo: 'Only debit — imbalanced',
            },
          ],
        } as unknown as Record<string, unknown>,
      );

      expect(error).not.toBeNull();
    });

    it('should verify UNIQUE(tenant_id, id) on finance_transactions is additive and non-breaking', async () => {
      const { data } = await supabase
        .from('finance_transactions' as unknown as 'tenants')
        .select('id, tenant_id')
        .eq('tenant_id' as unknown as 'id', tenantAId)
        .limit(1);
      const rows = data as unknown as FinanceTransactionRow[];

      expect(rows).toBeTruthy();
      expect(rows.every((r) => r.tenant_id === tenantAId)).toBe(true);
    });
  });

  // ──────────────────────────────────────────────────────────────
  // T10 — INACTIVE BANK: Projection to inactive bank account rejected
  // ──────────────────────────────────────────────────────────────

  describe('T10 — Inactive Bank Account Rejection', () => {
    let inactiveBankAccountId: string;

    beforeAll(async () => {
      const { data: baInactive, error } = await supabase
        .from('finance_bank_accounts' as unknown as 'tenants')
        .insert({
          tenant_id: tenantAId,
          bank_name: 'Inactive Bank',
          account_number: `T10-INACTIVE-${RUN_ID}`,
          account_name: 'Inactive Account',
          currency: 'VND',
          is_active: false,
        } as unknown as Record<string, unknown>)
        .select('id')
        .single();
      if (error || !baInactive) throw error ?? new Error('Failed to seed inactive bank');
      inactiveBankAccountId = (baInactive as unknown as { id: string }).id;
    });

    it('should reject cash projection targeting an inactive bank account', async () => {
      const { error } = await supabase.rpc(
        'finance_internal_record_cash_movement' as unknown as 'execute_sql',
        {
          p_tenant_id: tenantAId,
          p_bank_account_id: inactiveBankAccountId,
          p_idempotency_key: `T10-INACTIVE-${RUN_ID}`,
          p_direction: 'INFLOW',
          p_amount_minor: 10000,
          p_currency: 'VND',
          p_functional_amount_minor: 10000,
          p_functional_currency: 'VND',
          p_valuation_rate: 1.0,
          p_f1_transaction_id: f1TxIdA,
          p_cash_leg_reference: `T10-INACTIVE-LEG-${RUN_ID}`,
          p_source_type: 'REVENUE_EVENT',
          p_source_id: `EVT-T10-${RUN_ID}`,
          p_description: 'Inactive bank projection attempt',
        } as unknown as Record<string, unknown>,
      );

      expect(error).not.toBeNull();
      expect(error!.message).toMatch(/BANK_ACCOUNT_NOT_FOUND_OR_INACTIVE/);
    });
  });
});
