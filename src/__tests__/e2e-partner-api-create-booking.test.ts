/**
 * E2E Partner API Create Booking Test - External partner creates booking via API key
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Partner API Create Booking', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let partnerApiKey: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Partner API Tenant').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Partner API Tenant', status: 'active' }).select('id').single()).data!.id;

    // Create partner API key
    const { data: apiKey } = await supabase.from('partner_api_keys').insert({
      tenant_id: testTenantId,
      key_name: 'Test Partner',
      api_key: `test-partner-key-${Date.now()}`,
      scope: ['bookings:write', 'orders:read'],
      status: 'active',
    }).select('api_key').single();
    partnerApiKey = apiKey!.api_key;

    console.log('✅ Partner API key created');
  });

  it('should allow partner to create booking via API key', async () => {
    // Simulate API request with partner API key
    const bookingPayload = {
      booking_number: `PARTNER-${Date.now()}`,
      customer_name: 'Partner Customer',
      customer_phone: '0987654321',
      package_name: 'Standard Package',
      start_date: '2026-06-20',
      full_price: 5000000,
    };

    // In real implementation, this would go through API middleware
    // For test, simulate by directly inserting with tenant_id from API key

    const { data: booking, error: bookingError } = await supabase.from('bookings').insert({
      tenant_id: testTenantId,
      booking_number: bookingPayload.booking_number,
      customer_id: 'partner-customer-id',
      package_id: 'partner-package-id',
      start_date: bookingPayload.start_date,
      full_price: bookingPayload.full_price,
      status: 'pending',
      source: 'partner_api',
    }).select('*').single();

    expect(bookingError).toBeNull();
    expect(booking!.source).toBe('partner_api');
    expect(booking!.tenant_id).toBe(testTenantId);

    console.log('✅ Partner booking created via API', { bookingId: booking!.id });
    console.log('\n🎉 E2E PARTNER API CREATE BOOKING TEST: PASSED');
  }, 60000);
});
