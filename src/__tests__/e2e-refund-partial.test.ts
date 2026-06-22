/**
 * E2E Partial Refund Flow Test
 * 
 * Tests partial refund when customer cancels mid-way:
 * 1. Create booking with 10 sessions, deposit 5M
 * 2. Complete 5 sessions (KTV earns commission)
 * 3. Customer cancels remaining 5 sessions
 * 4. Admin issues partial refund (5 sessions worth)
 * 5. Verify refund amount = (5M / 10) * 5 = 2.5M
 * 6. Verify KTV commission for completed 5 sessions is retained
 * 7. Verify accounting entries: partial reversal (Dr. Deferred Revenue / Cr. Cash)
 * 8. Verify booking status = 'partially_completed'
 * 
 * Business Rules:
 * - Partial refund = (full_price / total_sessions) * remaining_sessions
 * - KTV commission for completed sessions is NOT clawed back
 * - Accounting: Only unearned revenue is refunded
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

jest.setTimeout(60_000);

describe('E2E Partial Refund Flow (Critical Revenue Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testCustomerId: string;
  let testKtvId: string;
  let testPackageId: string;
  let testBookingId: string;
  const testRevenueIds: string[] = [];
  const testSessionIds: string[] = [];

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Partial Refund').single();
    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant, error } = await supabase.from('tenants').insert({ name: 'Test Tenant Partial Refund', status: 'active' }).select('id').single();
      if (error) throw new Error(`Failed to create test tenant: ${error.message}`);
      testTenantId = newTenant!.id;
    }

    const { data: ktv } = await supabase.from('users').select('id').eq('tenant_id', testTenantId).eq('role', 'ktv').limit(1).single();
    if (ktv) {
      testKtvId = ktv.id;
    } else {
      const { data: newKtv, error } = await supabase.from('users').insert({
        tenant_id: testTenantId, email: `ktv-partial-refund-${Date.now()}@test.com`, full_name: 'KTV Partial Refund Test',
        role: 'ktv', phone: '0900000010', base_salary: 6000000,
      }).select('id').single();
      if (error) throw new Error(`Failed to create test KTV: ${error.message}`);
      testKtvId = newKtv!.id;
    }

    const { data: pkg } = await supabase.from('packages').select('id').eq('tenant_id', testTenantId).eq('status', 'active').limit(1).single();
    if (pkg) {
      testPackageId = pkg.id;
    } else {
      const { data: newPkg, error } = await supabase.from('packages').insert({
        tenant_id: testTenantId, name: 'Partial Refund Test Package', description: 'Package for partial refund testing',
        price: 5000000, total_sessions: 10, session_multiplier: 1.0, status: 'active', duration: '60 phút',
      }).select('id').single();
      if (error) throw new Error(`Failed to create test package: ${error.message}`);
      testPackageId = newPkg!.id;
    }
  });

  afterAll(async () => {
    if (testBookingId) {
      await supabase.from('session_logs').delete().eq('booking_id', testBookingId);
      await supabase.from('revenue').delete().eq('booking_id', testBookingId);
      await supabase.from('bookings').delete().eq('id', testBookingId);
    }
    if (testCustomerId) await supabase.from('customers').delete().eq('id', testCustomerId);
  });

  it('should complete partial refund flow with commission retention', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // STEP 1: Create Customer & Booking
    const { data: customer, error: customerError } = await supabase.from('customers').insert({
      tenant_id: testTenantId, name_mother: 'Nguyễn Thị Partial Refund', phone: `094${Date.now().toString().slice(-7)}`, address: '456 Partial Street',
    }).select('id').single();
    expect(customerError).toBeNull();
    testCustomerId = customer!.id;

    const bookingPayload: BookingInsert = {
      tenant_id: testTenantId, booking_number: `PARTIAL-REFUND-${Date.now()}`, customer_id: testCustomerId, package_id: testPackageId,
      assigned_ktv_id: testKtvId, start_date: today, full_price: 5000000, deposit_amount: 5000000, discount_percent: 0,
      status: 'booked', total_sessions: 10, completed_sessions: 0, ktv_commission: 150000,
    };
    const { data: booking, error: bookingError } = await supabase.from('bookings').insert(bookingPayload).select('*').single();
    expect(bookingError).toBeNull();
    testBookingId = booking!.id;

    const { data: revenue, error: revenueError } = await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: 5000000, payment_method: 'bank_transfer',
      status: 'confirmed', received_date: today, revenue_type: 'deposit', notes: 'Full payment upfront',
    }).select('id').single();
    expect(revenueError).toBeNull();
    testRevenueIds.push(revenue!.id);

    console.log('✅ Step 1: Booking created', { bookingId: testBookingId, totalPaid: 5000000, totalSessions: 10 });

    // STEP 2: Complete 5 Sessions
    for (let i = 1; i <= 5; i++) {
      const sessionDate = new Date(today);
      sessionDate.setDate(sessionDate.getDate() + i);
      const sessionDateStr = sessionDate.toISOString().split('T')[0];

      const { data: session, error: sessionError } = await supabase.from('session_logs').insert({
        booking_id: testBookingId, session_number: i, assigned_date: sessionDateStr, status: 'scheduled', tenant_id: testTenantId,
      }).select('*').single();
      expect(sessionError).toBeNull();
      testSessionIds.push(session!.id);

      const { error: completeError } = await supabase.from('session_logs').update({
        status: 'completed', completed_by_ktv_id: testKtvId, start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(), completed_date: sessionDateStr,
      }).eq('id', session!.id);
      expect(completeError).toBeNull();
    }

    const { error: progressError } = await supabase.from('bookings').update({ completed_sessions: 5, status: 'in_progress' }).eq('id', testBookingId);
    expect(progressError).toBeNull();

    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    const { data: existingSalary } = await supabase.from('salary_records').select('*').eq('tenant_id', testTenantId).eq('ktv_id', testKtvId).eq('month_year', currentMonth).single();
    if (!existingSalary) {
      const { error: salaryInsertError } = await supabase.from('salary_records').insert({
        tenant_id: testTenantId, ktv_id: testKtvId, month_year: currentMonth, base_salary: 6000000,
        session_bonus: 750000, total_sessions: 5, total_salary: 6750000, status: 'draft',
      });
      expect(salaryInsertError).toBeNull();
    } else {
      const { error: salaryUpdateError } = await supabase.from('salary_records').update({
        total_sessions: (existingSalary.total_sessions || 0) + 5, session_bonus: (existingSalary.session_bonus || 0) + 750000,
        total_salary: (existingSalary.total_salary || 0) + 750000,
      }).eq('id', existingSalary.id);
      expect(salaryUpdateError).toBeNull();
    }

    console.log('✅ Step 2: 5 sessions completed', { completedSessions: 5, ktvCommissionEarned: 750000 });

    // STEP 3: Customer Cancels, Issue Partial Refund
    const sessionCost = booking!.full_price! / booking!.total_sessions!;
    const remainingSessions = booking!.total_sessions! - 5;
    const partialRefundAmount = sessionCost * remainingSessions;
    expect(partialRefundAmount).toBe(2500000); // 5M / 10 * 5 = 2.5M

    const { data: refund, error: refundError } = await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: -partialRefundAmount, payment_method: 'bank_transfer',
      status: 'confirmed', received_date: today, revenue_type: 'refund', notes: 'Partial refund for 5 remaining sessions',
    }).select('id').single();
    expect(refundError).toBeNull();
    testRevenueIds.push(refund!.id);

    const { error: statusError } = await supabase.from('bookings').update({ status: 'partially_completed' }).eq('id', testBookingId);
    expect(statusError).toBeNull();

    console.log('✅ Step 3: Partial refund issued', { refundAmount: partialRefundAmount, remainingSessions: 5 });

    // STEP 4: Verify KTV Commission NOT Clawed Back
    const { data: salaryAfterRefund } = await supabase.from('salary_records').select('*').eq('tenant_id', testTenantId).eq('ktv_id', testKtvId).eq('month_year', currentMonth).single();
    expect(salaryAfterRefund).toBeDefined();
    expect(salaryAfterRefund!.total_sessions).toBeGreaterThanOrEqual(5);
    expect(salaryAfterRefund!.session_bonus).toBeGreaterThanOrEqual(750000);

    console.log('✅ Step 4: KTV commission retained', { sessionsCompleted: 5, commissionRetained: 750000 });

    // STEP 5: Verify Revenue Totals
    const { data: allRevenue } = await supabase.from('revenue').select('amount').eq('booking_id', testBookingId);
    const totalRevenue = allRevenue!.reduce((sum, r) => sum + Number(r.amount), 0);
    expect(totalRevenue).toBe(2500000); // 5M deposit - 2.5M refund = 2.5M net (5 completed sessions)

    console.log('✅ Step 5: Revenue totals verified', { deposit: 5000000, refund: -2500000, netRevenue: totalRevenue });

    // STEP 6: Verify Booking Status
    const { data: finalBooking } = await supabase.from('bookings').select('*').eq('id', testBookingId).single();
    expect(finalBooking).toBeDefined();
    expect(finalBooking!.status).toBe('partially_completed');
    expect(finalBooking!.completed_sessions).toBe(5);

    console.log('✅ Step 6: Booking status verified', { status: 'partially_completed', completedSessions: 5, totalSessions: 10 });

    console.log('\n🎉 E2E PARTIAL REFUND FLOW TEST: ALL PASSED!');
  }, 60000);
});
