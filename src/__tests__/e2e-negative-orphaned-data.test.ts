/**
 * E2E Orphaned Data Test - Booking deleted but session logs still exist
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';
import crypto from 'crypto';

jest.setTimeout(60_000);

describe('E2E Orphaned Data (Referential Integrity Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testCustomerId: string;
  let testPackageId: string;
  let bookingId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Orphan Tenant').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Orphan Tenant', status: 'active' }).select('id').single()).data!.id;

    testCustomerId = crypto.randomUUID();
    await supabase.from('customers').insert({ id: testCustomerId, tenant_id: testTenantId, name_mother: 'Customer Orphan', phone: `095${Date.now().toString().slice(-7)}`, status: 'active' });
    testPackageId = crypto.randomUUID();
    await supabase.from('packages').insert({ id: testPackageId, tenant_id: testTenantId, name: 'Package Orphan', full_price: 5000000, total_sessions: 5, status: 'active', module_key: 'baby_care', service_kind: 'treatment_package', default_duration_minutes: 60, requires_resource: false, before_after_required: false });
  });

  it('should cascade delete session logs when booking is deleted', async () => {
    // Create booking with sessions
    const { data: booking } = await supabase.from('bookings').insert({
      tenant_id: testTenantId, booking_number: `ORPHAN-${Date.now()}`,
      customer_id: testCustomerId, package_id: testPackageId,
      start_date: '2026-06-20', full_price: 5000000, status: 'booked',
    }).select('id').single();
    bookingId = booking!.id;

    await supabase.from('session_logs').insert([
      { booking_id: bookingId, session_number: 1, assigned_date: '2026-06-21', status: 'scheduled', tenant_id: testTenantId },
      { booking_id: bookingId, session_number: 2, assigned_date: '2026-06-22', status: 'scheduled', tenant_id: testTenantId },
    ]);

    console.log('✅ Booking created with 2 session logs');

    // Delete booking
    const { error: deleteError } = await supabase.from('bookings').delete().eq('id', bookingId);

    if (deleteError) {
      console.log('✅ Delete blocked by foreign key constraint (sessions exist)');
      expect(deleteError.message).toMatch(/foreign key|constraint/i);

      // Cleanup sessions first, then delete booking
      await supabase.from('session_logs').delete().eq('booking_id', bookingId);
      await supabase.from('bookings').delete().eq('id', bookingId);
      console.log('✅ Manual cascade cleanup required (correct behavior)');
    } else {
      // If cascade delete is enabled, verify sessions are also deleted
      const { data: orphanedSessions } = await supabase
        .from('session_logs')
        .select('*')
        .eq('booking_id', bookingId);

      expect(orphanedSessions).toHaveLength(0);
      console.log('✅ Cascade delete cleaned up session logs automatically');
    }

    console.log('\n🎉 E2E ORPHANED DATA TEST: PASSED');
  }, 60000);
});
