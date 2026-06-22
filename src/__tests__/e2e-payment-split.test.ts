/**
 * E2E Split Payment Test
 * 
 * Tests booking payment split across multiple payers:
 * 1. Create booking with 6M total price
 * 2. Mother pays 2M deposit
 * 3. Father pays 2M remaining
 * 4. Grandmother pays final 2M
 * 5. Verify 3 revenue records with different notes (payer names)
 * 6. Verify total revenue = 6M (full price)
 * 7. Verify all revenue records linked to same booking_id
 * 8. Verify booking status = 'booked' (fully paid)
 * 
 * Business Rules:
 * - Multiple payers allowed for same booking
 * - Each revenue record stores payer info in notes field
 * - System does NOT need separate 'payer_id' field, notes sufficient
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

jest.setTimeout(60_000);

describe('E2E Split Payment (Multiple Payers Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testCustomerId: string;
  let testPackageId: string;
  let testBookingId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Split Payment').single();
    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant, error } = await supabase.from('tenants').insert({ name: 'Test Tenant Split Payment', status: 'active' }).select('id').single();
      if (error) throw new Error(`Failed to create test tenant: ${error.message}`);
      testTenantId = newTenant!.id;
    }

    const { data: pkg } = await supabase.from('packages').select('id').eq('tenant_id', testTenantId).eq('status', 'active').limit(1).single();
    if (pkg) {
      testPackageId = pkg.id;
    } else {
      const { data: newPkg, error } = await supabase.from('packages').insert({
        tenant_id: testTenantId, name: 'Split Payment Package', price: 6000000, total_sessions: 12,
        session_multiplier: 1.0, status: 'active', duration: '60 phút',
      }).select('id').single();
      if (error) throw new Error(`Failed to create test package: ${error.message}`);
      testPackageId = newPkg!.id;
    }

    const { data: customer, error: customerError } = await supabase.from('customers').insert({
      tenant_id: testTenantId, name_mother: 'Nguyễn Thị Thanh', phone: `097${Date.now().toString().slice(-7)}`, address: '202 Family St',
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

  it('should accept split payments from multiple family members', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // STEP 1: Create Booking
    const bookingPayload: BookingInsert = {
      tenant_id: testTenantId, booking_number: `SPLIT-PAY-${Date.now()}`, customer_id: testCustomerId, package_id: testPackageId,
      start_date: today, full_price: 6000000, deposit_amount: 0, status: 'deposit_pending',
      total_sessions: 12, completed_sessions: 0,
    };
    const { data: booking, error: bookingError } = await supabase.from('bookings').insert(bookingPayload).select('*').single();
    expect(bookingError).toBeNull();
    testBookingId = booking!.id;

    console.log('✅ Step 1: Booking created', { bookingId: testBookingId, fullPrice: 6000000 });

    // STEP 2: Mother Pays 2M
    const { error: motherPayError } = await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: 2000000, payment_method: 'bank_transfer',
      status: 'confirmed', received_date: today, revenue_type: 'deposit',
      notes: 'Payer: Mẹ Thanh (Mother) - Deposit 2M',
    });
    expect(motherPayError).toBeNull();

    await supabase.from('bookings').update({ deposit_amount: 2000000, status: 'deposit' }).eq('id', testBookingId);

    console.log('✅ Step 2: Mother paid 2M', { payer: 'Mẹ Thanh', amount: 2000000 });

    // STEP 3: Father Pays 2M
    const { error: fatherPayError } = await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: 2000000, payment_method: 'cash',
      status: 'confirmed', received_date: today, revenue_type: 'remaining_payment',
      notes: 'Payer: Bố Hùng (Father) - Payment 2M',
    });
    expect(fatherPayError).toBeNull();

    await supabase.from('bookings').update({ deposit_amount: 4000000 }).eq('id', testBookingId);

    console.log('✅ Step 3: Father paid 2M', { payer: 'Bố Hùng', amount: 2000000 });

    // STEP 4: Grandmother Pays Final 2M
    const { error: grandmaPayError } = await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: 2000000, payment_method: 'qr_code',
      status: 'confirmed', received_date: today, revenue_type: 'remaining_payment',
      notes: 'Payer: Bà Ngoại Lan (Grandmother) - Final 2M',
    });
    expect(grandmaPayError).toBeNull();

    await supabase.from('bookings').update({ deposit_amount: 6000000, status: 'booked' }).eq('id', testBookingId);

    console.log('✅ Step 4: Grandmother paid 2M', { payer: 'Bà Ngoại Lan', amount: 2000000 });

    // STEP 5: Verify All Revenue Records Linked to Same Booking
    const { data: allRevenue } = await supabase.from('revenue').select('*').eq('booking_id', testBookingId).order('created_at', { ascending: true });
    expect(allRevenue).toHaveLength(3);
    expect(allRevenue!.every(r => r.booking_id === testBookingId)).toBe(true);

    console.log('✅ Step 5: All payments linked to same booking', {
      bookingId: testBookingId,
      paymentCount: 3,
    });

    // STEP 6: Verify Payer Info in Notes
    expect(allRevenue![0].notes).toContain('Mẹ Thanh');
    expect(allRevenue![1].notes).toContain('Bố Hùng');
    expect(allRevenue![2].notes).toContain('Bà Ngoại Lan');

    console.log('✅ Step 6: Payer info verified', {
      payer1: 'Mẹ Thanh (Mother)',
      payer2: 'Bố Hùng (Father)',
      payer3: 'Bà Ngoại Lan (Grandmother)',
    });

    // STEP 7: Verify Total Payment
    const totalPaid = allRevenue!.reduce((sum, r) => sum + Number(r.amount), 0);
    expect(totalPaid).toBe(6000000);

    console.log('✅ Step 7: Total payment verified', { totalPaid: 6000000, expectedTotal: 6000000 });

    // STEP 8: Verify Booking Fully Paid
    const { data: finalBooking } = await supabase.from('bookings').select('*').eq('id', testBookingId).single();
    expect(finalBooking!.status).toBe('booked');
    expect(finalBooking!.deposit_amount).toBe(6000000);

    console.log('✅ Step 8: Booking fully paid by 3 family members', { status: 'booked', totalPaid: 6000000 });

    console.log('\n🎉 E2E SPLIT PAYMENT TEST: ALL PASSED!');
  }, 60000);
});
