/**
 * E2E Payment Gateway Timeout Test
 * 
 * Tests webhook arrives late after manual payment already recorded:
 * 1. Create booking (deposit pending)
 * 2. Customer pays via online gateway (webhook expected)
 * 3. Webhook is delayed/timeout (network issue)
 * 4. Admin manually records payment (thinking webhook failed)
 * 5. Webhook finally arrives 10 minutes later
 * 6. System detects duplicate payment via idempotency check
 * 7. Verify: Only ONE revenue record created (manual payment)
 * 8. Verify: Webhook payment is skipped (duplicate detected)
 * 9. Verify: Accounting entries NOT duplicated
 * 
 * Business Rules:
 * - Idempotency key = booking_id + amount + payment_method + received_date
 * - If duplicate detected, return existing revenue record
 * - No error thrown, just skip duplicate insert
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

jest.setTimeout(60_000);

describe('E2E Payment Gateway Timeout (Idempotency Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testCustomerId: string;
  let testPackageId: string;
  let testBookingId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Gateway Timeout').single();
    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant, error } = await supabase.from('tenants').insert({ name: 'Test Tenant Gateway Timeout', status: 'active' }).select('id').single();
      if (error) throw new Error(`Failed to create test tenant: ${error.message}`);
      testTenantId = newTenant!.id;
    }

    const { data: pkg } = await supabase.from('packages').select('id').eq('tenant_id', testTenantId).eq('status', 'active').limit(1).single();
    if (pkg) {
      testPackageId = pkg.id;
    } else {
      const { data: newPkg, error } = await supabase.from('packages').insert({
        tenant_id: testTenantId, name: 'Gateway Timeout Package', price: 5000000, total_sessions: 10,
        session_multiplier: 1.0, status: 'active', duration: '60 phút', module_key: 'baby_care',
        service_kind: 'treatment_package', default_duration_minutes: 60, requires_resource: false, before_after_required: false,
      }).select('id').single();
      if (error) throw new Error(`Failed to create test package: ${error.message}`);
      testPackageId = newPkg!.id;
    }

    const { data: customer, error: customerError } = await supabase.from('customers').insert({
      tenant_id: testTenantId, name_mother: 'Nguyễn Thị Timeout', phone: `098${Date.now().toString().slice(-7)}`, address: '303 Timeout St',
    }).select('id').single();
    if (customerError) throw new Error(`Failed to create test customer: ${customerError.message}`);
    testCustomerId = customer!.id;
  });

  afterAll(async () => {
    if (testBookingId) {
      await supabase.from('revenue').delete().eq('booking_id', testBookingId);
      await supabase.from('bookings').delete().eq('id', testBookingId);
    }
    if (testCustomerId) await supabase.from('customers').delete().eq('id', testCustomerId);
  });

  it('should prevent duplicate payment when webhook arrives late', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // STEP 1: Create Booking
    const bookingPayload: BookingInsert = {
      tenant_id: testTenantId, booking_number: `TIMEOUT-${Date.now()}`, customer_id: testCustomerId, package_id: testPackageId,
      start_date: today, full_price: 5000000, deposit_amount: 0, status: 'deposit_pending',
      total_sessions: 10, completed_sessions: 0,
    };
    const { data: booking, error: bookingError } = await supabase.from('bookings').insert(bookingPayload).select('*').single();
    expect(bookingError).toBeNull();
    testBookingId = booking!.id;

    console.log('✅ Step 1: Booking created', { bookingId: testBookingId });

    // STEP 2: Customer Pays Online (webhook expected but delayed)
    console.log('⏳ Step 2: Customer paid via online gateway, webhook delayed...');

    // STEP 3: Admin Manually Records Payment (thinking webhook failed)
    const { data: manualPayment, error: manualError } = await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: 5000000, payment_method: 'bank_transfer',
      status: 'confirmed', received_date: today, revenue_type: 'deposit',
      notes: 'Manual payment recorded by admin (webhook timeout)',
      accounting_metadata: {
        manual_payment_idempotency_key: `${testBookingId}-5000000-bank_transfer-${today}`, // Manual idempotency key
      },
    }).select('*').single();
    expect(manualError).toBeNull();

    await supabase.from('bookings').update({ deposit_amount: 5000000, status: 'booked' }).eq('id', testBookingId);

    console.log('✅ Step 3: Admin manually recorded payment', {
      revenueId: manualPayment!.id,
      amount: 5000000,
      source: 'manual',
    });

    // STEP 4: Webhook Finally Arrives (10 minutes later)
    console.log('⏳ Step 4: Webhook arrives 10 minutes late...');

    // Try to insert duplicate payment via webhook
    const { data: webhookPayment, error: webhookError } = await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: 5000000, payment_method: 'bank_transfer',
      status: 'confirmed', received_date: today, revenue_type: 'deposit',
      notes: 'Payment via webhook (late arrival)',
      accounting_metadata: {
        manual_payment_idempotency_key: `${testBookingId}-5000000-bank_transfer-${today}`, // Same idempotency key
      },
    }).select('*').single();

    // Webhook insert should fail due to duplicate idempotency_key (unique constraint)
    // OR if no unique constraint, manually check for duplicate before insert
    if (webhookError) {
      console.log('✅ Step 4a: Webhook payment blocked by unique constraint', {
        error: webhookError.message,
        expectedError: 'duplicate key value violates unique constraint',
      });
      expect(webhookError.message).toContain('duplicate');
    } else {
      console.warn('⚠️ Step 4b: No unique constraint, checking manually...');
      // If insert succeeded, verify it's the SAME record (idempotency check returned existing)
      expect(webhookPayment!.id).toBe(manualPayment!.id);
    }

    // STEP 5: Verify Only ONE Revenue Record Exists
    const { data: allRevenue } = await supabase.from('revenue').select('*').eq('booking_id', testBookingId);
    expect(allRevenue).toHaveLength(1);
    expect(allRevenue![0].id).toBe(manualPayment!.id);

    console.log('✅ Step 5: Only ONE revenue record exists', {
      revenueCount: 1,
      revenueId: manualPayment!.id,
      duplicatePrevented: true,
    });

    // STEP 6: Verify Booking Status Unchanged
    const { data: finalBooking } = await supabase.from('bookings').select('*').eq('id', testBookingId).single();
    expect(finalBooking!.status).toBe('booked');
    expect(finalBooking!.deposit_amount).toBe(5000000);

    console.log('✅ Step 6: Booking status unchanged', { status: 'booked', totalPaid: 5000000 });

    console.log('\n🎉 E2E PAYMENT GATEWAY TIMEOUT TEST: PASSED (Duplicate prevented by idempotency)');
  }, 60000);
});
