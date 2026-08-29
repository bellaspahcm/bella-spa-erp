/**
 * F2 Bank Account GL Map Contract Tests
 *
 * Verifies the read-only contract consumed by F5.6 CASH_GL_BALANCE.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(45000);

type BankAccountGlMapRow = {
  bank_account_id: string;
  linked_finance_account_id: string;
  linked_account_code: string;
  currency: string;
};

describe('F2_BANK_ACCOUNT_GL_MAP:v1 Contract', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  const runId = Date.now().toString(36).toUpperCase();
  const tenantAName = `F2-GL-MAP-A-${runId}`;
  const tenantBName = `F2-GL-MAP-B-${runId}`;

  let tenantAId: string;
  let tenantBId: string;
  let cashAccountAId: string;
  let cashAccountBId: string;
  let bankAccountAId: string;
  let unmappedBankAccountAId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);

    const { data: tenantA, error: tenantAErr } = await supabase
      .from('tenants')
      .insert({ name: tenantAName, status: 'active' })
      .select('id')
      .single();
    if (tenantAErr || !tenantA) throw tenantAErr ?? new Error('Tenant A creation failed');
    tenantAId = tenantA.id;

    const { data: tenantB, error: tenantBErr } = await supabase
      .from('tenants')
      .insert({ name: tenantBName, status: 'active' })
      .select('id')
      .single();
    if (tenantBErr || !tenantB) throw tenantBErr ?? new Error('Tenant B creation failed');
    tenantBId = tenantB.id;

    const { data: accountA, error: accountAErr } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: tenantAId,
        code: '1111',
        name: 'Cash VND A',
        type: 'ASSET',
        normal_balance: 'DEBIT',
        currency: 'VND',
        is_active: true,
      })
      .select('id')
      .single();
    if (accountAErr || !accountA) throw accountAErr ?? new Error('Account A creation failed');
    cashAccountAId = String(accountA.id);

    const { data: accountB, error: accountBErr } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: tenantBId,
        code: '1121',
        name: 'Cash VND B',
        type: 'ASSET',
        normal_balance: 'DEBIT',
        currency: 'VND',
        is_active: true,
      })
      .select('id')
      .single();
    if (accountBErr || !accountB) throw accountBErr ?? new Error('Account B creation failed');
    cashAccountBId = String(accountB.id);

    const { data: bankA, error: bankAErr } = await supabase
      .from('finance_bank_accounts')
      .insert({
        tenant_id: tenantAId,
        bank_name: 'F2 Map Bank A',
        account_number: `MAP-A-${runId}`,
        account_name: 'Mapped Cash Account',
        currency: 'VND',
        linked_finance_account_id: cashAccountAId,
        is_active: true,
      })
      .select('id')
      .single();
    if (bankAErr || !bankA) throw bankAErr ?? new Error('Bank A creation failed');
    bankAccountAId = bankA.id;

    const { data: unmappedBankA, error: unmappedBankAErr } = await supabase
      .from('finance_bank_accounts')
      .insert({
        tenant_id: tenantAId,
        bank_name: 'F2 Map Unmapped Bank A',
        account_number: `MAP-A-UNMAPPED-${runId}`,
        account_name: 'Unmapped Cash Account',
        currency: 'VND',
        is_active: true,
      })
      .select('id')
      .single();
    if (unmappedBankAErr || !unmappedBankA) throw unmappedBankAErr ?? new Error('Unmapped bank creation failed');
    unmappedBankAccountAId = unmappedBankA.id;

    const { error: bankBErr } = await supabase
      .from('finance_bank_accounts')
      .insert({
        tenant_id: tenantBId,
        bank_name: 'F2 Map Bank B',
        account_number: `MAP-B-${runId}`,
        account_name: 'Mapped Cash Account B',
        currency: 'VND',
        linked_finance_account_id: cashAccountBId,
        is_active: true,
      });
    if (bankBErr) throw bankBErr;
  });

  afterAll(async () => {
    await cleanupTenant(tenantAId);
    await cleanupTenant(tenantBId);
  });

  async function cleanupTenant(tenantId: string): Promise<void> {
    try { await supabase.from('finance_bank_accounts').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('tenants').delete().eq('id', tenantId); } catch (e) {}
  }

  async function readMap(tenantId: string, bankAccountId?: string): Promise<BankAccountGlMapRow[]> {
    const { data, error } = await supabase.rpc('finance_bank_account_gl_map' as never, {
      p_tenant_id: tenantId,
      p_bank_account_id: bankAccountId ?? null,
      p_contract_version: 'F2_BANK_ACCOUNT_GL_MAP:v1',
    } as never);
    if (error) throw error;
    return data as BankAccountGlMapRow[];
  }

  it('returns deterministic minimal mapping for one bank account', async () => {
    const rowsA = await readMap(tenantAId, bankAccountAId);
    const rowsB = await readMap(tenantAId, bankAccountAId);

    expect(rowsA).toEqual(rowsB);
    expect(rowsA).toHaveLength(1);
    expect(rowsA[0]).toEqual({
      bank_account_id: bankAccountAId,
      linked_finance_account_id: cashAccountAId,
      linked_account_code: '1111',
      currency: 'VND',
    });
  });

  it('does not leak mappings across tenants', async () => {
    const tenantARows = await readMap(tenantAId);

    expect(tenantARows).toHaveLength(1);
    expect(tenantARows.every((row) => row.linked_finance_account_id !== cashAccountBId)).toBe(true);
  });

  it('does not expose unmapped bank accounts as valid GL mappings', async () => {
    const rows = await readMap(tenantAId, unmappedBankAccountAId);

    expect(rows).toHaveLength(0);
  });

  it('rejects unknown contract versions', async () => {
    const { error } = await supabase.rpc('finance_bank_account_gl_map' as never, {
      p_tenant_id: tenantAId,
      p_bank_account_id: bankAccountAId,
      p_contract_version: 'F2_BANK_ACCOUNT_GL_MAP:v2',
    } as never);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('UNKNOWN_CONTRACT_VERSION');
  });
});
