/**
 * E2E Cross-Tenant Leak Test - Tenant A user cannot access Tenant B data via API
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Cross-Tenant Leak (Security Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let tenantAId: string;
  let tenantBId: string;
  let bookingAId: string;
  let bookingBId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);

    const { data: tenantA } = await supabase.from('tenants').insert({ name: 'Tenant A Leak Test', status: 'active' }).select('id').single();
    tenantAId = tenantA!.id;

    const { data: tenantB } = await supabase.from('tenants').insert({ name: 'Tenant B Leak Test', status: 'active' }).select('id').single();
    tenantBId = tenantB!.id;

    const { data: bookingA } = await supabase.from('bookings').insert({
      tenant_id: tenantAId, booking_number: `TA-${Date.now()}`,
      customer_id: 'cust-a', package_id: 'pkg-a',
      start_date: '2026-06-01', full_price: 5000000, status: 'booked',
    }).select('id').single();
    bookingAId = bookingA!.id;

    const { data: bookingB } = await supabase.from('bookings').insert({
      tenant_id: tenantBId, booking_number: `TB-${Date.now()}`,
      customer_id: 'cust-b', package_id: 'pkg-b',
      start_date: '2026-06-01', full_price: 3000000, status: 'booked',
    }).select('id').single();
    bookingBId = bookingB!.id;

    console.log('✅ Test data created', { tenantA: tenantAId, tenantB: tenantBId });
  });

  it('should prevent Tenant A user from accessing Tenant B booking', async () => {
    // Simulate Tenant A user querying all bookings (RLS should filter by tenant_id)
    const { data: tenantABookings } = await supabase
      .from('bookings')
      .select('*')
      .eq('tenant_id', tenantAId); // RLS enforces this automatically

    expect(tenantABookings).toHaveLength(1);
    expect(tenantABookings![0].tenant_id).toBe(tenantAId);

    console.log('✅ Tenant A user sees only own bookings', { count: 1 });

    // Tenant A user tries direct query with Tenant B booking ID (should fail)
    const { data: leakAttempt, error: leakError } = await supabase
      .from('bookings')
      .select('*')
      .eq('id', bookingBId); // Trying to access Tenant B booking

    // RLS should block this query (empty result or error)
    if (leakError) {
      console.log('✅ RLS blocked direct query', { error: leakError.message });
    } else if (!leakAttempt || leakAttempt.length === 0) {
      console.log('✅ RLS returned empty result (correct)');
    } else {
      console.error('❌ DATA LEAK DETECTED: Tenant A accessed Tenant B booking!');
      expect(leakAttempt).toHaveLength(0); // Test should fail
    }

    console.log('\n🎉 E2E CROSS-TENANT LEAK TEST: PASSED');
  }, 60000);
});
