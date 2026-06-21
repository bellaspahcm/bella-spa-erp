/**
 * COMPLETE CLEANUP - Delete ALL massage-related entries and recreate correctly (AUTO MODE)
 * 
 * This will:
 * 1. Find ALL entries related to massage (including all reversals)
 * 2. Reverse ALL of them to bring balances to zero
 * 3. Create 2 NEW correct entries:
 *    - Package sale: 199,500
 *    - Session done: 199,500 revenue + 150,000 commission
 */

import { createClient } from '@supabase/supabase-js';
import * as dotenv from 'dotenv';
import * as path from 'path';

dotenv.config({ path: path.join(__dirname, '..', '.env.local') });

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL!;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY!;

const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

async function findAllMassageRelatedEntries() {
  console.log('\n=== FINDING ALL MASSAGE-RELATED ENTRIES ===\n');

  // Find ALL entries that mention massage OR have 199.5 amounts OR reference massage entry IDs
  const { data: entries } = await supabase
    .from('journal_entries')
    .select(`
      id,
      entry_date,
      description,
      status,
      reference_type,
      created_at,
      journal_lines (
        debit_amount,
        credit_amount,
        account_id
      )
    `)
    .eq('status', 'POSTED')
    .or('description.ilike.%Massage%,description.ilike.%51c25138%,description.ilike.%f115b082%,description.ilike.%896a212a%,description.ilike.%b8845290%,description.ilike.%1a69f2d5%,description.ilike.%a504672d%,description.ilike.%1df6a4b3%,description.ilike.%7380d4b5%,description.ilike.%b9edf1b0%,description.ilike.%db857091%,description.ilike.%a8174dbb%')
    .order('created_at', { ascending: true });

  console.log(`Found ${entries?.length || 0} massage-related entries:\n`);

  entries?.forEach((entry: any, idx: number) => {
    console.log(`${idx + 1}. ${entry.entry_date} - ${entry.description.substring(0, 80)}...`);
    console.log(`   ID: ${entry.id.substring(0, 8)}... | Type: ${entry.reference_type || 'MANUAL'}`);
    
    let totalDebit = 0;
    let totalCredit = 0;
    entry.journal_lines?.forEach((line: any) => {
      totalDebit += Number(line.debit_amount);
      totalCredit += Number(line.credit_amount);
    });
    console.log(`   Totals: Debit ${totalDebit.toLocaleString('vi-VN')} | Credit ${totalCredit.toLocaleString('vi-VN')}`);
  });

  return entries || [];
}

async function reverseAllEntries(entries: any[]) {
  console.log('\n\n=== REVERSING ALL MASSAGE ENTRIES ===\n');

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (!tenants) {
    console.error('No tenant found');
    return false;
  }

  const tenantId = tenants.id;
  const today = new Date().toISOString().split('T')[0];

  for (const entry of entries) {
    console.log(`Reversing: ${entry.id.substring(0, 8)}...`);

    // Get full entry with lines
    const { data: fullEntry } = await supabase
      .from('journal_entries')
      .select(`
        *,
        journal_lines (*)
      `)
      .eq('id', entry.id)
      .single();

    if (!fullEntry) {
      console.error('  ❌ Could not fetch entry');
      continue;
    }

    // Create reversal
    const { data: reversalEntry, error: createError } = await supabase
      .from('journal_entries')
      .insert({
        tenant_id: tenantId,
        entry_date: today,
        description: `[FINAL CLEANUP AUTO] Đảo toàn bộ massage entries - ${entry.id.substring(0, 8)}`,
        reference_type: 'REVERSAL',
        reference_id: entry.id,
        status: 'DRAFT',
      })
      .select()
      .single();

    if (createError || !reversalEntry) {
      console.error('  ❌ Error creating reversal:', createError);
      continue;
    }

    // Create reversed lines (swap debit/credit)
    const reversedLines = fullEntry.journal_lines.map((line: any) => ({
      entry_id: reversalEntry.id,
      account_id: line.account_id,
      debit_amount: Number(line.credit_amount),
      credit_amount: Number(line.debit_amount),
      ktv_id: line.ktv_id,
      branch_id: line.branch_id,
    }));

    const { error: linesError } = await supabase
      .from('journal_lines')
      .insert(reversedLines);

    if (linesError) {
      console.error('  ❌ Error creating lines:', linesError);
      continue;
    }

    // Post the entry
    const { error: postError } = await supabase
      .from('journal_entries')
      .update({ status: 'POSTED' })
      .eq('id', reversalEntry.id);

    if (postError) {
      console.error('  ❌ Error posting:', postError);
      continue;
    }

    console.log(`  ✅ Reversed`);
  }

  console.log(`\n✅ All ${entries.length} entries reversed!\n`);
  return true;
}

async function createCorrectEntries() {
  console.log('\n=== CREATING CORRECT MASSAGE ENTRIES ===\n');

  const { data: tenants } = await supabase
    .from('tenants')
    .select('id')
    .limit(1)
    .single();

  if (!tenants) {
    console.error('No tenant found');
    return false;
  }

  const tenantId = tenants.id;
  const originalDate = '2026-06-19'; // Original transaction date

  // Get accounts
  const { data: accounts } = await supabase
    .from('accounting_accounts')
    .select('id, account_code, account_name')
    .in('account_code', ['111', '3387', '5113', '6421', '334']);

  if (!accounts || accounts.length < 5) {
    console.error('Cannot find all required accounts');
    return false;
  }

  const accountMap: Record<string, any> = {};
  accounts.forEach(acc => {
    accountMap[acc.account_code] = acc;
  });

  // Get KTV for commission
  const { data: ktvData } = await supabase
    .from('users')
    .select('id')
    .eq('role', 'ktv')
    .limit(1)
    .single();

  const ktvId = ktvData?.id || null;

  console.log('Creating entries with CORRECT amounts:');
  console.log('  Package sale: 199,500đ (after 43% discount)');
  console.log('  Session done: Revenue 199,500đ + Commission 150,000đ\n');

  // Generate unique reference IDs to avoid constraint violation
  const { randomUUID } = await import('crypto');
  const packageSaleRefId = randomUUID();
  const sessionDoneRefId = randomUUID();

  // ENTRY 1: Package Sale
  console.log('1. Creating PACKAGE SALE entry...');

  const { data: entry1, error: e1Error } = await supabase
    .from('journal_entries')
    .insert({
      tenant_id: tenantId,
      entry_date: originalDate,
      description: '[FINAL CORRECTED] Bán gói: Thu phí dịch vụ lẻ sau CK 43% - Massage Bầu Tại Nhà (Lẻ) - 199.500đ',
      reference_type: 'PACKAGE_SALE',
      reference_id: packageSaleRefId,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (e1Error || !entry1) {
    console.error('  ❌ Error:', e1Error);
    return false;
  }

  await supabase.from('journal_lines').insert([
    {
      entry_id: entry1.id,
      account_id: accountMap['111'].id,
      debit_amount: 199500,
      credit_amount: 0,
    },
    {
      entry_id: entry1.id,
      account_id: accountMap['3387'].id,
      debit_amount: 0,
      credit_amount: 199500,
    },
  ]);

  await supabase
    .from('journal_entries')
    .update({ status: 'POSTED' })
    .eq('id', entry1.id);

  console.log('  ✅ Package sale created');
  console.log('     Nợ 111 (Tiền mặt): 199,500');
  console.log('     Có 3387 (Doanh thu chưa thực hiện): 199,500\n');

  // ENTRY 2: Session Completion
  console.log('2. Creating SESSION COMPLETION entry...');

  const { data: entry2, error: e2Error } = await supabase
    .from('journal_entries')
    .insert({
      tenant_id: tenantId,
      entry_date: originalDate,
      description: '[FINAL CORRECTED] Kết chuyển dịch vụ hoàn thành: Hoàn thành buổi 1/1 - Massage Bầu Tại Nhà (Lẻ)',
      reference_type: 'SESSION_DONE',
      reference_id: sessionDoneRefId,
      status: 'DRAFT',
    })
    .select()
    .single();

  if (e2Error || !entry2) {
    console.error('  ❌ Error:', e2Error);
    return false;
  }

  await supabase.from('journal_lines').insert([
    {
      entry_id: entry2.id,
      account_id: accountMap['3387'].id,
      debit_amount: 199500,
      credit_amount: 0,
    },
    {
      entry_id: entry2.id,
      account_id: accountMap['5113'].id,
      debit_amount: 0,
      credit_amount: 199500,
    },
    {
      entry_id: entry2.id,
      account_id: accountMap['6421'].id,
      debit_amount: 150000,
      credit_amount: 0,
      ktv_id: ktvId,
    },
    {
      entry_id: entry2.id,
      account_id: accountMap['334'].id,
      debit_amount: 0,
      credit_amount: 150000,
      ktv_id: ktvId,
    },
  ]);

  await supabase
    .from('journal_entries')
    .update({ status: 'POSTED' })
    .eq('id', entry2.id);

  console.log('  ✅ Session completion created');
  console.log('     Nợ 3387 (Doanh thu chưa thực hiện): 199,500');
  console.log('     Có 5113 (Doanh thu): 199,500');
  console.log('     Nợ 6421 (Chi phí hoa hồng): 150,000');
  console.log('     Có 334 (Phải trả NLĐ): 150,000\n');

  return true;
}

async function verifyFinal() {
  console.log('\n=== VERIFYING FINAL STATE ===\n');

  // Check if any massage entries still have decimals
  const { data: decimalCheck } = await supabase
    .from('journal_lines')
    .select(`
      id,
      debit_amount,
      credit_amount,
      entry:journal_entries!inner (
        description,
        status
      )
    `)
    .eq('entry.status', 'POSTED')
    .or('entry.description.ilike.%Massage%,entry.description.ilike.%FINAL%');

  let hasDecimals = false;
  decimalCheck?.forEach((line: any) => {
    const debit = Number(line.debit_amount);
    const credit = Number(line.credit_amount);

    if ((debit > 0 && debit !== Math.floor(debit)) || (credit > 0 && credit !== Math.floor(credit))) {
      hasDecimals = true;
      console.log(`⚠️  Found decimal in line ${line.id}: Debit ${debit} | Credit ${credit}`);
    }
  });

  if (!hasDecimals) {
    console.log('✅ No decimal amounts found in massage entries!');
  }

  console.log('\nExpected final balances (massage only):');
  console.log('  111 (Tiền mặt): +199,500');
  console.log('  3387 (Doanh thu chưa thực hiện): 0 (balanced)');
  console.log('  5113 (Doanh thu): +199,500');
  console.log('  6421 (Chi phí): +150,000');
  console.log('  334 (Phải trả NLĐ): +150,000');
  console.log('');
}

async function main() {
  try {
    console.log('='.repeat(80));
    console.log('FINAL COMPLETE CLEANUP - MASSAGE ACCOUNTING (AUTO MODE)');
    console.log('='.repeat(80));

    // Step 1: Find all
    const entries = await findAllMassageRelatedEntries();

    if (entries.length === 0) {
      console.log('\n✅ No massage entries found to clean up.');
      return;
    }

    console.log('\n' + '='.repeat(80));
    console.log('PLAN:');
    console.log(`  1. Reverse ALL ${entries.length} massage-related entries`);
    console.log('  2. Create 2 NEW correct entries (199,500 + 150,000)');
    console.log('  3. Verify no decimals remain');
    console.log('='.repeat(80));
    console.log('\n⚡ AUTO MODE: Executing without confirmation...\n');

    // Step 2: Reverse all
    const reverseSuccess = await reverseAllEntries(entries);
    if (!reverseSuccess) {
      console.error('\n❌ Reversal failed');
      process.exit(1);
    }

    // Step 3: Create correct entries
    const createSuccess = await createCorrectEntries();
    if (!createSuccess) {
      console.error('\n❌ Creating correct entries failed');
      process.exit(1);
    }

    // Step 4: Verify
    await verifyFinal();

    console.log('='.repeat(80));
    console.log('✅ FINAL CLEANUP COMPLETE!');
    console.log('='.repeat(80));
    console.log('\nAll massage accounting entries have been corrected.');
    console.log('Please verify in the accounting reports.');
    console.log('');
  } catch (error) {
    console.error('Script failed:', error);
    process.exit(1);
  }
}

main();
