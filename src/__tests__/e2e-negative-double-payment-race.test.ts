/**
 * E2E Double Payment Race Condition Test - Customer pays twice within 1 second
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

jest.setTimeout(60_000);

import crypto from 'crypto';

describe('E2E Double Payment Race Condition', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testCustomerId: string;
  let testPackageId: string;
  let bookingId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Double Payment Tenant').single();
    testTenantId = tenant?.id || (await supabase.from('tenants').insert({ name: 'Test Double Payment Tenant', status: 'active' }).select('id').single()).data!.id;

    // Create test customer
    testCustomerId = crypto.randomUUID();
    await supabase.from('customers').insert({
      id: testCustomerId,
      tenant_id: testTenantId,
      name_mother: 'Customer Double Payment Test',
      phone: `095${Date.now().toString().slice(-7)}`,
      status: 'active',
    });

    // Create test package
    testPackageId = crypto.randomUUID();
    await supabase.from('packages').insert({
      id: testPackageId,
      tenant_id: testTenantId,
      name: 'Double Payment Test Package',
      full_price: 5000000,
      total_sessions: 10,
      status: 'active',
      module_key: 'baby_care',
      service_kind: 'treatment_package',
      default_duration_minutes: 90,
      requires_resource: false,
      before_after_required: false,
    });

    const { data: booking } = await supabase.from('bookings').insert({
      tenant_id: testTenantId, booking_number: `DOUBLE-PAY-${Date.now()}`,
      customer_id: testCustomerId, package_id: testPackageId,
      start_date: '2026-06-20', full_price: 5000000, status: 'deposit_pending',
    }).select('id').single();
    bookingId = booking!.id;
  });

  afterAll(async () => {
    if (testTenantId) {
      await supabase.from('revenue').delete().eq('tenant_id', testTenantId);
      await supabase.from('bookings').delete().eq('tenant_id', testTenantId);
      await supabase.from('packages').delete().eq('tenant_id', testTenantId);
      await supabase.from('customers').delete().eq('tenant_id', testTenantId);
      await supabase.from('tenants').delete().eq('id', testTenantId);
    }
  });

  it('should prevent duplicate payment via idempotency key', async () => {
    const today = new Date().toISOString().split('T')[0];
    const idempotencyKey = `${bookingId}-5000000-cash-${today}`;

    // Customer clicks "Pay" button twice rapidly
    const paymentPromises = [
      supabase.from('revenue').insert({
        tenant_id: testTenantId, booking_id: bookingId, amount: 5000000,
        payment_method: 'cash', status: 'confirmed', received_date: today,
        revenue_type: 'deposit',
        accounting_metadata: { manual_payment_idempotency_key: idempotencyKey },
      }),
      supabase.from('revenue').insert({
        tenant_id: testTenantId, booking_id: bookingId, amount: 5000000,
        payment_method: 'cash', status: 'confirmed', received_date: today,
        revenue_type: 'deposit',
        accounting_metadata: { manual_payment_idempotency_key: idempotencyKey }, // Same key → unique index prevents duplicate
      }),
    ];

    const results = await Promise.all(paymentPromises);

    // Only ONE insert should succeed due to unique constraint on idempotency_key
    const successCount = results.filter(r => !r.error).length;
    const errorCount = results.filter(r => r.error).length;

    expect(successCount).toBe(1);
    expect(errorCount).toBe(1);

    console.log('✅ Double payment prevented by idempotency key', {
      successful: successCount,
      blocked: errorCount,
    });

    // Verify only 1 revenue record exists
    const { data: allRevenue } = await supabase.from('revenue').select('*').eq('booking_id', bookingId);
    expect(allRevenue).toHaveLength(1);

    console.log('✅ Only 1 revenue record created');
    console.log('\n🎉 E2E DOUBLE PAYMENT RACE TEST: PASSED');
  }, 60000);
});
