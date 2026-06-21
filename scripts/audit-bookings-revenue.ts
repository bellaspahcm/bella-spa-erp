/**
 * Audit Bookings Revenue vs Accounting Reports
 * 
 * This script:
 * 1. Lists all confirmed bookings in June 2026
 * 2. Calculates total revenue from bookings
 * 3. Queries journal entries for revenue accounts (5113, 5111)
 * 4. Compares bookings revenue vs accounting revenue
 * 5. Identifies discrepancies
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

interface BookingRow {
  id: string;
  customer_name: string;
  package_name: string;
  booking_date: string;
  status: string;
  payment_status: string;
  payment_method: string;
  full_price: number;
  deposit_amount: number;
  total_sessions: number;
  completed_sessions: number;
}

interface JournalEntryRow {
  id: string;
  entry_date: string;
  description: string;
  reference_type: string;
  status: string;
  journal_lines: Array<{
    debit_amount: number;
    credit_amount: number;
    account: {
      account_code: string;
      account_name: string;
    };
  }>;
}

async function getConfirmedBookings() {
  console.log('\n=== CONFIRMED BOOKINGS (June 2026) ===\n');

  const { data: bookings, error } = await supabase
    .from('bookings')
    .select(`
      id,
      booking_number,
      status,
      deposit_amount,
      full_price,
      start_date,
      total_sessions,
      completed_sessions,
      created_at,
      customer:customers (
        name_mother
      )
    `)
    .gte('created_at', '2026-06-01')
    .lt('created_at', '2026-07-01')
    .in('status', ['booked', 'in_progress', 'completed'])
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error fetching bookings:', error);
    return [];
  }

  console.log(`Found ${bookings?.length || 0} confirmed bookings:\n`);

  let totalRevenue = 0;
  let totalDeposit = 0;

  bookings?.forEach((booking: any, idx: number) => {
    const revenue = Number(booking.full_price || 0);
    const deposit = Number(booking.deposit_amount || 0);
    totalRevenue += revenue;
    totalDeposit += deposit;

    console.log(`${idx + 1}. ${booking.created_at?.substring(0, 10)} - ${booking.customer?.name_mother || 'N/A'}`);
    console.log(`   Booking: ${booking.booking_number}`);
    console.log(`   Status: ${booking.status}`);
    console.log(`   Full Price: ${revenue.toLocaleString('vi-VN')}đ | Deposit: ${deposit.toLocaleString('vi-VN')}đ`);
    console.log(`   Sessions: ${booking.completed_sessions}/${booking.total_sessions}`);
    console.log('');
  });

  console.log('─'.repeat(80));
  console.log(`Total Bookings Revenue: ${totalRevenue.toLocaleString('vi-VN')}đ`);
  console.log(`Total Deposits Received: ${totalDeposit.toLocaleString('vi-VN')}đ`);
  console.log('─'.repeat(80));

  return bookings || [];
}

async function getAccountingRevenue() {
  console.log('\n\n=== ACCOUNTING REVENUE (June 2026) ===\n');

  // Get all journal entries in June
  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      description,
      reference_type,
      status,
      journal_lines (
        debit_amount,
        credit_amount,
        account:accounting_accounts (
          account_code,
          account_name
        )
      )
    `)
    .gte('entry_date', '2026-06-01')
    .lt('entry_date', '2026-07-01')
    .eq('status', 'POSTED');

  if (error) {
    console.error('Error fetching journal entries:', error);
    return 0;
  }

  console.log(`Found ${entries?.length || 0} journal entries:\n`);

  let totalRevenueCredit = 0;

  entries?.forEach((entry: any, idx: number) => {
    let hasRevenue = false;
    let entryRevenue = 0;

    // Check if this entry has revenue accounts (5113, 5111)
    entry.journal_lines?.forEach((line: any) => {
      const credit = Number(line.credit_amount || 0);
      const debit = Number(line.debit_amount || 0);

      if (line.account?.account_code === '5113' || line.account?.account_code === '5111') {
        hasRevenue = true;
        // Revenue accounts have credit balance
        entryRevenue += credit - debit;
      }
    });

    if (hasRevenue) {
      console.log(`${idx + 1}. ${entry.entry_date} - ${entry.description.substring(0, 80)}...`);
      console.log(`   Type: ${entry.reference_type || 'MANUAL'} | ID: ${entry.id.substring(0, 8)}...`);
      console.log(`   Revenue: ${entryRevenue.toLocaleString('vi-VN')}đ`);
      totalRevenueCredit += entryRevenue;
      console.log('');
    }
  });

  console.log('─'.repeat(80));
  console.log(`Total Accounting Revenue: ${totalRevenueCredit.toLocaleString('vi-VN')}đ`);
  console.log('─'.repeat(80));

  return totalRevenueCredit;
}

async function getUnearnedRevenue() {
  console.log('\n\n=== UNEARNED REVENUE (Account 3387) ===\n');

  // Get balance of unearned revenue account
  const { data: lines, error } = await supabase
    .from('journal_lines')
    .select(`
      debit_amount,
      credit_amount,
      entry:journal_entries!inner (
        entry_date,
        status
      ),
      account:accounting_accounts!inner (
        account_code,
        account_name
      )
    `)
    .eq('account.account_code', '3387')
    .lte('entry.entry_date', '2026-06-30')
    .eq('entry.status', 'POSTED');

  if (error) {
    console.error('Error fetching unearned revenue:', error);
    return 0;
  }

  let balance = 0;
  lines?.forEach((line: any) => {
    const credit = Number(line.credit_amount || 0);
    const debit = Number(line.debit_amount || 0);
    // Unearned revenue is a liability, has credit balance
    balance += credit - debit;
  });

  console.log(`Account 3387 (Doanh thu chưa thực hiện) Balance: ${balance.toLocaleString('vi-VN')}đ`);
  console.log('(Positive = customer prepaid, service not yet delivered)');

  return balance;
}

async function compareRevenueRecognition() {
  console.log('\n\n=== REVENUE RECOGNITION COMPARISON ===\n');

  // Get session logs for completed sessions
  const { data: sessions, error } = await supabase
    .from('session_logs')
    .select(`
      id,
      completed_date,
      status,
      booking:bookings (
        full_price,
        total_sessions,
        customer:customers (
          name_mother
        )
      )
    `)
    .gte('completed_date', '2026-06-01')
    .lt('completed_date', '2026-07-01')
    .eq('status', 'completed');

  if (error) {
    console.error('Error fetching sessions:', error);
    return;
  }

  console.log(`Found ${sessions?.length || 0} completed sessions in June 2026:\n`);

  let totalSessionRevenue = 0;

  sessions?.forEach((session: any, idx: number) => {
    const booking = session.booking;
    if (!booking) return;

    const revenuePerSession = Number(booking.full_price || 0) / Number(booking.total_sessions || 1);
    totalSessionRevenue += revenuePerSession;

    console.log(`${idx + 1}. ${session.completed_date} - ${booking.customer?.name_mother || 'N/A'}`);
    console.log(`   Revenue recognized: ${revenuePerSession.toLocaleString('vi-VN')}đ (${booking.full_price}/${booking.total_sessions})`);
  });

  console.log('\n' + '─'.repeat(80));
  console.log(`Total Session Revenue (should match accounting): ${totalSessionRevenue.toLocaleString('vi-VN')}đ`);
  console.log('─'.repeat(80));

  return totalSessionRevenue;
}

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('BOOKINGS REVENUE AUDIT vs ACCOUNTING REPORTS');
    console.log('='.repeat(80));

    // Step 1: Get confirmed bookings
    const bookings = await getConfirmedBookings();
    const bookingsRevenue = bookings.reduce((sum: number, b: any) => sum + Number(b.full_price || 0), 0);

    // Step 2: Get accounting revenue
    const accountingRevenue = await getAccountingRevenue();

    // Step 3: Get unearned revenue (prepayments)
    const unearnedRevenue = await getUnearnedRevenue();

    // Step 4: Compare session-based revenue recognition
    const sessionRevenue = await compareRevenueRecognition();

    // Step 5: Summary & Discrepancies
    console.log('\n\n' + '='.repeat(80));
    console.log('SUMMARY & ANALYSIS');
    console.log('='.repeat(80));
    console.log('');
    console.log(`1. Total Bookings (Full Price):       ${bookingsRevenue.toLocaleString('vi-VN')}đ`);
    console.log(`   (All confirmed/in-progress/completed bookings)`);
    console.log('');
    console.log(`2. Accounting Revenue (5113/5111):    ${accountingRevenue.toLocaleString('vi-VN')}đ`);
    console.log(`   (Revenue recognized in journal entries)`);
    console.log('');
    console.log(`3. Unearned Revenue (3387):           ${unearnedRevenue.toLocaleString('vi-VN')}đ`);
    console.log(`   (Customer prepayments not yet earned)`);
    console.log('');
    console.log(`4. Session-based Revenue:             ${(sessionRevenue || 0).toLocaleString('vi-VN')}đ`);
    console.log(`   (Calculated from completed sessions)`);
    console.log('');
    console.log('─'.repeat(80));
    console.log('EXPECTED RELATIONSHIP:');
    console.log('  Bookings Revenue = Accounting Revenue + Unearned Revenue');
    console.log(`  ${bookingsRevenue.toLocaleString('vi-VN')} = ${accountingRevenue.toLocaleString('vi-VN')} + ${unearnedRevenue.toLocaleString('vi-VN')}`);
    console.log(`  ${bookingsRevenue.toLocaleString('vi-VN')} = ${(accountingRevenue + unearnedRevenue).toLocaleString('vi-VN')}`);
    console.log('');

    const discrepancy = bookingsRevenue - (accountingRevenue + unearnedRevenue);
    if (Math.abs(discrepancy) < 1000) {
      console.log(`  ✅ BALANCED (diff: ${discrepancy.toLocaleString('vi-VN')}đ - rounding acceptable)`);
    } else {
      console.log(`  ⚠️  DISCREPANCY: ${discrepancy.toLocaleString('vi-VN')}đ`);
      if (discrepancy > 0) {
        console.log(`     → Bookings show MORE revenue than accounting (${discrepancy.toLocaleString('vi-VN')}đ missing in accounting)`);
      } else {
        console.log(`     → Accounting shows MORE revenue than bookings (${Math.abs(discrepancy).toLocaleString('vi-VN')}đ extra in accounting)`);
      }
    }

    console.log('='.repeat(80));
    console.log('');
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
