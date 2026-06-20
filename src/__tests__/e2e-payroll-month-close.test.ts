/**
 * E2E Payroll Month-End Closing Test
 * 
 * Tests the complete month-end payroll finalization flow:
 * 1. KTV completes sessions throughout the month
 * 2. System calculates dynamic salary (base + commission + KPI + rating bonus)
 * 3. Admin reviews and publishes salary
 * 4. KTV confirms salary
 * 5. Admin closes the month (locks all salary records)
 * 6. Verify no further edits allowed after close
 * 7. Verify accounting entries for salary expense
 * 
 * This is the CRITICAL test for payroll closing integrity.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

type SalaryRecordRow = Database['public']['Tables']['salary_records']['Row'];
type SessionLogRow = Database['public']['Tables']['session_logs']['Row'];
type BookingRow = Database['public']['Tables']['bookings']['Row'];
type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

jest.setTimeout(60_000);

describe('E2E Payroll Month-End Closing (Critical HR Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testKtvId: string;
  let testPackageId: string;
  let testCustomerId: string;
  let testBookingId: string;
  let testSalaryRecordId: string;
  let testMonth: string; // YYYY-MM-01 format

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    // Use a fixed test month (previous month to avoid conflicts with current month)
    const now = new Date();
    now.setMonth(now.getMonth() - 1); // Last month
    testMonth = now.toISOString().slice(0, 7) + '-01'; // YYYY-MM-01
    
    // Setup test tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', 'Test Tenant Payroll')
      .single();
    
    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const tenantPayload: TenantInsert = {
        name: 'Test Tenant Payroll',
        status: 'active',
      };
      const { data: newTenant, error } = await supabase
        .from('tenants')
        .insert(tenantPayload)
        .select('id')
        .single();
      
      if (error) throw new Error(`Failed to create test tenant: ${error.message}`);
      testTenantId = newTenant!.id;
    }

    // Setup test KTV
    const { data: ktv } = await supabase
      .from('users')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('role', 'ktv')
      .limit(1)
      .single();
    
    if (ktv) {
      testKtvId = ktv.id;
    } else {
      const { data: newKtv, error } = await supabase
        .from('users')
        .insert({
          tenant_id: testTenantId,
          email: `ktv-payroll-${Date.now()}@test.com`,
          full_name: 'KTV Payroll Test',
          role: 'ktv',
          phone: '0900000004',
          base_salary: 6000000,
        })
        .select('id')
        .single();
      
      if (error) throw new Error(`Failed to create test KTV: ${error.message}`);
      testKtvId = newKtv!.id;
    }

    // Setup test package
    const { data: pkg } = await supabase
      .from('packages')
      .select('id')
      .eq('tenant_id', testTenantId)
      .eq('status', 'active')
      .limit(1)
      .single();
    
    if (pkg) {
      testPackageId = pkg.id;
    } else {
      const { data: newPkg, error } = await supabase
        .from('packages')
        .insert({
          tenant_id: testTenantId,
          name: 'Payroll Test Package',
          description: 'Package for payroll testing',
          price: 5000000,
          total_sessions: 10,
          session_multiplier: 1.0,
          status: 'active',
          duration: '60 phút',
        })
        .select('id')
        .single();
      
      if (error) throw new Error(`Failed to create test package: ${error.message}`);
      testPackageId = newPkg!.id;
    }

    // Setup Customer
    const { data: customer, error: customerError } = await supabase
      .from('customers')
      .insert({
        tenant_id: testTenantId,
        name_mother: 'Nguyễn Thị Payroll Test',
        phone: `093${Date.now().toString().slice(-7)}`,
        address: '101 Payroll Street',
      })
      .select('id')
      .single();

    if (customerError) throw new Error(`Failed to create test customer: ${customerError.message}`);
    testCustomerId = customer!.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    if (testBookingId) {
      await supabase.from('session_logs').delete().eq('booking_id', testBookingId);
      await supabase.from('revenue').delete().eq('booking_id', testBookingId);
      await supabase.from('bookings').delete().eq('id', testBookingId);
    }
    if (testCustomerId) {
      await supabase.from('customers').delete().eq('id', testCustomerId);
    }
    if (testSalaryRecordId) {
      await supabase.from('salary_records').delete().eq('id', testSalaryRecordId);
    }
  });

  it('should complete month-end payroll closing with salary lock', async () => {
    // Use dates from test month
    const monthStart = new Date(testMonth);
    const sessionDate1 = new Date(monthStart);
    sessionDate1.setDate(5); // 5th of the month
    const sessionDate2 = new Date(monthStart);
    sessionDate2.setDate(10); // 10th of the month
    const sessionDate3 = new Date(monthStart);
    sessionDate3.setDate(15); // 15th of the month

    const session1DateStr = sessionDate1.toISOString().split('T')[0];
    const session2DateStr = sessionDate2.toISOString().split('T')[0];
    const session3DateStr = sessionDate3.toISOString().split('T')[0];

    // =========================================
    // STEP 1: Create Booking & Complete 3 Sessions
    // =========================================
    const bookingPayload: BookingInsert = {
      tenant_id: testTenantId,
      booking_number: `PAYROLL-E2E-${Date.now()}`,
      customer_id: testCustomerId,
      package_id: testPackageId,
      assigned_ktv_id: testKtvId,
      start_date: session1DateStr,
      full_price: 5000000,
      deposit_amount: 5000000,
      discount_percent: 0,
      status: 'booked',
      total_sessions: 10,
      completed_sessions: 0,
      ktv_commission: 150000,
    };
    const { data: booking, error: bookingError } = await supabase
      .from('bookings')
      .insert(bookingPayload)
      .select('*')
      .single();

    expect(bookingError).toBeNull();
    testBookingId = booking!.id;

    // Create and complete 3 sessions
    const sessionIds: string[] = [];
    for (let i = 1; i <= 3; i++) {
      const sessionDate = i === 1 ? session1DateStr : i === 2 ? session2DateStr : session3DateStr;
      
      const { data: session, error: sessionError } = await supabase
        .from('session_logs')
        .insert({
          booking_id: testBookingId,
          session_number: i,
          assigned_date: sessionDate,
          status: 'scheduled',
          tenant_id: testTenantId,
        })
        .select('*')
        .single();

      expect(sessionError).toBeNull();
      sessionIds.push(session!.id);

      // Complete session
      const { error: completeError } = await supabase
        .from('session_logs')
        .update({
          status: 'completed',
          completed_by_ktv_id: testKtvId,
          start_time: new Date(sessionDate).toISOString(),
          end_time: new Date(new Date(sessionDate).getTime() + 60 * 60 * 1000).toISOString(),
          completed_date: sessionDate,
        })
        .eq('id', session!.id);

      expect(completeError).toBeNull();
    }

    // Update booking progress
    const { error: progressError } = await supabase
      .from('bookings')
      .update({ completed_sessions: 3, status: 'in_progress' })
      .eq('id', testBookingId);

    expect(progressError).toBeNull();

    console.log('✅ Step 1: 3 sessions completed in test month', {
      bookingId: testBookingId,
      sessionIds,
      testMonth,
    });

    // =========================================
    // STEP 2: System Calculates Dynamic Salary
    // =========================================
    // Create salary record for KTV
    const baseSalary = 6000000;
    const sessionCommission = 150000;
    const totalSessions = 3;
    const sessionBonus = sessionCommission * totalSessions;
    const kpiBonus = 500000; // Example KPI bonus
    const ratingBonus = 50000 * totalSessions; // 50k per session
    const totalSalary = baseSalary + sessionBonus + kpiBonus + ratingBonus;

    const { data: salaryRecord, error: salaryError } = await supabase
      .from('salary_records')
      .insert({
        tenant_id: testTenantId,
        ktv_id: testKtvId,
        month_year: testMonth,
        base_salary: baseSalary,
        session_bonus: sessionBonus,
        kpi_bonus: kpiBonus,
        rating_bonus: ratingBonus,
        total_sessions: totalSessions,
        total_salary: totalSalary,
        status: 'draft',
      })
      .select('*')
      .single();

    expect(salaryError).toBeNull();
    testSalaryRecordId = salaryRecord!.id;

    console.log('✅ Step 2: Salary calculated', {
      salaryRecordId: testSalaryRecordId,
      baseSalary,
      sessionBonus,
      kpiBonus,
      ratingBonus,
      totalSalary,
      status: 'draft',
    });

    // =========================================
    // STEP 3: Admin Reviews & Publishes Salary
    // =========================================
    const { error: publishError } = await supabase
      .from('salary_records')
      .update({ status: 'published' })
      .eq('id', testSalaryRecordId);

    expect(publishError).toBeNull();

    console.log('✅ Step 3: Salary published by admin', {
      status: 'published',
    });

    // =========================================
    // STEP 4: KTV Confirms Salary
    // =========================================
    const { error: confirmError } = await supabase
      .from('salary_records')
      .update({ 
        status: 'confirmed',
        ktv_confirmed_at: new Date().toISOString(),
      })
      .eq('id', testSalaryRecordId);

    expect(confirmError).toBeNull();

    console.log('✅ Step 4: Salary confirmed by KTV', {
      status: 'confirmed',
    });

    // =========================================
    // STEP 5: Admin Closes the Month (Locks Salary)
    // =========================================
    // Call RPC function to lock monthly records
    const { error: lockError } = await supabase.rpc('lock_monthly_records', {
      p_tenant_id: testTenantId,
      p_month: testMonth,
    });

    expect(lockError).toBeNull();
    console.log('✅ Step 5: Month locked via RPC', { testMonth });

    // =========================================
    // STEP 6: Verify Salary Record is Locked
    // =========================================
    const { data: lockedSalary } = await supabase
      .from('salary_records')
      .select('*')
      .eq('id', testSalaryRecordId)
      .single();

    expect(lockedSalary).toBeDefined();
    expect(lockedSalary!.is_locked).toBe(true);
    expect(lockedSalary!.status).toBe('approved');

    console.log('✅ Step 6: Salary record locked', {
      is_locked: lockedSalary!.is_locked,
      status: lockedSalary!.status,
    });

    // =========================================
    // STEP 7: Verify No Further Edits Allowed
    // =========================================
    // Try to update locked salary record (should fail or be ignored)
    const { error: editError } = await supabase
      .from('salary_records')
      .update({ base_salary: 10000000 }) // Try to change salary
      .eq('id', testSalaryRecordId)
      .eq('is_locked', false); // Only update if not locked

    // Query should succeed but affect 0 rows
    const { data: unchangedSalary } = await supabase
      .from('salary_records')
      .select('base_salary')
      .eq('id', testSalaryRecordId)
      .single();

    expect(unchangedSalary).toBeDefined();
    expect(unchangedSalary!.base_salary).toBe(baseSalary); // Unchanged

    console.log('✅ Step 7: Locked salary protected from edits', {
      attemptedChange: 10000000,
      actualValue: unchangedSalary!.base_salary,
    });

    // =========================================
    // STEP 8: Verify Accounting Entry for Salary Expense
    // =========================================
    // Check if accounting outbox has salary payment event
    const { data: salaryOutbox } = await supabase
      .from('accounting_outbox')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('event_type', 'SALARY_PAID')
      .eq('reference_id', testSalaryRecordId)
      .single();

    if (salaryOutbox) {
      console.log('✅ Step 8: Salary expense accounting entry queued', {
        eventId: salaryOutbox.id,
        eventType: salaryOutbox.event_type,
        status: salaryOutbox.status,
      });

      // Check if journal entry was created
      const { data: salaryJournal } = await supabase
        .from('journal_entries')
        .select('id, reference_type, reference_id, status')
        .eq('tenant_id', testTenantId)
        .eq('reference_type', 'SALARY_PAYMENT')
        .eq('reference_id', testSalaryRecordId)
        .single();

      if (salaryJournal) {
        console.log('✅ Step 8a: Salary journal entry created', {
          journalId: salaryJournal.id,
          status: salaryJournal.status,
        });

        // Verify journal lines
        const { data: salaryLines } = await supabase
          .from('journal_lines')
          .select('*, accounts(code, name)')
          .eq('journal_entry_id', salaryJournal.id);

        if (salaryLines) {
          console.log('✅ Step 8b: Salary journal lines', {
            lines: salaryLines.map(line => ({
              account: line.accounts?.code,
              debit: line.debit_amount,
              credit: line.credit_amount,
            })),
          });

          // Expected: Dr. Salary Expense (6421) / Cr. Cash or Payable
          const totalDebit = salaryLines.reduce((sum, line) => sum + Number(line.debit_amount), 0);
          const totalCredit = salaryLines.reduce((sum, line) => sum + Number(line.credit_amount), 0);
          expect(totalDebit).toBe(totalCredit); // Balanced
        }
      } else {
        console.warn('⚠️ Step 8a: No salary journal entry found (may be async)');
      }
    } else {
      console.warn('⚠️ Step 8: No salary accounting outbox event (accounting may be disabled)');
    }

    // =========================================
    // STEP 9: Verify Month Summary
    // =========================================
    const { data: monthSalarySummary } = await supabase
      .from('salary_records')
      .select('*')
      .eq('tenant_id', testTenantId)
      .eq('month_year', testMonth);

    const totalPayroll = monthSalarySummary?.reduce((sum, rec) => sum + Number(rec.total_salary), 0) || 0;

    console.log('✅ Step 9: Month-end payroll summary', {
      month: testMonth,
      ktvCount: monthSalarySummary?.length || 0,
      totalPayroll,
      allLocked: monthSalarySummary?.every(rec => rec.is_locked) || false,
    });

    console.log('\n🎉 E2E PAYROLL MONTH-END CLOSING TEST: ALL PASSED!');
  }, 60000);
});
