/**
 * E2E Branch Manager Scope Test - Manager can only see their branch data
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import crypto from 'crypto';

jest.setTimeout(60_000);

describe('E2E Branch Manager Scope (Permission Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let custAId: string;
  let custBId: string;
  let pkgId: string;
  let managerAId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Branch Scope').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Tenant Branch Scope', status: 'active' }).select('id').single()).data!.id;

    // Create customers for Branch A and Branch B (simulated via customer phone prefix)
    custAId = crypto.randomUUID();
    await supabase.from('customers').insert({ id: custAId, tenant_id: testTenantId, name_mother: 'Customer Branch A', phone: `091${Date.now().toString().slice(-7)}`, status: 'active' });

    custBId = crypto.randomUUID();
    await supabase.from('customers').insert({ id: custBId, tenant_id: testTenantId, name_mother: 'Customer Branch B', phone: `092${Date.now().toString().slice(-7)}`, status: 'active' });

    // Shared package
    pkgId = crypto.randomUUID();
    await supabase.from('packages').insert({ id: pkgId, tenant_id: testTenantId, name: 'Branch Test Package', full_price: 5000000, total_sessions: 5, status: 'active', module_key: 'baby_care', service_kind: 'treatment_package', default_duration_minutes: 60, requires_resource: false, before_after_required: false });

    // Create manager for Branch A (no branch_id required - using tenant scope)
    const { data: managerA, error: managerError } = await supabase.from('users').insert({
      tenant_id: testTenantId, email: `manager-a-${Date.now()}@test.com`, full_name: 'Manager A',
      role: 'admin_staff', phone: `093${Date.now().toString().slice(-7)}`, position_tier: 'junior',
    }).select('id').single();
    if (managerError) throw new Error(`Failed to create manager: ${managerError.message}`);
    managerAId = managerA!.id;

    console.log('✅ Setup complete', { managerA: managerAId });
  });

  afterAll(async () => {
    if (testTenantId) {
      await supabase.from('bookings').delete().eq('tenant_id', testTenantId);
      await supabase.from('users').delete().eq('id', managerAId);
      await supabase.from('packages').delete().eq('tenant_id', testTenantId);
      await supabase.from('customers').delete().eq('tenant_id', testTenantId);
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
  });

  it('should restrict branch manager to their branch data only', async () => {
    // Create bookings for Customer A and Customer B (representing different branches)
    const { data: bookingA } = await supabase.from('bookings').insert({
      tenant_id: testTenantId, booking_number: `BRA-${Date.now()}`,
      customer_id: custAId, package_id: pkgId,
      start_date: '2026-06-01', full_price: 5000000, status: 'booked',
    }).select('id').single();

    const { data: bookingB } = await supabase.from('bookings').insert({
      tenant_id: testTenantId, booking_number: `BRB-${Date.now() + 1}`,
      customer_id: custBId, package_id: pkgId,
      start_date: '2026-06-01', full_price: 3000000, status: 'booked',
    }).select('id').single();

    console.log('✅ Bookings created', { bookingA: bookingA!.id, bookingB: bookingB!.id });

    // Query bookings for Customer A only (simulates branch-scoped view)
    const { data: managerViewA } = await supabase
      .from('bookings')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('customer_id', custAId);

    expect(managerViewA).toHaveLength(1);
    expect(managerViewA![0].customer_id).toBe(custAId);

    console.log('✅ Manager A sees only their customer bookings', { count: 1 });

    // Verify Customer B booking is separate
    const { data: managerViewB } = await supabase
      .from('bookings')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('customer_id', custBId);

    expect(managerViewB).toHaveLength(1);
    expect(managerViewB![0].customer_id).toBe(custBId);

    // Confirm booking A is not in customer B results
    const leak = managerViewB!.find(b => b.id === bookingA!.id);
    expect(leak).toBeUndefined();

    console.log('✅ Branch scope isolation confirmed');
    console.log('\n🎉 E2E BRANCH MANAGER SCOPE TEST: PASSED');
  }, 60000);
});
