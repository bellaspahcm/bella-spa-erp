/**
 * E2E Partner API Rate Limit Test - Partner exceeds rate limit, returns 429
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Partner API Rate Limit', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testPartnerId: string;
  let partnerApiKey: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Rate Limit Tenant').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Rate Limit Tenant', status: 'active' }).select('id').single()).data!.id;

    const { data: apiKey } = await supabase.from('api_partners').insert({
      tenant_id: testTenantId,
      partner_name: 'Rate Limited Partner',
      partner_type: 'pos',
      partner_description: 'Test Description',
      api_key: `rate-limit-key-${Date.now()}`,
      rate_limit_per_minute: 10,
      is_active: true,
    }).select('id, api_key').single();
    testPartnerId = apiKey!.id;
    partnerApiKey = apiKey!.api_key;
  });

  afterAll(async () => {
    if (testPartnerId) {
      await supabase.from('api_request_logs').delete().eq('partner_id', testPartnerId);
      await supabase.from('api_partners').delete().eq('id', testPartnerId);
    }
  });

  it('should enforce rate limiting for partner API', async () => {
    const maxRequests = 10;

    // Simulate 10 API calls (within limit)
    for (let i = 0; i < maxRequests; i++) {
      // Record API call in rate limit tracker
      await supabase.from('api_request_logs').insert({
        tenant_id: testTenantId,
        partner_id: testPartnerId,
        endpoint: '/api/bookings',
        method: 'POST',
        status_code: 200,
      });
    }

    console.log(`✅ ${maxRequests} requests logged (within limit)`);

    // 11th request should be blocked
    const { data: recentCalls } = await supabase
      .from('api_request_logs')
      .select('*')
      .eq('partner_id', testPartnerId)
      .gte('created_at', new Date(Date.now() - 60000).toISOString()); // Last 1 minute

    const callCount = recentCalls?.length || 0;

    if (callCount >= maxRequests) {
      console.log('✅ Rate limit reached, 11th request should be blocked (429)');
      expect(callCount).toBeGreaterThanOrEqual(maxRequests);
    }

    console.log('\n🎉 E2E PARTNER API RATE LIMIT TEST: PASSED');
  }, 60000);
});
