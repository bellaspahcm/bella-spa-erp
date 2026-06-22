/**
 * E2E Concurrent Session Completion Test - 2 KTVs try to complete same session simultaneously
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

describe('E2E Concurrent Session Completion (Race Condition Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let sessionId: string;
  let ktvAId: string;
  let ktvBId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Concurrent Tenant').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Concurrent Tenant', status: 'active' }).select('id').single()).data!.id;

    const { data: ktvA } = await supabase.from('users').insert({
      tenant_id: testTenantId, email: `ktv-a-concurrent-${Date.now()}@test.com`,
      full_name: 'KTV A', role: 'ktv', phone: '0900000040', base_salary: 6000000,
    }).select('id').single();
    ktvAId = ktvA!.id;

    const { data: ktvB } = await supabase.from('users').insert({
      tenant_id: testTenantId, email: `ktv-b-concurrent-${Date.now()}@test.com`,
      full_name: 'KTV B', role: 'ktv', phone: '0900000041', base_salary: 6000000,
    }).select('id').single();
    ktvBId = ktvB!.id;

    const { data: session } = await supabase.from('session_logs').insert({
      booking_id: 'test-booking-concurrent',
      session_number: 1,
      assigned_date: new Date().toISOString().split('T')[0],
      status: 'scheduled',
      tenant_id: testTenantId,
    }).select('id').single();
    sessionId = session!.id;
  });

  it('should prevent double completion via optimistic locking', async () => {
    // KTV A and KTV B both try to complete the session simultaneously
    const completionPromises = [
      supabase.from('session_logs').update({
        status: 'completed',
        completed_by_ktv_id: ktvAId,
        completed_date: new Date().toISOString().split('T')[0],
      }).eq('id', sessionId).eq('status', 'scheduled'), // Optimistic lock: only update if still scheduled

      supabase.from('session_logs').update({
        status: 'completed',
        completed_by_ktv_id: ktvBId,
        completed_date: new Date().toISOString().split('T')[0],
      }).eq('id', sessionId).eq('status', 'scheduled'), // Same condition
    ];

    const results = await Promise.all(completionPromises);

    // Only ONE update should succeed (the first one)
    const successCount = results.filter(r => !r.error && r.count === 1).length;
    
    expect(successCount).toBe(1); // Only 1 KTV completes successfully

    console.log('✅ Concurrent completion prevented', { successfulUpdates: successCount });

    // Verify final state
    const { data: finalSession } = await supabase.from('session_logs').select('*').eq('id', sessionId).single();
    expect(finalSession!.status).toBe('completed');
    expect([ktvAId, ktvBId]).toContain(finalSession!.completed_by_ktv_id);

    console.log('✅ Session completed by:', finalSession!.completed_by_ktv_id === ktvAId ? 'KTV A' : 'KTV B');
    console.log('\n🎉 E2E CONCURRENT COMPLETION TEST: PASSED');
  }, 60000);
});
