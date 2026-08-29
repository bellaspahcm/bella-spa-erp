/**
 * F4 Prepayment GL Map Contract Tests
 *
 * Verifies tenant-configured, effective-dated PREPAYMENT_CONTROL mapping.
 * Bella does not hardcode 331P, 242, or any universal prepayment account code.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(45000);

type PrepaymentGlMapRow = {
  tenant_id: string;
  control_key: string;
  gl_account_id: string;
  gl_account_code: string;
  effective_from: string;
  effective_to: string | null;
};

describe('F4_PREPAYMENT_GL_MAP:v1 Contract', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  const runId = Date.now().toString(36).toUpperCase();
  let tenantAId: string;
  let tenantBId: string;
  let tenantCId: string;
  let tenantDId: string;
  let account331PId: string;
  let account242Id: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);

    tenantAId = await createTenant(`F4-PP-MAP-331P-${runId}`);
    tenantBId = await createTenant(`F4-PP-MAP-242-${runId}`);
    tenantCId = await createTenant(`F4-PP-MAP-HIST-${runId}`);
    tenantDId = await createTenant(`F4-PP-MAP-NONE-${runId}`);

    account331PId = await createAccount(tenantAId, '331P');
    account242Id = await createAccount(tenantBId, '242');
    await createAccount(tenantCId, '331P');
    await createAccount(tenantCId, '242');

    await createMapping(tenantAId, '331P', '2026-01-01', null);
    await createMapping(tenantBId, '242', '2026-01-01', null);
    await createMapping(tenantCId, '331P', '2026-01-01', '2026-12-31');
    await createMapping(tenantCId, '242', '2027-01-01', null);
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
        name: `Prepayment ${code}`,
        type: 'ASSET',
        normal_balance: 'DEBIT',
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
        control_type: 'PREPAYMENT_CONTROL',
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

  async function readMap(tenantId: string, asOf: string): Promise<PrepaymentGlMapRow[]> {
    const { data, error } = await supabase.rpc('finance_get_prepayment_gl_map_as_of' as never, {
      p_tenant_id: tenantId,
      p_as_of: asOf,
      p_contract_version: 'F4_PREPAYMENT_GL_MAP:v1',
    } as never);
    if (error) throw error;
    return data as PrepaymentGlMapRow[];
  }

  it('returns tenant-configured 331P mapping without making 331P a platform default', async () => {
    const rows = await readMap(tenantAId, '2026-06-30');

    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      tenant_id: tenantAId,
      control_key: 'PREPAYMENT_CONTROL',
      gl_account_id: account331PId,
      gl_account_code: '331P',
      effective_from: '2026-01-01',
      effective_to: null,
    });
  });

  it('returns tenant-configured 242 mapping for another tenant', async () => {
    const rows = await readMap(tenantBId, '2026-06-30');

    expect(rows).toHaveLength(1);
    expect(rows[0].gl_account_id).toBe(account242Id);
    expect(rows[0].gl_account_code).toBe('242');
  });

  it('resolves historical mappings deterministically by as_of date', async () => {
    const rows2026 = await readMap(tenantCId, '2026-06-30');
    const rows2027 = await readMap(tenantCId, '2027-06-30');

    expect(rows2026).toHaveLength(1);
    expect(rows2026[0].gl_account_code).toBe('331P');
    expect(rows2027).toHaveLength(1);
    expect(rows2027[0].gl_account_code).toBe('242');
  });

  it('does not fallback to a hardcoded account when PREPAYMENT_CONTROL is unconfigured', async () => {
    await createAccount(tenantDId, '331P');
    await createAccount(tenantDId, '242');

    const rows = await readMap(tenantDId, '2026-06-30');
    const { data: resolverValue, error } = await supabase.rpc('finance_get_control_account' as never, {
      p_tenant_id: tenantDId,
      p_control_type: 'PREPAYMENT_CONTROL',
      p_as_of: '2026-06-30',
    } as never);

    expect(error).toBeNull();
    expect(rows).toHaveLength(0);
    expect(resolverValue).toBeNull();
  });
  it('rejects overlapping PREPAYMENT_CONTROL effective ranges for the same tenant', async () => {
    const { error } = await supabase
      .from('finance_control_account_mappings')
      .insert({
        tenant_id: tenantCId,
        control_type: 'PREPAYMENT_CONTROL',
        account_code: '242',
        effective_from: '2026-06-01',
        effective_to: '2026-12-31',
        authority_version: 'TENANT_CONFIG:v1',
      } as never);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('PREPAYMENT_CONTROL_MAPPING_OVERLAP');
  });


  it('rejects unknown contract versions', async () => {
    const { error } = await supabase.rpc('finance_get_prepayment_gl_map_as_of' as never, {
      p_tenant_id: tenantAId,
      p_as_of: '2026-06-30',
      p_contract_version: 'F4_PREPAYMENT_GL_MAP:v2',
    } as never);

    expect(error).not.toBeNull();
    expect(error!.message).toContain('UNKNOWN_CONTRACT_VERSION');
  });
});