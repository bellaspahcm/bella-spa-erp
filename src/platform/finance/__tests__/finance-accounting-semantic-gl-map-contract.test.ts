/**
 * FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1 Contract Tests
 *
 * Verifies tenant-configured, effective-dated SERVICE_REVENUE mapping.
 * Bella does not hardcode 5111, 5113, or any universal revenue account code.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(45000);

type AccountingSemanticGlMapRow = {
  tenant_id: string;
  semantic_key: string;
  gl_account_id: string;
  gl_account_code: string;
  effective_from: string;
  effective_to: string | null;
  authority_version: string;
};

describe('FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1 Contract', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  const runId = Date.now().toString(36).toUpperCase();
  let tenantAId: string;
  let tenantBId: string;
  let tenantCId: string;
  let tenantDId: string;
  let account5113Id: string;
  let account5111Id: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);

    tenantAId = await createTenant(`FIN-SEM-REV-5113-${runId}`);
    tenantBId = await createTenant(`FIN-SEM-REV-5111-${runId}`);
    tenantCId = await createTenant(`FIN-SEM-REV-HIST-${runId}`);
    tenantDId = await createTenant(`FIN-SEM-REV-NONE-${runId}`);

    account5113Id = await createAccount(tenantAId, '5113');
    account5111Id = await createAccount(tenantBId, '5111');
    await createAccount(tenantCId, '5113');
    await createAccount(tenantCId, '5111');
    await createAccount(tenantDId, '5113');

    await createMapping(tenantAId, '5113', '2026-01-01', null);
    await createMapping(tenantBId, '5111', '2026-01-01', null);
    await createMapping(tenantCId, '5113', '2026-01-01', '2026-12-31');
    await createMapping(tenantCId, '5111', '2027-01-01', null);
  });

  afterAll(async () => {
    await cleanupTenant(tenantAId);
    await cleanupTenant(tenantBId);
    await cleanupTenant(tenantCId);
    await cleanupTenant(tenantDId);
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

  async function createAccount(tenantId: string, code: string): Promise<string> {
    const { data, error } = await supabase
      .from('finance_accounts' as unknown as 'tenants')
      .insert({
        tenant_id: tenantId,
        code,
        name: `Revenue ${code}`,
        type: 'REVENUE',
        normal_balance: 'CREDIT',
        currency: 'VND',
        is_active: true,
      })
      .select('id')
      .single();
    if (error || !data) throw error ?? new Error(`Account ${code} creation failed`);
    return String(data.id);
  }

  async function createMapping(
    tenantId: string,
    accountCode: string,
    effectiveFrom: string,
    effectiveTo: string | null,
  ): Promise<void> {
    const { error } = await supabase
      .from('finance_control_account_mappings')
      .insert({
        tenant_id: tenantId,
        control_type: 'SERVICE_REVENUE',
        account_code: accountCode,
        effective_from: effectiveFrom,
        effective_to: effectiveTo,
        authority_version: 'TENANT_CONFIG:v1',
      } as never);
    if (error) throw error;
  }

  async function cleanupTenant(tenantId: string | undefined): Promise<void> {
    if (!tenantId) return;
    try { await supabase.from('finance_control_account_mappings').delete().eq('tenant_id', tenantId); } catch (e) {}
    try { await supabase.from('finance_accounts' as unknown as 'tenants').delete().eq('tenant_id' as unknown as 'id', tenantId); } catch (e) {}
    try { await supabase.from('tenants').delete().eq('id', tenantId); } catch (e) {}
  }

  async function readMap(tenantId: string, asOf: string, semanticKey = 'SERVICE_REVENUE'): Promise<AccountingSemanticGlMapRow[]> {
    const { data, error } = await supabase.rpc('finance_get_accounting_semantic_gl_map_as_of' as never, {
      p_tenant_id: tenantId,
      p_semantic_key: semanticKey,
      p_as_of: asOf,
      p_contract_version: 'FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1',
    } as never);
    if (error) throw error;
    return data as AccountingSemanticGlMapRow[];
  }

  it('returns tenant-configured 5113 mapping without making 5113 a platform default', async () => {
    const rows = await readMap(tenantAId, '2026-06-30');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenant_id: tenantAId,
      semantic_key: 'SERVICE_REVENUE',
      gl_account_id: account5113Id,
      gl_account_code: '5113',
      effective_from: '2026-01-01',
      effective_to: null,
      authority_version: 'TENANT_CONFIG:v1',
    });
  });

  it('returns tenant-configured 5111 mapping for another tenant', async () => {
    const rows = await readMap(tenantBId, '2026-06-30');

    expect(rows).toHaveLength(1);
    expect(rows[0].gl_account_id).toBe(account5111Id);
    expect(rows[0].gl_account_code).toBe('5111');
  });

  it('resolves historical mappings deterministically by as_of date', async () => {
    const rows2026 = await readMap(tenantCId, '2026-06-30');
    const rows2027 = await readMap(tenantCId, '2027-06-30');

    expect(rows2026).toHaveLength(1);
    expect(rows2026[0].gl_account_code).toBe('5113');
    expect(rows2027).toHaveLength(1);
    expect(rows2027[0].gl_account_code).toBe('5111');
  });

  it('does not fallback to a hardcoded account when SERVICE_REVENUE is unconfigured', async () => {
    const rows = await readMap(tenantDId, '2026-06-30');

    expect(rows).toHaveLength(0);
  });

  it('rejects overlapping SERVICE_REVENUE effective ranges for the same tenant', async () => {
    const { error } = await supabase
      .from('finance_control_account_mappings')
      .insert({
        tenant_id: tenantCId,
        control_type: 'SERVICE_REVENUE',
        account_code: '5111',
        effective_from: '2026-06-01',
        effective_to: '2026-12-31',
        authority_version: 'TENANT_CONFIG:v1',
      } as never);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('ACCOUNTING_SEMANTIC_MAPPING_OVERLAP');
  });

  it('rejects unsupported semantics during the v1 pilot', async () => {
    const { error } = await supabase.rpc('finance_get_accounting_semantic_gl_map_as_of' as never, {
      p_tenant_id: tenantAId,
      p_semantic_key: 'GOODS_REVENUE',
      p_as_of: '2026-06-30',
      p_contract_version: 'FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v1',
    } as never);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('ACCOUNTING_SEMANTIC_GL_MAP_UNSUPPORTED_SEMANTIC');
  });

  it('rejects unknown contract versions', async () => {
    const { error } = await supabase.rpc('finance_get_accounting_semantic_gl_map_as_of' as never, {
      p_tenant_id: tenantAId,
      p_semantic_key: 'SERVICE_REVENUE',
      p_as_of: '2026-06-30',
      p_contract_version: 'FINANCE_ACCOUNTING_SEMANTIC_GL_MAP:v2',
    } as never);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('UNKNOWN_CONTRACT_VERSION');
  });
});
