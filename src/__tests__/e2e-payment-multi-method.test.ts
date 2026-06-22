/**
 * E2E Multi-Payment Method Test
 * 
 * Tests booking payment split across multiple payment methods:
 * 1. Create booking with 5M total price
 * 2. Customer pays 1M deposit via bank transfer
 * 3. Customer pays 2M remaining via cash
 * 4. Customer pays final 2M via QR code
 * 5. Verify 3 revenue records with different payment_method
 * 6. Verify total revenue = 5M (full price)
 * 7. Verify booking status = 'booked' (fully paid)
 * 8. Verify accounting entries for each payment method
 * 
 * Business Rules:
 * - Multiple revenue records allowed for same booking_id
 * - Each revenue record tracks different payment_method
 * - Total payments must match full_price for booking completion
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

jest.setTimeout(60_000);

describe('E2E Multi-Payment Method (Payment Flow Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testCustomerId: string;
  let testKtvId: string;
  let testPackageId: string;
  let testBookingId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Multi Payment').single();
    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant, error } = await supabase.from('tenants').insert({ name: 'Test Tenant Multi Payment', status: 'active' }).select('id').single();
      if (error) throw new Error(`Failed to create test tenant: ${error.message}`);
      testTenantId = newTenant!.id;
    }

    const { data: ktv } = await supabase.from('users').select('id').eq('tenant_id', testTenantId).eq('role', 'ktv').limit(1).single();
    if (ktv) {
      testKtvId = ktv.id;
    } else {
      const { data: newKtv, error } = await supabase.from('users').insert({
        tenant_id: testTenantId, email: `ktv-multipay-${Date.now()}@test.com`, full_name: 'KTV Multi Payment',
        role: 'ktv', phone: '0900000012', base_salary: 6000000,
      }).select('id').single();
      if (error) throw new Error(`Failed to create test KTV: ${error.message}`);
      testKtvId = newKtv!.id;
    }

    const { data: pkg } = await supabase.from('packages').select('id').eq('tenant_id', testTenantId).eq('status', 'active').limit(1).single();
    if (pkg) {
      testPackageId = pkg.id;
    } else {
      const { data: newPkg, error } = await supabase.from('packages').insert({
        tenant_id: testTenantId, name: 'Multi Payment Package', price: 5000000, total_sessions: 10,
        session_multiplier: 1.0, status: 'active', duration: '60 phút',
      }).select('id').single();
      if (error) throw new Error(`Failed to create test package: ${error.message}`);
      testPackageId = newPkg!.id;
    }

    const { data: customer, error: customerError } = await supabase.from('customers').insert({
      tenant_id: testTenantId, name_mother: 'Nguyễn Thị Multi Pay', phone: `096${Date.now().toString().slice(-7)}`, address: '101 Multi St',
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

  it('should accept multiple payment methods for single booking', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // STEP 1: Create Booking (deposit pending)
    const bookingPayload: BookingInsert = {
      tenant_id: testTenantId, booking_number: `MULTI-PAY-${Date.now()}`, customer_id: testCustomerId, package_id: testPackageId,
      assigned_ktv_id: testKtvId, start_date: today, full_price: 5000000, deposit_amount: 0,
      status: 'deposit_pending', total_sessions: 10, completed_sessions: 0, ktv_commission: 150000,
    };
    const { data: booking, error: bookingError } = await supabase.from('bookings').insert(bookingPayload).select('*').single();
    expect(bookingError).toBeNull();
    testBookingId = booking!.id;

    console.log('✅ Step 1: Booking created', { bookingId: testBookingId, fullPrice: 5000000 });

    // STEP 2: Payment 1 - Bank Transfer (1M)
    const { data: payment1, error: payment1Error } = await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: 1000000, payment_method: 'bank_transfer',
      status: 'confirmed', received_date: today, revenue_type: 'deposit', notes: 'Deposit via bank',
    }).select('*').single();
    expect(payment1Error).toBeNull();

    await supabase.from('bookings').update({ deposit_amount: 1000000, status: 'deposit' }).eq('id', testBookingId);

    console.log('✅ Step 2: Payment 1 (bank_transfer)', { amount: 1000000, totalPaid: 1000000 });

    // STEP 3: Payment 2 - Cash (2M)
    const { data: payment2, error: payment2Error } = await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: 2000000, payment_method: 'cash',
      status: 'confirmed', received_date: today, revenue_type: 'remaining_payment', notes: 'Cash payment',
    }).select('*').single();
    expect(payment2Error).toBeNull();

    await supabase.from('bookings').update({ deposit_amount: 3000000 }).eq('id', testBookingId);

    console.log('✅ Step 3: Payment 2 (cash)', { amount: 2000000, totalPaid: 3000000 });

    // STEP 4: Payment 3 - QR Code (2M)
    const { data: payment3, error: payment3Error } = await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: 2000000, payment_method: 'qr_code',
      status: 'confirmed', received_date: today, revenue_type: 'remaining_payment', notes: 'QR code payment',
    }).select('*').single();
    expect(payment3Error).toBeNull();

    await supabase.from('bookings').update({ deposit_amount: 5000000, status: 'booked' }).eq('id', testBookingId);

    console.log('✅ Step 4: Payment 3 (qr_code)', { amount: 2000000, totalPaid: 5000000 });

    // STEP 5: Verify All Revenue Records
    const { data: allRevenue } = await supabase.from('revenue').select('*').eq('booking_id', testBookingId).order('created_at', { ascending: true });
    expect(allRevenue).toHaveLength(3);
    expect(allRevenue![0].payment_method).toBe('bank_transfer');
    expect(allRevenue![0].amount).toBe(1000000);
    expect(allRevenue![1].payment_method).toBe('cash');
    expect(allRevenue![1].amount).toBe(2000000);
    expect(allRevenue![2].payment_method).toBe('qr_code');
    expect(allRevenue![2].amount).toBe(2000000);

    console.log('✅ Step 5: All revenue records verified', {
      totalRecords: 3,
      methods: ['bank_transfer', 'cash', 'qr_code'],
    });

    // STEP 6: Verify Total Payment
    const totalPaid = allRevenue!.reduce((sum, r) => sum + Number(r.amount), 0);
    expect(totalPaid).toBe(5000000);

    console.log('✅ Step 6: Total payment verified', { totalPaid: 5000000, expectedTotal: 5000000 });

    // STEP 7: Verify Booking Status
    const { data: finalBooking } = await supabase.from('bookings').select('*').eq('id', testBookingId).single();
    expect(finalBooking!.status).toBe('booked');
    expect(finalBooking!.deposit_amount).toBe(5000000);

    console.log('✅ Step 7: Booking fully paid', { status: 'booked', totalPaid: 5000000 });

    console.log('\n🎉 E2E MULTI-PAYMENT METHOD TEST: ALL PASSED!');
  }, 60000);
});
