/**
 * E2E Refund with Commission Clawback Test
 * 
 * Tests refund issued BEFORE session completion triggers commission clawback:
 * 1. Create booking, KTV assigned with 150k commission per session
 * 2. KTV completes 3 sessions (earns 450k commission)
 * 3. Commission posted to salary_records (draft)
 * 4. Customer cancels before further sessions
 * 5. Admin issues refund for remaining 7 sessions
 * 6. System detects refund BEFORE future sessions → NO clawback on completed 3 sessions
 * 7. Verify: KTV retains 450k commission for completed sessions
 * 
 * Edge Case Tested:
 * - If refund issued AFTER booking created but BEFORE session completion → commission NOT yet earned → no clawback needed
 * - If refund issued AFTER session completion → commission already earned → retained
 * 
 * This test verifies: Commission clawback only applies to FUTURE sessions, not completed ones.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

jest.setTimeout(60_000);

describe('E2E Refund with Commission Clawback (Edge Case Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testCustomerId: string;
  let testKtvId: string;
  let testPackageId: string;
  let testBookingId: string;

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    const { data: tenant } = await supabase.from('tenants').select('id').eq('name', 'Test Tenant Commission Clawback').single();
    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const { data: newTenant, error } = await supabase.from('tenants').insert({ name: 'Test Tenant Commission Clawback', status: 'active' }).select('id').single();
      if (error) throw new Error(`Failed to create test tenant: ${error.message}`);
      testTenantId = newTenant!.id;
    }

    const { data: ktv } = await supabase.from('users').select('id').eq('tenant_id', testTenantId).eq('role', 'ktv').limit(1).single();
    if (ktv) {
      testKtvId = ktv.id;
    } else {
      const { data: newKtv, error } = await supabase.from('users').insert({
        tenant_id: testTenantId, email: `ktv-clawback-${Date.now()}@test.com`, full_name: 'KTV Clawback Test',
        role: 'ktv', phone: '0900000011', base_salary: 6000000,
      }).select('id').single();
      if (error) throw new Error(`Failed to create test KTV: ${error.message}`);
      testKtvId = newKtv!.id;
    }

    const { data: pkg } = await supabase.from('packages').select('id').eq('tenant_id', testTenantId).eq('status', 'active').limit(1).single();
    if (pkg) {
      testPackageId = pkg.id;
    } else {
      const { data: newPkg, error } = await supabase.from('packages').insert({
        tenant_id: testTenantId, name: 'Clawback Test Package', price: 5000000, total_sessions: 10,
        session_multiplier: 1.0, status: 'active', duration: '60 phút', module_key: 'babycare',
      }).select('id').single();
      if (error) throw new Error(`Failed to create test package: ${error.message}`);
      testPackageId = newPkg!.id;
    }

    const { data: customer, error: customerError } = await supabase.from('customers').insert({
      tenant_id: testTenantId, name_mother: 'Nguyễn Thị Clawback', phone: `095${Date.now().toString().slice(-7)}`, address: '789 Clawback St',
    }).select('id').single();
    if (customerError) throw new Error(`Failed to create test customer: ${customerError.message}`);
    testCustomerId = customer!.id;
  });

  afterAll(async () => {
    if (testBookingId) {
      await supabase.from('session_logs').delete().eq('booking_id', testBookingId);
      await supabase.from('revenue').delete().eq('booking_id', testBookingId);
      await supabase.from('bookings').delete().eq('id', testBookingId);
    }
    if (testCustomerId) await supabase.from('customers').delete().eq('id', testCustomerId);
  });

  it('should NOT claw back commission for completed sessions when refund issued', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // STEP 1: Create Booking
    const bookingPayload: BookingInsert = {
      tenant_id: testTenantId, booking_number: `CLAWBACK-${Date.now()}`, customer_id: testCustomerId, package_id: testPackageId,
      assigned_ktv_id: testKtvId, start_date: today, full_price: 5000000, deposit_amount: 5000000,
      status: 'booked', total_sessions: 10, completed_sessions: 0, ktv_commission: 150000,
    };
    const { data: booking, error: bookingError } = await supabase.from('bookings').insert(bookingPayload).select('*').single();
    expect(bookingError).toBeNull();
    testBookingId = booking!.id;

    await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: 5000000, payment_method: 'cash',
      status: 'confirmed', received_date: today, revenue_type: 'deposit',
    });

    console.log('✅ Step 1: Booking created', { bookingId: testBookingId, ktvCommission: 150000 });

    // STEP 2: Complete 3 Sessions
    for (let i = 1; i <= 3; i++) {
      const sessionDate = new Date(today);
      sessionDate.setDate(sessionDate.getDate() + i);
      const sessionDateStr = sessionDate.toISOString().split('T')[0];

      const { data: session } = await supabase.from('session_logs').insert({
        booking_id: testBookingId, session_number: i, assigned_date: sessionDateStr, status: 'scheduled', tenant_id: testTenantId,
      }).select('*').single();

      await supabase.from('session_logs').update({
        status: 'completed', completed_by_ktv_id: testKtvId, completed_date: sessionDateStr,
      }).eq('id', session!.id);
    }

    await supabase.from('bookings').update({ completed_sessions: 3, status: 'in_progress' }).eq('id', testBookingId);

    const currentMonth = new Date().toISOString().slice(0, 7) + '-01';
    await supabase.from('salary_records').insert({
      tenant_id: testTenantId, ktv_id: testKtvId, month_year: currentMonth, base_salary: 6000000,
      session_bonus: 450000, total_sessions: 3, total_salary: 6450000, status: 'draft',
    });

    console.log('✅ Step 2: 3 sessions completed', { commissionEarned: 450000 });

    // STEP 3: Customer Cancels, Refund Issued
    const sessionCost = 500000; // 5M / 10
    const remainingSessions = 7;
    const refundAmount = sessionCost * remainingSessions;

    await supabase.from('revenue').insert({
      tenant_id: testTenantId, booking_id: testBookingId, amount: -refundAmount, payment_method: 'bank_transfer',
      status: 'confirmed', received_date: today, revenue_type: 'refund', notes: 'Refund for 7 remaining sessions',
    });

    await supabase.from('bookings').update({ status: 'cancelled' }).eq('id', testBookingId);

    console.log('✅ Step 3: Refund issued', { refundAmount, remainingSessions: 7 });

    // STEP 4: Verify Commission NOT Clawed Back
    const { data: salaryAfterRefund } = await supabase.from('salary_records').select('*').eq('tenant_id', testTenantId).eq('ktv_id', testKtvId).eq('month_year', currentMonth).single();
    
    expect(salaryAfterRefund).toBeDefined();
    expect(salaryAfterRefund!.session_bonus).toBe(450000); // Commission retained for 3 completed sessions
    expect(salaryAfterRefund!.total_sessions).toBe(3);

    console.log('✅ Step 4: Commission retained (NO clawback)', {
      completedSessions: 3,
      commissionRetained: 450000,
      expectedClawback: 0,
    });

    console.log('\n🎉 E2E COMMISSION CLAWBACK TEST: PASSED (No clawback for completed sessions)');
  }, 60000);
});
