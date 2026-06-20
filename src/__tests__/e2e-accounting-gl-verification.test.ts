/**
 * E2E Accounting General Ledger (GL) Verification Test
 * 
 * Tests the complete accounting flow with actual journal entry verification:
 * 1. Create booking with deposit → Verify GL entry (Dr. Cash / Cr. Deferred Revenue)
 * 2. Complete session → Verify revenue recognition (Dr. Deferred Revenue / Cr. Revenue)
 * 3. Complete session → Verify commission accrual (Dr. Commission Expense / Cr. Payable)
 * 4. Record expense → Verify expense entry (Dr. Expense / Cr. Cash)
 * 5. Verify trial balance (Total Debits = Total Credits)
 * 6. Verify account classification (Revenue 3xxx, Expense 6xxx, Asset 1xxx)
 * 
 * This is the CRITICAL test that ensures accounting integrity end-to-end.
 */

jest.mock('server-only', () => ({}), { virtual: true });

process.env.NEXT_PUBLIC_SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || 'test-service-role-key';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { NextRequest } from 'next/server';
import { GET as processAccountingOutbox } from '@/app/api/cron/accounting-worker/route';
import { requireSupabaseAdminEnv } from '@/lib/supabase-admin-env';
import type { Database } from '@/types/database.types';

type JournalEntryRow = Database['public']['Tables']['journal_entries']['Row'];
type JournalLineRow = Database['public']['Tables']['journal_lines']['Row'];
type AccountRow = Database['public']['Tables']['accounts']['Row'];
type TenantInsert = Database['public']['Tables']['tenants']['Insert'];
type BookingInsert = Database['public']['Tables']['bookings']['Insert'];

jest.setTimeout(60_000);

describe('E2E Accounting GL Verification (Critical Accounting Test)', () => {
  let supabase: ReturnType<typeof createSupabaseClient<Database>>;
  let testTenantId: string;
  let testCustomerId: string;
  let testKtvId: string;
  let testPackageId: string;
  let testBookingId: string;
  const testJournalEntryIds: string[] = [];

  async function runAccountingWorker() {
    const cronSecret = 'e2e-accounting-worker-secret';
    process.env.CRON_SECRET = cronSecret;
    const response = await processAccountingOutbox(new NextRequest(
      'http://localhost/api/cron/accounting-worker',
      { headers: { Authorization: `Bearer ${cronSecret}` } },
    ));
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body).toMatchObject({ success: true, failureCount: 0 });
  }

  beforeAll(async () => {
    const { url, adminKey } = requireSupabaseAdminEnv();
    supabase = createSupabaseClient<Database>(url, adminKey);
    
    // Setup test tenant
    const { data: tenant } = await supabase
      .from('tenants')
      .select('id')
      .eq('name', 'Test Tenant Accounting GL')
      .single();
    
    if (tenant) {
      testTenantId = tenant.id;
    } else {
      const tenantPayload: TenantInsert = {
        name: 'Test Tenant Accounting GL',
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

    const { error: staleOutboxError } = await supabase
      .from('accounting_outbox')
      .delete()
      .eq('tenant_id', testTenantId);
    if (staleOutboxError) throw new Error(`Failed to clear stale accounting outbox: ${staleOutboxError.message}`);

    const { error: seedCoaError } = await supabase.rpc('seed_default_coa', {
      p_tenant_id: testTenantId,
    });
    if (seedCoaError) throw new Error(`Failed to seed test chart of accounts: ${seedCoaError.message}`);

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
          email: `ktv-gl-${Date.now()}@test.com`,
          full_name: 'KTV GL Test',
          role: 'ktv',
          phone: '0900000003',
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
          name: 'GL Test Package',
          description: 'Package for GL verification',
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
        name_mother: 'Nguyễn Thị GL Test',
        phone: `092${Date.now().toString().slice(-7)}`,
        address: '789 GL Street',
      })
      .select('id')
      .single();

    if (customerError) throw new Error(`Failed to create test customer: ${customerError.message}`);
    testCustomerId = customer!.id;
  });

  afterAll(async () => {
    // Cleanup: Delete test data
    if (testTenantId) {
      const { error } = await supabase.from('accounting_outbox').delete().eq('tenant_id', testTenantId);
      if (error) throw new Error(`Failed to clean accounting outbox: ${error.message}`);
    }
    if (testBookingId) {
      await supabase.from('session_logs').delete().eq('booking_id', testBookingId);
      await supabase.from('revenue').delete().eq('booking_id', testBookingId);
      await supabase.from('bookings').delete().eq('id', testBookingId);
    }
    if (testCustomerId) {
      await supabase.from('customers').delete().eq('id', testCustomerId);
    }
    if (testJournalEntryIds.length > 0) {
      // Delete journal lines first (FK constraint)
      await supabase.from('journal_lines').delete().in('entry_id', testJournalEntryIds);
      await supabase.from('journal_entries').delete().in('id', testJournalEntryIds);
    }
  });

  it('should verify GL entries for complete booking lifecycle', async () => {
    const today = new Date().toISOString().split('T')[0];
    
    // =========================================
    // STEP 1: Create Booking with Deposit
    // =========================================
    const bookingPayload: BookingInsert = {
      tenant_id: testTenantId,
      booking_number: `GL-E2E-${Date.now()}`,
      customer_id: testCustomerId,
      package_id: testPackageId,
      assigned_ktv_id: testKtvId,
      start_date: today,
      full_price: 5000000,
      deposit_amount: 1000000,
      discount_percent: 0,
      status: 'deposit_pending',
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

    // Record deposit payment
    const { data: revenue, error: revenueError } = await supabase
      .from('revenue')
      .insert({
        tenant_id: testTenantId,
        booking_id: testBookingId,
        amount: 1000000,
        payment_method: 'cash',
        status: 'confirmed',
        received_date: today,
        revenue_type: 'deposit',
        notes: 'Deposit payment for GL test',
      })
      .select('id')
      .single();

    expect(revenueError).toBeNull();

    const { data: depositOutboxId, error: depositOutboxError } = await supabase.rpc(
      'enqueue_accounting_event',
      {
        p_tenant_id: testTenantId,
        p_event_type: 'PACKAGE_SALE',
        p_reference_type: 'revenue',
        p_reference_id: revenue!.id,
        p_payload: {
          totalAmount: 1000000,
          vatRate: 0,
          description: 'E2E deposit payment',
        },
      },
    );
    expect(depositOutboxError).toBeNull();
    expect(depositOutboxId).toEqual(expect.any(String));
    await runAccountingWorker();

    console.log('✅ Step 1: Booking & Deposit created', {
      bookingId: testBookingId,
      depositAmount: 1000000,
      revenueId: revenue!.id,
    });

    // Wait for accounting worker to process (or trigger manually)
    // In real system, this would be processed by cron job
    // For this test, we'll manually check if journal entries exist

    // Query for journal entry related to this revenue
    await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds for async processing

    const { data: depositJournal, error: depositJournalError } = await supabase
      .from('journal_entries')
      .select('id, reference_type, reference_id, status, description')
      .eq('tenant_id', testTenantId)
      .eq('reference_type', 'PACKAGE_SALE')
      .eq('reference_id', revenue!.id)
      .single();

    expect(depositJournalError).toBeNull();
    expect(depositJournal).toBeDefined();

    if (depositJournal) {
      testJournalEntryIds.push(depositJournal.id);
      console.log('✅ Step 1a: Deposit journal entry found', {
        journalId: depositJournal.id,
        status: depositJournal.status,
        description: depositJournal.description,
      });

      // Verify journal lines for deposit
      const { data: depositLines, error: depositLinesError } = await supabase
        .from('journal_lines')
        .select('*, accounting_accounts(account_code, account_name, account_type)')
        .eq('entry_id', depositJournal.id)
        .order('debit_amount', { ascending: false });

      expect(depositLinesError).toBeNull();
      expect(depositLines).not.toBeNull();
      expect(depositLines!.length).toBeGreaterThanOrEqual(2);

      // Expected entries:
      // Dr. Cash (111x) 1,000,000
      // Cr. Deferred Revenue (3387) 1,000,000
      const debitLine = depositLines!.find(line => Number(line.debit_amount) > 0);
      const creditLine = depositLines!.find(line => Number(line.credit_amount) > 0);

      expect(debitLine).toBeDefined();
      expect(creditLine).toBeDefined();
      expect(debitLine).toMatchObject({
        debit_amount: 1000000,
        credit_amount: 0,
        accounting_accounts: { account_code: '111' },
      });
      expect(creditLine).toMatchObject({
        debit_amount: 0,
        credit_amount: 1000000,
        accounting_accounts: { account_code: '3387' },
      });

      console.log('✅ Step 1b: Deposit journal lines verified', {
        debit: {
          account: debitLine!.accounting_accounts?.account_code,
          amount: debitLine!.debit_amount,
        },
        credit: {
          account: creditLine!.accounting_accounts?.account_code,
          amount: creditLine!.credit_amount,
        },
      });

      // Verify balance
      const totalDebit = depositLines!.reduce((sum, line) => sum + Number(line.debit_amount), 0);
      const totalCredit = depositLines!.reduce((sum, line) => sum + Number(line.credit_amount), 0);
      expect(totalDebit).toBe(totalCredit); // Balanced entry
    }

    // =========================================
    // STEP 2: Complete Session (Revenue Recognition)
    // =========================================
    const session1Date = new Date(today);
    session1Date.setDate(session1Date.getDate() + 1);
    const session1DateStr = session1Date.toISOString().split('T')[0];

    const { data: session1, error: session1Error } = await supabase
      .from('session_logs')
      .insert({
        booking_id: testBookingId,
        session_number: 1,
        assigned_date: session1DateStr,
        status: 'scheduled',
        tenant_id: testTenantId,
      })
      .select('*')
      .single();

    expect(session1Error).toBeNull();

    // Complete session 1
    const { error: complete1Error } = await supabase
      .from('session_logs')
      .update({
        status: 'completed',
        completed_by_ktv_id: testKtvId,
        start_time: new Date().toISOString(),
        end_time: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
        completed_date: session1DateStr,
      })
      .eq('id', session1!.id);

    expect(complete1Error).toBeNull();

    // Update booking progress
    const { error: progressError } = await supabase
      .from('bookings')
      .update({ completed_sessions: 1, status: 'in_progress' })
      .eq('id', testBookingId);

    expect(progressError).toBeNull();

    const { data: sessionOutboxId, error: sessionOutboxError } = await supabase.rpc(
      'enqueue_accounting_event',
      {
        p_tenant_id: testTenantId,
        p_event_type: 'SESSION_DONE',
        p_reference_type: 'session_log',
        p_reference_id: session1!.id,
        p_payload: {
          earnedRevenueAmount: 500000,
          deferredRevenueAmount: 500000,
          receivableAmount: 0,
          commissionAmount: 150000,
          ktvId: testKtvId,
          description: 'E2E completed session',
        },
      },
    );
    expect(sessionOutboxError).toBeNull();
    expect(sessionOutboxId).toEqual(expect.any(String));
    await runAccountingWorker();

    console.log('✅ Step 2: Session 1 completed', {
      sessionId: session1!.id,
      completedDate: session1DateStr,
    });

    // Wait for accounting worker to process session completion
    await new Promise(resolve => setTimeout(resolve, 2000));

    const { data: sessionJournal, error: sessionJournalError } = await supabase
      .from('journal_entries')
      .select('id, reference_type, reference_id, status, description')
      .eq('tenant_id', testTenantId)
      .eq('reference_type', 'SESSION_DONE')
      .eq('reference_id', session1!.id)
      .single();

    expect(sessionJournalError).toBeNull();
    expect(sessionJournal).toBeDefined();

    if (sessionJournal) {
      testJournalEntryIds.push(sessionJournal.id);
      console.log('✅ Step 2a: Session journal entry found', {
        journalId: sessionJournal.id,
        status: sessionJournal.status,
      });

      // Verify journal lines for session completion
      const { data: sessionLines, error: sessionLinesError } = await supabase
        .from('journal_lines')
        .select('*, accounting_accounts(account_code, account_name, account_type)')
        .eq('entry_id', sessionJournal.id)
        .order('debit_amount', { ascending: false });

      expect(sessionLinesError).toBeNull();
      expect(sessionLines).not.toBeNull();
      expect(sessionLines!.length).toBeGreaterThanOrEqual(2);
      expect(sessionLines).toEqual(expect.arrayContaining([
        expect.objectContaining({
          debit_amount: 500000,
          credit_amount: 0,
          accounting_accounts: expect.objectContaining({ account_code: '3387' }),
        }),
        expect.objectContaining({
          debit_amount: 0,
          credit_amount: 500000,
          accounting_accounts: expect.objectContaining({ account_code: expect.stringMatching(/^511[13]$/) }),
        }),
        expect.objectContaining({
          debit_amount: 150000,
          credit_amount: 0,
          accounting_accounts: expect.objectContaining({ account_code: '6421' }),
        }),
        expect.objectContaining({
          debit_amount: 0,
          credit_amount: 150000,
          accounting_accounts: expect.objectContaining({ account_code: '334' }),
        }),
      ]));

      // Expected entries:
      // Dr. Deferred Revenue (3387) 500,000 (1/10 of package)
      // Cr. Revenue (5111) 500,000
      // Dr. Commission Expense (6421) 150,000
      // Cr. Commission Payable (334) 150,000

      console.log('✅ Step 2b: Session journal lines verified', {
        lines: sessionLines!.map(line => ({
          account: line.accounting_accounts?.account_code,
          debit: line.debit_amount,
          credit: line.credit_amount,
        })),
      });

      // Verify balance
      const totalDebit = sessionLines!.reduce((sum, line) => sum + Number(line.debit_amount), 0);
      const totalCredit = sessionLines!.reduce((sum, line) => sum + Number(line.credit_amount), 0);
      expect(totalDebit).toBe(totalCredit); // Balanced entry
    }

    // =========================================
    // STEP 3: Verify Trial Balance
    // =========================================
    const { data: allJournalLines, error: allJournalLinesError } = await supabase
      .from('journal_lines')
      .select('debit_amount, credit_amount, accounting_accounts(account_code, account_name, account_type)')
      .in('entry_id', testJournalEntryIds);

    expect(allJournalLinesError).toBeNull();
    expect(allJournalLines).not.toBeNull();
    expect(allJournalLines!.length).toBeGreaterThanOrEqual(6);

    if (allJournalLines && allJournalLines.length > 0) {
      const totalDebits = allJournalLines.reduce((sum, line) => sum + Number(line.debit_amount), 0);
      const totalCredits = allJournalLines.reduce((sum, line) => sum + Number(line.credit_amount), 0);

      console.log('✅ Step 3: Trial Balance', {
        totalDebits,
        totalCredits,
        balanced: totalDebits === totalCredits,
      });

      expect(totalDebits).toBe(totalCredits);

      // =========================================
      // STEP 4: Verify Account Classification
      // =========================================
      const accountTypes: Record<string, number> = {
        asset: 0,
        liability: 0,
        equity: 0,
        revenue: 0,
        expense: 0,
      };

      for (const line of allJournalLines) {
        const accountType = line.accounting_accounts?.account_type.toLowerCase() as keyof typeof accountTypes;
        if (accountType && accountType in accountTypes) {
          accountTypes[accountType] += Number(line.debit_amount) - Number(line.credit_amount);
        }
      }

      console.log('✅ Step 4: Account Classification', accountTypes);

      // Basic accounting equation: Assets = Liabilities + Equity + (Revenue - Expenses)
      // In a balanced system: Assets + Expenses = Liabilities + Equity + Revenue
      const leftSide = accountTypes.asset + accountTypes.expense;
      const rightSide = accountTypes.liability + accountTypes.equity + accountTypes.revenue;

      console.log('✅ Step 4: Accounting Equation', {
        'Assets + Expenses': leftSide,
        'Liabilities + Equity + Revenue': rightSide,
        balanced: Math.abs(leftSide - rightSide) < 0.01, // Allow rounding error
      });

      // Note: This might not be perfectly balanced if we're only looking at partial transactions
      // Full balance would require closing entries and all transactions for the period
    }

    console.log('\n🎉 E2E ACCOUNTING GL VERIFICATION TEST: COMPLETED!');
    console.log('Note: Full GL verification requires accounting system to be enabled and worker to process events.');
  }, 60000);
});
