/**
 * Accounting Semantic Configuration Write Contract
 *
 * Verifies the UI write RPC preserves tenant ownership and effective dating
 * for proven accounting semantic mappings.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(45000);

type AccountingSemanticGlMapRow = {
  semantic_key: string;
  gl_account_code: string;
  effective_from: string;
  effective_to: string | null;
  authority_version: string;
};

describe('finance_save_accounting_semantic_gl_mapping', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  const runId = Date.now().toString(36).toUpperCase();
  let tenantId: string;
  let otherTenantId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);

    const { data, error } = await supabase
      .from('tenants')
      .insert({ name: `FIN-SEM-CONFIG-UI-${runId}`, status: 'active' })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error('Tenant creation failed');
    tenantId = data.id;

    const { data: otherTenant, error: otherTenantError } = await supabase
      .from('tenants')
      .insert({ name: `FIN-SEM-CONFIG-OTHER-${runId}`, status: 'active' })
      .select('id')
      .single();
    if (otherTenantError || !otherTenant) throw otherTenantError ?? new Error('Other tenant creation failed');
    otherTenantId = otherTenant.id;

    await createFinanceAccount('5112');
    await createFinanceAccount('5111');
    await createFinanceAccount('5999', otherTenantId);
  });

  afterAll(async () => {
    if (!tenantId) return;
    try { await supabase.from('finance_control_account_mappings').delete().eq('tenant_id', tenantId); } catch {}
    try { await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch {}
    try { await supabase.from('tenants').delete().eq('id', tenantId); } catch {}
    try { await supabase.from('finance_control_account_mappings').delete().eq('tenant_id', otherTenantId); } catch {}
    try { await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', otherTenantId); } catch {}
    try { await supabase.from('tenants').delete().eq('id', otherTenantId); } catch {}
  });

  async function createFinanceAccount(code: string, targetTenantId = tenantId): Promise<void> {
    const { error } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: targetTenantId,
        code,
        name: `Revenue ${code}`,
        type: 'REVENUE',
        normal_balance: 'CREDIT',
        currency: 'VND',
        is_active: true,
      } as never);
    if (error) throw error;
  }

  async function saveMapping(accountCode: string, effectiveFrom: string) {
    return supabase.rpc('finance_save_accounting_semantic_gl_mapping' as never, {
      p_tenant_id: tenantId,
      p_semantic_key: 'GOODS_REVENUE',
      p_account_code: accountCode,
      p_effective_from: effectiveFrom,
      p_authority_version: 'TENANT_CONFIG:UI:v1',
    } as never);
  }

  async function readMap(asOf: string): Promise<AccountingSemanticGlMapRow[]> {
    const { data, error } = await supabase.rpc('finance_get_accounting_semantic_gl_map_as_of' as never, {
      p_tenant_id: tenantId,
      p_semantic_key: 'GOODS_REVENUE',
      p_as_of: asOf,
      p_contract_version: 'FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1',
    } as never);
    if (error) throw error;
    return data as AccountingSemanticGlMapRow[];
  }

  it('saves tenant-selected accounts and preserves historical effective dating', async () => {
    const first = await saveMapping('5112', '2026-01-01');
    expect(first.error).toBeNull();

    const second = await saveMapping('5111', '2027-01-01');
    expect(second.error).toBeNull();

    const rows2026 = await readMap('2026-06-30');
    const rows2027 = await readMap('2027-06-30');

    expect(rows2026).toHaveLength(1);
    expect(rows2026[0]).toMatchObject({
      semantic_key: 'GOODS_REVENUE',
      gl_account_code: '5112',
      authority_version: 'TENANT_CONFIG:UI:v1',
    });
    expect(rows2027).toHaveLength(1);
    expect(rows2027[0].gl_account_code).toBe('5111');
  });

  it('rejects account codes that are not active tenant GL accounts', async () => {
    const result = await saveMapping('5999', '2028-01-01');

    expect(result.error).not.toBeNull();
    expect(result.error!.message).toContain('ACCOUNTING_SEMANTIC_CONFIG_INVALID_ACCOUNT');
  });

  it('rejects account codes that only exist in another tenant', async () => {
    const beforeRows = await readMap('2027-06-30');
    const result = await saveMapping('5999', '2028-01-01');
    const afterRows = await readMap('2027-06-30');

    expect(result.error).not.toBeNull();
    expect(result.error!.message).toContain('ACCOUNTING_SEMANTIC_CONFIG_INVALID_ACCOUNT');
    expect(afterRows).toEqual(beforeRows);
  });

  it('rejects inserts before an existing future schedule without mutating history', async () => {
    const before2026 = await readMap('2026-06-30');
    const before2027 = await readMap('2027-06-30');

    const result = await saveMapping('5112', '2026-06-01');

    const after2026 = await readMap('2026-06-30');
    const after2027 = await readMap('2027-06-30');

    expect(result.error).not.toBeNull();
    expect(result.error!.message).toContain('ACCOUNTING_SEMANTIC_CONFIG_FUTURE_MAPPING_EXISTS');
    expect(after2026).toEqual(before2026);
    expect(after2027).toEqual(before2027);
  });

  it('rejects direct overlapping mapping writes for the same tenant and semantic', async () => {
    const { error } = await supabase
      .from('finance_control_account_mappings')
      .insert({
        tenant_id: tenantId,
        control_type: 'GOODS_REVENUE',
        account_code: '5112',
        effective_from: '2026-12-01',
        effective_to: '2027-12-31',
        authority_version: 'TENANT_CONFIG:UI:v1',
      } as never);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('ACCOUNTING_SEMANTIC_MAPPING_OVERLAP');
  });
});
