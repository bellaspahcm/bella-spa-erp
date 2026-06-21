/**
 * COMPREHENSIVE ACCOUNTING AUDIT FOR JUNE 2026
 * 
 * This script will:
 * 1. List ALL journal entries from June 1st onwards
 * 2. Show ALL business transactions (bookings, sessions, packages)
 * 3. Compare accounting entries vs actual business data
 * 4. Identify discrepancies and missing entries
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function auditJournalEntries() {
  console.log('\n' + '='.repeat(80));
  console.log('JOURNAL ENTRIES AUDIT - FROM JUNE 1, 2026');
  console.log('='.repeat(80) + '\n');

  const { data: entries, error } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      description,
      reference_type,
      reference_id,
      status,
      created_at,
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
    .eq('status', 'POSTED')
    .order('entry_date', { ascending: true })
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Error:', error);
    return;
  }

  console.log(`Found ${entries?.length || 0} POSTED journal entries\n`);

  // Group by date and type
  const byDate: Record<string, any[]> = {};
  const byType: Record<string, number> = {};
  const totalsByAccount: Record<string, { debit: number; credit: number }> = {};

  entries?.forEach((entry: any) => {
    const date = entry.entry_date;
    if (!byDate[date]) byDate[date] = [];
    byDate[date].push(entry);

    const type = entry.reference_type || 'MANUAL';
    byType[type] = (byType[type] || 0) + 1;

    entry.journal_lines?.forEach((line: any) => {
      const code = line.account?.account_code || 'Unknown';
      if (!totalsByAccount[code]) {
        totalsByAccount[code] = { debit: 0, credit: 0 };
      }
      totalsByAccount[code].debit += Number(line.debit_amount);
      totalsByAccount[code].credit += Number(line.credit_amount);
    });
  });

  // Print by date
  console.log('ENTRIES BY DATE:\n');
  Object.keys(byDate).sort().forEach(date => {
    console.log(`📅 ${date} (${byDate[date].length} entries)`);
    byDate[date].forEach((entry: any, idx: number) => {
      console.log(`   ${idx + 1}. [${entry.reference_type || 'MANUAL'}] ${entry.description}`);
      console.log(`      ID: ${entry.id.substring(0, 8)}...`);
      
      let totalDebit = 0;
      let totalCredit = 0;
      entry.journal_lines?.forEach((line: any) => {
        totalDebit += Number(line.debit_amount);
        totalCredit += Number(line.credit_amount);
      });
      
      console.log(`      Total: Debit ${totalDebit.toLocaleString('vi-VN')} | Credit ${totalCredit.toLocaleString('vi-VN')}`);
      
      if (Math.abs(totalDebit - totalCredit) > 0.01) {
        console.log(`      ⚠️  UNBALANCED ENTRY!`);
      }
    });
    console.log('');
  });

  // Print by type
  console.log('\nENTRIES BY TYPE:\n');
  Object.entries(byType).forEach(([type, count]) => {
    console.log(`  ${type}: ${count} entries`);
  });

  // Print account totals
  console.log('\n\nACCOUNT TOTALS (Debit | Credit | Net):\n');
  Object.entries(totalsByAccount)
    .sort((a, b) => a[0].localeCompare(b[0]))
    .forEach(([code, totals]) => {
      const net = totals.debit - totals.credit;
      const netLabel = net >= 0 ? 'Debit' : 'Credit';
      console.log(`  ${code}: ${totals.debit.toLocaleString('vi-VN')} | ${totals.credit.toLocaleString('vi-VN')} | ${netLabel} ${Math.abs(net).toLocaleString('vi-VN')}`);
    });
}

async function auditBusinessTransactions() {
  console.log('\n\n' + '='.repeat(80));
  console.log('BUSINESS TRANSACTIONS AUDIT - FROM JUNE 1, 2026');
  console.log('='.repeat(80) + '\n');

  // 1. Bookings
  console.log('1. BOOKINGS:\n');
  const { data: bookings } = await supabase
    .from('bookings')
    .select(`
      id,
      created_at,
      service_name,
      total_price,
      status,
      customer:customers (
        full_name
      )
    `)
    .gte('created_at', '2026-06-01T00:00:00')
    .order('created_at', { ascending: true });

  console.log(`   Found ${bookings?.length || 0} bookings`);
  bookings?.forEach((b: any, idx: number) => {
    console.log(`   ${idx + 1}. ${b.created_at.substring(0, 10)} - ${b.customer?.full_name}: ${b.service_name} - ${Number(b.total_price).toLocaleString('vi-VN')}đ (${b.status})`);
  });

  // 2. Package Sales
  console.log('\n2. PACKAGE SALES:\n');
  const { data: packages } = await supabase
    .from('customer_packages')
    .select(`
      id,
      created_at,
      package:packages (
        name,
        price
      ),
      sessions_remaining,
      status,
      customer:customers (
        full_name
      )
    `)
    .gte('created_at', '2026-06-01T00:00:00')
    .order('created_at', { ascending: true });

  console.log(`   Found ${packages?.length || 0} package sales`);
  packages?.forEach((p: any, idx: number) => {
    console.log(`   ${idx + 1}. ${p.created_at.substring(0, 10)} - ${p.customer?.full_name}: ${p.package?.name} - ${Number(p.package?.price || 0).toLocaleString('vi-VN')}đ (${p.sessions_remaining} sessions left, ${p.status})`);
  });

  // 3. Session Logs (completed sessions)
  console.log('\n3. COMPLETED SESSIONS:\n');
  const { data: sessions } = await supabase
    .from('session_logs')
    .select(`
      id,
      check_in_time,
      check_out_time,
      status,
      session_type
    `)
    .gte('check_in_time', '2026-06-01T00:00:00')
    .in('status', ['completed', 'checked_out'])
    .order('check_in_time', { ascending: true });

  console.log(`   Found ${sessions?.length || 0} completed sessions`);
  sessions?.forEach((s: any, idx: number) => {
    const date = s.check_in_time?.substring(0, 10) || 'Unknown';
    console.log(`   ${idx + 1}. ${date} - Session ${s.id.substring(0, 8)} (${s.status})`);
  });

  // 4. Expenses
  console.log('\n4. EXPENSES:\n');
  const { data: expenses } = await supabase
    .from('expenses')
    .select(`
      id,
      created_at,
      amount,
      category,
      description,
      status
    `)
    .gte('created_at', '2026-06-01T00:00:00')
    .order('created_at', { ascending: true });

  console.log(`   Found ${expenses?.length || 0} expenses`);
  expenses?.forEach((e: any, idx: number) => {
    console.log(`   ${idx + 1}. ${e.created_at.substring(0, 10)} - ${e.description}: ${Number(e.amount).toLocaleString('vi-VN')}đ (${e.category}, ${e.status})`);
  });
}

async function compareAccountingVsBusiness() {
  console.log('\n\n' + '='.repeat(80));
  console.log('RECONCILIATION: ACCOUNTING VS BUSINESS DATA');
  console.log('='.repeat(80) + '\n');

  // Count entries by reference type
  const { data: entryStats } = await supabase
    .from('journal_entries')
    .select('reference_type, reference_id')
    .gte('entry_date', '2026-06-01')
    .eq('status', 'POSTED');

  const entryTypes: Record<string, Set<string>> = {};
  entryStats?.forEach((e: any) => {
    const type = e.reference_type || 'MANUAL';
    if (!entryTypes[type]) entryTypes[type] = new Set();
    if (e.reference_id) entryTypes[type].add(e.reference_id);
  });

  // Count business transactions
  const { data: bookings } = await supabase
    .from('bookings')
    .select('id')
    .gte('created_at', '2026-06-01T00:00:00');

  const { data: packages } = await supabase
    .from('customer_packages')
    .select('id')
    .gte('created_at', '2026-06-01T00:00:00');

  const { data: sessions } = await supabase
    .from('session_logs')
    .select('id')
    .gte('check_in_time', '2026-06-01T00:00:00')
    .in('status', ['completed', 'checked_out']);

  const { data: expenses } = await supabase
    .from('expenses')
    .select('id, status')
    .gte('created_at', '2026-06-01T00:00:00')
    .in('status', ['approved', 'paid']);

  console.log('BUSINESS TRANSACTIONS vs ACCOUNTING ENTRIES:\n');
  console.log(`  Bookings: ${bookings?.length || 0} transactions`);
  console.log(`    → BOOKING entries in accounting: ${entryTypes['BOOKING']?.size || 0}`);
  if ((bookings?.length || 0) !== (entryTypes['BOOKING']?.size || 0)) {
    console.log(`    ⚠️  MISMATCH! Missing ${(bookings?.length || 0) - (entryTypes['BOOKING']?.size || 0)} entries`);
  }

  console.log(`\n  Package Sales: ${packages?.length || 0} transactions`);
  console.log(`    → PACKAGE_SALE entries in accounting: ${entryTypes['PACKAGE_SALE']?.size || 0}`);
  if ((packages?.length || 0) !== (entryTypes['PACKAGE_SALE']?.size || 0)) {
    console.log(`    ⚠️  MISMATCH! Missing ${(packages?.length || 0) - (entryTypes['PACKAGE_SALE']?.size || 0)} entries`);
  }

  console.log(`\n  Completed Sessions: ${sessions?.length || 0} transactions`);
  console.log(`    → SESSION_DONE entries in accounting: ${entryTypes['SESSION_DONE']?.size || 0}`);
  if ((sessions?.length || 0) !== (entryTypes['SESSION_DONE']?.size || 0)) {
    console.log(`    ⚠️  MISMATCH! Missing ${(sessions?.length || 0) - (entryTypes['SESSION_DONE']?.size || 0)} entries`);
  }

  console.log(`\n  Approved/Paid Expenses: ${expenses?.length || 0} transactions`);
  console.log(`    → EXPENSE entries in accounting: ${entryTypes['EXPENSE']?.size || 0}`);
  if ((expenses?.length || 0) !== (entryTypes['EXPENSE']?.size || 0)) {
    console.log(`    ⚠️  MISMATCH! Missing ${(expenses?.length || 0) - (entryTypes['EXPENSE']?.size || 0)} entries`);
  }

  console.log(`\n  Manual Entries: ${entryTypes['MANUAL']?.size || 0}`);
  console.log(`  Reversal Entries: ${entryTypes['REVERSAL']?.size || 0}`);
}

async function identifyMissingEntries() {
  console.log('\n\n' + '='.repeat(80));
  console.log('IDENTIFYING MISSING ACCOUNTING ENTRIES');
  console.log('='.repeat(80) + '\n');

  // Find packages without accounting entries
  const { data: packagesAll } = await supabase
    .from('customer_packages')
    .select('id, created_at, package:packages(name, price), customer:customers(full_name)')
    .gte('created_at', '2026-06-01T00:00:00')
    .order('created_at', { ascending: true });

  const { data: packageEntries } = await supabase
    .from('journal_entries')
    .select('reference_id')
    .eq('reference_type', 'PACKAGE_SALE')
    .eq('status', 'POSTED');

  const packageEntryIds = new Set(packageEntries?.map(e => e.reference_id) || []);

  const missingPackages = packagesAll?.filter(p => !packageEntryIds.has(p.id)) || [];

  if (missingPackages.length > 0) {
    console.log(`⚠️  Found ${missingPackages.length} packages WITHOUT accounting entries:\n`);
    missingPackages.forEach((p: any, idx: number) => {
      console.log(`   ${idx + 1}. ${p.created_at.substring(0, 10)} - ${p.customer?.full_name}: ${p.package?.name} (${Number(p.package?.price || 0).toLocaleString('vi-VN')}đ)`);
      console.log(`      Package ID: ${p.id}`);
    });
  } else {
    console.log('✅ All packages have accounting entries\n');
  }

  // Find completed sessions without accounting entries
  const { data: sessionsAll } = await supabase
    .from('session_logs')
    .select('id, check_in_time, status')
    .gte('check_in_time', '2026-06-01T00:00:00')
    .in('status', ['completed', 'checked_out'])
    .order('check_in_time', { ascending: true });

  const { data: sessionEntries } = await supabase
    .from('journal_entries')
    .select('reference_id')
    .eq('reference_type', 'SESSION_DONE')
    .eq('status', 'POSTED');

  const sessionEntryIds = new Set(sessionEntries?.map(e => e.reference_id) || []);

  const missingSessions = sessionsAll?.filter(s => !sessionEntryIds.has(s.id)) || [];

  if (missingSessions.length > 0) {
    console.log(`\n⚠️  Found ${missingSessions.length} completed sessions WITHOUT accounting entries:\n`);
    missingSessions.forEach((s: any, idx: number) => {
      console.log(`   ${idx + 1}. ${s.check_in_time?.substring(0, 10)} - Session ${s.id.substring(0, 8)}`);
    });
  } else {
    console.log('\n✅ All completed sessions have accounting entries');
  }
}

async function main() {
  try {
    console.log('\n');
    console.log('█'.repeat(80));
    console.log('██                  COMPREHENSIVE ACCOUNTING AUDIT                         ██');
    console.log('██                        JUNE 2026 DATA REVIEW                            ██');
    console.log('█'.repeat(80));

    await auditJournalEntries();
    await auditBusinessTransactions();
    await compareAccountingVsBusiness();
    await identifyMissingEntries();

    console.log('\n\n' + '='.repeat(80));
    console.log('AUDIT COMPLETE');
    console.log('='.repeat(80));
    console.log('\nReview the output above to identify discrepancies between');
    console.log('accounting entries and actual business transactions.');
    console.log('');
  } catch (error) {
    console.error('Audit failed:', error);
    process.exit(1);
  }
}

main();
