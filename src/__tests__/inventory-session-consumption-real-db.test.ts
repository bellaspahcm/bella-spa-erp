import { randomUUID } from 'node:crypto';

import { createClient as createSupabaseClient, type SupabaseClient } from '@supabase/supabase-js';

import { completeSession } from '@/core/services/order';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import { createAuthenticatedClient } from '../../tests/utils/test-jwt-helper';

jest.mock('server-only', () => ({}), { virtual: true });

type CurrentUserStub = {
  id: string;
  email: string;
  full_name: string;
  role: string;
  status: string;
  tenant_id: string;
};

let mockCurrentUser: CurrentUserStub | null = null;

jest.mock('@/services/user-actions', () => ({
  getCurrentUser: jest.fn(async () => mockCurrentUser),
}));

jest.setTimeout(90_000);

type SeedClient = SupabaseClient<Database>;

const hasRealSupabaseAdminEnv = () => {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const adminKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  return Boolean(
    url
    && adminKey
    && !url.includes('mock.supabase.co')
    && adminKey !== 'mock-service-role-key',
  );
};

const describeWithRealSupabase = hasRealSupabaseAdminEnv() ? describe : describe.skip;

describeWithRealSupabase('Inventory session consumption Real DB proof', () => {
  const marker = `inventory-real-db-proof-${Date.now()}`;
  const adminUserId = '11111111-1111-4111-8111-111111111196';
  const otherUserId = '22222222-2222-4222-8222-222222222196';
  const customerId = randomUUID();
  const packageId = randomUUID();
  const bookingId = randomUUID();
  const sessionId = randomUUID();
  const unauthorizedSessionId = randomUUID();
  const itemId = randomUUID();
  const today = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Ho_Chi_Minh',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
  const lastDayOfMonth = new Date(Number(today.slice(0, 4)), Number(today.slice(5, 7)), 0)
    .getDate()
    .toString()
    .padStart(2, '0');

  let supabase: SeedClient;
  let tenantId: string;
  let otherTenantId: string;

  async function ensureTenant(name: string) {
    const existing = await supabase
      .from('tenants')
      .select('id')
      .eq('name', name)
      .maybeSingle();
    if (existing.error) throw new Error(`tenant lookup failed: ${existing.error.message}`);
    if (existing.data?.id) return existing.data.id;

    const created = await supabase
      .from('tenants')
      .insert({
        name,
        status: 'active',
        enabled_modules: [],
        salary_config: { auto_consume_inventory: true },
      })
      .select('id')
      .single();
    if (created.error || !created.data) {
      throw new Error(`tenant create failed: ${created.error?.message || 'missing tenant id'}`);
    }
    return created.data.id;
  }

  async function cleanupStep(label: string, result: PromiseLike<{ error: { message: string } | null }>) {
    const { error } = await result;
    if (error) throw new Error(`${label} cleanup failed: ${error.message}`);
  }

  async function cleanup() {
    await cleanupStep('accounting_outbox', supabase.from('accounting_outbox').delete().eq('tenant_id', tenantId));
    await cleanupStep('session_reviews', supabase.from('session_reviews').delete().eq('tenant_id', tenantId));
    await cleanupStep('inventory_logs', supabase.from('inventory_logs').delete().eq('tenant_id', tenantId));
    await cleanupStep('package_materials', supabase.from('package_materials').delete().eq('tenant_id', tenantId));
    await cleanupStep('session_logs', supabase.from('session_logs').delete().in('id', [sessionId, unauthorizedSessionId]));
    await cleanupStep('bookings', supabase.from('bookings').delete().eq('id', bookingId));
    await cleanupStep('customers', supabase.from('customers').delete().eq('id', customerId));
    await cleanupStep('inventory_items', supabase.from('inventory_items').delete().eq('id', itemId));
    await cleanupStep('accounting_periods', supabase.from('accounting_periods').delete().eq('tenant_id', tenantId));
  }

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
    tenantId = await ensureTenant('Inventory Real DB Proof Tenant');
    otherTenantId = await ensureTenant('Inventory Real DB Proof Other Tenant');
    await cleanup();
  });

  afterAll(async () => {
    await cleanup();
    mockCurrentUser = null;
  });

  it('proves complete session auto-consumes package materials and RLS isolates inventory rows', async () => {
    const tenantInsert = await supabase
      .from('tenants')
      .update({
        status: 'active',
        enabled_modules: [],
        salary_config: { auto_consume_inventory: true },
      })
      .in('id', [tenantId, otherTenantId]);
    expect(tenantInsert.error).toBeNull();

    const userInsert = await supabase.from('users').upsert([
      {
        id: adminUserId,
        tenant_id: tenantId,
        email: 'inventory-real-db-proof-admin@example.test',
        full_name: 'Inventory Proof Admin',
        role: 'admin',
        status: 'active',
      },
      {
        id: otherUserId,
        tenant_id: otherTenantId,
        email: 'inventory-real-db-proof-other@example.test',
        full_name: 'Inventory Proof Other Admin',
        role: 'admin',
        status: 'active',
      },
    ], { onConflict: 'id' });
    expect(userInsert.error).toBeNull();

    mockCurrentUser = {
      id: adminUserId,
      tenant_id: tenantId,
      email: 'inventory-real-db-proof-admin@example.test',
      full_name: 'Inventory Proof Admin',
      role: 'admin',
      status: 'active',
    };

    const accountingPeriodInsert = await supabase.from('accounting_periods').insert({
      tenant_id: tenantId,
      name: `${marker}-open-period`,
      start_date: `${today.slice(0, 7)}-01`,
      end_date: `${today.slice(0, 7)}-${lastDayOfMonth}`,
      status: 'OPEN',
    });
    expect(accountingPeriodInsert.error).toBeNull();

    const fixtureInsert = await supabase.from('customers').insert({
      id: customerId,
      tenant_id: tenantId,
      name_mother: 'Inventory Proof Customer',
      phone: `09${Date.now().toString().slice(-8)}`,
      status: 'active',
    });
    expect(fixtureInsert.error).toBeNull();

    const packageInsert = await supabase.from('packages').insert({
      id: packageId,
      tenant_id: tenantId,
      name: `${marker} service package`,
      module_key: 'beauty_spa',
      service_kind: 'treatment_package',
      status: 'active',
      full_price: 1000000,
      price: 1000000,
      total_sessions: 2,
      default_duration_minutes: 60,
    });
    expect(packageInsert.error).toBeNull();

    const bookingInsert = await supabase.from('bookings').insert({
      id: bookingId,
      tenant_id: tenantId,
      booking_number: `INV-PROOF-${Date.now()}`,
      customer_id: customerId,
      package_id: packageId,
      package_name: `${marker} service package`,
      assigned_ktv_id: adminUserId,
      start_date: today,
      full_price: 1000000,
      deposit_amount: 0,
      discount_percent: 0,
      status: 'booked',
      total_sessions: 2,
      completed_sessions: 0,
    });
    expect(bookingInsert.error).toBeNull();

    const sessionInsert = await supabase.from('session_logs').insert({
      id: sessionId,
      tenant_id: tenantId,
      booking_id: bookingId,
      session_number: 1,
      assigned_date: today,
      status: 'scheduled',
    });
    expect(sessionInsert.error).toBeNull();

    const itemInsert = await supabase.from('inventory_items').insert({
      id: itemId,
      tenant_id: tenantId,
      name: `${marker} material`,
      sku: `${marker}-sku`,
      unit: 'unit',
      stock_level: 10,
      min_stock_level: 1,
      price_per_unit: 0,
      category: 'test-proof',
    });
    expect(itemInsert.error).toBeNull();

    const materialInsert = await supabase.from('package_materials').insert({
      tenant_id: tenantId,
      package_id: packageId,
      item_id: itemId,
      quantity_per_session: 2,
    });
    expect(materialInsert.error).toBeNull();

    const before = await supabase
      .from('inventory_items')
      .select('stock_level')
      .eq('id', itemId)
      .single();
    expect(before.error).toBeNull();
    expect(before.data?.stock_level).toBe(10);

    const result = await completeSession(sessionId, bookingId, 'Inventory Real DB proof');
    expect(result).toEqual({ success: true });

    const after = await supabase
      .from('inventory_items')
      .select('stock_level')
      .eq('id', itemId)
      .single();
    expect(after.error).toBeNull();
    expect(after.data?.stock_level).toBe(8);

    const logs = await supabase
      .from('inventory_logs')
      .select('id, item_id, session_log_id, change_amount, reason, tenant_id')
      .eq('tenant_id', tenantId)
      .eq('item_id', itemId)
      .eq('session_log_id', sessionId)
      .eq('reason', 'session_consumption');
    expect(logs.error).toBeNull();
    expect(logs.data).toHaveLength(1);
    expect(logs.data?.[0]).toMatchObject({
      item_id: itemId,
      session_log_id: sessionId,
      change_amount: -2,
      reason: 'session_consumption',
      tenant_id: tenantId,
    });

    const completedSession = await supabase
      .from('session_logs')
      .select('status, completed_by_ktv_id, tenant_id')
      .eq('id', sessionId)
      .single();
    expect(completedSession.error).toBeNull();
    expect(completedSession.data).toMatchObject({
      status: 'completed',
      completed_by_ktv_id: adminUserId,
      tenant_id: tenantId,
    });

    mockCurrentUser = {
      id: otherUserId,
      tenant_id: otherTenantId,
      email: 'inventory-real-db-proof-other@example.test',
      full_name: 'Inventory Proof Other Admin',
      role: 'admin',
      status: 'active',
    };
    const crossTenantCompletion = await completeSession(sessionId, bookingId, 'Cross tenant completion proof');
    expect(crossTenantCompletion).toHaveProperty('error');
    expect(crossTenantCompletion).not.toHaveProperty('success');

    if (process.env.SUPABASE_JWT_SECRET && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY) {
      const tenantClient = createAuthenticatedClient(tenantId, adminUserId) as SupabaseClient<Database>;
      const otherTenantClient = createAuthenticatedClient(otherTenantId, otherUserId) as SupabaseClient<Database>;

      const visibleToOwner = await tenantClient
        .from('inventory_items')
        .select('id, stock_level, tenant_id')
        .eq('id', itemId);
      expect(visibleToOwner.error).toBeNull();
      expect(visibleToOwner.data).toHaveLength(1);
      expect(visibleToOwner.data?.[0]).toMatchObject({
        id: itemId,
        stock_level: 8,
        tenant_id: tenantId,
      });

      const hiddenFromOtherTenant = await otherTenantClient
        .from('inventory_items')
        .select('id')
        .eq('id', itemId);
      expect(hiddenFromOtherTenant.error).toBeNull();
      expect(hiddenFromOtherTenant.data).toEqual([]);

      const otherTenantUpdate = await otherTenantClient
        .from('inventory_items')
        .update({ stock_level: 99 })
        .eq('id', itemId)
        .select('id');
      expect(otherTenantUpdate.error).toBeNull();
      expect(otherTenantUpdate.data).toEqual([]);
    }

    mockCurrentUser = {
      id: adminUserId,
      tenant_id: tenantId,
      email: 'inventory-real-db-proof-admin@example.test',
      full_name: 'Inventory Proof Admin',
      role: 'ktv',
      status: 'active',
    };
    const unauthorizedSessionInsert = await supabase.from('session_logs').insert({
      id: unauthorizedSessionId,
      tenant_id: tenantId,
      booking_id: bookingId,
      session_number: 2,
      assigned_date: today,
      status: 'cancelled',
    });
    expect(unauthorizedSessionInsert.error).toBeNull();

    const permissionCheck = await completeSession(unauthorizedSessionId, bookingId, 'Unauthorized completion proof');
    expect(permissionCheck).toEqual({
      error: 'Bạn không có quyền thực hiện thao tác này (Unauthorized)',
    });
  });
});
